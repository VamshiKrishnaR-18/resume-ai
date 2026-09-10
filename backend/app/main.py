import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models
from .database import engine, run_migrations
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

models.Base.metadata.create_all(bind=engine)
run_migrations()

app = FastAPI(title="AI Resume Tailor API", version="1.1.0")

# Local dev origins are always allowed. Add your deployed frontend origin
# (e.g. your Elastic Beanstalk / CloudFront / Vercel URL) via the
# CORS_ORIGINS env var, comma-separated, in backend/.env:
#   CORS_ORIGINS=https://resume-ai-prod.eba-xxxx.us-east-1.elasticbeanstalk.com
_extra_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]

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

app.include_router(auth_router.router)
app.include_router(resumes.router)
app.include_router(versions.router)
app.include_router(export.router)
app.include_router(history.router)
app.include_router(settings.router)
app.include_router(dashboard.router)
app.include_router(admin.router)


@app.get("/")
def health_check():
    return {"status": "ok", "service": "resume-tailor-api"}
