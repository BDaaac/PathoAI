import torch
import numpy as np
import cv2
from PIL import Image
from django.conf import settings

try:
    import segmentation_models_pytorch as smp
    SMP_AVAILABLE = True
except ImportError:
    SMP_AVAILABLE = False

try:
    import ttach as tta
    TTA_AVAILABLE = True
except ImportError:
    TTA_AVAILABLE = False

# Exact same values as Streamlit
MEAN      = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD       = np.array([0.229, 0.224, 0.225], dtype=np.float32)
INPUT_SIZE = 256   # Streamlit uses 256, not 512
THRESHOLD  = 0.78  # Streamlit uses 0.78, not 0.5


class SegmentationEngine:
    _instance = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.model = None
        self.tta_model = None
        self._load_model()

    def _load_model(self):
        model_path = settings.SEG_MODEL_PATH
        if not model_path.exists():
            print(f"[SegmentationEngine] Model not found: {model_path}")
            return
        if not SMP_AVAILABLE:
            print("[SegmentationEngine] segmentation_models_pytorch not installed")
            return
        try:
            self.model = smp.UnetPlusPlus(
                encoder_name='efficientnet-b5',
                encoder_weights=None,
                in_channels=3,
                classes=1,
                activation=None,  # Streamlit uses activation=None
            )
            state = torch.load(model_path, map_location=self.device)
            if isinstance(state, dict) and 'model_state_dict' in state:
                state = state['model_state_dict']
            elif isinstance(state, dict) and 'state_dict' in state:
                state = state['state_dict']
            self.model.load_state_dict(state, strict=False)
            self.model.to(self.device).eval()

            if TTA_AVAILABLE:
                # Same TTA as Streamlit: HFlip + VFlip + Rotate90(0,90,180,270)
                tta_transforms = tta.Compose([
                    tta.HorizontalFlip(),
                    tta.VerticalFlip(),
                    tta.Rotate90(angles=[0, 90, 180, 270]),
                ])
                self.tta_model = tta.SegmentationTTAWrapper(
                    self.model, tta_transforms, merge_mode='mean'
                )
            print(f"[SegmentationEngine] Loaded on {self.device}")
        except Exception as e:
            print(f"[SegmentationEngine] Load error: {e}")

    def predict(self, image: Image.Image) -> dict:
        if self.model is None:
            return self._mock_predict(image)

        img_np = np.array(image)
        orig_h, orig_w = img_np.shape[:2]

        # Preprocessing identical to Streamlit
        img_res  = cv2.resize(img_np, (INPUT_SIZE, INPUT_SIZE)).astype(np.float32) / 255.0
        img_norm = (img_res - MEAN) / STD
        tensor   = torch.from_numpy(img_norm.transpose(2, 0, 1)).unsqueeze(0).float().to(self.device)

        with torch.no_grad():
            infer_model = self.tta_model if self.tta_model else self.model
            logits = infer_model(tensor)
            prob   = torch.sigmoid(logits).squeeze().cpu().numpy()

        mask = (prob > THRESHOLD).astype(np.uint8)
        mask = cv2.resize(mask, (orig_w, orig_h), interpolation=cv2.INTER_NEAREST)

        area_percent = round(float(mask.mean()) * 100, 2)
        overlay      = self._create_overlay(img_np, mask)
        contours, _  = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        return {
            'mask':          mask * 255,
            'overlay':       overlay,
            'area_percent':  area_percent,
            'contour_count': len(contours),
        }

    def _create_overlay(self, image: np.ndarray, mask: np.ndarray) -> np.ndarray:
        """Green overlay identical to Streamlit."""
        colored = image.copy()
        colored[mask == 1] = [0, 255, 0]
        return cv2.addWeighted(image, 0.6, colored, 0.4, 0)

    def _mock_predict(self, image: Image.Image) -> dict:
        w, h = image.size
        mask = np.zeros((h, w), dtype=np.uint8)
        cx, cy, r = w // 2, h // 2, min(w, h) // 4
        cv2.circle(mask, (cx, cy), r, 1, -1)
        overlay = self._create_overlay(np.array(image), mask)
        return {
            'mask':          mask * 255,
            'overlay':       overlay,
            'area_percent':  round(np.pi * r * r / (w * h) * 100, 2),
            'contour_count': 1,
        }
