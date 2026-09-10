from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/versions", tags=["versions"])


def _get_owned_version(db: Session, version_id: int, user: models.User) -> models.ResumeVersion:
    version = (
        db.query(models.ResumeVersion)
        .filter(models.ResumeVersion.id == version_id, models.ResumeVersion.user_id == user.id)
        .first()
    )
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return version


@router.get("/{version_id}", response_model=schemas.ResumeVersionOut)
def get_version(
    version_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    version = _get_owned_version(db, version_id, user)
    return schemas.ResumeVersionOut.from_orm_obj(version)


@router.patch("/{version_id}/status", response_model=schemas.ResumeVersionOut)
def update_status(
    version_id: int,
    payload: schemas.VersionStatusUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    version = _get_owned_version(db, version_id, user)
    version.status = payload.status
    db.commit()
    db.refresh(version)
    return schemas.ResumeVersionOut.from_orm_obj(version)


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
