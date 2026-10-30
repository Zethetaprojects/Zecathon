"""Submission evaluation report as a PDF.

One engine (fpdf2) everywhere, so the report a developer sees locally is the same
one production sends. Text uses a Unicode TTF (DejaVu on the server, Arial on
Windows) so rupee signs, curly quotes and dashes from the AI feedback print.
"""
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

_UNICODE_FONTS = [
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"),
]
# Used only when no TTF is installed: the built-in Helvetica covers Latin-1 alone.
_LATIN1_REPLACEMENTS = {
    "₹": "Rs ", "“": '"', "”": '"', "‘": "'", "’": "'", "–": "-", "—": "-",
    "…": "...", "•": "-", "→": "->", "≥": ">=", "≤": "<=", " ": " ",
}

# Palette
INK = (15, 23, 42)
BODY = (51, 65, 85)
MUTED = (100, 116, 139)
RULE = (226, 232, 240)
PANEL = (248, 250, 252)
TRACK = (226, 232, 240)
CYAN = (6, 182, 212)
CYAN_SOFT = (236, 254, 255)
GREEN = (22, 163, 74)
GREEN_SOFT = (240, 253, 244)
AMBER = (217, 119, 6)
AMBER_SOFT = (255, 251, 235)
RED = (220, 38, 38)
RED_SOFT = (254, 242, 242)
VIOLET = (124, 58, 237)

VERDICT_COLORS = {
    "OUTSTANDING": VIOLET,
    "EXCELLENT": GREEN,
    "SATISFACTORY": AMBER,
    "NEEDS WORK": RED,
    "NOT ASSESSABLE": MUTED,
}
AUTHENTICITY_LABELS = {
    "HIGH_HUMAN_INPUT": "High human input",
    "MIXED": "Mixed",
    "PREDOMINANTLY_ASSISTED": "Predominantly AI-assisted",
    "NO_DISCERNIBLE_HUMAN_INPUT": "No discernible human input",
}
SCORER_LABELS = {
    "gemini": "Gemini AI evaluator",
    "generic": "AI evaluator",
    "mock": "Offline fallback scorer",
    "gate": "Admissibility check",
    "suspected_mock": "Offline fallback scorer (legacy)",
}

PAGE_W = 210
MARGIN = 16
CONTENT_W = PAGE_W - 2 * MARGIN


def _to_dict(obj: Any) -> Dict[str, Any]:
    """Normalize a Pydantic model or dict into a plain dict."""
    if obj is None:
        return {}
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if hasattr(obj, "dict"):
        return obj.dict()
    if isinstance(obj, dict):
        return dict(obj)
    return {}


def _score_color(ratio: float) -> Tuple[int, int, int]:
    if ratio >= 0.8:
        return GREEN
    if ratio >= 0.6:
        return CYAN
    if ratio >= 0.4:
        return AMBER
    return RED


def _fmt_date(value: Any) -> str:
    if isinstance(value, datetime):
        return value.strftime("%d %b %Y, %H:%M UTC")
    if isinstance(value, str) and value:
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).strftime("%d %b %Y, %H:%M UTC")
        except ValueError:
            return value
    return ""


