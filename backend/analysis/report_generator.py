import uuid
import os
import re
import json
from pathlib import Path
from datetime import datetime
from django.conf import settings

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Image as RLImage,
        Table, TableStyle, Spacer, HRFlowable
    )
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

# Windows font paths with Cyrillic support
_FONT_CANDIDATES = [
    r'C:\Windows\Fonts\arial.ttf',
    r'C:\Windows\Fonts\calibri.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
]
_FONT_BOLD_CANDIDATES = [
    r'C:\Windows\Fonts\arialbd.ttf',
    r'C:\Windows\Fonts\calibrib.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
]

BODY_FONT = 'Helvetica'
BOLD_FONT = 'Helvetica-Bold'


def _register_fonts():
    global BODY_FONT, BOLD_FONT
    if not REPORTLAB_AVAILABLE:
        return
    for path in _FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont('ReportFont', path))
                BODY_FONT = 'ReportFont'
                break
            except Exception:
                pass
    for path in _FONT_BOLD_CANDIDATES:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont('ReportFontBold', path))
                BOLD_FONT = 'ReportFontBold'
                break
            except Exception:
                pass


_register_fonts()


def _safe(text: str) -> str:
    """Ensure string is safe for ReportLab."""
    if not text:
        return '—'
    return str(text).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def _clean_llm_text(text: str) -> str:
    if not text:
        return ''
    cleaned = str(text)
    cleaned = cleaned.replace('\r\n', '\n')
    cleaned = re.sub(r'\*\*(.*?)\*\*', r'\1', cleaned)
    cleaned = re.sub(r'__([^_]+)__', r'\1', cleaned)
    cleaned = re.sub(r'`([^`]+)`', r'\1', cleaned)
    cleaned = re.sub(r'\[(Source|Источник):[^\]]*\]', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    return cleaned.strip()


DEFAULT_REFERENCES = [
    "WHO Classification of Tumours of the Digestive System, 5th Ed.",
    "NCCN Clinical Practice Guidelines in Oncology: Colon Cancer, 2024",
    "AJCC Cancer Staging Manual, 8th Ed.",
    "ESMO Clinical Practice Guidelines for Colorectal Cancer, 2023",
]

_CLASS_INDEX_CACHE = None
INCLUDE_RAG_CONTEXT_SECTION = False


def _is_russian_text(text: str) -> bool:
    return bool(re.search(r'[А-Яа-яЁё]', text or ''))


def _get_class_index() -> dict:
    global _CLASS_INDEX_CACHE
    if _CLASS_INDEX_CACHE is not None:
        return _CLASS_INDEX_CACHE

    index = {}
    kb_path = Path(settings.BASE_DIR) / 'rag' / 'knowledge_base' / 'pathology_classes.json'
    if not kb_path.exists():
        _CLASS_INDEX_CACHE = index
        return index

    try:
        with open(kb_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        for cls in data.get('classes', []):
            index[int(cls.get('id', -1))] = cls
    except Exception:
        index = {}

    _CLASS_INDEX_CACHE = index
    return index


def _get_class_info(class_id):
    try:
        return _get_class_index().get(int(class_id))
    except Exception:
        return None


def _get_report_references(analysis) -> list[str]:
    cls = _get_class_info(getattr(analysis, 'class_id', None)) or {}
    refs = [str(r).strip() for r in (cls.get('references') or []) if str(r).strip()]
    if refs:
        return refs[:4]
    return DEFAULT_REFERENCES[:4]


def _build_structured_medical_context(analysis, is_ru: bool) -> str:
    cls = _get_class_info(getattr(analysis, 'class_id', None))
    if cls:
        if is_ru:
            found = f"признаки класса «{cls.get('name_ru') or cls.get('name') or 'N/A'}»"
            return (
                f"Обнаружены: {found}\n"
                "Контекст RAG: подтверждение и краткая интерпретация по базе знаний."
                " Детальные морфологические критерии приведены в секции выше.\n"
                "Ссылки: [1], [2]"
            )

        found = f"features consistent with class '{cls.get('name') or 'N/A'}'"
        return (
            f"Detected: {found}\n"
            "RAG context: confirmation and concise interpretation from knowledge base."
            " Detailed morphological criteria are provided in the section above.\n"
            "References: [1], [2]"
        )

    # Fallback to existing analysis text, but strip obvious mixed/broken formatting.
    raw = _clean_llm_text(getattr(analysis, 'rag_description', '') or '')
    if not raw:
        return "Нет данных RAG." if is_ru else "No RAG data available."
    lines = [ln.strip() for ln in raw.split('\n') if ln.strip()]
    if is_ru:
        lines = [ln for ln in lines if _is_russian_text(ln) or ln.startswith('---')]
    return '\n'.join(lines[:8])


def _build_detailed_morphology_text(analysis, top1: dict, is_ru: bool) -> str:
    cls = _get_class_info(getattr(analysis, 'class_id', None))
    conf1 = float(top1.get('confidence', 0) or 0)
    tsr_text = f"{analysis.area_percent:.1f}%" if analysis.area_percent is not None else "N/A"

    if is_ru:
        cls_name = (cls or {}).get('name_ru') or top1.get('name_ru') or top1.get('name') or analysis.class_name_ru or analysis.class_name or 'N/A'
        morph = (cls or {}).get('description_ru') or (cls or {}).get('description') or 'Морфологическое описание недоступно.'
        clin = (cls or {}).get('clinical_significance_ru') or (cls or {}).get('clinical_significance') or 'Клиническая интерпретация недоступна.'
        recs = (cls or {}).get('recommendations_ru') or (cls or {}).get('recommendations') or 'Рекомендации недоступны.'
        return (
            f"Класс: {cls_name}. Уверенность модели: {conf1:.1f}%. TSR: {tsr_text}.\n"
            f"Морфология: {morph}\n"
            f"Клиническое значение: {clin}\n"
            f"Рекомендации: {recs}"
        )

    cls_name = (cls or {}).get('name') or top1.get('name') or analysis.class_name or 'N/A'
    morph = (cls or {}).get('description') or (cls or {}).get('description_ru') or 'Morphological description unavailable.'
    clin = (cls or {}).get('clinical_significance') or (cls or {}).get('clinical_significance_ru') or 'Clinical interpretation unavailable.'
    recs = (cls or {}).get('recommendations') or (cls or {}).get('recommendations_ru') or 'Recommendations unavailable.'
    return (
        f"Class: {cls_name}. Model confidence: {conf1:.1f}%. TSR: {tsr_text}.\n"
        f"Morphology: {morph}\n"
        f"Clinical significance: {clin}\n"
        f"Recommendations: {recs}"
    )


def _tsr_interpretation(area_percent) -> str:
    if area_percent is None:
        return "Insufficient data / Недостаточно данных"
    if area_percent >= 50:
        return (
            "Low stromal content (TSR >= 50%): may be associated with a relatively "
            "more favorable prognosis in CRC / Низкое содержание стромы (TSR >= 50%): "
            "может ассоциироваться с более благоприятным прогнозом при КРР"
        )
    return (
        "High stromal content (TSR < 50%): may be associated with a less favorable "
        "prognosis in CRC / Высокое содержание стромы (TSR < 50%): может ассоциироваться "
        "с менее благоприятным прогнозом при КРР"
    )


def _get_differential_diagnosis(top1: dict, top2: dict, area_percent, language: str = 'ru') -> str:
    """
    Ask RAG to compare top-1 vs top-2 class and return differential diagnosis text.
    Falls back to a template string if RAG is unavailable.
    """
    name1 = top1.get('name', 'Class 1')
    name2 = top2.get('name', 'Class 2')
    conf1 = top1.get('confidence', 0)
    conf2 = top2.get('confidence', 0)
    area_str = f"{area_percent:.1f}%" if area_percent is not None else "N/A"

    try:
        from rag.engine import RAGEngine
        rag = RAGEngine.get_instance()
        lang = (language or 'ru').lower()
        if lang.startswith('en'):
            question = (
                f"Compare '{name1}' (confidence {conf1:.1f}%) vs '{name2}' ({conf2:.1f}%) "
                f"for differential diagnosis. Segmentation area: {area_str}. "
                f"What morphological features help distinguish them? "
                f"Reply in English, 3-4 sentences max, cite WHO/NCCN if relevant."
            )
        else:
            question = (
                f"Сравни '{name1}' (уверенность {conf1:.1f}%) и '{name2}' ({conf2:.1f}%) "
                f"в рамках дифференциального диагноза. Площадь сегментации: {area_str}. "
                f"Какие морфологические признаки помогают различить их? "
                f"Ответ на русском, 3-4 предложения, с ссылками на WHO/NCCN при уместности."
            )
        resp = rag.query(question, k=4, language=language)
        answer = _clean_llm_text(resp.get('answer', ''))
        if answer and 'not in the knowledge base' not in answer.lower():
            if (language or 'ru').lower().startswith('en'):
                return (
                    f"Differential diagnosis: {name1} ({conf1:.1f}%) vs {name2} ({conf2:.1f}%). "
                    f"Segmentation TSR: {area_str}.\n\n{answer}"
                )
            return (
                f"Дифференциальный диагноз: {name1} ({conf1:.1f}%) vs {name2} ({conf2:.1f}%). "
                f"TSR сегментации: {area_str}.\n\n{answer}"
            )
    except Exception:
        pass

    # Fallback template
    if (language or 'ru').lower().startswith('en'):
        return (
            f"Differential diagnosis between {name1} ({conf1:.1f}%) and {name2} ({conf2:.1f}%). "
            f"Tumor-Stroma Ratio (TSR) detected by segmentation model: {area_str}. "
            f"Please consult WHO Classification of Tumours 5th Edition for morphological criteria."
        )
    return (
        f"Дифференциальный диагноз между {name1} ({conf1:.1f}%) и {name2} ({conf2:.1f}%). "
        f"TSR, определенный моделью сегментации: {area_str}. "
        f"Для морфологических критериев используйте WHO Classification of Tumours, 5th Ed."
    )


def _get_morphological_analysis(top1: dict, area_percent, language: str = 'ru') -> str:
    name1 = top1.get('name', 'Class 1')
    conf1 = top1.get('confidence', 0)
    area_str = f"{area_percent:.1f}%" if area_percent is not None else "N/A"
    lang = (language or 'ru').lower()
    if lang.startswith('en'):
        prompt = (
            f"Provide a detailed morphological analysis for '{name1}' with confidence {conf1:.1f}%. "
            f"Segmentation TSR: {area_str}. Focus on histological architecture, key atypia signs, "
            f"prognostic implications, and concise practical recommendations. "
            f"Use 4-6 sentences and cite using [1], [2] style where relevant."
        )
    else:
        prompt = (
            f"Дай детализированный морфологический анализ для '{name1}' при уверенности {conf1:.1f}%. "
            f"TSR сегментации: {area_str}. Сделай акцент на архитектуре ткани, признаках атипии, "
            f"прогностическом значении и кратких практических рекомендациях. "
            f"Ответ 4-6 предложений с ссылками в формате [1], [2] при необходимости."
        )

    try:
        from rag.engine import RAGEngine
        rag = RAGEngine.get_instance()
        resp = rag.query(prompt, k=4, language=language)
        answer = _clean_llm_text(resp.get('answer', ''))
        if answer and 'not in the knowledge base' not in answer.lower():
            return answer
    except Exception:
        pass

    if lang.startswith('en'):
        return (
            f"Detailed morphology suggests patterns consistent with {name1} at high model confidence "
            f"({conf1:.1f}%). Correlate nuclear atypia, architecture, and invasion pattern with standard "
            f"histopathological criteria. Integrate TSR ({area_str}) into prognostic interpretation "
            f"and final pathology reporting."
        )
    return (
        f"Детальная морфология соответствует классу {name1} при высокой уверенности модели "
        f"({conf1:.1f}%). Необходимо сопоставить ядерную атипию, архитектуру и инвазивный паттерн "
        f"со стандартными гистопатологическими критериями. Показатель TSR ({area_str}) следует "
        f"учитывать при прогностической интерпретации и финальном заключении."
    )


class ReportGenerator:
    def generate(self, analysis) -> str:
        if not REPORTLAB_AVAILABLE:
            return ''

        name = f"report_{analysis.id}_{uuid.uuid4().hex[:6]}.pdf"
        path = settings.MEDIA_ROOT / 'reports' / name

        doc = SimpleDocTemplate(
            str(path), pagesize=A4,
            leftMargin=2 * cm, rightMargin=2 * cm,
            topMargin=2 * cm, bottomMargin=2 * cm
        )

        def style(font=None, bold_font=None, size=10, color='#1E293B', space_after=4, **kwargs):
            # Allow callers to override leading without passing duplicate kwargs.
            leading = kwargs.pop('leading', size * 1.4)
            return ParagraphStyle(
                f'custom_{uuid.uuid4().hex[:4]}',
                fontName=bold_font or font or BODY_FONT,
                fontSize=size,
                textColor=colors.HexColor(color),
                spaceAfter=space_after,
                leading=leading,
                **kwargs,
            )

        title_s = style(bold_font=BOLD_FONT, size=18, color='#1E3A5F', space_after=6)
        heading_s = style(bold_font=BOLD_FONT, size=13, color='#2563EB', space_after=4)
        subheading_s = style(bold_font=BOLD_FONT, size=10, color='#475569', space_after=3)
        body_s = style(size=10, space_after=4)
        small_s = style(size=8, color='#64748B', space_after=2)
        disclaimer_s = style(size=9, color='#EF4444', space_after=3)
        rag_s = style(size=9.5, color='#1E293B', space_after=3, leading=13)
        is_ru = bool((getattr(analysis, 'class_name_ru', '') or '').strip()) or _is_russian_text(getattr(analysis, 'rag_description', ''))

        def to_p(text):
            return Paragraph(_safe(str(text)), body_s)

        def make_table(rows, col_widths, header_bg, row_bg):
            tbl = Table(rows, colWidths=col_widths, repeatRows=1)
            tbl.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(header_bg)),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), BOLD_FONT),
                ('FONTNAME', (0, 1), (-1, -1), BODY_FONT),
                ('FONTSIZE', (0, 0), (-1, -1), 9.5),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor(row_bg)]),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (0, 0), (-1, -1), 7),
                ('RIGHTPADDING', (0, 0), (-1, -1), 7),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))
            return tbl

        elements = []

        # ── HEADER ──────────────────────────────────────────────
        elements.append(Paragraph("BioVision AI — Biopsy Analysis Report", title_s))
        elements.append(Paragraph(
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}  |  "
            f"Analysis ID: {analysis.id}  |  "
            f"Dataset: NCT-CRC-HE-100K",
            small_s
        ))
        elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#2563EB')))
        elements.append(Spacer(1, 0.3 * cm))

        # ── IMAGES ──────────────────────────────────────────────
        img_entries = [
            (analysis.image_url, 'Original Image'),
            (analysis.gradcam_url, 'Grad-CAM Heatmap'),
            (analysis.overlay_url, 'Segmentation Overlay'),
        ]
        img_row, label_row = [], []
        for url, label in img_entries:
            abs_path = None
            if url:
                rel = url.lstrip('/')
                if rel.startswith('media/'):
                    rel = rel[len('media/'):]
                abs_path = str(settings.MEDIA_ROOT / rel)

            if abs_path and os.path.exists(abs_path):
                try:
                    img_row.append(RLImage(abs_path, width=5.15 * cm, height=5.15 * cm))
                except Exception:
                    img_row.append(Paragraph('(unavailable)', small_s))
            else:
                img_row.append(Paragraph('—', small_s))
            label_row.append(Paragraph(label, small_s))

        img_table = Table([img_row, label_row], colWidths=[5.65 * cm] * 3)
        img_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#F8FAFC')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(img_table)
        elements.append(Spacer(1, 0.5 * cm))

        # ── CLASSIFICATION ──────────────────────────────────────
        elements.append(Paragraph("Classification Results", heading_s))
        cls_rows = [
            [Paragraph('Parameter', subheading_s), Paragraph('Value', subheading_s)],
            [to_p('Class (English)'), to_p(analysis.class_name or '—')],
            [to_p('Class (Russian)'), to_p(analysis.class_name_ru or '—')],
            [to_p('Model Confidence'), to_p(f"{analysis.confidence:.1f}%" if analysis.confidence is not None else '—')],
        ]
        if analysis.top3:
            for i, t3 in enumerate(analysis.top3[:3]):
                cls_rows.append([
                    to_p(f"Top-{i+1}"),
                    to_p(f"{t3.get('name', '')} ({t3.get('confidence', 0):.1f}%)")
                ])
        cls_table = make_table(cls_rows, [8 * cm, 9 * cm], '#2563EB', '#EFF6FF')
        elements.append(cls_table)
        elements.append(Spacer(1, 0.4 * cm))

        # ── SEGMENTATION ────────────────────────────────────────
        elements.append(Paragraph("Segmentation Results", heading_s))
        seg_rows = [
            [Paragraph('Parameter', subheading_s), Paragraph('Value', subheading_s)],
            [to_p('Tumor-Stroma Ratio (TSR)'), to_p(f"{analysis.area_percent:.2f}%" if analysis.area_percent is not None else '—')],
            [to_p('TSR Interpretation'), to_p(_tsr_interpretation(analysis.area_percent))],
            [to_p('Number of Contours'), to_p(str(analysis.contour_count) if analysis.contour_count is not None else '—')],
            [to_p('Model Architecture'), to_p('UNet++ EfficientNet-B5 with TTA (HFlip+VFlip+Rotate90)')],
            [to_p('Threshold'), to_p('0.78')],
        ]
        seg_table = make_table(seg_rows, [8 * cm, 9 * cm], '#10B981', '#F0FDF4')
        elements.append(seg_table)
        elements.append(Spacer(1, 0.4 * cm))

        # ── MODEL INFO ──────────────────────────────────────────
        elements.append(Paragraph("Model Information", heading_s))
        model_rows = [
            [Paragraph('Component', subheading_s), Paragraph('Details', subheading_s)],
            [to_p('Classification Model'), to_p('ConvNeXt Large (timm)')],
            [to_p('Number of Classes'), to_p('12 (NCT-CRC-HE-100K dataset)')],
            [to_p('Input Resolution'), to_p('224x224 RGB')],
            [to_p('Explainability'), to_p('Grad-CAM visualization')],
            [to_p('Segmentation Model'), to_p('UNet++ EfficientNet-B5 (SMP)')],
            [to_p('Segmentation Input'), to_p('256x256 RGB')],
            [to_p('Knowledge Base'), to_p('RAG with ChromaDB + all-MiniLM-L6-v2')],
        ]
        model_table = make_table(model_rows, [8 * cm, 9 * cm], '#7C3AED', '#F5F3FF')
        elements.append(model_table)
        elements.append(Spacer(1, 0.4 * cm))

        # Textual AI sections intentionally removed from PDF by product request.

        doc.build(elements)
        return f'/media/reports/{name}'
