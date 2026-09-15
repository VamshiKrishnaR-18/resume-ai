from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
import logging

from ..ai_service import tailor_resume
from ..ats_service import score_resume_against_job

router = APIRouter(prefix="/versions", tags=["versions"])
logger = logging.getLogger(__name__)


# -----------------------------
# Helpers
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


def _get_owned_resume(db: Session, resume_id: int, user: models.User):
    resume = (
        db.query(models.Resume)
        .filter(
            models.Resume.id == resume_id,
            models.Resume.user_id == user.id
        )
        .first()
    )
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return resume


# -----------------------------
# Generate (Streaming)
# -----------------------------

@router.post("/generate")
def generate_version(
    payload: schemas.GenerateResumeRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    _get_owned_resume(db, payload.resume_id, user)

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
        model_used=payload.provider or "groq",
    )

    db.add(version)
    db.commit()
    db.refresh(version)

    def stream_and_store():
        from ..database import SessionLocal
        stream_db = SessionLocal()

        full_text = ""

        try:
            provider = (payload.provider or "groq").lower()

            # ✅ ALWAYS use streaming (even for Gemini)
            stream = tailor_resume(
                resume_content=payload.resume_content,
                job_description=payload.job_description,
                company_name=payload.company_name,
                job_title=payload.job_title,
                job_location=payload.job_location,
                provider=provider,
                stream=True,   # 🔥 IMPORTANT FIX
            )

            for chunk in stream:
                if not chunk:
                    continue
                full_text += chunk
                yield chunk

            # ❌ If nothing came → force error
            
            if "[ERROR]" in full_text:
                raise RuntimeError("AI generation error")

            # ✅ ATS scoring
            ats = score_resume_against_job(full_text, payload.job_description)

            db_version = stream_db.get(models.ResumeVersion, version.id)

            db_version.tailored_content = full_text
            db_version.ats_score = ats["score"]
            db_version.matched_keywords = ", ".join(ats["matched"])
            db_version.missing_keywords = ", ".join(ats["missing"])
            db_version.generation_status = "completed"

            stream_db.commit()


        except Exception as e:
            logger.exception("Generation failed: %s", e)

            try:
                db_version = stream_db.get(models.ResumeVersion, version.id)
                if db_version:
                    db_version.generation_status = "failed"
                    stream_db.commit()
            except Exception as db_err:
                logger.exception("DB update failed: %s", db_err)

            yield "\n[ERROR] Generation failed"

        finally:
            stream_db.close()

    return StreamingResponse(
        stream_and_store(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

# -----------------------------
# List Versions
# -----------------------------

@router.get("/resume/{resume_id}", response_model=list[schemas.ResumeVersionOut])
def list_versions(
    resume_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    _get_owned_resume(db, resume_id, user)

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
        "improvement": round((v2.ats_score or 0) - (v1.ats_score or 0), 2),
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
        raise HTTPException(
            status_code=400,
            detail="Only failed versions can be retried"
        )

    def stream_retry():
        from ..database import SessionLocal
        stream_db = SessionLocal()

        full_text = ""

        try:
            db_version = stream_db.get(models.ResumeVersion, version.id)
            db_version.generation_status = "processing"
            stream_db.commit()

            stream = tailor_resume(
                resume_content=db_version.original_resume,
                job_description=db_version.job_description,
                company_name=db_version.company_name,
                job_title=db_version.job_title,
                job_location=db_version.job_location,
                provider=db_version.model_used or "groq",
                stream=True,
            )

            for chunk in stream:
                if not chunk:
                    continue
                full_text += chunk
                yield chunk

            ats = score_resume_against_job(full_text, db_version.job_description)

            db_version.tailored_content = full_text
            db_version.ats_score = ats["score"]
            db_version.matched_keywords = ", ".join(ats["matched"])
            db_version.missing_keywords = ", ".join(ats["missing"])
            db_version.generation_status = "completed"

            stream_db.commit()

        except Exception:
            db_version = stream_db.query(models.ResumeVersion).get(version.id)
            db_version.generation_status = "failed"
            stream_db.commit()

            yield "\n[ERROR] Retry failed"

        finally:
            stream_db.close()

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