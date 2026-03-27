from django.db import models


class Analysis(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    image_url = models.CharField(max_length=500)

    # Classification
    class_id = models.IntegerField(null=True)
    class_name = models.CharField(max_length=200, blank=True)
    class_name_ru = models.CharField(max_length=200, blank=True)
    confidence = models.FloatField(null=True)
    top3 = models.JSONField(default=list)

    # Segmentation
    mask_url = models.CharField(max_length=500, blank=True)
    overlay_url = models.CharField(max_length=500, blank=True)
    area_percent = models.FloatField(null=True)
    contour_count = models.IntegerField(null=True)

    # GradCAM
    gradcam_url = models.CharField(max_length=500, blank=True)

    # RAG
    rag_description = models.TextField(blank=True)

    # Report
    report_url = models.CharField(max_length=500, blank=True)

    # Computed fields (no migration needed)
    @property
    def tsr_percent(self):
        """Tumor-Stroma Ratio — fraction of mask area."""
        return self.area_percent

    @property
    def is_urgent(self):
        """High-confidence adenocarcinoma → needs immediate review."""
        ADENOCARCINOMA_CLASSES = {8}  # Colorectal Adenocarcinoma Epithelium
        return (
            self.confidence is not None
            and self.confidence > 85.0
            and self.class_id in ADENOCARCINOMA_CLASSES
        )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Analysis {self.id} — {self.class_name} ({self.created_at:%Y-%m-%d})"
