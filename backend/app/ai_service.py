import os

import httpx
from dotenv import load_dotenv

load_dotenv()


def _build_user_prompt(
    resume_content: str,
    job_description: str,
    company_name: str | None = None,
    job_title: str | None = None,
    job_location: str | None = None,
) -> str:
    """Build the prompt used to tailor a resume."""

    company = company_name or "Not provided"
    title = job_title or "Not provided"
    location = job_location or "Not provided"

    return f"""
You are an expert resume writer and ATS optimization specialist.

Create a tailored, ATS-friendly resume using the candidate's original
resume and the job description.

Rules:
1. Use only information already present in the original resume.
2. Do not invent employers, job titles, dates, degrees, certifications,
   projects, technologies, achievements, or metrics.
3. Improve the professional summary and experience bullet points.
4. Use relevant ATS keywords only when supported by the original resume.
5. Keep the resume professional, clear, and easy to read.
6. Return only the completed tailored resume.
7. Do not repeat these instructions.
8. Do not repeat the job description.
9. Do not include explanations or markdown code fences.
10. Keep the candidate's name and contact line (phone | email | location |
    links) as the first two lines, unchanged from the original resume.
11. Write each section header in ALL CAPS on its own line (for example
    PROFESSIONAL SUMMARY, EDUCATION, TECHNICAL SKILLS, WORK EXPERIENCE,
    CERTIFICATIONS).
12. Bold important skills, tools, technologies, methodologies, and job
    titles inline by wrapping them in double asterisks, e.g. **Python**,
    **AWS**, **Data Engineer**. Do not bold entire sentences.
13. Use "- " at the start of a line for bullet points under Work
    Experience or Projects.

Company: {company}
Job Title: {title}
Job Location: {location}

ORIGINAL RESUME:
{resume_content}

JOB DESCRIPTION:
{job_description}
""".strip()


def _tailor_with_openai(user_prompt: str) -> str:
    """Tailor the resume using OpenAI."""

    from openai import OpenAI

    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        raise ValueError(
            "OPENAI_API_KEY is not set. "
            "Add it to backend/.env to use OpenAI."
        )

    client = OpenAI(api_key=api_key)

    model_name = os.getenv(
        "OPENAI_MODEL",
        "gpt-4o-mini",
    )

    response = client.chat.completions.create(
        model=model_name,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert resume writer. "
                    "Return only the completed tailored resume."
                ),
            },
            {
                "role": "user",
                "content": user_prompt,
            },
        ],
        temperature=0.3,
    )

    content = response.choices[0].message.content

    if not content:
        raise RuntimeError(
            "OpenAI returned an empty response."
        )

    return content.strip()


def _tailor_with_claude(user_prompt: str) -> str:
    """Tailor the resume using Anthropic's Claude."""

    from anthropic import Anthropic

    api_key = os.getenv("ANTHROPIC_API_KEY")

    if not api_key:
        raise ValueError(
            "ANTHROPIC_API_KEY is not set. "
            "Add it to backend/.env to use Claude."
        )

    client = Anthropic(api_key=api_key)

    # Override via ANTHROPIC_MODEL in .env if you want a different Claude
    # model - check https://docs.claude.com for current model names.
    model_name = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5")

    response = client.messages.create(
        model=model_name,
        max_tokens=2000,
        temperature=0.3,
        system=(
            "You are an expert resume writer. "
            "Return only the completed tailored resume."
        ),
        messages=[
            {
                "role": "user",
                "content": user_prompt,
            },
        ],
    )

    content = "".join(
        block.text for block in response.content if getattr(block, "type", None) == "text"
    ).strip()

    if not content:
        raise RuntimeError(
            "Claude returned an empty response."
        )

    return content


def _tailor_with_ollama(user_prompt: str) -> str:
    """Tailor the resume using a local Ollama model."""

    base_url = os.getenv(
        "OLLAMA_BASE_URL",
        "http://127.0.0.1:11434",
    ).rstrip("/")

    model_name = os.getenv(
        "OLLAMA_MODEL",
        "llama3.2:1b",
    )

    try:
        response = httpx.post(
            f"{base_url}/api/generate",
            json={
                "model": model_name,
                "prompt": (
                    "Return the completed tailored resume now. "
                    "Do not repeat instructions, rules, or the "
                    "job description.\n\n"
                    + user_prompt
                ),
                "stream": False,
                "options": {
                    "temperature": 0.3,
                },
            },
            timeout=300.0,
        )

        response.raise_for_status()

    except httpx.ConnectError as error:
        raise RuntimeError(
            "Could not connect to Ollama. "
            "Check the service with: "
            "sudo systemctl status ollama"
        ) from error

    except httpx.HTTPStatusError as error:
        error_text = error.response.text

        if (
            error.response.status_code == 404
            and "model" in error_text.lower()
            and "not found" in error_text.lower()
        ):
            raise RuntimeError(
                f"Ollama model '{model_name}' is not installed. "
                f"Install it with:\n"
                f"ollama pull {model_name}"
            ) from error

        raise RuntimeError(
            f"Ollama returned HTTP "
            f"{error.response.status_code}: "
            f"{error_text}"
        ) from error

    result = response.json()

    content = result.get(
        "response",
        "",
    ).strip()

    if not content:
        raise RuntimeError(
            "Ollama returned an empty response."
        )

    return content


def tailor_resume(
    resume_content: str,
    job_description: str,
    company_name: str | None = None,
    job_title: str | None = None,
    job_location: str | None = None,
    model: str = "openai",
) -> str:
    """Tailor a resume using Claude, OpenAI, or a local Ollama model."""

    user_prompt = _build_user_prompt(
        resume_content=resume_content,
        job_description=job_description,
        company_name=company_name,
        job_title=job_title,
        job_location=job_location,
    )

    provider = model.lower().strip()

    if provider == "claude" or provider == "anthropic":
        return _tailor_with_claude(user_prompt)

    if provider == "openai":
        return _tailor_with_openai(user_prompt)

    if provider == "ollama":
        return _tailor_with_ollama(user_prompt)

    raise ValueError(
        "Unsupported AI provider. "
        "Use 'claude', 'openai', or 'ollama'."
    )
