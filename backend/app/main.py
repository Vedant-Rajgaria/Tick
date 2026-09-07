from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import auth, agent, employee, manager

app = FastAPI(
    title="TICK API",
    version="0.1.0-mvp",
    description="Backend for the TICK workforce-intelligence platform.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Support /api/v1, /api, and root prefixes for robust routing across all frontend pages and API callers
for prefix in ["/api/v1", "/api", ""]:
    app.include_router(auth.router, prefix=prefix)
    app.include_router(agent.router, prefix=prefix)
    app.include_router(employee.router, prefix=prefix)
    app.include_router(manager.router, prefix=prefix)

@app.get("/health")
def health():
    return {"status": "ok"}