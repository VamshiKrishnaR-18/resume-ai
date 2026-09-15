from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Text, DateTime,
    ForeignKey, Float, Boolean, Index
)
from sqlalchemy.orm import relationship

from .database import Base


# -----------------------------
# USER
# -----------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    resumes = relationship("Resume", back_populates="owner", cascade="all, delete-orphan")
    settings = relationship(
        "UserSettings", back_populates="owner",
        uselist=False, cascade="all, delete-orphan"
    )


# -----------------------------
# USER SETTINGS
# -----------------------------

class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    font_family = Column(String, default="Calibri")
    font_size = Column(Integer, default=11)
    page_size = Column(String, default="A4")
    page_margin_mm = Column(Integer, default=15)
    line_height = Column(Float, default=1.2)

    section_order = Column(
        Text,
        default="Professional Summary,Education,Technical Skills,Work Experience,"
        "Projects,Certifications,Publications",
    )

    template = Column(String, default="Original")
    download_filename_pattern = Column(String, default="FirstName_Role_CompanyName")

    owner = relationship("User", back_populates="settings")


# -----------------------------
# BASE RESUME
# -----------------------------

class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String, nullable=False, default="My Resume")
    content = Column(Text, nullable=False)

    experience_level = Column(String, default="Mid Level (3-5 yrs)")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="resumes")
    versions = relationship(
        "ResumeVersion", back_populates="resume",
        cascade="all, delete-orphan"
    )


# -----------------------------
# RESUME VERSION (IMPORTANT)
# -----------------------------

class ResumeVersion(Base):
    __tablename__ = "resume_versions"

    id = Column(Integer, primary_key=True, index=True)
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    company_name = Column(String)
    job_location = Column(String)
    job_title = Column(String)

    job_description = Column(Text, nullable=False)

    # ✅ NEW (for retry)
    original_resume = Column(Text)

    # ✅ allow NULL until AI finishes
    tailored_content = Column(Text, nullable=True)

    model_used = Column(String, default="groq")

    # ATS
    ats_score = Column(Float, default=0.0)
    matched_keywords = Column(Text, default="")
    missing_keywords = Column(Text, default="")

    # ✅ FIXED (separate states)
    generation_status = Column(
        String,
        default="processing"  # processing | completed | failed
    )

    application_status = Column(
        String,
        default="Not Applied"  # Not Applied | Applied | Interviewing | Rejected | Offer
    )

    created_at = Column(DateTime, default=datetime.utcnow)

    resume = relationship("Resume", back_populates="versions")

    # ✅ INDEX (important for performance)
    __table_args__ = (
        Index("idx_resume_user", "resume_id", "user_id"),
    )


# -----------------------------
# USAGE LOG
# -----------------------------

class UsageLog(Base):
    __tablename__ = "usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    action = Column(String, nullable=False)  # generate | pdf | docx
    success = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)