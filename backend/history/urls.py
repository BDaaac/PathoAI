from django.urls import path
from .views import HistoryListView, AnalysisDetailView, ReportView, StatsView, ExportCSVView

urlpatterns = [
    path('history/', HistoryListView.as_view(), name='history'),
    path('history/<int:pk>/', AnalysisDetailView.as_view(), name='analysis-detail'),
    path('report/<int:pk>/', ReportView.as_view(), name='report'),
    path('stats/', StatsView.as_view(), name='stats'),
    path('history/export/', ExportCSVView.as_view(), name='export-csv'),
]
