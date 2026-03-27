import uuid
from PIL import Image
import numpy as np
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from django.conf import settings

from .inference import ClassificationEngine, apply_gradcam_overlay


class ClassifyView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        if 'image' not in request.FILES:
            return Response({'error': 'No image provided'}, status=status.HTTP_400_BAD_REQUEST)

        file = request.FILES['image']
        if not file.name.lower().endswith(('.png', '.jpg', '.jpeg', '.tiff', '.bmp')):
            return Response({'error': 'Invalid file format. Use PNG or JPG.'}, status=400)
        if file.size > 20 * 1024 * 1024:
            return Response({'error': 'File too large (max 20MB)'}, status=400)

        try:
            image = Image.open(file).convert('RGB')
        except Exception:
            return Response({'error': 'Cannot open image'}, status=400)

        for d in ('uploads', 'gradcam'):
            (settings.MEDIA_ROOT / d).mkdir(parents=True, exist_ok=True)

        engine = ClassificationEngine.get_instance()
        result = engine.predict_with_gradcam(image)

        gradcam_url = None
        if result.get('gradcam_map') is not None:
            gradcam_url = _save_gradcam(image, result['gradcam_map'])

        upload_name = f"{uuid.uuid4().hex}.jpg"
        upload_path = settings.MEDIA_ROOT / 'uploads' / upload_name
        image.save(str(upload_path), 'JPEG')

        return Response({
            'class_id': result['class_id'],
            'class_name': result['class_name'],
            'class_name_ru': result['class_name_ru'],
            'confidence': result['confidence'],
            'top3': result['top3'],
            'gradcam_url': gradcam_url,
            'image_url': f'/media/uploads/{upload_name}',
        })


def _save_gradcam(image: Image.Image, cam: np.ndarray) -> str:
    overlay = apply_gradcam_overlay(image, cam)
    name = f"gradcam_{uuid.uuid4().hex}.jpg"
    path = settings.MEDIA_ROOT / 'gradcam' / name
    arr = np.clip(overlay, 0, 255).astype(np.uint8)
    Image.fromarray(arr, mode='RGB').save(path, format='JPEG', quality=92)
    return f'/media/gradcam/{name}'
