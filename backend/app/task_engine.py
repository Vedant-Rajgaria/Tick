"""
TICK Task Optimization & Analytics Engine.

Implements:
1. Backend Stage 2 — Session Reconstruction Algorithm (T_gap = 15m, O(n log n)).
2. Metric Aggregation & Personalized Historical Baseline (z-score anomaly detection).
3. Dynamic Workload Engine (Policy tiers: Low, Normal, High, Overloaded).
4. Constrained Multi-Objective Task Assignment Engine:
   - Hard constraint satisfiability (RequiredSkills ⊆ EmployeeSkills).
   - 4-Signal Feature Extraction: [S_e (Skill), A_e (Availability), E_e (Efficiency), D_e (Deadline)].
   - Weighted Decision Function: B_e = 0.35*S + 0.30*A + 0.20*E + 0.15*D.
   - Non-linear Overload Penalty Curve: P(W_e).
   - Optimal Recommendation: e* = argmax FinalScore_e.
"""
from datetime import date, datetime, timezone, timedelta
import math
from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy import func

from .models import User, Task, ApplicationSession, WorkSession, WorkMetric, Recommendation


# ===========================================================================
# 1. Backend Stage 2 — Session Reconstruction Algorithm
# ===========================================================================

def reconstruct_sessions(events: list[dict], gap_minutes: float = 15.0) -> list[dict]:
    """
    Reconstructs continuous work sessions from discrete activity intervals.
    
    Algorithm:
      1. Sort events chronologically by start_time: O(n log n).
      2. For each consecutive event pair, compute Delta t_i = t_i - t_{i-1}:
         - If Delta t_i <= T_gap (15 min): coalesce into the current session.
         - If Delta t_i > T_gap: finalize current session and initiate a new session boundary.
      3. Compute session-level metrics: total active seconds, idle seconds, span.
    """
    if not events:
        return []

    # Sort chronologically by start_time (O(n log n))
    sorted_events = sorted(
        events,
        key=lambda e: e["start_time"] if isinstance(e["start_time"], datetime) else datetime.fromisoformat(str(e["start_time"]).replace("Z", "+00:00"))
    )

    reconstructed = []
    current_session = None

    for event in sorted_events:
        e_start = event["start_time"] if isinstance(event["start_time"], datetime) else datetime.fromisoformat(str(event["start_time"]).replace("Z", "+00:00"))
        e_end = event["end_time"] if isinstance(event["end_time"], datetime) else datetime.fromisoformat(str(event["end_time"]).replace("Z", "+00:00"))
        active_sec = event.get("active_seconds", event.get("duration_seconds", 0))
        idle_sec = event.get("idle_seconds", 0)

        if current_session is None:
            current_session = {
                "start_time": e_start,
                "end_time": e_end,
                "active_seconds": active_sec,
                "idle_seconds": idle_sec,
                "event_count": 1,
            }
            continue

        # Compute interval between current session's end and this event's start
        gap_duration = (e_start - current_session["end_time"]).total_seconds() / 60.0

        if gap_duration <= gap_minutes:
            # Delta t <= T_gap => Coalesce into existing session
            current_session["end_time"] = max(current_session["end_time"], e_end)
            current_session["active_seconds"] += active_sec
            current_session["idle_seconds"] += idle_sec
            current_session["event_count"] += 1
        else:
            # Delta t > T_gap => Finalize session, start new session boundary
            total_duration = max(0, int((current_session["end_time"] - current_session["start_time"]).total_seconds()))
            current_session["duration_seconds"] = total_duration
            reconstructed.append(current_session)

            current_session = {
                "start_time": e_start,
                "end_time": e_end,
                "active_seconds": active_sec,
                "idle_seconds": idle_sec,
                "event_count": 1,
            }

    if current_session:
        total_duration = max(0, int((current_session["end_time"] - current_session["start_time"]).total_seconds()))
        current_session["duration_seconds"] = total_duration
        reconstructed.append(current_session)

    return reconstructed


# ===========================================================================
# 2. Metric Aggregation & Personalized Historical Baseline (Z-Score)
# ===========================================================================

def compute_active_ratio(active_seconds: int, idle_seconds: int) -> float:
    """Computes ActiveRatio = ActiveTime / (ActiveTime + IdleTime) in percent."""
    total = active_seconds + idle_seconds
    return round((active_seconds / total) * 100.0, 2) if total > 0 else 0.0