def _number(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _make_pdf(header_title: str, footer_note: str = "Zeckathon by Zetheta Algorithms · AI-assisted evaluation, for judges' reference"):
    from fpdf import FPDF

    class _ReportPDF(FPDF):
        def __init__(self):
            super().__init__(format="A4")
            self._unicode_family = None
            for regular, bold in _UNICODE_FONTS:
                if os.path.exists(regular) and os.path.exists(bold):
                    try:
                        self.add_font("ReportSans", "", regular)
                        self.add_font("ReportSans", "B", bold)
                        self._unicode_family = "ReportSans"
                        break
                    except Exception:
                        logger.warning("Could not load font %s", regular)
            self.set_margins(MARGIN, 22, MARGIN)
            self.set_auto_page_break(auto=True, margin=20)
            self.alias_nb_pages()

        def set_font(self, family=None, style="", size=0):
            if self._unicode_family and family and family.lower() in ("helvetica", "arial"):
                family = self._unicode_family
            super().set_font(family, style, size)

        def normalize_text(self, text):
            if not self._unicode_family:
                for old, new in _LATIN1_REPLACEMENTS.items():
                    text = text.replace(old, new)
                text = text.encode("latin-1", "replace").decode("latin-1")
            return super().normalize_text(text)

        def header(self):
            # The first page has its own large banner.
            if self.page_no() == 1:
                return
            self.set_fill_color(*INK)
            self.rect(0, 0, PAGE_W, 12, style="F")
            self.set_xy(MARGIN, 3.5)
            self.set_font("Helvetica", "B", 8)
            self.set_text_color(*CYAN)
            self.cell(30, 5, "ZECKATHON")
            self.set_font("Helvetica", "", 8)
            self.set_text_color(203, 213, 225)
            self.cell(CONTENT_W - 30, 5, header_title, align="R")
            self.set_y(22)

        def footer(self):
            self.set_y(-13)
            self.set_draw_color(*RULE)
            self.line(MARGIN, self.get_y(), PAGE_W - MARGIN, self.get_y())
            self.ln(2)
            self.set_font("Helvetica", "", 7.5)
            self.set_text_color(*MUTED)
            self.cell(CONTENT_W / 2, 5, footer_note)
            self.cell(CONTENT_W / 2, 5, f"Page {self.page_no()} of {{nb}}", align="R")

    return _ReportPDF()


class _Writer:
    """Small layout helpers on top of fpdf2."""

    def __init__(self, pdf):
        self.pdf = pdf

    def lines_needed(self, text: str, width: float, size: float, style: str = "") -> int:
        pdf = self.pdf
        pdf.set_font("Helvetica", style, size)
        return max(1, len(pdf.multi_cell(width, 5, text, dry_run=True, output="LINES")))

    def ensure_space(self, height: float):
        pdf = self.pdf
        if pdf.get_y() + height > pdf.h - pdf.b_margin:
            pdf.add_page()

    def section(self, title: str, accent=CYAN, space_after_title: float = 12):
        pdf = self.pdf
        self.ensure_space(space_after_title + 10)
        pdf.ln(4)
        y = pdf.get_y()
        pdf.set_fill_color(*accent)
        pdf.rect(MARGIN, y + 1, 1.2, 5, style="F")
        pdf.set_xy(MARGIN + 4, y)
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(*INK)
        pdf.cell(CONTENT_W - 4, 7, title, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)

    def paragraph(self, text: str, size: float = 9.5, color=BODY, line_h: float = 5, indent: float = 0):
        pdf = self.pdf
        pdf.set_font("Helvetica", "", size)
        pdf.set_text_color(*color)
        pdf.set_x(MARGIN + indent)
        pdf.multi_cell(CONTENT_W - indent, line_h, text, new_x="LMARGIN", new_y="NEXT")

    def bullets(self, items: List[str], marker_color, marker: str = "•"):
        pdf = self.pdf
        for item in items:
            n = self.lines_needed(item, CONTENT_W - 7, 9.5)
            self.ensure_space(n * 5 + 2)
            y = pdf.get_y()
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(*marker_color)
            pdf.set_xy(MARGIN + 1, y)
            pdf.cell(5, 5, marker)
            pdf.set_font("Helvetica", "", 9.5)
            pdf.set_text_color(*BODY)
            pdf.set_xy(MARGIN + 7, y)
            pdf.multi_cell(CONTENT_W - 7, 5, item, new_x="LMARGIN", new_y="NEXT")
            pdf.ln(1.5)

    def callout(self, text: str, fill, bar, size: float = 9.5):
        """Shaded box with a coloured bar on the left; splits across pages if long."""
        pdf = self.pdf
        pad = 4
        inner_w = CONTENT_W - 2 * pad - 2
        n = self.lines_needed(text, inner_w, size)
        height = n * 5 + 2 * pad
        fits_on_a_page = height < pdf.h - pdf.t_margin - pdf.b_margin - 10
        if fits_on_a_page:
            self.ensure_space(height)
            y = pdf.get_y()
            pdf.set_fill_color(*fill)
            pdf.rect(MARGIN, y, CONTENT_W, height, style="F")
            pdf.set_fill_color(*bar)
            pdf.rect(MARGIN, y, 1.2, height, style="F")
        else:
            y = pdf.get_y()
        pdf.set_xy(MARGIN + pad + 2, y + pad)
        pdf.set_font("Helvetica", "", size)
        pdf.set_text_color(*BODY)
        pdf.multi_cell(inner_w, 5, text, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(pad + 1)

    def bar(self, x: float, y: float, w: float, ratio: float, color, h: float = 2.2):
        pdf = self.pdf
        pdf.set_fill_color(*TRACK)
        pdf.rect(x, y, w, h, style="F")
        filled = max(0.0, min(1.0, ratio)) * w
        if filled > 0:
            pdf.set_fill_color(*color)
            pdf.rect(x, y, filled, h, style="F")


def _banner(pdf, title: str, hackathon: str):
    """Dark first-page banner with the wordmark, a title and the hackathon name."""
    pdf.set_fill_color(*INK)
    pdf.rect(0, 0, PAGE_W, 38, style="F")
    pdf.set_fill_color(*CYAN)
    pdf.rect(0, 38, PAGE_W, 1.2, style="F")
    pdf.set_xy(MARGIN, 11)
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(*CYAN)
    pdf.cell(90, 9, "ZECKATHON")
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(148, 163, 184)
    pdf.set_xy(MARGIN, 21)
    pdf.cell(90, 5, "by Zetheta Algorithms")
    pdf.set_xy(PAGE_W - MARGIN - 90, 11)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(90, 7, title, align="R")
    if hackathon:
        pdf.set_xy(PAGE_W - MARGIN - 110, 19)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(203, 213, 225)
        pdf.multi_cell(110, 4.6, hackathon, align="R", max_line_height=4.6)


def _cover(pdf, w: _Writer, report: Dict[str, Any], evaluation: Dict[str, Any]):
    pdf.add_page()
    _banner(pdf, "Evaluation Report", report.get("hackathon_name") or "")

    # Team and statement
    pdf.set_y(48)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*MUTED)
    pdf.cell(CONTENT_W, 4, "TEAM", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(*INK)
    pdf.multi_cell(CONTENT_W, 8, report.get("team_name") or "Team", new_x="LMARGIN", new_y="NEXT")
    statement = report.get("problem_statement_title") or ""
    if statement:
        pdf.ln(1)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*MUTED)
        pdf.cell(CONTENT_W, 4, "PROBLEM STATEMENT", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10.5)
        pdf.set_text_color(*BODY)
        pdf.multi_cell(CONTENT_W, 5.5, statement, new_x="LMARGIN", new_y="NEXT")

    meta = [
        f"Submission #{report.get('id', '')}",
        f"Round {report.get('round_number')}" if (report.get("round_number") or 1) > 1 else "",
        (report.get("type") or "").replace("_", "-").title() + " track" if report.get("type") else "",
        f"Evaluated {_fmt_date(evaluation.get('evaluated_at'))}" if evaluation.get("evaluated_at") else "",
        SCORER_LABELS.get(evaluation.get("llm_source") or "", ""),
    ]
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(*MUTED)
    pdf.multi_cell(CONTENT_W, 4.5, "   ·   ".join(m for m in meta if m), new_x="LMARGIN", new_y="NEXT")

    if not evaluation:
        return

    # Score panel
    pdf.ln(6)
    y = pdf.get_y()
    total = int(_number(evaluation.get("total_score")))
    pct = _number(evaluation.get("percentage"))
    verdict = str(evaluation.get("verdict") or "")
    verdict_color = VERDICT_COLORS.get(verdict, MUTED)

    hero_w, hero_h = 74, 46
    pdf.set_fill_color(*INK)
    pdf.rect(MARGIN, y, hero_w, hero_h, style="F")
    pdf.set_xy(MARGIN + 6, y + 5)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(148, 163, 184)
    pdf.cell(hero_w - 12, 4, "FINAL SCORE")
    pdf.set_xy(MARGIN + 6, y + 11)
    pdf.set_font("Helvetica", "B", 30)
    pdf.set_text_color(255, 255, 255)
    score_text = str(total)
    score_w = pdf.get_string_width(score_text) + 1.5
    pdf.cell(score_w, 13, score_text)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(148, 163, 184)
    pdf.set_xy(MARGIN + 6 + score_w, y + 16.5)
    pdf.cell(20, 6, "/ 1000")
    w.bar(MARGIN + 6, y + 27, hero_w - 12, total / 1000.0, verdict_color, h=2.4)
    # Verdict pill
    pdf.set_font("Helvetica", "B", 8.5)
    pill_w = pdf.get_string_width(verdict) + 8 if verdict else 0
    if verdict:
        pdf.set_fill_color(*verdict_color)
        pdf.rect(MARGIN + 6, y + 34, pill_w, 7, style="F")
        pdf.set_xy(MARGIN + 6, y + 34)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(pill_w, 7, verdict, align="C")
    pdf.set_xy(MARGIN + 6 + pill_w + 3, y + 34)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(25, 7, f"{pct:.1f}%")

    # Side stats
    gap = 4
    sx = MARGIN + hero_w + gap
    sw = (CONTENT_W - hero_w - gap - gap) / 2
    sh = (hero_h - gap) / 2
    multiplier = _number(evaluation.get("multiplier"))
    band = evaluation.get("authenticity_band") or ""
    needs_review = bool(evaluation.get("needs_review"))
    stats = [
        ("RUBRIC SCORE", f"{int(_number(evaluation.get('raw_score')))} / 1000", "Before authenticity adjustment", INK),
        ("AUTHENTICITY", AUTHENTICITY_LABELS.get(band, band.replace("_", " ").title() or "-"), f"Score multiplier ×{multiplier:.2f}",
         GREEN if multiplier >= 1 else AMBER),
        ("REVIEW STATUS", "Needs a judge's review" if needs_review else "No review needed",
         "See review flags below" if needs_review else "No concerns raised", AMBER if needs_review else GREEN),
        ("CATEGORIES", f"{len(evaluation.get('category_scores') or {})} rubric areas", "Scored individually below", INK),
    ]
    for i, (label, value, sub, color) in enumerate(stats):
        cx = sx + (i % 2) * (sw + gap)
        cy = y + (i // 2) * (sh + gap)
        pdf.set_fill_color(*PANEL)
        pdf.set_draw_color(*RULE)
        pdf.rect(cx, cy, sw, sh, style="DF", round_corners=True, corner_radius=2.5)
        pdf.set_xy(cx + 4, cy + 3.5)
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(*MUTED)
        pdf.cell(sw - 8, 3.5, label)
        pdf.set_xy(cx + 4, cy + 8)
        pdf.set_font("Helvetica", "B", 9.5)
        pdf.set_text_color(*color)
        pdf.multi_cell(sw - 8, 4.5, value, max_line_height=4.5)
        pdf.set_xy(cx + 4, cy + sh - 6.5)
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(*MUTED)
        pdf.cell(sw - 8, 3.5, sub)
    pdf.set_y(y + hero_h + 2)


def _rubric(pdf, w: _Writer, evaluation: Dict[str, Any]):
    scores = evaluation.get("category_scores") or {}
    if not scores:
        return
    maxes = evaluation.get("category_max_points") or {}
    explanations = evaluation.get("category_explanations") or {}

    w.section("Rubric breakdown")
    for category, score in scores.items():
        value = _number(score)
        max_points = _number(maxes.get(category))
        ratio = value / max_points if max_points else 0.0
        color = _score_color(ratio)
        explanation = str(explanations.get(category) or "").strip()
        expl_lines = w.lines_needed(explanation, CONTENT_W - 4, 9) if explanation else 0
        w.ensure_space(17 + expl_lines * 4.6)

        y = pdf.get_y()
        pdf.set_xy(MARGIN, y)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*INK)
        pdf.cell(CONTENT_W - 40, 6, str(category))
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*color)
        score_label = f"{value:g}" + (f" / {max_points:g}" if max_points else "")
        pdf.cell(40, 6, score_label, align="R", new_x="LMARGIN", new_y="NEXT")
        w.bar(MARGIN, pdf.get_y() + 1, CONTENT_W, ratio, color)
        pdf.set_y(pdf.get_y() + 5)
        if explanation:
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*BODY)
            pdf.multi_cell(CONTENT_W, 4.6, explanation, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2.5)
        pdf.set_draw_color(*RULE)
        pdf.line(MARGIN, pdf.get_y(), PAGE_W - MARGIN, pdf.get_y())
        pdf.ln(3)


