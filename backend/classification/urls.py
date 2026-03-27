from django.urls import path
from .views import ClassifyView

urlpatterns = [
    path('classify/', ClassifyView.as_view(), name='classify'),
]
