from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from . import models

# Simple per-user daily caps. Adjust freely - these just protect your
# OpenAI/Claude spend and keep exports from being hammered.
DAILY_LIMITS = {
    "generate": 20,
    "pdf": 30,
    "docx": 30,
}


def _today_start() -> datetime:
    now = datetime.utcnow()
    return datetime(now.year, now.month, now.day)


def check_rate_limit(db: Session, user_id: int, action: str) -> None:
    limit = DAILY_LIMITS.get(action)
    if not limit:
        return

    count = (
        db.query(models.UsageLog)
        .filter(
            models.UsageLog.user_id == user_id,
            models.UsageLog.action == action,
            models.UsageLog.created_at >= _today_start(),
        )
        .count()
    )

    if count >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Daily limit reached for '{action}' ({limit}/day). Try again tomorrow.",
        )


def log_usage(db: Session, user_id: int, action: str, success: bool) -> None:
    db.add(models.UsageLog(user_id=user_id, action=action, success=success))
    db.commit()
