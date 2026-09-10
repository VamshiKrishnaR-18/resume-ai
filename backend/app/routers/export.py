import re

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .. import models
from ..auth import get_current_user
from ..database import get_db
from ..export_service import build_docx, build_pdf
from ..rate_limits import check_rate_limit, log_usage
from .versions import _get_owned_version

router = APIRouter(prefix="/export", tags=["export"])


def _safe(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "_", (text or "").strip()) or "Resume"


def _get_settings(db: Session, user: models.User) -> models.UserSettings | None:
    return db.query(models.UserSettings).filter(models.UserSettings.user_id == user.id).first()


def _filename(user: models.User, version: models.ResumeVersion, settings, ext: str) -> str:
    pattern = getattr(settings, "download_filename_pattern", None) or "FirstName_Role_CompanyName"
    first_name = _safe(user.username.split(" ")[0]) if user.username else "Resume"
    role = _safe(version.job_title or "Resume")
    company = _safe(version.company_name or "")

    name = (
        pattern.replace("FirstName", first_name)
        .replace("Role", role)
        .replace("CompanyName", company)
    )
    name = re.sub(r"_+", "_", name).strip("_") or "Resume"
    return f"{name}.{ext}"


@router.get("/versions/{version_id}/pdf")
def export_pdf(
    version_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    version = _get_owned_version(db, version_id, user)
    check_rate_limit(db, user.id, "pdf")
    settings = _get_settings(db, user)

    buf = build_pdf(version.job_title or "Resume", version.tailored_content, settings)
    log_usage(db, user.id, "pdf", success=True)

    filename = _filename(user, version, settings, "pdf")
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/versions/{version_id}/docx")
def export_docx(
    version_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    version = _get_owned_version(db, version_id, user)
    check_rate_limit(db, user.id, "docx")
    settings = _get_settings(db, user)

    buf = build_docx(version.job_title or "Resume", version.tailored_content, settings)
    log_usage(db, user.id, "docx", success=True)

    filename = _filename(user, version, settings, "docx")
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
