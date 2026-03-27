import { useEffect, useState } from 'react';
import { X, Download, Loader2, AlertCircle } from 'lucide-react';
import { getAnalysis, getReport } from '../api/client';
import ClassificationResult from './ClassificationResult';
import SegmentationViewer from './SegmentationViewer';
import GradCAMViewer from './GradCAMViewer';
import RAGResponse from './RAGResponse';

export default function AnalysisModal({ id, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalysis(id)
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDownloadReport = async () => {
    try {
      const res = await getReport(id, true);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${id}.pdf`;
      a.click();
    } catch (e) {
      console.error(e);
    }
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Анализ #{id}</h2>
              {data?.is_urgent && (
                <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full border border-red-200">
                  <AlertCircle size={11} /> URGENT
                </span>
              )}
            </div>
            {data && (
              <p className="text-sm text-slate-400 mt-0.5">
                {new Date(data.created_at).toLocaleString('ru-RU')}
                {data.tsr_percent != null && (
                  <span className="ml-3 font-medium text-slate-600">
                    TSR: {data.tsr_percent.toFixed(1)}%
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <button
                onClick={handleDownloadReport}
                className="flex items-center gap-1.5 text-sm bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg transition-colors"
              >
                <Download size={14} />
                PDF
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-48 gap-2 text-slate-400">
              <Loader2 size={20} className="animate-spin" />
              Загрузка...
            </div>
          ) : !data ? (
            <div className="text-center text-red-500 py-12">Данные не найдены</div>
          ) : (
            <div className="space-y-6">
              {/* 3 columns: GradCAM | Segmentation | Classification */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-slate-50 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Grad-CAM
                  </h3>
                  <GradCAMViewer
                    originalUrl={data.image_url}
                    gradcamUrl={data.gradcam_url}
                  />
                </div>

                <div className="bg-slate-50 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Сегментация
                  </h3>
                  <SegmentationViewer
                    imageUrl={data.image_url}
                    maskUrl={data.mask_url}
                    overlayUrl={data.overlay_url}
                    result={{ area_percent: data.area_percent, contour_count: data.contour_count }}
                  />
                </div>

                <div className="bg-slate-50 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Классификация
                  </h3>
                  <ClassificationResult
                    result={{
                      class_id: data.class_id,
                      class_name: data.class_name,
                      class_name_ru: data.class_name_ru,
                      confidence: data.confidence,
                      top3: data.top3,
                    }}
                  />
                </div>
              </div>

              {/* RAG description */}
              {data.rag_description && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Медицинский контекст
                  </h3>
                  <RAGResponse
                    answer={data.rag_description}
                    sources={[{ index: 1, source: 'knowledge_base' }]}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
