import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Loader2, Download, Send, ChevronDown } from 'lucide-react';
import { analyze, ragQuery, getReport } from '../api/client';
import ImageUploader from '../components/ImageUploader';
import ClassificationResult from '../components/ClassificationResult';
import SegmentationViewer from '../components/SegmentationViewer';
import GradCAMViewer from '../components/GradCAMViewer';
import RAGResponse from '../components/RAGResponse';
import { useLanguage } from '../context/LanguageContext';

export default function FullAnalysis() {
  const { lang } = useLanguage();
  const isEn = lang === 'en';
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [ragLoading, setRagLoading] = useState(false);
  const [ragResult, setRagResult] = useState(null);
  const resultsRef = useRef(null);

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    setRagResult(null);

    const fd = new FormData();
    fd.append('image', file);
    fd.append('language', lang);

    try {
      const res = await analyze(fd);
      setResult(res.data);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
      setError(e.response?.data?.error || (isEn ? 'Analysis failed. Please try again.' : 'Ошибка анализа. Попробуйте снова.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRagQuestion = async () => {
    if (!question.trim()) return;
    setRagLoading(true);
    try {
      const res = await ragQuery({
        question,
        classification_result: result?.classification,
        language: lang,
      });
      setRagResult(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setRagLoading(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!result?.id) return;
    try {
      const res = await getReport(result.id, true);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${result.id}.pdf`;
      a.click();
    } catch (e) {
      console.error('Report error:', e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FlaskConical size={24} className="text-blue-600" />
          {isEn ? 'Full biopsy analysis' : 'Полный анализ биопсии'}
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          {isEn ? 'Classification + Segmentation + AI interpretation in one request' : 'Классификация + Сегментация + AI-интерпретация за один запрос'}
        </p>
      </div>

      {/* Upload */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <ImageUploader onFile={setFile} disabled={loading} />
        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-600">
            {error}
          </div>
        )}
        <button
          onClick={handleAnalyze}
          disabled={!file || loading}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
            text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {isEn ? 'Analyzing...' : 'Анализируем...'}
            </>
          ) : (
            <>
              <FlaskConical size={18} />
              {isEn ? 'Analyze' : 'Анализировать'}
            </>
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div ref={resultsRef} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Grad-CAM */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wide">
                {isEn ? 'Grad-CAM visualization' : 'Grad-CAM визуализация'}
              </h3>
              <GradCAMViewer
                originalUrl={result.image_url}
                gradcamUrl={result.classification?.gradcam_url}
              />
            </div>

            {/* Segmentation */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wide">
                {isEn ? 'Segmentation' : 'Сегментация'}
              </h3>
              <SegmentationViewer
                imageUrl={result.image_url}
                maskUrl={result.segmentation?.mask_url}
                overlayUrl={result.segmentation?.overlay_url}
                result={result.segmentation}
              />
            </div>

            {/* Classification */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wide">
                {isEn ? 'Classification' : 'Классификация'}
              </h3>
              <ClassificationResult result={result.classification} />
            </div>
          </div>

          {/* RAG Block */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4">{isEn ? 'AI pathology interpretation' : 'AI-интерпретация патологии'}</h3>

            {result.rag_description && (
              <RAGResponse answer={result.rag_description} sources={[{ index: 1, source: 'knowledge_base' }]} />
            )}

            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-600 mb-2">{isEn ? 'Ask an additional question:' : 'Задать дополнительный вопрос:'}</p>
              <div className="flex gap-2">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRagQuestion()}
                  placeholder={isEn ? 'What are the key characteristics of this pathology?' : 'Чем характеризуется данная патология?'}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleRagQuestion}
                  disabled={ragLoading || !question.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  {ragLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
              {ragResult && (
                <div className="mt-3">
                  <RAGResponse answer={ragResult.answer} sources={ragResult.sources} />
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              <Download size={16} />
              {isEn ? 'Download PDF report' : 'Скачать PDF отчёт'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
