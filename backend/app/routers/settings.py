from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/settings", tags=["settings"])

DEFAULTS = {
    "font_family": "Calibri",
    "font_size": 11,
    "page_size": "A4",
    "page_margin_mm": 15,
    "line_height": 1.2,
    "template": "Original",
    "section_order": (
        "Professional Summary,Education,Technical Skills,Work Experience,"
        "Projects,Certifications,Publications"
    ),
    "download_filename_pattern": "FirstName_Role_CompanyName",
}


def _get_or_create(db: Session, user: models.User) -> models.UserSettings:
    settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == user.id).first()
    if not settings:
        settings = models.UserSettings(user_id=user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("", response_model=schemas.SettingsSchema)
def get_settings(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return schemas.SettingsSchema.from_orm_obj(_get_or_create(db, user))


@router.put("", response_model=schemas.SettingsSchema)
def update_settings(
    payload: schemas.SettingsSchema,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    settings = _get_or_create(db, user)
    settings.font_family = payload.font_family
    settings.font_size = payload.font_size
    settings.page_size = payload.page_size
    settings.page_margin_mm = payload.page_margin_mm
    settings.line_height = payload.line_height
    settings.template = payload.template
    settings.section_order = ",".join(payload.section_order)
    settings.download_filename_pattern = payload.download_filename_pattern
    db.commit()
    db.refresh(settings)
    return schemas.SettingsSchema.from_orm_obj(settings)


@router.post("/reset", response_model=schemas.SettingsSchema)
def reset_settings(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    settings = _get_or_create(db, user)
    for key, value in DEFAULTS.items():
        setattr(settings, key, value)
    db.commit()
    db.refresh(settings)
    return schemas.SettingsSchema.from_orm_obj(settings)
