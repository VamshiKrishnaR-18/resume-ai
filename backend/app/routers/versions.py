from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

from ..ai_service import tailor_resume
from ..ats_service import score_resume_against_job

router = APIRouter(prefix="/versions", tags=["versions"])


# -----------------------------
# Helper
# -----------------------------

def _get_owned_version(db: Session, version_id: int, user: models.User):
    version = (
        db.query(models.ResumeVersion)
        .filter(
            models.ResumeVersion.id == version_id,
            models.ResumeVersion.user_id == user.id
        )
        .first()
    )

    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    return version


# -----------------------------
# Generate (Streaming)
# -----------------------------

@router.post("/generate")
def generate_version(
    payload: schemas.GenerateResumeRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    version = models.ResumeVersion(
        resume_id=payload.resume_id,
        user_id=user.id,
        company_name=payload.company_name,
        job_title=payload.job_title,
        job_location=payload.job_location,
        job_description=payload.job_description,
        original_resume=payload.resume_content,
        generation_status="processing",
        application_status="Not Applied",
    )

    db.add(version)
    db.commit()
    db.refresh(version)

    def stream_and_store():
        full_text = ""

        try:
            stream = tailor_resume(
                payload.resume_content,
                payload.job_description,
                payload.company_name,
                payload.job_title,
                payload.job_location,
                provider=payload.provider or "groq",
                stream=True,
            )

            for chunk in stream:
                full_text += chunk
                yield chunk

            # ATS scoring
            ats = score_resume_against_job(full_text, payload.job_description)

            version.tailored_content = full_text
            version.ats_score = ats["score"]
            version.matched_keywords = ", ".join(ats["matched"])
            version.missing_keywords = ", ".join(ats["missing"])
            version.model_used = payload.provider or "groq"
            version.generation_status = "completed"

            db.commit()

        except Exception:
            version.generation_status = "failed"
            db.commit()
            yield "\n[ERROR] Generation failed"

    return StreamingResponse(stream_and_store(), media_type="text/plain")


# -----------------------------
# Version Listing
# -----------------------------

@router.get("/resume/{resume_id}", response_model=list[schemas.ResumeVersionOut])
def list_versions(
    resume_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    versions = (
        db.query(models.ResumeVersion)
        .filter(
            models.ResumeVersion.resume_id == resume_id,
            models.ResumeVersion.user_id == user.id,
        )
        .order_by(models.ResumeVersion.created_at.desc())
        .all()
    )

    return [schemas.ResumeVersionOut.from_orm_obj(v) for v in versions]


# -----------------------------
# Compare Versions
# -----------------------------

@router.get("/compare/{v1_id}/{v2_id}")
def compare_versions(
    v1_id: int,
    v2_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    v1 = _get_owned_version(db, v1_id, user)
    v2 = _get_owned_version(db, v2_id, user)

    return {
        "version_1": {
            "id": v1.id,
            "score": v1.ats_score,
        },
        "version_2": {
            "id": v2.id,
            "score": v2.ats_score,
        },
        "improvement": (v2.ats_score or 0) - (v1.ats_score or 0),
    }


# -----------------------------
# Retry Failed Job
# -----------------------------

@router.post("/{version_id}/retry")
def retry_version(
    version_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    version = _get_owned_version(db, version_id, user)

    if version.generation_status != "failed":
        raise HTTPException(status_code=400, detail="Only failed versions can be retried")

    def stream_retry():
        full_text = ""

        try:
            version.generation_status = "processing"
            db.commit()

            stream = tailor_resume(
                resume_content=version.original_resume,
                job_description=version.job_description,
                company_name=version.company_name,
                job_title=version.job_title,
                job_location=version.job_location,
                provider="groq",
                stream=True,
            )

            for chunk in stream:
                full_text += chunk
                yield chunk

            ats = score_resume_against_job(full_text, version.job_description)

            version.tailored_content = full_text
            version.ats_score = ats["score"]
            version.matched_keywords = ", ".join(ats["matched"])
            version.missing_keywords = ", ".join(ats["missing"])
            version.generation_status = "completed"

            db.commit()

        except Exception:
            version.generation_status = "failed"
            db.commit()
            yield "\n[ERROR] Retry failed"

    return StreamingResponse(stream_retry(), media_type="text/plain")


# -----------------------------
# Get Version
# -----------------------------

@router.get("/{version_id}", response_model=schemas.ResumeVersionOut)
def get_version(
    version_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    version = _get_owned_version(db, version_id, user)
    return schemas.ResumeVersionOut.from_orm_obj(version)


# -----------------------------
# Update Status
# -----------------------------

@router.patch("/{version_id}/status", response_model=schemas.ResumeVersionOut)
def update_status(
    version_id: int,
    payload: schemas.VersionStatusUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    version = _get_owned_version(db, version_id, user)

    version.application_status = payload.status
    db.commit()
    db.refresh(version)

    return schemas.ResumeVersionOut.from_orm_obj(version)


# -----------------------------
# Delete Version
# -----------------------------

@router.delete("/{version_id}")
def delete_version(
    version_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    version = _get_owned_version(db, version_id, user)

    db.delete(version)
    db.commit()

    return {"ok": True}