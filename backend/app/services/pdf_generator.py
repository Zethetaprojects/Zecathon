import logging
from pathlib import Path
from typing import Any, Dict

from jinja2 import Environment, FileSystemLoader, select_autoescape

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
TEMPLATE_DIR = BASE_DIR / "templates"

_jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


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


def _render_html(report: Any) -> str:
    report_dict = _to_dict(report)
    evaluation = report_dict.get("evaluation") or {}
    template = _jinja_env.get_template("report.html")
    return template.render(
        team_name=report_dict.get("team_name", "Team"),
        problem_statement_title=report_dict.get("problem_statement_title", ""),
        hackathon_name=report_dict.get("hackathon_name", ""),
        type=report_dict.get("type", ""),
        submission_url=report_dict.get("submission_url", ""),
        github_url=report_dict.get("github_url", ""),
        ppt_url=report_dict.get("ppt_url", ""),
        created_at=str(report_dict.get("created_at", "")),
        evaluation=evaluation,
    )


def _generate_with_weasyprint(html: str) -> bytes:
    try:
        import weasyprint
    except ImportError as exc:  # pragma: no cover
        raise ImportError("WeasyPrint is not installed") from exc

    logger.info("Generating PDF with WeasyPrint")
    return weasyprint.HTML(string=html).write_pdf()


def _generate_with_fpdf(report: Dict[str, Any]) -> bytes:
    """Fallback PDF generator for environments without WeasyPrint (e.g., Windows dev)."""
    try:
        from fpdf import FPDF
    except ImportError as exc:  # pragma: no cover
        raise ImportError("No PDF engine available; install weasyprint or fpdf2") from exc

    logger.info("Generating PDF with fpdf2 fallback")
    evaluation = report.get("evaluation") or {}
    category_scores = evaluation.get("category_scores", {})
    category_max = evaluation.get("category_max_points", {})
    category_explanations = evaluation.get("category_explanations", {})

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Header
    pdf.set_fill_color(15, 23, 42)
    pdf.set_draw_color(15, 23, 42)
    pdf.rect(10, 10, 190, 30, style="F")
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(255, 255, 255)
    pdf.set_xy(15, 16)
    pdf.cell(0, 8, "ZECATHON", new_x="RIGHT", new_y="TOP")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_xy(15, 26)
    pdf.cell(0, 5, "by Zetheta Algorithms", new_x="RIGHT", new_y="TOP")
    pdf.set_xy(150, 18)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "Evaluation Report", new_x="RIGHT", new_y="TOP")

    # Meta
    pdf.set_text_color(30, 41, 59)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_xy(10, 45)
    pdf.cell(0, 7, f"Team: {report.get('team_name', 'Team')}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"Problem statement: {report.get('problem_statement_title', '')}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Type: {report.get('type', '').replace('_', '-').title()}", new_x="LMARGIN", new_y="NEXT")

    # Score cards
    y = 70
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_xy(10, y)
    pdf.cell(48, 8, "Total Score", border=1, align="C")
    pdf.cell(48, 8, "Percentage", border=1, align="C")
    pdf.cell(48, 8, "Verdict", border=1, align="C")
    pdf.cell(48, 8, "Authenticity", border=1, align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(48, 10, str(evaluation.get("total_score", 0)), border=1, align="C")
    pdf.cell(48, 10, f"{evaluation.get('percentage', 0):.1f}%", border=1, align="C")
    pdf.cell(48, 10, str(evaluation.get("verdict", "")), border=1, align="C")
    pdf.cell(48, 10, str(evaluation.get("authenticity_band", "").replace("_", " ").title()), border=1, align="C", new_x="LMARGIN", new_y="NEXT")

    y = pdf.get_y() + 8

    # Overall assessment
    if evaluation.get("overall_assessment"):
        pdf.set_xy(10, y)
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(6, 182, 212)
        pdf.cell(0, 7, "Overall Assessment", new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(30, 41, 59)
        pdf.set_font("Helvetica", "", 10)
        pdf.multi_cell(0, 6, str(evaluation["overall_assessment"]))
        y = pdf.get_y() + 6

    # Rubric breakdown
    pdf.set_xy(10, y)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(6, 182, 212)
    pdf.cell(0, 7, "Rubric Breakdown", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(255, 255, 255)
    pdf.set_fill_color(15, 23, 42)
    pdf.cell(140, 8, "Category", border=1, align="L", fill=True)
    pdf.cell(50, 8, "Score", border=1, align="C", fill=True, new_x="LMARGIN", new_y="NEXT")

    pdf.set_text_color(30, 41, 59)
    pdf.set_font("Helvetica", "", 9)
    for category, score in category_scores.items():
        max_points = category_max.get(category, 0)
        explanation = category_explanations.get(category, "")
        line = f"{category} ({score}/{max_points})"
        if explanation:
            line += f" - {explanation}"
        pdf.cell(140, 7, line, border=1)
        pdf.cell(50, 7, f"{score} / {max_points}", border=1, align="C", new_x="LMARGIN", new_y="NEXT")

    y = pdf.get_y() + 6

    # Strengths / improvements
    if evaluation.get("key_strengths") or evaluation.get("areas_for_improvement"):
        pdf.set_xy(10, y)
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(6, 182, 212)
        pdf.cell(0, 7, "Strengths & Improvements", new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(30, 41, 59)
        pdf.set_font("Helvetica", "", 9)
        if evaluation.get("key_strengths"):
            pdf.set_font("Helvetica", "B", 9)
            pdf.cell(0, 6, "Key Strengths", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 9)
            for item in evaluation["key_strengths"]:
                pdf.cell(5, 5, "", new_x="RIGHT", new_y="TOP")
                pdf.multi_cell(0, 5, f"- {item}")
        if evaluation.get("areas_for_improvement"):
            pdf.set_font("Helvetica", "B", 9)
            pdf.cell(0, 6, "Areas for Improvement", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 9)
            for item in evaluation["areas_for_improvement"]:
                pdf.cell(5, 5, "", new_x="RIGHT", new_y="TOP")
                pdf.multi_cell(0, 5, f"- {item}")
        y = pdf.get_y() + 6

    # Judge questions
    if evaluation.get("judge_questions"):
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(6, 182, 212)
        pdf.cell(0, 7, "Suggested Judge Questions", new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(30, 41, 59)
        pdf.set_font("Helvetica", "", 10)
        for idx, question in enumerate(evaluation["judge_questions"], 1):
            pdf.multi_cell(0, 6, f"{idx}. {question}")
            pdf.ln(2)

    return bytes(pdf.output())


def generate_pdf(report: Any) -> bytes:
    """Generate a professional PDF report from a SubmissionReport object/dict.

    Primary engine: WeasyPrint (HTML/CSS). Fallback: fpdf2.
    """
    report_dict = _to_dict(report)
    try:
        html = _render_html(report_dict)
        return _generate_with_weasyprint(html)
    except Exception as exc:
        logger.warning("WeasyPrint PDF generation failed (%s); falling back to fpdf2", exc)
        return _generate_with_fpdf(report_dict)