def _list_section(pdf, w: _Writer, title: str, items: List[str], color, marker: str):
    items = [str(i).strip() for i in (items or []) if str(i).strip()]
    if not items:
        return
    w.section(title, accent=color)
    w.bullets(items, color, marker)


def _judge_questions(pdf, w: _Writer, questions: List[str]):
    questions = [str(q).strip() for q in (questions or []) if str(q).strip()]
    if not questions:
        return
    w.section("Suggested questions for the judges", accent=VIOLET)
    for idx, question in enumerate(questions, 1):
        n = w.lines_needed(question, CONTENT_W - 12, 9.5)
        w.ensure_space(n * 5 + 4)
        y = pdf.get_y()
        pdf.set_fill_color(*VIOLET)
        pdf.rect(MARGIN, y + 0.3, 6.5, 6.5, style="F")
        pdf.set_xy(MARGIN, y + 0.3)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(6.5, 6.5, str(idx), align="C")
        pdf.set_xy(MARGIN + 10, y + 1)
        pdf.set_font("Helvetica", "", 9.5)
        pdf.set_text_color(*BODY)
        pdf.multi_cell(CONTENT_W - 10, 5, question, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2.5)


def _links(pdf, w: _Writer, report: Dict[str, Any]):
    links = [
        ("Project document", report.get("submission_url")),
        ("GitHub repository", report.get("github_url")),
        ("Presentation", report.get("ppt_url")),
    ]
    links = [(label, url) for label, url in links if url and str(url).startswith("http")]
    if not links:
        return
    w.section("Submitted material", accent=MUTED)
    for label, url in links:
        w.ensure_space(6)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*INK)
        pdf.cell(40, 5, label)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*CYAN)
        pdf.multi_cell(CONTENT_W - 40, 5, str(url), link=str(url), new_x="LMARGIN", new_y="NEXT")


