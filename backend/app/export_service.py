import io
import re

from docx import Document
from docx.shared import Pt, Mm, RGBColor
from reportlab.lib.pagesizes import LETTER, A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

# Light accent color per template, used for headings in both DOCX and PDF.
TEMPLATE_ACCENTS = {
    "Original": "6366F1",
    "Classic": "374151",
    "Modern": "EA580C",
    "Oslo": "0284C7",
    "Emerald": "059669",
    "Chicago": "111827",
}


def _lines(text: str) -> list[str]:
    return text.replace("\r\n", "\n").split("\n")


def _clean(text: str) -> str:
    return text.replace("**", "")


def _tokenize_runs(line: str):
    """Split a line into (word, bold) tokens, honoring **bold** markers."""
    tokens = []
    bold = False
    for chunk in re.split(r"(\*\*)", line):
        if chunk == "**":
            bold = not bold
            continue
        for word in chunk.split(" "):
            if word:
                tokens.append((word, bold))
    return tokens


def _accent_hex(settings) -> str:
    template = getattr(settings, "template", None) or "Original"
    return TEMPLATE_ACCENTS.get(template, TEMPLATE_ACCENTS["Original"])


def build_docx(title: str, content: str, settings=None) -> io.BytesIO:
    """Builds a simple, ATS-friendly .docx file from plain resume text.

    `settings` is an optional SettingsSchema (or the DB model) - if given,
    font family/size, margins, and template accent color are applied.
    """
    doc = Document()

    font_family = getattr(settings, "font_family", None) or "Calibri"
    font_size = getattr(settings, "font_size", None) or 11
    margin_mm = getattr(settings, "page_margin_mm", None) or 15
    accent = RGBColor.from_string(_accent_hex(settings))

    style = doc.styles["Normal"]
    style.font.name = font_family
    style.font.size = Pt(font_size)

    for section in doc.sections:
        section.left_margin = Mm(margin_mm)
        section.right_margin = Mm(margin_mm)
        section.top_margin = Mm(margin_mm)
        section.bottom_margin = Mm(margin_mm)

    heading = doc.add_heading(_clean(title), level=1)
    heading.alignment = 0
    for run in heading.runs:
        run.font.color.rgb = accent

    for line in _lines(content):
        stripped = line.strip()
        if not stripped:
            doc.add_paragraph("")
            continue

        is_bullet = stripped.startswith("- ") or stripped.startswith("* ")
        if is_bullet:
            stripped = stripped[2:].strip()

        clean_stripped = _clean(stripped)
        # Treat all-caps short lines as section headers (SUMMARY, EXPERIENCE...)
        if clean_stripped.isupper() and len(clean_stripped.split()) <= 6:
            h = doc.add_heading(clean_stripped, level=2)
            for run in h.runs:
                run.font.color.rgb = accent
            continue

        p = doc.add_paragraph(style="List Bullet" if is_bullet else None)
        for word, bold in _tokenize_runs(stripped):
            run = p.add_run(word + " ")
            run.bold = bold

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf


def _wrap_tokens(c, tokens, font_size, max_width):
    space_w = c.stringWidth(" ", "Helvetica", font_size)
    lines = []
    current = []
    current_w = 0.0
    for word, bold in tokens:
        font = "Helvetica-Bold" if bold else "Helvetica"
        w = c.stringWidth(word, font, font_size)
        add_w = w if not current else w + space_w
        if current and current_w + add_w > max_width:
            lines.append(current)
            current = [(word, bold)]
            current_w = w
        else:
            current.append((word, bold))
            current_w += add_w
    if current:
        lines.append(current)
    return lines or [[]]


def _draw_token_line(c, x, y, tokens, font_size):
    cx = x
    for word, bold in tokens:
        font = "Helvetica-Bold" if bold else "Helvetica"
        c.setFont(font, font_size)
        c.drawString(cx, y, word)
        cx += c.stringWidth(word, font, font_size) + c.stringWidth(" ", font, font_size)


def build_pdf(title: str, content: str, settings=None) -> io.BytesIO:
    """Builds a simple, single-column, ATS-friendly PDF from plain resume text."""
    page_size_name = (getattr(settings, "page_size", None) or "A4").upper()
    page_size = LETTER if page_size_name == "LETTER" else A4
    margin_mm = getattr(settings, "page_margin_mm", None) or 15
    font_size = getattr(settings, "font_size", None) or 10
    line_height = (getattr(settings, "line_height", None) or 1.2) * (font_size + 3)
    accent_hex = _accent_hex(settings)
    accent_rgb = tuple(int(accent_hex[i : i + 2], 16) / 255 for i in (0, 2, 4))

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=page_size)
    width, height = page_size

    margin = margin_mm * mm
    y = height - margin
    max_width = width - 2 * margin

    c.setFillColorRGB(*accent_rgb)
    c.setFont("Helvetica-Bold", font_size + 5)
    c.drawString(margin, y, _clean(title))
    c.setFillColorRGB(0, 0, 0)
    y -= line_height * 2

    c.setFont("Helvetica", font_size)

    def new_page():
        nonlocal y
        c.showPage()
        c.setFont("Helvetica", font_size)
        y = height - margin

    for raw_line in _lines(content):
        stripped = raw_line.strip()
        if not stripped:
            y -= line_height / 2
            if y < margin:
                new_page()
            continue

        is_bullet = stripped.startswith("- ") or stripped.startswith("* ")
        if is_bullet:
            stripped = "\u2022  " + stripped[2:].strip()

        clean_stripped = _clean(stripped)
        is_header = (
            not is_bullet
            and clean_stripped.isupper()
            and len(clean_stripped.split()) <= 6
        )

        if is_header:
            y -= line_height / 2
            if y < margin:
                new_page()
            c.setFillColorRGB(*accent_rgb)
            c.setFont("Helvetica-Bold", font_size + 1)
            c.drawString(margin, y, clean_stripped)
            c.setFillColorRGB(0, 0, 0)
            y -= line_height
            c.setFont("Helvetica", font_size)
            continue

        indent = 12 if is_bullet else 0
        tokens = _tokenize_runs(stripped)
        for token_line in _wrap_tokens(c, tokens, font_size, max_width - indent):
            if y < margin:
                new_page()
            _draw_token_line(c, margin + indent, y, token_line, font_size)
            y -= line_height

    c.save()
    buf.seek(0)
    return buf
