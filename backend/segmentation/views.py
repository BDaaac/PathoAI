import uuid
import numpy as np
from PIL import Image
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from django.conf import settings

from .inference import SegmentationEngine


class SegmentView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
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

        for d in ('masks', 'overlays'):
            (settings.MEDIA_ROOT / d).mkdir(parents=True, exist_ok=True)

        engine = SegmentationEngine.get_instance()
        result = engine.predict(image)

        uid = uuid.uuid4().hex
        mask_name = f"mask_{uid}.png"
        overlay_name = f"overlay_{uid}.jpg"

        mask_path = settings.MEDIA_ROOT / 'masks' / mask_name
        overlay_path = settings.MEDIA_ROOT / 'overlays' / overlay_name

        mask_arr = np.clip(result['mask'], 0, 255).astype(np.uint8)
        overlay_arr = np.clip(result['overlay'], 0, 255).astype(np.uint8)
        Image.fromarray(mask_arr, mode='L').save(mask_path, format='PNG')
        Image.fromarray(overlay_arr, mode='RGB').save(overlay_path, format='JPEG', quality=92)

        return Response({
            'mask_url': f'/media/masks/{mask_name}',
            'overlay_url': f'/media/overlays/{overlay_name}',
            'area_percent': result['area_percent'],
            'contour_count': result['contour_count'],
        })
