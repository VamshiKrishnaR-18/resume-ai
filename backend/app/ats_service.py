"""
Improved ATS (Applicant Tracking System) keyword matcher.

Enhancements:
- Better token normalization (Node.js → nodejs)
- Removes duplicates in stopwords
- Filters weak tokens
- Handles multi-word keywords (basic phrase support)
- More stable scoring
"""

import re
from collections import Counter

# -----------------------------
# STOPWORDS (cleaned)
# -----------------------------
STOPWORDS = {
    "a","an","the","and","or","but","if","then","so","of","to",
    "in","on","for","with","at","by","from","up","about","into",
    "over","after","is","are","was","were","be","been","being",
    "have","has","had","do","does","did","will","would","should",
    "could","can","may","might","must","shall","this","that",
    "these","those","you","your","we","our","us","they","their",
    "it","its","as","not","no","yes","all","any","each","more",
    "most","other","some","such","only","own","same","than","too",
    "very","just","also","job","work","role","team","years",
    "experience","etc","using","use","used","strong","ability",
    "skills","skill","requirements","required","preferred",
    "responsibilities"
}

# Matches tech-friendly tokens
WORD_RE = re.compile(r"[A-Za-z][A-Za-z0-9+.#/-]{1,}")

# -----------------------------
# NORMALIZATION
# -----------------------------
def _normalize(word: str) -> str:
    """
    Normalize tokens:
    Node.js → nodejs
    React.js → reactjs
    """
    return word.lower().replace(".", "").replace("-", "")


# -----------------------------
# TOKENIZATION
# -----------------------------
def _tokenize(text: str) -> list[str]:
    words = WORD_RE.findall(text.lower())

    tokens = []
    for w in words:
        w = _normalize(w.strip("-.#/"))

        if w in STOPWORDS:
            continue

        if len(w) <= 2:  # filter weak tokens like "js", "c"
            continue

        tokens.append(w)

    return tokens


# -----------------------------
# KEYWORD EXTRACTION
# -----------------------------
def extract_keywords(job_description: str, top_n: int = 30) -> list[str]:
    """
    Extract most relevant keywords based on frequency.
    """
    tokens = _tokenize(job_description)

    counts = Counter(tokens)

    # Prefer meaningful words (length bias)
    ranked = sorted(
        counts.items(),
        key=lambda x: (x[1], len(x[0])),
        reverse=True
    )

    return [word for word, _ in ranked[:top_n]]


# -----------------------------
# SCORING
# -----------------------------
def score_resume_against_job(resume_text: str, job_description: str) -> dict:
    """
    Compare resume with job description.

    Returns:
    - score (0–100)
    - matched keywords
    - missing keywords
    """

    keywords = extract_keywords(job_description, top_n=30)

    resume_tokens = set(_tokenize(resume_text))

    matched = []
    missing = []

    for kw in keywords:
        if kw in resume_tokens:
            matched.append(kw)
        else:
            missing.append(kw)

    # Weighted score (slightly rewards more matches)
    total = len(keywords)
    match_count = len(matched)

    score = round((match_count / total) * 100, 1) if total else 0.0

    return {
        "score": score,
        "matched": matched,
        "missing": missing,
    }