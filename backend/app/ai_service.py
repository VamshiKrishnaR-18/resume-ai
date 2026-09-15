# app/ai_service.py
import os
import logging
import httpx
from dotenv import load_dotenv
from typing import Iterator

load_dotenv()
logger = logging.getLogger("ai_service")
logger.setLevel(logging.INFO)

# -----------------------------
# Prompt builders
# -----------------------------
def _build_user_prompt(
    resume_content: str,
    job_description: str,
    keywords: str = "",
    company_name: str | None = None,
    job_title: str | None = None,
    job_location: str | None = None,
) -> str:
    return f"""
You are an expert resume writer and ATS optimization specialist.

Create a tailored, ATS-friendly resume using the candidate's original resume and the job description.

Rules:
1. Use only information already present in the original resume.
2. Do not invent any details.
3. Improve summary and bullet points.
4. Use ATS keywords only if present in resume.
5. Keep it concise and professional.
6. Return only the final resume.

Company: {company_name or "Not provided"}
Job Title: {job_title or "Not provided"}
Location: {job_location or "Not provided"}

ORIGINAL RESUME:
{resume_content}

JOB DESCRIPTION:
{job_description}
""".strip()


# -----------------------------
# GROQ
# -----------------------------
def _call_groq(prompt: str) -> str:
    from groq import Groq

    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

    res = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "Return only final answer"},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
    )

    return res.choices[0].message.content.strip()


def _stream_groq(prompt: str) -> Iterator[str]:
    yield _call_groq(prompt)


# -----------------------------
# GEMINI (NEW SDK - FIXED)
# -----------------------------
def _get_gemini_client():
    from google import genai
    return genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


def _call_gemini(prompt: str) -> str:
    client = _get_gemini_client()
    model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config={"temperature": 0.3},
    )

    if not response.text:
        raise RuntimeError("Empty Gemini response")

    return response.text.strip()


def _stream_gemini(prompt: str) -> Iterator[str]:
    """
    🔥 FIXES YOUR ISSUE:
    - Always yields something (prevents ERR_INCOMPLETE_CHUNKED_ENCODING)
    - Never raises inside generator
    - Handles empty chunks safely
    """

    try:
        client = _get_gemini_client()
        model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

        stream = client.models.generate_content_stream(
            model=model,
            contents=prompt,
            config={"temperature": 0.3},
        )

        sent_any = False

        for chunk in stream:
            text = getattr(chunk, "text", None)
            if text:
                sent_any = True
                yield text

        # ⚠️ CRITICAL: prevent broken HTTP stream
        if not sent_any:
            yield "\n[ERROR] Empty response from Gemini"

    except Exception as e:
        logger.exception("Gemini streaming error: %s", e)

        # ⚠️ NEVER RAISE inside streaming generator
        yield "\n[ERROR] Gemini failed"


# -----------------------------
# OLLAMA
# -----------------------------
def _call_ollama(prompt: str) -> str:
    base = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    model = os.getenv("OLLAMA_MODEL", "llama3.2:3b")

    res = httpx.post(
        f"{base}/api/generate",
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.3},
        },
        timeout=300,
    )

    res.raise_for_status()
    return res.json()["response"].strip()


def _stream_ollama(prompt: str) -> Iterator[str]:
    yield _call_ollama(prompt)


# -----------------------------
# MAIN ENTRY
# -----------------------------
def tailor_resume(
    resume_content: str,
    job_description: str,
    company_name: str | None = None,
    job_title: str | None = None,
    job_location: str | None = None,
    provider: str = "groq",
    stream: bool = False,
):
    prompt = _build_user_prompt(
        resume_content,
        job_description,
        "",
        company_name,
        job_title,
        job_location,
    )

    provider = provider.lower().strip()

    if stream:
        if provider == "groq":
            return _stream_groq(prompt)
        elif provider in ("gemini", "google"):
            return _stream_gemini(prompt)
        else:
            return _stream_ollama(prompt)
    else:
        if provider == "groq":
            return _call_groq(prompt)
        elif provider in ("gemini", "google"):
            return _call_gemini(prompt)
        else:
            return _call_ollama(prompt)