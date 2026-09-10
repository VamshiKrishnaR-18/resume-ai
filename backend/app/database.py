import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./resume_tailor.db")

# check_same_thread is needed only for SQLite
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Lightweight migrations
#
# Base.metadata.create_all() only creates tables that don't exist yet - it
# never adds new columns to a table that's already there. Since this app
# ships with an existing resume_tailor.db, new columns (experience_level,
# template, is_admin) need to be added to that file in place. This is a
# best-effort SQLite ALTER TABLE helper - safe to call on every startup.
# For Postgres/MySQL in production, use a real migration tool (Alembic).
# ---------------------------------------------------------------------------

_NEW_COLUMNS = [
    ("resumes", "experience_level", "VARCHAR DEFAULT 'Mid Level (3-5 yrs)'"),
    ("user_settings", "template", "VARCHAR DEFAULT 'Original'"),
    ("users", "is_admin", "BOOLEAN DEFAULT 0"),
]


def run_migrations():
    if not DATABASE_URL.startswith("sqlite"):
        # Non-SQLite deployments should manage schema changes explicitly.
        return

    with engine.connect() as conn:
        for table, column, ddl in _NEW_COLUMNS:
            try:
                existing = [
                    row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))
                ]
                if column not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
                    conn.commit()
            except Exception:
                # Table may not exist yet on a brand-new DB - create_all()
                # handles that case, so it's safe to skip here.
                conn.rollback()
