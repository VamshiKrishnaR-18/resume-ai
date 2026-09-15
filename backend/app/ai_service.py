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
# Prompt builders (kept simple)
# -----------------------------
def _extract_keywords_prompt(job_description: str) -> str:
    return f"""Extract the most important ATS keywords from this job description.

Rules:
- Return only comma-separated keywords
- Focus on skills, tools, technologies, roles
- No explanation

JOB DESCRIPTION:
{job_description}
""".strip()


def _build_user_prompt(
    resume_content: str,
    job_description: str,
    keywords: str = "",
    company_name: str | None = None,
    job_title: str | None = None,
    job_location: str | None = None,
) -> str:
    company = company_name or "Not provided"
    title = job_title or "Not provided"
    location = job_location or "Not provided"

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
7. Do not include explanations.

Additional focus keywords:
{keywords}

Company: {company}
Job Title: {title}
Job Location: {location}

ORIGINAL RESUME:
{resume_content}

JOB DESCRIPTION:
{job_description}
""".strip()


# -----------------------------
# Provider wrappers (synchronous & streaming)
# Each streaming function below yields text chunks (str)
# -----------------------------

def _call_groq(prompt: str) -> str:
    try:
        from groq import Groq
    except Exception as e:
        raise RuntimeError("groq package not installed") from e

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("Missing GROQ_API_KEY")

    client = Groq(api_key=api_key)
    model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

    res = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "Return only the final answer."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
    )

    content = res.choices[0].message.content or ""
    if not content.strip():
        raise RuntimeError("Groq returned empty response")
    return content.strip()


def _stream_groq(prompt: str) -> Iterator[str]:
    """If Groq supports streaming in your setup, implement here.
    Fallback to a single-block response if not available."""
    text = _call_groq(prompt)
    yield text


def _call_gemini(prompt: str) -> str:
    # synchronous (non-stream) fallback
    try:
        import google.generativeai as genai
    except Exception as e:
        raise RuntimeError("Gemini client not available") from e

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("Missing GEMINI_API_KEY")

    genai.configure(api_key=api_key)
    model_name = os.getenv("GEMINI_MODEL", "gemini-3.7-flash")

    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction="Return only the final answer."
    )

    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(temperature=0.3)
    )

    text = getattr(response, "text", None)
    if not text:
        raise RuntimeError("Gemini returned empty/blocked response")
    return text.strip()


def _stream_gemini(prompt: str) -> Iterator[str]:
    """
    Stream from Gemini safely. The `google.generativeai` package's streaming
    interface may differ across versions. We wrap this and yield partial text
    chunks. If streaming API is unavailable, fall back to single-block call.
    """
    try:
        import google.generativeai as genai
    except Exception:
        # fall back to blocking call
        logger.warning("Gemini client not available for streaming, using blocking call")
        yield _call_gemini(prompt)
        return

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("Missing GEMINI_API_KEY")

    genai.configure(api_key=api_key)
    model_name = os.getenv("GEMINI_MODEL", "gemini-3.7-flash")

    # TRY streaming interface if available (older/newer clients differ)
    try:
        # Some versions provide .stream() or .generate_stream()
        stream = genai.generate_stream(model=model_name, prompt=prompt, temperature=0.3)
    except Exception:
        try:
            # fallback: generate_content and yield whole text
            text = _call_gemini(prompt)
            yield text
            return
        except Exception as e:
            logger.exception("Gemini fallback failed: %s", e)
            raise

    # If we have a stream-like generator
    try:
        buffer = ""
        for event in stream:
            # event may be dict-like; try to extract text pieces safely.
            delta = None
            if isinstance(event, dict):
                # common field names in streaming events:
                delta = event.get("text") or event.get("delta") or event.get("content")
            else:
                # sometimes event is an object with .text
                delta = getattr(event, "text", None)

            if not delta:
                continue

            buffer += delta
            # yield in moderate chunks (every ~256 chars or break lines)
            if len(buffer) > 256 or buffer.endswith("\n"):
                yield buffer
                buffer = ""

        if buffer:
            yield buffer
    except Exception as e:
        logger.exception("Gemini streaming raised: %s", e)
        # bubble up so router can mark failed
        raise


def _call_ollama(prompt: str) -> str:
    base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    model = os.getenv("OLLAMA_MODEL", "llama3.2:3b")

    try:
        res = httpx.post(
            f"{base_url}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.3},
            },
            timeout=300,
        )
        res.raise_for_status()
    except Exception as e:
        raise RuntimeError("Ollama request failed") from e

    data = res.json()
    output = data.get("response", "").strip()

    if not output:
        raise RuntimeError("Ollama returned empty response")

    return output


def _stream_ollama(prompt: str) -> Iterator[str]:
    base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    model = os.getenv("OLLAMA_MODEL", "llama3.2:3b")

    try:
        # Ollama supports streaming if stream=True and SSE-like responses; but not all setups do.
        res = httpx.post(
            f"{base_url}/api/generate",
            json={"model": model, "prompt": prompt, "stream": False, "options": {"temperature": 0.3}},
            timeout=300,
        )
        res.raise_for_status()
        data = res.json()
        yield data.get("response", "").strip()
    except Exception as e:
        logger.exception("Ollama streaming failed: %s", e)
        raise


# -----------------------------
# Public: unified functions
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
    """
    If stream==False -> returns the full text (str).
    If stream==True -> returns an iterator that yields chunks (Iterator[str]).
    """
    prompt = _build_user_prompt(
        resume_content=resume_content,
        job_description=job_description,
        keywords="",  # you may extract keywords beforehand if you wish
        company_name=company_name,
        job_title=job_title,
        job_location=job_location,
    )

    provider = (provider or "groq").lower().strip()

    if stream:
        if provider == "groq":
            return _stream_groq(prompt)
        if provider in ("gemini", "google"):
            return _stream_gemini(prompt)
        # ollama fallback
        return _stream_ollama(prompt)
    else:
        if provider == "groq":
            return _call_groq(prompt)
        if provider in ("gemini", "google"):
            return _call_gemini(prompt)
        return _call_ollama(prompt)