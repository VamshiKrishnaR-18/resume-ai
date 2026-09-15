import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routers import (
    admin,
    auth_router,
    dashboard,
    export,
    history,
    resumes,
    settings,
    versions,
)

app = FastAPI(title="AI Resume Tailor API", version="1.1.0")


# -----------------------------
# CORS CONFIG
# -----------------------------

_extra_origins = [
    o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        *_extra_origins,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------
# ROUTERS
# -----------------------------

API_PREFIX = "/api"

app.include_router(auth_router.router, prefix=API_PREFIX)
app.include_router(resumes.router, prefix=API_PREFIX)
app.include_router(versions.router, prefix=API_PREFIX)
app.include_router(export.router, prefix=API_PREFIX)
app.include_router(history.router, prefix=API_PREFIX)
app.include_router(settings.router, prefix=API_PREFIX)
app.include_router(dashboard.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)


# -----------------------------
# HEALTH CHECK
# -----------------------------

@app.get("/")
def health_check():
    return {"status": "ok", "service": "resume-tailor-api"}


# -----------------------------
# STARTUP EVENT (ONLY PLACE DB INIT HAPPENS)
# -----------------------------

@app.on_event("startup")
def startup():
    init_db()