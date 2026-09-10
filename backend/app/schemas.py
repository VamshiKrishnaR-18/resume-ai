from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, field_validator

# ---------- Auth ----------

class UserCreate(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def username_ok(cls, v):
        if len(v.strip()) < 3:
            raise ValueError("Username must be at least 3 characters")
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_ok(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    is_admin: bool = False
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Resumes ----------

EXPERIENCE_LEVELS = [
    "Entry Level (0-2 yrs)",
    "Mid Level (3-5 yrs)",
    "Senior Level (6-9 yrs)",
    "Lead / Principal (10+ yrs)",
]


class ResumeCreate(BaseModel):
    title: str = "My Resume"
    content: str
    experience_level: str = "Mid Level (3-5 yrs)"


class ResumeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    experience_level: str
    created_at: datetime
    updated_at: datetime


class ResumeVersionCreateRequest(BaseModel):
    job_description: str
    company_name: Optional[str] = None
    job_location: Optional[str] = None
    job_title: Optional[str] = None
    model: str = "openai"  # "claude", "openai", or "ollama"

    @field_validator("job_description")
    @classmethod
    def jd_min_length(cls, v):
        if len(v.strip()) < 250:
            raise ValueError("Job description must be at least 250 characters")
        return v

class ResumeVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    resume_id: int
    company_name: Optional[str]
    job_location: Optional[str]
    job_title: Optional[str]
    job_description: str
    model_used: str
    tailored_content: str
    ats_score: float
    matched_keywords: List[str]
    missing_keywords: List[str]
    status: str
    created_at: datetime

    @classmethod
    def from_orm_obj(cls, obj):
        return cls(
            id=obj.id,
            resume_id=obj.resume_id,
            company_name=obj.company_name,
            job_location=obj.job_location,
            job_title=obj.job_title,
            job_description=obj.job_description,
            model_used=obj.model_used,
            tailored_content=obj.tailored_content,
            ats_score=obj.ats_score,
            matched_keywords=[k for k in (obj.matched_keywords or "").split(",") if k],
            missing_keywords=[k for k in (obj.missing_keywords or "").split(",") if k],
            status=obj.status,
            created_at=obj.created_at,
        )


class VersionStatusUpdate(BaseModel):
    status: str

class ResumeVersionListItem(BaseModel):
    id: int
    resume_id: int
    company_name: Optional[str]
    job_title: Optional[str]
    job_location: Optional[str]
    job_description: str
    ats_score: float
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class HistoryPage(BaseModel):
    items: List[ResumeVersionListItem]
    total: int
    page: int
    page_size: int

# ---------- Settings ----------

TEMPLATES = ["Original", "Classic", "Modern", "Oslo", "Emerald", "Chicago"]


class SettingsSchema(BaseModel):
    font_family: str = "Calibri"
    font_size: int = 11
    page_size: str = "A4"
    page_margin_mm: int = 15
    line_height: float = 1.2
    template: str = "Original"
    section_order: List[str] = [
        "Professional Summary", "Education", "Technical Skills",
        "Work Experience", "Projects", "Certifications", "Publications",
    ]
    download_filename_pattern: str = "FirstName_Role_CompanyName"

    @classmethod
    def from_orm_obj(cls, obj):
        return cls(
            font_family=obj.font_family,
            font_size=obj.font_size,
            page_size=obj.page_size,
            page_margin_mm=obj.page_margin_mm,
            line_height=obj.line_height,
            template=getattr(obj, "template", None) or "Original",
            section_order=[s for s in (obj.section_order or "").split(",") if s],
            download_filename_pattern=obj.download_filename_pattern,
        )

# ---------- Dashboard ----------

class RateLimitStat(BaseModel):
    label: str
    used: int
    limit: int


class ActivityLogRow(BaseModel):
    date: str
    action: str
    success: int
    failed: int
    total: int

class DashboardStats(BaseModel):
    total_resumes: int
    in_range: int
    this_week: int
    this_month: int
    success_rate: float
    rate_limits: List[RateLimitStat]
    activity_log: List[ActivityLogRow]


# ---------- Admin ----------

class AdminUserRow(BaseModel):
    id: int
    username: str
    is_admin: bool
    created_at: datetime
    resume_count: int
    version_count: int


class AdminStats(BaseModel):
    total_users: int
    total_resumes: int
    total_versions: int
    total_actions: int
    failed_actions: int
    users: List[AdminUserRow]
