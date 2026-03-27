import { useEffect, useState } from 'react';
import { History as HistoryIcon, Download, ChevronLeft, ChevronRight, Eye, AlertCircle, Trash2 } from 'lucide-react';
import { getHistory, getReport, deleteAnalysis } from '../api/client';
import { BASE_URL } from '../config';
import AnalysisModal from '../components/AnalysisModal';
import MediaImage from '../components/MediaImage';
import { useLanguage } from '../context/LanguageContext';

export default function History() {
  const { lang } = useLanguage();
  const isEn = lang === 'en';
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const fetchHistory = (p = 1) => {
    setLoading(true);
    const params = { page: p, per_page: 15 };
    if (classFilter) params.class_id = classFilter;
    getHistory(params)
      .then((res) => {
        setData(res.data.results || []);
        setTotal(res.data.total || 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchHistory(1); setPage(1); }, [classFilter]);

  const totalPages = Math.ceil(total / 15);

  const handleDownload = async (e, id) => {
    e.stopPropagation();
    try {
      const res = await getReport(id, true);
      const contentType = res?.headers?.['content-type'] || 'application/pdf';
      const blob = new Blob([res.data], { type: contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const disposition = res?.headers?.['content-disposition'] || '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      a.download = match?.[1] || `report_${id}.pdf`;

      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      window.alert(isEn ? 'PDF download failed. Please try again.' : 'Не удалось скачать PDF. Попробуйте еще раз.');
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    const ok = window.confirm(isEn ? 'Delete this record from history?' : 'Удалить эту запись из истории?');
    if (!ok) return;
    try {
      await deleteAnalysis(id);
      if (selectedId === id) setSelectedId(null);
      fetchHistory(page);
    } catch (err) {
      console.error(err);
      window.alert(isEn ? 'Delete failed' : 'Не удалось удалить');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <HistoryIcon size={24} className="text-blue-600" />
          {isEn ? 'Analysis history' : 'История анализов'}
        </h1>
        <div className="flex gap-2">
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">{isEn ? 'All classes' : 'Все классы'}</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>{isEn ? `Class ${i}` : `Класс ${i}`}</option>
            ))}
          </select>
          <button
            onClick={() => window.open(`${BASE_URL}/api/history/export/`, '_blank')}
            className="flex items-center gap-1.5 border border-slate-300 hover:border-blue-500 hover:text-blue-600 px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{isEn ? 'Image' : 'Изображение'}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{isEn ? 'Class' : 'Класс'}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{isEn ? 'Confidence' : 'Уверенность'}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">TSR</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{isEn ? 'Date' : 'Дата'}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-400">{isEn ? 'Loading...' : 'Загрузка...'}</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-400">{isEn ? 'History is empty' : 'История пуста'}</td></tr>
            ) : data.map((row) => (
              <tr
                key={row.id}
                onClick={() => setSelectedId(row.id)}
                className="hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <MediaImage
                    src={row.image_url}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover border border-slate-100"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="font-medium text-slate-800">{isEn ? row.class_name : (row.class_name_ru || row.class_name)}</div>
                      <div className="text-xs text-slate-400">{row.class_name}</div>
                    </div>
                    {row.is_urgent && (
                      <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full border border-red-200 shrink-0">
                        <AlertCircle size={10} /> URGENT
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`font-semibold ${(row.confidence || 0) >= 80 ? 'text-emerald-600' : (row.confidence || 0) >= 60 ? 'text-blue-600' : 'text-amber-600'}`}>
                    {row.confidence?.toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3">
                  {row.tsr_percent != null ? (
                    <span className={`text-xs font-semibold tabular-nums ${row.tsr_percent > 30 ? 'text-red-600' : row.tsr_percent > 15 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {row.tsr_percent.toFixed(1)}%
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {new Date(row.created_at).toLocaleString(isEn ? 'en-US' : 'ru-RU')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedId(row.id); }}
                      className="text-slate-400 hover:text-blue-600 transition-colors"
                      title={isEn ? 'View' : 'Просмотр'}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={(e) => handleDownload(e, row.id)}
                      className="text-slate-400 hover:text-blue-600 transition-colors"
                      title={isEn ? 'Download PDF' : 'Скачать PDF'}
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, row.id)}
                      className="text-slate-400 hover:text-red-600 transition-colors"
                      title={isEn ? 'Delete' : 'Удалить'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-slate-500">{isEn ? `Total: ${total}` : `Всего: ${total}`}</span>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => { const p = page - 1; setPage(p); fetchHistory(p); }}
                disabled={page <= 1}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm">{page} / {totalPages}</span>
              <button
                onClick={() => { const p = page + 1; setPage(p); fetchHistory(p); }}
                disabled={page >= totalPages}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedId && (
        <AnalysisModal id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
