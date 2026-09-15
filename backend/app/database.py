import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./resume_tailor.db")

# -----------------------------
# ENGINE SETUP
# -----------------------------

is_sqlite = DATABASE_URL.startswith("sqlite")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if is_sqlite else {},
    pool_pre_ping=True,
    **({} if is_sqlite else {"pool_size": 5, "max_overflow": 10})
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


# -----------------------------
# DB DEPENDENCY
# -----------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -----------------------------
# LIGHT MIGRATIONS (SQLite only)
# -----------------------------

_NEW_COLUMNS = [
    # existing
    ("resumes", "experience_level", "VARCHAR DEFAULT 'Mid Level (3-5 yrs)'"),
    ("user_settings", "template", "VARCHAR DEFAULT 'Original'"),
    ("users", "is_admin", "BOOLEAN DEFAULT 0"),

    # 🔥 NEW (IMPORTANT)
    ("resume_versions", "original_resume", "TEXT"),
    ("resume_versions", "generation_status", "VARCHAR DEFAULT 'processing'"),
    ("resume_versions", "application_status", "VARCHAR DEFAULT 'Not Applied'"),
]


def run_migrations():
    """
    Lightweight column migrations for SQLite only.
    Safe to run at startup.
    """
    if not is_sqlite:
        return

    print("🔄 Running SQLite migrations...")

    with engine.begin() as conn:  # ✅ transaction-safe
        for table, column, ddl in _NEW_COLUMNS:
            try:
                result = conn.execute(text(f"PRAGMA table_info({table})"))
                existing_cols = [row[1] for row in result]

                if column not in existing_cols:
                    print(f"➕ Adding column: {table}.{column}")
                    conn.execute(
                        text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")
                    )

            except Exception as e:
                print(f"⚠️ Migration skipped for {table}.{column}: {e}")


# -----------------------------
# INIT DB
# -----------------------------

def init_db():
    """
    Call this once at app startup.
    """
    from . import models  # ensure models are loaded

    print("📦 Creating tables if not exist...")
    Base.metadata.create_all(bind=engine)

    run_migrations()

    print("✅ Database ready.")