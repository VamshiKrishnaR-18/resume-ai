from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..ai_service import tailor_resume
from ..ats_service import score_resume_against_job
from ..auth import get_current_user
from ..database import get_db
from ..rate_limits import check_rate_limit, log_usage

router = APIRouter(prefix="/resumes", tags=["resumes"])


def _get_owned_resume(db: Session, resume_id: int, user: models.User) -> models.Resume:
    resume = (
        db.query(models.Resume)
        .filter(models.Resume.id == resume_id, models.Resume.user_id == user.id)
        .first()
    )
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return resume


@router.get("", response_model=list[schemas.ResumeOut])
def list_resumes(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return (
        db.query(models.Resume)
        .filter(models.Resume.user_id == user.id)
        .order_by(models.Resume.updated_at.desc())
        .all()
    )


@router.post("", response_model=schemas.ResumeOut)
def create_resume(
    payload: schemas.ResumeCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    resume = models.Resume(
        user_id=user.id,
        title=payload.title,
        content=payload.content,
        experience_level=payload.experience_level,
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume


@router.put("/{resume_id}", response_model=schemas.ResumeOut)
def update_resume(
    resume_id: int,
    payload: schemas.ResumeCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    resume = _get_owned_resume(db, resume_id, user)
    resume.title = payload.title
    resume.content = payload.content
    resume.experience_level = payload.experience_level
    db.commit()
    db.refresh(resume)
    return resume


@router.delete("/{resume_id}")
def delete_resume(
    resume_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    resume = _get_owned_resume(db, resume_id, user)
    db.delete(resume)
    db.commit()
    return {"ok": True}


@router.post("/{resume_id}/tailor", response_model=schemas.ResumeVersionOut)
def tailor(
    resume_id: int,
    payload: schemas.ResumeVersionCreateRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    resume = _get_owned_resume(db, resume_id, user)
    check_rate_limit(db, user.id, "generate")

    try:
        tailored_content = tailor_resume(
            resume_content=resume.content,
            job_description=payload.job_description,
            company_name=payload.company_name,
            job_title=payload.job_title,
            job_location=payload.job_location,
            model=payload.model,
        )
    except Exception as exc:
        log_usage(db, user.id, "generate", success=False)
        raise HTTPException(status_code=502, detail=str(exc))

    ats = score_resume_against_job(tailored_content, payload.job_description)

    version = models.ResumeVersion(
        resume_id=resume.id,
        user_id=user.id,
        company_name=payload.company_name,
        job_location=payload.job_location,
        job_title=payload.job_title,
        job_description=payload.job_description,
        model_used=payload.model,
        tailored_content=tailored_content,
        ats_score=ats["score"],
        matched_keywords=",".join(ats["matched"]),
        missing_keywords=",".join(ats["missing"]),
    )
    db.add(version)
    log_usage(db, user.id, "generate", success=True)
    db.commit()
    db.refresh(version)

    return schemas.ResumeVersionOut.from_orm_obj(version)


@router.get("/{resume_id}/versions", response_model=list[schemas.ResumeVersionListItem])
def list_versions(
    resume_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    _get_owned_resume(db, resume_id, user)
    return (
        db.query(models.ResumeVersion)
        .filter(models.ResumeVersion.resume_id == resume_id, models.ResumeVersion.user_id == user.id)
        .order_by(models.ResumeVersion.created_at.desc())
        .all()
    )
