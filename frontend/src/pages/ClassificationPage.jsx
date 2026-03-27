import { useState } from 'react';
import { Layers, Loader2 } from 'lucide-react';
import { classify } from '../api/client';
import ImageUploader from '../components/ImageUploader';
import ClassificationResult from '../components/ClassificationResult';
import GradCAMViewer from '../components/GradCAMViewer';
import RAGResponse from '../components/RAGResponse';
import { ragQuery } from '../api/client';
import { useLanguage } from '../context/LanguageContext';

export default function ClassificationPage() {
  const { lang } = useLanguage();
  const isEn = lang === 'en';
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [rag, setRag] = useState(null);
  const [ragLoading, setRagLoading] = useState(false);

  const handleClassify = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    setRag(null);
    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await classify(fd);
      setResult(res.data);
      // Auto RAG
      setRagLoading(true);
      const prompt = lang === 'en'
        ? `Describe class ${res.data.class_name}`
        : `Опиши класс ${res.data.class_name}`;
      const rr = await ragQuery({ question: prompt, classification_result: res.data, language: lang }).catch(() => null);
      if (rr) setRag(rr.data);
    } catch (e) {
      setError(e.response?.data?.error || (isEn ? 'Classification error' : 'Ошибка классификации'));
    } finally {
      setLoading(false);
      setRagLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Layers size={24} className="text-blue-600" />
          {isEn ? 'Classification' : 'Классификация'}
        </h1>
        <p className="text-slate-500 text-sm mt-1">{isEn ? 'ConvNeXt Large — 12 pathology classes' : 'ConvNeXt Large — 12 классов патологий'}</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <ImageUploader onFile={setFile} disabled={loading} />
        {error && <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</div>}
        <button
          onClick={handleClassify}
          disabled={!file || loading}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <><Loader2 size={18} className="animate-spin" /> {isEn ? 'Classifying...' : 'Классификация...'}</> : (isEn ? 'Classify' : 'Классифицировать')}
        </button>
      </div>

      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wide">Grad-CAM</h3>
            <GradCAMViewer originalUrl={result.image_url} gradcamUrl={result.gradcam_url} />
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wide">{isEn ? 'Result' : 'Результат'}</h3>
            <ClassificationResult result={result} />
          </div>
        </div>
      )}

      {(rag || ragLoading) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          {ragLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Loader2 size={14} className="animate-spin" /> {isEn ? 'Fetching medical context...' : 'Получаем медицинский контекст...'}
            </div>
          ) : (
            <RAGResponse answer={rag?.answer} sources={rag?.sources} />
          )}
        </div>
      )}
    </div>
  );
}
