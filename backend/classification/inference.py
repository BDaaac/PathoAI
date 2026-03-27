import torch
import torch.nn.functional as F
import numpy as np
import cv2
from PIL import Image
from torchvision import transforms
from django.conf import settings

try:
    import timm
    TIMM_AVAILABLE = True
except ImportError:
    TIMM_AVAILABLE = False

MEAN = [0.485, 0.456, 0.406]
STD  = [0.229, 0.224, 0.225]


class GradCAM:
    """Grad-CAM matching the Streamlit implementation exactly."""

    def __init__(self, model):
        self.model = model
        self.activations = {}
        self.gradients = {}
        self._register_hooks()

    def _register_hooks(self):
        # ConvNeXt: hook into conv_dw of last block (same as Streamlit)
        try:
            target_layer = self.model.stages[-1].blocks[-1].conv_dw
        except AttributeError:
            target_layer = self.model.stages[-1]

        target_layer.register_forward_hook(self._fwd_hook)
        target_layer.register_full_backward_hook(self._bwd_hook)

    def _fwd_hook(self, _, __, output):
        self.activations['feat'] = output

    def _bwd_hook(self, _, __, grad_output):
        self.gradients['feat'] = grad_output[0]

    def generate(self, inp: torch.Tensor, class_idx: int) -> np.ndarray | None:
        self.activations.clear()
        self.gradients.clear()

        self.model.eval()
        with torch.enable_grad():
            output = self.model(inp)
            self.model.zero_grad()
            one_hot = torch.zeros_like(output)
            one_hot[0, class_idx] = 1
            output.backward(gradient=one_hot)

        if 'feat' not in self.activations or 'feat' not in self.gradients:
            return None

        feat = self.activations['feat'].detach()
        grad = self.gradients['feat'].detach()

        # ConvNeXt may output NHWC — fix to NCHW
        if feat.dim() == 4 and feat.shape[-1] > feat.shape[1]:
            feat = feat.permute(0, 3, 1, 2).contiguous()
            grad = grad.permute(0, 3, 1, 2).contiguous()

        weights = grad.mean(dim=[2, 3], keepdim=True)
        cam = F.relu((weights * feat).sum(dim=1).squeeze())
        cam_np = cam.cpu().numpy()

        if cam_np.max() > cam_np.min():
            cam_np = (cam_np - cam_np.min()) / (cam_np.max() - cam_np.min() + 1e-8)

        return cam_np


class ClassificationEngine:
    _instance = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.model = None
        self.gradcam = None
        self.class_names = settings.CLASS_NAMES
        self.class_names_ru = settings.CLASS_NAMES_RU

        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=MEAN, std=STD),
        ])
        self._load_model()

    def _load_model(self):
        model_path = settings.CLASS_MODEL_PATH
        if not model_path.exists():
            print(f"[ClassificationEngine] Model not found: {model_path}")
            return
        if not TIMM_AVAILABLE:
            print("[ClassificationEngine] timm not installed")
            return
        try:
            self.model = timm.create_model('convnext_large', pretrained=False, num_classes=12)
            checkpoint = torch.load(model_path, map_location=self.device)

            # Support multiple checkpoint formats (same priority as Streamlit)
            if isinstance(checkpoint, dict):
                if 'model_state_dict' in checkpoint:
                    state = checkpoint['model_state_dict']
                elif 'state_dict' in checkpoint:
                    state = checkpoint['state_dict']
                else:
                    state = checkpoint
            else:
                state = checkpoint

            self.model.load_state_dict(state, strict=False)
            self.model.to(self.device).eval()
            self.gradcam = GradCAM(self.model)
            print(f"[ClassificationEngine] Loaded on {self.device}")
        except Exception as e:
            print(f"[ClassificationEngine] Load error: {e}")

    def predict(self, image: Image.Image) -> dict:
        if self.model is None:
            return self._mock_predict()

        tensor = self.transform(image).unsqueeze(0).to(self.device)
        with torch.no_grad():
            logits = self.model(tensor)
            probs = torch.softmax(logits, dim=1)[0]

        top3_probs, top3_ids = probs.topk(3)
        class_id = top3_ids[0].item()

        return {
            'class_id': class_id,
            'class_name': self.class_names.get(class_id, f'Class {class_id}'),
            'class_name_ru': self.class_names_ru.get(class_id, f'Класс {class_id}'),
            'confidence': round(top3_probs[0].item() * 100, 2),
            'top3': [
                {
                    'class_id': top3_ids[i].item(),
                    'name': self.class_names.get(top3_ids[i].item(), f'Class {top3_ids[i].item()}'),
                    'name_ru': self.class_names_ru.get(top3_ids[i].item(), ''),
                    'confidence': round(top3_probs[i].item() * 100, 2),
                }
                for i in range(3)
            ],
        }

    def predict_with_gradcam(self, image: Image.Image) -> dict:
        result = self.predict(image)
        result['gradcam_map'] = None

        if self.gradcam is None:
            return result
        try:
            tensor = self.transform(image).unsqueeze(0).to(self.device).requires_grad_(True)
            result['gradcam_map'] = self.gradcam.generate(tensor, result['class_id'])
        except Exception as e:
            print(f"[GradCAM] Error: {e}")
        return result

    def _mock_predict(self) -> dict:
        import random
        class_id = random.randint(0, 11)
        return {
            'class_id': class_id,
            'class_name': self.class_names.get(class_id, f'Class {class_id}'),
            'class_name_ru': self.class_names_ru.get(class_id, f'Класс {class_id}'),
            'confidence': round(random.uniform(60, 99), 2),
            'top3': [
                {
                    'class_id': (class_id + i) % 12,
                    'name': self.class_names.get((class_id + i) % 12, ''),
                    'name_ru': self.class_names_ru.get((class_id + i) % 12, ''),
                    'confidence': round(random.uniform(10, 60), 2),
                }
                for i in range(3)
            ],
            'gradcam_map': None,
        }


def apply_gradcam_overlay(image: Image.Image, cam: np.ndarray) -> np.ndarray:
    """Identical to Streamlit: addWeighted 55/45."""
    orig_np = np.array(image)
    cam_resized = cv2.resize(cam, (orig_np.shape[1], orig_np.shape[0]))
    heatmap = cv2.applyColorMap(np.uint8(255 * cam_resized), cv2.COLORMAP_JET)
    heatmap_rgb = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
    overlay = cv2.addWeighted(orig_np, 0.55, heatmap_rgb, 0.45, 0)
    return overlay
