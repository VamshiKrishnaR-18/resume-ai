"""
Lightweight ATS (Applicant Tracking System) keyword matcher.

This mimics what a real ATS does at a basic level: it pulls the meaningful
keywords out of a job description (skills, tools, nouns) and checks how many
of them appear in the resume text. No external API needed - pure Python.
"""

import re
from collections import Counter

# Common English stopwords + generic job-posting filler words we don't want
# to treat as "keywords".
STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "then", "so", "of", "to",
    "in", "on", "for", "with", "at", "by", "from", "up", "about", "into",
    "over", "after", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "should",
    "could", "can", "may", "might", "must", "shall", "this", "that",
    "these", "those", "you", "your", "we", "our", "us", "they", "their",
    "it", "its", "as", "not", "no", "yes", "all", "any", "each", "more",
    "most", "other", "some", "such", "only", "own", "same", "than", "too",
    "very", "just", "also", "job", "work", "role", "team", "years",
    "experience", "including", "including", "etc", "using", "use", "used",
    "including", "strong", "ability", "skills", "skill", "including",
    "requirements", "required", "preferred", "responsibilities", "including",
}

WORD_RE = re.compile(r"[A-Za-z][A-Za-z0-9+.#/-]{1,}")


def _tokenize(text: str) -> list[str]:
    words = WORD_RE.findall(text.lower())
    return [w.strip("-.#/") for w in words if w not in STOPWORDS and len(w) > 1]


def extract_keywords(job_description: str, top_n: int = 30) -> list[str]:
    """Pull the most frequent, meaningful terms out of a job description."""
    tokens = _tokenize(job_description)
    counts = Counter(tokens)
    # Keep terms that appear at least once, ranked by frequency.
    ranked = [word for word, _ in counts.most_common(top_n)]
    return ranked


def score_resume_against_job(resume_text: str, job_description: str) -> dict:
    """
    Returns a dict with:
      - score: 0-100 float, percentage of job keywords found in the resume
      - matched: list of keywords found in the resume
      - missing: list of important keywords NOT found in the resume
    """
    keywords = extract_keywords(job_description, top_n=30)
    resume_tokens = set(_tokenize(resume_text))

    matched = [kw for kw in keywords if kw in resume_tokens]
    missing = [kw for kw in keywords if kw not in resume_tokens]

    score = round((len(matched) / len(keywords)) * 100, 1) if keywords else 0.0

    return {
        "score": score,
        "matched": matched,
        "missing": missing,
    }
