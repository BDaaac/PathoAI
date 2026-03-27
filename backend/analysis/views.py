import uuid
import numpy as np
from PIL import Image
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from django.conf import settings

from classification.inference import ClassificationEngine, apply_gradcam_overlay
from segmentation.inference import SegmentationEngine
from history.models import Analysis


class FullAnalysisView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        language = request.data.get('language', 'ru')
        if 'image' not in request.FILES:
            return Response({'error': 'No image provided'}, status=400)

        file = request.FILES['image']
        if not file.name.lower().endswith(('.png', '.jpg', '.jpeg', '.tiff', '.bmp')):
            return Response({'error': 'Invalid file format'}, status=400)
        if file.size > 20 * 1024 * 1024:
            return Response({'error': 'File too large'}, status=400)

        try:
            image = Image.open(file).convert('RGB')
        except Exception:
            return Response({'error': 'Cannot open image'}, status=400)

        uid = uuid.uuid4().hex

        # Ensure all media dirs exist
        for d in ('uploads', 'gradcam', 'masks', 'overlays', 'reports'):
            (settings.MEDIA_ROOT / d).mkdir(parents=True, exist_ok=True)

        # Save original
        upload_name = f"{uid}.jpg"
        upload_path = settings.MEDIA_ROOT / 'uploads' / upload_name
        image.save(str(upload_path), 'JPEG')
        image_url = f'/media/uploads/{upload_name}'

        # Classification
        cls_engine = ClassificationEngine.get_instance()
        cls_result = cls_engine.predict_with_gradcam(image)

        gradcam_url = ''
        if cls_result.get('gradcam_map') is not None:
            overlay = apply_gradcam_overlay(image, cls_result['gradcam_map'])
            gc_name = f"gradcam_{uid}.jpg"
            gc_path = settings.MEDIA_ROOT / 'gradcam' / gc_name
            overlay_arr = np.clip(overlay, 0, 255).astype(np.uint8)
            Image.fromarray(overlay_arr, mode='RGB').save(gc_path, format='JPEG', quality=92)
            if gc_path.exists():
                gradcam_url = f'/media/gradcam/{gc_name}'

        # Segmentation
        seg_engine = SegmentationEngine.get_instance()
        seg_result = seg_engine.predict(image)

        mask_name = f"mask_{uid}.png"
        overlay_name = f"overlay_{uid}.jpg"
        mask_path = settings.MEDIA_ROOT / 'masks' / mask_name
        overlay_path = settings.MEDIA_ROOT / 'overlays' / overlay_name

        mask_arr = np.clip(seg_result['mask'], 0, 255).astype(np.uint8)
        overlay_arr = np.clip(seg_result['overlay'], 0, 255).astype(np.uint8)

        Image.fromarray(mask_arr, mode='L').save(mask_path, format='PNG')
        Image.fromarray(overlay_arr, mode='RGB').save(overlay_path, format='JPEG', quality=92)

        mask_url = f'/media/masks/{mask_name}' if mask_path.exists() else ''
        overlay_url = f'/media/overlays/{overlay_name}' if overlay_path.exists() else ''

        # RAG description (auto)
        rag_description = ''
        try:
            from rag.engine import RAGEngine
            rag = RAGEngine.get_instance()
            rag_resp = rag.describe_class(cls_result['class_id'], cls_result, language=language)
            rag_description = rag_resp.get('answer', '')
        except Exception as e:
            print(f"[RAG] Auto-description error: {e}")

        # Save to DB
        analysis = Analysis.objects.create(
            image_url=image_url,
            class_id=cls_result['class_id'],
            class_name=cls_result['class_name'],
            class_name_ru=cls_result['class_name_ru'],
            confidence=cls_result['confidence'],
            top3=cls_result['top3'],
            mask_url=mask_url,
            overlay_url=overlay_url,
            area_percent=seg_result['area_percent'],
            contour_count=seg_result['contour_count'],
            gradcam_url=gradcam_url,
            rag_description=rag_description,
        )

        return Response({
            'id': analysis.id,
            'image_url': image_url,
            'classification': {
                'class_id': cls_result['class_id'],
                'class_name': cls_result['class_name'],
                'class_name_ru': cls_result['class_name_ru'],
                'confidence': cls_result['confidence'],
                'top3': cls_result['top3'],
                'gradcam_url': gradcam_url,
            },
            'segmentation': {
                'mask_url': mask_url,
                'overlay_url': overlay_url,
                'area_percent': seg_result['area_percent'],
                'contour_count': seg_result['contour_count'],
            },
            'rag_description': rag_description,
        })
