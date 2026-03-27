import csv
import os
from django.http import HttpResponse, FileResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings

from .models import Analysis
from analysis.report_generator import ReportGenerator


class HistoryListView(APIView):
    def get(self, request):
        qs = Analysis.objects.all()

        # Filters
        class_id = request.query_params.get('class_id')
        if class_id is not None:
            qs = qs.filter(class_id=class_id)

        date_from = request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)

        date_to = request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        page = int(request.query_params.get('page', 1))
        per_page = int(request.query_params.get('per_page', 20))
        total = qs.count()
        qs = qs[(page - 1) * per_page: page * per_page]

        data = [_serialize(a) for a in qs]
        return Response({'results': data, 'total': total, 'page': page, 'per_page': per_page})


class AnalysisDetailView(APIView):
    def get(self, request, pk):
        try:
            a = Analysis.objects.get(pk=pk)
        except Analysis.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        return Response(_serialize(a))

    def delete(self, request, pk):
        try:
            a = Analysis.objects.get(pk=pk)
        except Analysis.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        media_fields = [a.image_url, a.mask_url, a.overlay_url, a.gradcam_url, a.report_url]
        for media_url in media_fields:
            _delete_media_file(media_url)

        a.delete()
        return Response({'ok': True}, status=status.HTTP_200_OK)


class ReportView(APIView):
    def get(self, request, pk):
        try:
            a = Analysis.objects.get(pk=pk)
        except Analysis.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        force_regen = str(request.query_params.get('force', '')).strip().lower() in {'1', 'true', 'yes'}

        if force_regen and a.report_url:
            _delete_media_file(a.report_url)
            a.report_url = ''
            a.save(update_fields=['report_url'])

        if a.report_url and os.path.exists(settings.MEDIA_ROOT / a.report_url.lstrip('/media/')):
            path = settings.MEDIA_ROOT / a.report_url.lstrip('/media/')
            response = FileResponse(
                open(path, 'rb'),
                content_type='application/pdf',
                as_attachment=True,
                filename=f'report_{pk}_{a.created_at:%Y%m%d_%H%M%S}.pdf',
            )
            response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            response['Pragma'] = 'no-cache'
            response['Expires'] = '0'
            return response

        # Generate on the fly
        gen = ReportGenerator()
        report_url = gen.generate(a)
        a.report_url = report_url
        a.save(update_fields=['report_url'])

        path = settings.MEDIA_ROOT / report_url.lstrip('/media/')
        response = FileResponse(
            open(str(path), 'rb'),
            content_type='application/pdf',
            as_attachment=True,
            filename=f'report_{pk}_{a.created_at:%Y%m%d_%H%M%S}.pdf',
        )
        response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        return response


CRITICAL_CONFIDENCE = 60.0   # below this → "needs validation"
LOW_CONFIDENCE      = 75.0   # below this → shown in needs_validation list


