from django.urls import path
from .views import SegmentView

urlpatterns = [
    path('segment/', SegmentView.as_view(), name='segment'),
]