def compute_baseline_zscore(db: Session, user_id: int, current_active_ratio: float) -> dict:
    """
    Evaluates employee relative to their own historical behavioral baseline (x_1, ..., x_n).
    Calculates mean μ, standard deviation σ, and current deviation z = (x - μ) / σ.
    
    Note: The z-score is an anomaly/deviation indicator, not a raw productivity score.
    """
    metrics = (
        db.query(WorkMetric)
        .filter(WorkMetric.user_id == user_id)
        .order_by(WorkMetric.date.desc())
        .limit(30)
        .all()
    )

    if not metrics:
        return {
            "historical_mean": round(current_active_ratio, 2),
            "std_deviation": 0.0,
            "z_score": 0.0,
            "interpretation": "Baseline initializing (insufficient historical records)",
            "sample_size": 0,
        }

    ratios = []
    for m in metrics:
        tot = (m.active_seconds or 0) + (m.idle_seconds or 0)
        if tot > 0:
            ratios.append((m.active_seconds / tot) * 100.0)

    if not ratios:
        ratios = [current_active_ratio]

    n = len(ratios)
    mu = sum(ratios) / n
    variance = sum((x - mu) ** 2 for x in ratios) / n
    sigma = math.sqrt(variance)

    if sigma < 0.01:
        z = 0.0
    else:
        z = round((current_active_ratio - mu) / sigma, 2)

    if abs(z) > 2.0:
        interp = "Statistically unusual deviation (anomaly flag)"
    elif abs(z) > 1.0:
        interp = "Moderate variation from personal baseline"
    else:
        interp = "Within typical personal baseline distribution"

    return {
        "historical_mean": round(mu, 2),
        "std_deviation": round(sigma, 2),
        "z_score": z,
        "interpretation": interp,
        "sample_size": n,
    }


# ===========================================================================
# 3. Workload Engine
# ===========================================================================

def get_employee_workload(
    db: Session,
    user_id: int,
    standard_capacity: float = 8.0,
    deadline: date | str | None = None,
    assignment_date: date | str | None = None,
) -> dict:
    """
    R = sum(estimated_hours) for all open deliverables (TODO, IN_PROGRESS).
    Workload = (R / Capacity).
    When deadline is provided, Capacity is computed across the time window
    between the day of task assignment (assignment_date or today) and the deadline:
      Capacity = max(1, (deadline - assignment_date).days) * 8.0 hours.
    Otherwise, standard single-day capacity (standard_capacity, default 8.0h) is used.
    Tiers:
      0-60%:   Low
      60-80%:  Normal
      80-100%: High
      >100%:   Overloaded
    """
    parsed_deadline = None
    if deadline:
        if isinstance(deadline, str):
            try:
                parsed_deadline = datetime.fromisoformat(deadline.split("T")[0]).date()
            except Exception:
                parsed_deadline = None
        elif isinstance(deadline, datetime):
            parsed_deadline = deadline.date()
        elif isinstance(deadline, date):
            parsed_deadline = deadline

    parsed_assignment = None
    if assignment_date:
        if isinstance(assignment_date, str):
            try:
                parsed_assignment = datetime.fromisoformat(assignment_date.split("T")[0]).date()
            except Exception:
                parsed_assignment = None
        elif isinstance(assignment_date, datetime):
            parsed_assignment = assignment_date.date()
        elif isinstance(assignment_date, date):
            parsed_assignment = assignment_date

    if parsed_deadline:
        assign_d = parsed_assignment or datetime.now(timezone.utc).date()
        days_until = max(1, (parsed_deadline - assign_d).days)
        effective_capacity = days_until * 8.0
    else:
        effective_capacity = standard_capacity

    open_tasks = (
        db.query(Task)
        .filter(
            Task.assigned_to == user_id,
            Task.status.in_(["TODO", "IN_PROGRESS"])
        )
        .all()
    )

    remaining_hours = sum(float(t.estimated_hours or 0.0) for t in open_tasks)
    workload_ratio = (remaining_hours / effective_capacity) if effective_capacity > 0 else 0.0
    workload_pct = round(workload_ratio * 100)

    if workload_pct < 60:
        tier = "Low"
    elif workload_pct <= 80:
        tier = "Normal"
    elif workload_pct <= 100:
        tier = "High"
    else:
        tier = "Overloaded"

    available_hours = max(0.0, round(effective_capacity - remaining_hours, 1))

    return {
        "remaining_hours": round(remaining_hours, 1),
        "capacity_hours": effective_capacity,
        "available_hours": available_hours,
        "workload_percentage": workload_pct,
        "tier": tier,
        "open_tasks_count": len(open_tasks),
    }