def _problem_statement(pdf, w: _Writer, title: str, description: str, has_attachment: bool, heading: str):
    """The full problem statement text, so judges can read what the team was asked to do."""
    if not (title or description):
        return
    w.section(heading, accent=MUTED)
    if title:
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(*INK)
        pdf.multi_cell(CONTENT_W, 6, title, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1.5)
    if description and description.strip():
        w.paragraph(description.strip(), size=9.5, line_h=5)
    else:
        w.paragraph("No written description was provided for this statement.", size=9.5, color=MUTED)
    if has_attachment:
        pdf.ln(2)
        w.paragraph("The organisers also attached a brief file to this statement; open it from the hackathon page "
                    "or the reports page.", size=8.5, color=MUTED)


def _no_evaluation(pdf, w: _Writer):
    w.section("Not evaluated yet", accent=AMBER)
    w.callout("This submission has not been evaluated. Run the evaluation from the hackathon's submissions page, "
              "then download the report again.", AMBER_SOFT, AMBER)


def generate_pdf(report: Any) -> bytes:
    """Render a SubmissionReport (model or dict) as a PDF and return the bytes."""
    try:
        import fpdf  # noqa: F401
    except ImportError as exc:  # pragma: no cover
        raise ImportError("fpdf2 is required to generate reports") from exc

    report = _to_dict(report)
    evaluation: Dict[str, Any] = report.get("evaluation") or {}
    header_title = " · ".join(x for x in (report.get("team_name"), report.get("hackathon_name")) if x)

    pdf = _make_pdf(header_title)
    pdf.set_title(f"Evaluation report - {report.get('team_name') or 'Team'}")
    pdf.set_author("Zeckathon")
    w = _Writer(pdf)

    _cover(pdf, w, report, evaluation)

    if not evaluation:
        _no_evaluation(pdf, w)
        return bytes(pdf.output())

    assessment: Optional[str] = evaluation.get("overall_assessment")
    if assessment:
        w.section("Overall assessment")
        w.callout(assessment, CYAN_SOFT, CYAN, size=10)

    _rubric(pdf, w, evaluation)
    _list_section(pdf, w, "Key strengths", evaluation.get("key_strengths"), GREEN, "+")
    _list_section(pdf, w, "Areas for improvement", evaluation.get("areas_for_improvement"), AMBER, "›")

    flags = [str(f).strip() for f in (evaluation.get("review_flags") or []) if str(f).strip()]
    if flags:
        w.section("Review flags", accent=RED)
        w.bullets(flags, RED, "!")

    if evaluation.get("review_note"):
        who = evaluation.get("reviewed_by") or "a judge"
        when = _fmt_date(evaluation.get("reviewed_at"))
        w.section("Judge review", accent=GREEN)
        w.callout(f"{evaluation['review_note']}\n\nReviewed by {who}{f' on {when}' if when else ''}.", GREEN_SOFT, GREEN)

    _judge_questions(pdf, w, evaluation.get("judge_questions"))
    _links(pdf, w, report)
    _problem_statement(
        pdf, w,
        report.get("problem_statement_title") or "",
        report.get("problem_statement_description") or "",
        bool(report.get("problem_statement_file")),
        "Problem statement the team took on",
    )

    return bytes(pdf.output())


def generate_problem_statement_pdf(statement: Dict[str, Any]) -> bytes:
    """A problem statement on its own: title, hackathon and full description."""
    title = statement.get("title") or "Problem statement"
    hackathon = statement.get("hackathon_name") or ""
    pdf = _make_pdf(" · ".join(x for x in (title, hackathon) if x), "Zeckathon by Zetheta Algorithms")
    pdf.set_title(f"Problem statement - {title}")
    pdf.set_author("Zeckathon")
    w = _Writer(pdf)
    pdf.add_page()
    _banner(pdf, "Problem Statement", hackathon)
    pdf.set_y(48)
    _problem_statement(pdf, w, title, statement.get("description") or "", bool(statement.get("file_path")), "Problem statement")
    return bytes(pdf.output())
