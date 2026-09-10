from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(user: models.User) -> None:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/stats", response_model=schemas.AdminStats)
def admin_stats(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    _require_admin(user)

    total_users = db.query(models.User).count()
    total_resumes = db.query(models.Resume).count()
    total_versions = db.query(models.ResumeVersion).count()
    total_actions = db.query(models.UsageLog).count()
    failed_actions = (
        db.query(models.UsageLog).filter(models.UsageLog.success == False).count()  # noqa: E712
    )

    user_rows = []
    for u in db.query(models.User).order_by(models.User.created_at.desc()).all():
        resume_count = db.query(models.Resume).filter(models.Resume.user_id == u.id).count()
        version_count = (
            db.query(models.ResumeVersion).filter(models.ResumeVersion.user_id == u.id).count()
        )
        user_rows.append(
            schemas.AdminUserRow(
                id=u.id,
                username=u.username,
                is_admin=u.is_admin,
                created_at=u.created_at,
                resume_count=resume_count,
                version_count=version_count,
            )
        )

    return schemas.AdminStats(
        total_users=total_users,
        total_resumes=total_resumes,
        total_versions=total_versions,
        total_actions=total_actions,
        failed_actions=failed_actions,
        users=user_rows,
    )
