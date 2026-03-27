from django.urls import path
from .views import FullAnalysisView

urlpatterns = [
    path('analyze/', FullAnalysisView.as_view(), name='full-analysis'),
]
