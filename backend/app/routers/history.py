from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/history", tags=["history"])


@router.get("", response_model=schemas.HistoryPage)
def get_history(
    query: Optional[str] = None,
    status: Optional[str] = None,
    resume_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 10,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    q = db.query(models.ResumeVersion).filter(models.ResumeVersion.user_id == user.id)

    if resume_id:
        q = q.filter(models.ResumeVersion.resume_id == resume_id)
    if status:
        q = q.filter(models.ResumeVersion.status == status)
    if query:
        like = f"%{query}%"
        q = q.filter(
            or_(
                models.ResumeVersion.company_name.ilike(like),
                models.ResumeVersion.job_title.ilike(like),
            )
        )

    total = q.count()
    page = max(page, 1)
    page_size = max(min(page_size, 100), 1)

    items = (
        q.order_by(models.ResumeVersion.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return schemas.HistoryPage(items=items, total=total, page=page, page_size=page_size)
