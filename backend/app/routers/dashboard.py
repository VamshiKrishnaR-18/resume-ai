from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..rate_limits import DAILY_LIMITS

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=schemas.DashboardStats)
def get_dashboard(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    today_start = datetime(now.year, now.month, now.day)

    versions = (
        db.query(models.ResumeVersion).filter(models.ResumeVersion.user_id == user.id).all()
    )

    total_resumes = db.query(models.Resume).filter(models.Resume.user_id == user.id).count()
    in_range = sum(1 for v in versions if v.ats_score >= 70)
    this_week = sum(1 for v in versions if v.created_at >= week_ago)
    this_month = sum(1 for v in versions if v.created_at >= month_ago)

    usage_logs = db.query(models.UsageLog).filter(models.UsageLog.user_id == user.id).all()
    total_actions = len(usage_logs)
    successful = sum(1 for log in usage_logs if log.success)
    success_rate = round((successful / total_actions) * 100, 1) if total_actions else 100.0

    rate_limits = [
        schemas.RateLimitStat(
            label=action.capitalize(),
            used=sum(1 for log in usage_logs if log.action == action and log.created_at >= today_start),
            limit=limit,
        )
        for action, limit in DAILY_LIMITS.items()
    ]

    cutoff = now - timedelta(days=14)
    activity_by_day: dict[str, dict] = {}
    for log in usage_logs:
        if log.created_at < cutoff:
            continue
        day = log.created_at.strftime("%Y-%m-%d")
        row = activity_by_day.setdefault(
            day, {"date": day, "action": "all", "success": 0, "failed": 0, "total": 0}
        )
        row["total"] += 1
        row["success" if log.success else "failed"] += 1

    activity_log = [
        schemas.ActivityLogRow(**row)
        for row in sorted(activity_by_day.values(), key=lambda r: r["date"], reverse=True)
    ]

    return schemas.DashboardStats(
        total_resumes=total_resumes,
        in_range=in_range,
        this_week=this_week,
        this_month=this_month,
        success_rate=success_rate,
        rate_limits=rate_limits,
        activity_log=activity_log,
    )