class StatsView(APIView):
    def get(self, request):
        from django.db.models import Count, Avg, FloatField
        from django.db.models.functions import TruncDate
        from django.utils import timezone
        import datetime

        now   = timezone.now()
        today = now.date()
        week_ago      = today - datetime.timedelta(days=7)
        two_weeks_ago = today - datetime.timedelta(days=14)

        total        = Analysis.objects.count()
        this_week    = Analysis.objects.filter(created_at__date__gte=week_ago).count()
        last_week    = Analysis.objects.filter(
            created_at__date__gte=two_weeks_ago,
            created_at__date__lt=week_ago
        ).count()
        week_delta_pct = (
            round((this_week - last_week) / max(last_week, 1) * 100, 1)
            if last_week else None
        )

        critical_count = Analysis.objects.filter(confidence__lt=CRITICAL_CONFIDENCE).count()
        avg_conf = Analysis.objects.aggregate(v=Avg('confidence'))['v']
        avg_conf = round(avg_conf, 1) if avg_conf else None

        # Class distribution
        class_dist = list(
            Analysis.objects
            .values('class_id', 'class_name', 'class_name_ru')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        # Timeline: analyses per day for last 14 days
        timeline = list(
            Analysis.objects
            .filter(created_at__date__gte=two_weeks_ago)
            .annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(count=Count('id'))
            .order_by('day')
        )
        timeline_data = [
            {'date': str(t['day']), 'count': t['count']}
            for t in timeline
        ]

        # Avg confidence per class
        conf_per_class = list(
            Analysis.objects
            .values('class_id', 'class_name')
            .annotate(avg_conf=Avg('confidence'), count=Count('id'))
            .order_by('class_id')
        )

        # Needs validation: recent low-confidence
        needs_validation = list(
            Analysis.objects
            .filter(confidence__lt=LOW_CONFIDENCE)
            .order_by('confidence')[:10]
            .values('id', 'class_id', 'class_name', 'class_name_ru',
                    'confidence', 'created_at', 'image_url')
        )

        # Urgent: high-confidence adenocarcinoma (class_id=8, confidence>85)
        urgent_count = Analysis.objects.filter(
            confidence__gt=85.0, class_id=8
        ).count()

        # RAG / model status
        from classification.inference import ClassificationEngine
        from segmentation.inference import SegmentationEngine
        from rag.engine import RAGEngine
        rag_instance = RAGEngine.get_instance()
        model_status = {
            'classification': ClassificationEngine.get_instance().model is not None,
            'segmentation':   SegmentationEngine.get_instance().model is not None,
            'rag_collection': rag_instance.collection is not None,
            'rag_docs':       rag_instance.collection.count()
                              if rag_instance.collection else 0,
        }

        # AI insights summary line
        ai_insights = _build_ai_insights(
            total=total, this_week=this_week, critical_count=critical_count,
            urgent_count=urgent_count, avg_conf=avg_conf,
            class_dist=class_dist, conf_per_class=conf_per_class,
        )

        return Response({
            'total':            total,
            'this_week':        this_week,
            'week_delta_pct':   week_delta_pct,
            'critical_count':   critical_count,
            'urgent_count':     urgent_count,
            'avg_confidence':   avg_conf,
            'class_distribution': class_dist,
            'timeline':         timeline_data,
            'conf_per_class':   conf_per_class,
            'needs_validation': needs_validation,
            'model_status':     model_status,
            'ai_insights':      ai_insights,
        })


class ExportCSVView(APIView):
    def get(self, request):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="analyses.csv"'
        writer = csv.writer(response)
        writer.writerow(['ID', 'Date', 'Class ID', 'Class Name', 'Confidence', 'Area %'])
        for a in Analysis.objects.all():
            writer.writerow([
                a.id,
                a.created_at.strftime('%Y-%m-%d %H:%M'),
                a.class_id,
                a.class_name,
                a.confidence,
                a.area_percent,
            ])
        return response


def _serialize(a: Analysis) -> dict:
    return {
        'id': a.id,
        'created_at': a.created_at.isoformat(),
        'image_url': a.image_url,
        'class_id': a.class_id,
        'class_name': a.class_name,
        'class_name_ru': a.class_name_ru,
        'confidence': a.confidence,
        'top3': a.top3,
        'mask_url': a.mask_url,
        'overlay_url': a.overlay_url,
        'area_percent': a.area_percent,
        'tsr_percent': a.tsr_percent,
        'contour_count': a.contour_count,
        'gradcam_url': a.gradcam_url,
        'rag_description': a.rag_description,
        'report_url': a.report_url,
        'is_urgent': a.is_urgent,
    }


def _build_ai_insights(total, this_week, critical_count, urgent_count,
                       avg_conf, class_dist, conf_per_class) -> str:
    """Generate a plain-text AI summary line from real DB stats."""
    parts = []

    if this_week:
        parts.append(f"За последние 7 дней обработано {this_week} образцов.")

    if urgent_count:
        parts.append(f"Выявлено {urgent_count} срочных случаев аденокарциномы (уверенность >85%).")
    elif critical_count:
        parts.append(f"{critical_count} анализов требуют дополнительной валидации (уверенность <60%).")

    if avg_conf is not None:
        quality = "высокое" if avg_conf >= 80 else "умеренное" if avg_conf >= 60 else "низкое"
        parts.append(f"Среднее качество классификации: {avg_conf}% ({quality}).")

    if class_dist:
        top = class_dist[0]
        name = top.get('class_name_ru') or top.get('class_name', '?')
        parts.append(f"Наиболее часто встречается: «{name}» ({top['count']} сл.).")

    # Find class with lowest avg confidence
    if conf_per_class:
        worst = min(conf_per_class, key=lambda x: x.get('avg_conf') or 100)
        if worst.get('avg_conf', 100) < 50:
            wname = worst.get('class_name_ru') or worst.get('class_name', '?')
            parts.append(
                f"Рекомендуется проверка класса «{wname}» — "
                f"средняя уверенность {worst['avg_conf']:.1f}%."
            )

    if not parts:
        return "Нет данных для анализа. Загрузите первый образец."

    return " ".join(parts)


def _delete_media_file(media_url: str):
    if not media_url:
        return
    try:
        rel = str(media_url).lstrip('/')
        if rel.startswith('media/'):
            rel = rel[len('media/'):]
        path = settings.MEDIA_ROOT / rel
        if path.exists() and path.is_file():
            path.unlink(missing_ok=True)
    except Exception:
        # Keep delete endpoint robust even if file cleanup fails.
        pass
