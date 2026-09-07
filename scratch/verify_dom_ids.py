import re
import os

checks = [
    {
        "html": r"c:\Users\jayas\OneDrive\Desktop\c2c tick\frontend\dashboard-manager\index.html",
        "ids": [
            "logoutLink", "topHeaderDate", "adminSidebarName", "adminSidebarRole",
            "adminSidebarMeta", "topHeaderBadge", "statTotalEmployees", "statTotalSessions",
            "statNeedAttention", "teamCapacityTableBody", "employeeSearchInput",
            "employeesRosterTableBody", "completedTasksTableBody", "deleteConfirmModal",
            "closeDeleteModalBtn", "cancelDeleteBtn", "confirmDeleteBtn", "deleteModalEmpName"
        ]
    },
    {
        "html": r"c:\Users\jayas\OneDrive\Desktop\c2c tick\frontend\dashboard-manager\employee-detail.html",
        "ids": [
            "calendarDateInput", "logoutLink", "topHeaderDate", "adminSidebarName",
            "adminSidebarRole", "adminSidebarMeta", "headerEmpName", "profileName",
            "profileRoleDept", "profileStatusBadge", "profileEmpId", "deleteEmployeeBtn",
            "modeBtnDate", "modeBtnWeek", "modeBtnYear", "prevDayBtn", "nextDayBtn",
            "btnToday", "btnYesterday", "dateInputGroup", "weekInputGroup", "yearInputGroup",
            "prevWeekBtn", "calendarWeekInput", "nextWeekBtn", "btnThisWeek", "btnLastWeek",
            "prevYearBtn", "calendarYearInput", "nextYearBtn", "btnCurrentYear", "btnPastYear",
            "timeframeBadge", "timeframeRangeText", "detailWorkload", "detailWorkloadLabel",
            "detailActiveTime", "detailIdleTime", "detailTasksCount", "workPulseContainer",
            "workPulseTimelineLabels", "workPulseBar", "pulseTooltip", "tooltipApp",
            "tooltipMeta", "workPulseLegend", "workPulseEmptyState", "usefulWorkChartContainer",
            "usefulWorkChart", "usefulWorkEmptyState", "appUsageTableBody", "breakdownActiveTime",
            "breakdownIdleTime", "breakdownTotalSession", "breakdownActiveRatio", "breakdownObsNote",
            "employeeTasksTableBody", "deleteConfirmModal", "closeDeleteModalBtn", "cancelDeleteBtn",
            "confirmDeleteBtn", "deleteModalEmpName"
        ]
    },
    {
        "html": r"c:\Users\jayas\OneDrive\Desktop\c2c tick\frontend\dashboard-manager\assign-task.html",
        "ids": [
            "topHeaderDate", "logoutLink", "adminSidebarName", "adminSidebarRole",
            "adminSidebarMeta", "taskDeadlineInput", "quickSkillTags", "taskSkillsInput",
            "findBestFitBtn", "taskNameInput", "taskTypeSelect", "taskPrioritySelect",
            "taskEstTimeInput", "recPlaceholder", "recLoader", "loaderMessage",
            "recResultsContent"
        ]
    },
    {
        "html": r"c:\Users\jayas\OneDrive\Desktop\c2c tick\frontend\dashboard-manager\add-employee.html",
        "ids": [
            "topHeaderDate", "logoutLink", "adminSidebarName", "adminSidebarRole",
            "adminSidebarMeta", "newEmpPassword", "newEmpName", "newEmpEmail",
            "newEmpDept", "submitCreateEmpBtn", "credentialsCard", "credEmpName",
            "credEmpMeta", "credEmpId", "credEmpLogin", "credEmpPass", "copyCredBtn"
        ]
    },
    {
        "html": r"c:\Users\jayas\OneDrive\Desktop\c2c tick\frontend\dashboard-manager\login.html",
        "ids": [
            "tabLogin", "tabRegister", "adminLoginForm", "adminRegisterForm",
            "authTitle", "adminEmail", "adminPassword", "loginErrorMsg",
            "regOrgName", "regAdminName", "regEmail", "regPassword"
        ]
    },
    {
        "html": r"c:\Users\jayas\OneDrive\Desktop\c2c tick\frontend\dashboard-employees\index.html",
        "ids": [
            "empLogoutLink", "topHeaderDate", "empSidebarName", "empSidebarRole",
            "empSidebarMeta", "empGreeting", "empWorkPulseBar", "empUsefulWork",
            "empIdleTime", "empSessionCount", "empAppCount", "empPulseTooltip",
            "empTooltipApp", "empTooltipMeta", "empUsefulWorkChart", "empAppUsageTbody",
            "myTasksContainer", "taskCompleteModal", "cancelCompleteBtn", "confirmCompleteBtn",
            "modalTaskDesc"
        ]
    },
    {
        "html": r"c:\Users\jayas\OneDrive\Desktop\c2c tick\frontend\dashboard-employees\login.html",
        "ids": [
            "employeeLoginForm", "employeeIdInput", "employeePassword", "loginErrorMsg"
        ]
    }
]

total_checked = 0
total_passed = 0
all_errors = []

for item in checks:
    html_path = item["html"]
    filename = os.path.basename(html_path)
    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()

    missing = []
    for elem_id in item["ids"]:
        total_checked += 1
        # Search for id="elem_id" or id='elem_id'
        pattern = rf'id=[\'"]{re.escape(elem_id)}[\'"]'
        if not re.search(pattern, content):
            missing.append(elem_id)
        else:
            total_passed += 1

    if missing:
        all_errors.append(f"FAILED {filename}: Missing IDs: {missing}")
    else:
        print(f"PASS: {filename} has all {len(item['ids'])} required IDs.")

print("\n--- SUMMARY ---")
print(f"Total IDs verified: {total_passed}/{total_checked}")
if all_errors:
    for err in all_errors:
        print(err)
else:
    print("ALL 100% OF FUNCTIONAL DOM IDS ARE PRESENT AND FULLY PRESERVED!")