# ===========================================================================
# 4. Constrained Multi-Objective Task Assignment Engine
# ===========================================================================

def get_overload_penalty(workload_ratio: float) -> float:
    """
    Non-linear overload penalty curve P(W_e):
      P(W) = 1.00  for W <= 0.80
      P(W) = 0.90  for 0.80 < W <= 0.90
      P(W) = 0.75  for 0.90 < W <= 1.00
      P(W) = 0.50  for W > 1.00
    """
    if workload_ratio <= 0.80:
        return 1.00
    elif workload_ratio <= 0.90:
        return 0.90
    elif workload_ratio <= 1.00:
        return 0.75
    else:
        return 0.50


def evaluate_task_assignment(
    db: Session,
    organization_id: int,
    task_title: str,
    estimated_hours: float,
    deadline: date | str | None = None,
    required_skills: list[str] | None = None,
    complexity: str = "MEDIUM",
    priority: str = "HIGH",
    assignment_date: date | str | None = None,
) -> dict:
    """
    Solves the constrained multi-objective ranking problem:
      1. Hard constraint filter: RequiredSkills(T) ⊆ Skills(e).
      2. Feature vector: X_e = [S_e, A_e, E_e, D_e] in [0, 1]^4.
         Capacity spans all time left between day of task assignment and deadline.
      3. Base score: B_e = 0.35*S + 0.30*A + 0.20*E + 0.15*D.
      4. Overload penalty: P(W_e).
      5. Final score: FinalScore_e = B_e * P(W_e).
      6. Ranking: e* = argmax FinalScore_e.
    """
    required = [s.strip().lower() for s in (required_skills or []) if s.strip()]

    # Fetch all active employees in this organization
    employees = (
        db.query(User)
        .filter(User.organization_id == organization_id, User.role == "EMPLOYEE", User.status == "ACTIVE")
        .all()
    )

    if not employees:
        return {
            "task": {
                "title": task_title,
                "estimated_hours": estimated_hours,
                "deadline": str(deadline) if deadline else None,
                "required_skills": required_skills or [],
            },
            "best_match": None,
            "alternatives": [],
            "candidates_evaluated": 0,
            "eligible_candidates": 0,
        }

    scored_candidates = []

    for emp in employees:
        emp_skills = [s.strip().lower() for s in (emp.skills or [])]

        # Step 4.1: Hard Constraint Checking (Core skills feasibility gate)
        # Check if RequiredSkills(T) ⊆ Skills(e)
        if required:
            matching_req = set(required).intersection(set(emp_skills))
            is_feasible = (len(matching_req) == len(required))
            skill_score = len(matching_req) / len(required)
        else:
            is_feasible = True
            skill_score = 1.0

        # Step 4.2: Feature Vector Extraction across deadline window
        workload_info = get_employee_workload(
            db,
            emp.id,
            standard_capacity=8.0,
            deadline=deadline,
            assignment_date=assignment_date,
        )
        remaining_h = workload_info["remaining_hours"]
        available_h = workload_info["available_hours"]
        effective_cap = workload_info["capacity_hours"]
        workload_ratio = (remaining_h / effective_cap) if effective_cap > 0 else 0.0

        # Availability A_e = AvailableHours_e / Capacity_e clipped to [0, 1]
        availability_score = max(0.0, min(1.0, available_h / effective_cap)) if effective_cap > 0 else 0.0

        # Efficiency E_e: Historical task performance ExpectedDuration / ActualDuration
        completed_tasks = (
            db.query(Task)
            .filter(Task.assigned_to == emp.id, Task.status == "COMPLETED")
            .all()
        )
        if completed_tasks:
            tot_est = sum(float(t.estimated_hours or 0.0) for t in completed_tasks)
            tot_act = sum(float(t.actual_hours or t.estimated_hours or 0.0) for t in completed_tasks)
            raw_eff = (tot_est / tot_act) if tot_act > 0 else 1.0
            efficiency_score = max(0.40, min(1.0, raw_eff))
        else:
            # Baseline efficiency for qualified team member without prior tasks
            efficiency_score = 0.88

        # Deadline Fit D_e: Available capacity before deadline / Task estimated hours
        if deadline:
            free_before_deadline = available_h
            deadline_fit = min(1.0, free_before_deadline / estimated_hours if estimated_hours > 0 else 1.0)
        else:
            deadline_fit = 1.0

        # Step 4.3: Weighted Decision Function
        base_score = (
            0.35 * skill_score +
            0.30 * availability_score +
            0.20 * efficiency_score +
            0.15 * deadline_fit
        )

        # Step 4.4: Overload Penalty
        penalty = get_overload_penalty(workload_ratio)

        # In constraint satisfaction: if required skills are specified and candidate has 0 matching skills,
        # they are strictly disqualified (FinalScore = 0). If partial match, scale proportionally.
        if required:
            if skill_score == 0:
                final_score = 0.0
            else:
                final_score = round(skill_score * base_score * penalty, 4)
        else:
            final_score = round(base_score * penalty, 4)

        # Projected workload impact if assigned
        projected_hours = remaining_h + estimated_hours
        projected_load_pct = min(150, round((projected_hours / effective_cap) * 100)) if effective_cap > 0 else 150

        # Human-readable "Why Reasons"
        why_reasons = []
        if skill_score >= 0.99:
            why_reasons.append("Complete historical skill match in required domain")
        elif skill_score > 0.0:
            why_reasons.append(f"Partial skill match ({round(skill_score * 100)}% of required skills)")
        else:
            missing_skills = ", ".join(required)
            why_reasons.append(f"Ineligible: Missing required skills ({missing_skills})")

        if availability_score >= 0.99:
            why_reasons.append(f"Full available capacity (0h pre-assigned, {effective_cap}h buffer)")
        elif availability_score >= 0.50:
            why_reasons.append(f"Good available capacity ({available_h}h buffer remaining)")
        elif availability_score > 0.0:
            why_reasons.append(f"Limited capacity remaining ({available_h}h available)")
        else:
            why_reasons.append("No available capacity (already at 100% capacity over deadline window)")

        if efficiency_score >= 0.85:
            why_reasons.append("Strong historical completion velocity on similar tasks")

        if deadline_fit >= 0.90:
            why_reasons.append("Target deadline is fully compatible with work session distribution")
        else:
            why_reasons.append("Tight delivery window relative to existing workload")

        if penalty < 1.0:
            penalty_pct = round((1.0 - penalty) * 100)
            why_reasons.append(
                f"Overload penalty applied: P(W) = {penalty} (workload at {workload_info['workload_percentage']}% "
                f"reduces score by {penalty_pct}% to protect employee from burnout)"
            )

        scored_candidates.append({
            "employee_id": emp.id,
            "name": emp.name,
            "email": emp.email,
            "role": emp.role,
            "department": emp.department_id or "General",
            "skills": emp.skills or [],
            "is_feasible": is_feasible,
            "match_percentage": round(final_score * 100),
            "final_score": final_score,
            "base_score": round(base_score, 4),
            "penalty": penalty,
            "breakdown": {
                "skill_match": round(skill_score * 100),
                "availability": round(availability_score * 100),
                "efficiency": round(efficiency_score * 100),
                "deadline_fit": round(deadline_fit * 100),
            },
            "workload": {
                "current_percentage": workload_info["workload_percentage"],
                "remaining_hours": workload_info["remaining_hours"],
                "capacity_hours": workload_info["capacity_hours"],
                "projected_percentage": projected_load_pct,
                "projected_hours": round(projected_hours, 1),
            },
            "why_reasons": why_reasons,
        })

    # Sort: Feasible candidates first (Hard constraint satisfaction), then by FinalScore descending
    feasible_candidates = [c for c in scored_candidates if c["is_feasible"]]
    infeasible_candidates = [c for c in scored_candidates if not c["is_feasible"]]

    feasible_candidates.sort(key=lambda c: c["final_score"], reverse=True)
    infeasible_candidates.sort(key=lambda c: c["final_score"], reverse=True)

    sorted_candidates = feasible_candidates + infeasible_candidates

    best_match = sorted_candidates[0] if sorted_candidates else None
    alternatives = sorted_candidates[1:] if len(sorted_candidates) > 1 else []

    return {
        "task": {
            "title": task_title,
            "estimated_hours": estimated_hours,
            "deadline": str(deadline) if deadline else None,
            "required_skills": required_skills or [],
            "complexity": complexity,
            "priority": priority,
        },
        "best_match": best_match,
        "candidates": sorted_candidates,
        "alternatives": alternatives,
        "candidates_evaluated": len(employees),
        "eligible_candidates": len(feasible_candidates),
    }
