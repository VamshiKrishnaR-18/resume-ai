import os
import httpx
from dotenv import load_dotenv

from .ats_service import extract_keywords

load_dotenv()

# -----------------------------
# Prompt Builder
# -----------------------------

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

Focus keywords:
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
# GROQ
# -----------------------------

def _call_groq(prompt: str) -> str:
    from groq import Groq

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("Missing GROQ_API_KEY")

    client = Groq(api_key=api_key)

    res = client.chat.completions.create(
        model=os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"),
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


def _stream_groq(prompt: str):
    from groq import Groq

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("Missing GROQ_API_KEY")

    client = Groq(api_key=api_key)

    stream = client.chat.completions.create(
        model=os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"),
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        stream=True,
    )

    for chunk in stream:
        content = chunk.choices[0].delta.content or ""
        if content:
            yield content


# -----------------------------
# GEMINI
# -----------------------------

def _call_gemini(prompt: str) -> str:
    import google.generativeai as genai

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("Missing GEMINI_API_KEY")

    genai.configure(api_key=api_key)

    model = genai.GenerativeModel(
        model_name=os.getenv("GEMINI_MODEL", "gemini-3.7-flash"),
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


def _stream_gemini(prompt: str):
    import google.generativeai as genai

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("Missing GEMINI_API_KEY")

    genai.configure(api_key=api_key)

    model = genai.GenerativeModel(
        model_name=os.getenv("GEMINI_MODEL", "gemini-3.7-flash"),
        system_instruction="Return only the final answer."
    )

    stream = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(temperature=0.3),
        stream=True,
    )

    for chunk in stream:
        text = getattr(chunk, "text", None)
        if text:
            yield text


# -----------------------------
# OLLAMA (fallback)
# -----------------------------

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


# -----------------------------
# Fallback Wrapper
# -----------------------------

def _safe_call(prompt: str, provider: str) -> str:
    provider = provider.lower()

    if provider == "groq":
        try:
            return _call_groq(prompt)
        except Exception:
            pass

    if provider in ["groq", "gemini"]:
        try:
            return _call_gemini(prompt)
        except Exception:
            pass

    return _call_ollama(prompt)


# -----------------------------
# PUBLIC API
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
    Generate a tailored resume.
    If stream=True → returns generator
    """

    # 🔹 Trim input (performance safety)
    resume_content = resume_content[:6000]
    job_description = job_description[:6000]

    # 🔹 Extract keywords locally (fast + free)
    keywords_list = extract_keywords(job_description)
    keywords = ", ".join(keywords_list[:20])

    # 🔹 Build prompt
    final_prompt = _build_user_prompt(
        resume_content=resume_content,
        job_description=job_description,
        keywords=keywords,
        company_name=company_name,
        job_title=job_title,
        job_location=job_location,
    )

    # 🔹 Streaming support
    if stream:
        if provider == "groq":
            return _stream_groq(final_prompt)

        if provider == "gemini":
            return _stream_gemini(final_prompt)

    # 🔹 Normal response
    return _safe_call(final_prompt, provider)