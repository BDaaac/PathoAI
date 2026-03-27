import { Info, Brain, Layers, MessageSquare, FileText, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const classes = [
  { id: 0, en: 'Adipose Tissue', ru: 'Жировая ткань' },
  { id: 1, en: 'Background / Artifact', ru: 'Фон / Артефакт' },
  { id: 2, en: 'Debris', ru: 'Дебрис' },
  { id: 3, en: 'Lymphocytes', ru: 'Лимфоциты' },
  { id: 4, en: 'Mucus', ru: 'Слизь' },
  { id: 5, en: 'Smooth Muscle', ru: 'Гладкая мускулатура' },
  { id: 6, en: 'Normal Colon Mucosa', ru: 'Нормальная слизистая' },
  { id: 7, en: 'Cancer-Associated Stroma', ru: 'Строма с раком' },
  { id: 8, en: 'Colorectal Adenocarcinoma Epithelium', ru: 'Эпителий аденокарциномы' },
  { id: 9, en: 'Serosa', ru: 'Серозная оболочка' },
  { id: 10, en: 'Complex Stroma', ru: 'Комплексная строма' },
  { id: 11, en: 'Tumor Epithelium', ru: 'Опухолевый эпителий' },
];

export default function About() {
  const { lang } = useLanguage();
  const isEn = lang === 'en';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Info size={24} className="text-blue-600" />
          {isEn ? 'About BioVision AI' : 'О системе BioVision AI'}
        </h1>
        <p className="text-slate-500 text-sm mt-1">{isEn ? 'Histopathology biopsy image analysis platform' : 'Система анализа гистопатологических изображений биопсии'}</p>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 flex gap-3">
        <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-amber-800">{isEn ? 'Important notice' : 'Важное предупреждение'}</div>
          <p className="text-amber-700 text-sm mt-1">
            {isEn
              ? 'This system is intended for research and demonstration only. '
              : 'Данная система разработана исключительно в исследовательских и демонстрационных целях.'}
            <strong>{isEn ? ' Not intended for clinical use.' : ' Не предназначена для клинического использования.'}</strong>
            {isEn
              ? ' All findings must be validated by a qualified pathologist.'
              : ' Все результаты требуют верификации квалифицированным специалистом-патологоанатомом.'}
          </p>
          <p className="text-amber-600 text-xs mt-1 font-medium">
            For research purposes only · Not a medical diagnosis
          </p>
        </div>
      </div>

      {/* Models */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={18} className="text-blue-500" />
            <h2 className="font-semibold text-slate-800">{isEn ? 'Classification model' : 'Модель классификации'}</h2>
          </div>
          <div className="space-y-2 text-sm text-slate-600">
            <div><span className="font-medium">{isEn ? 'Architecture:' : 'Архитектура:'}</span> ConvNeXt Large</div>
            <div><span className="font-medium">{isEn ? 'Classes:' : 'Классов:'}</span> 12 (NCT-CRC-HE-100K)</div>
            <div><span className="font-medium">Input:</span> 224×224 RGB</div>
            <div><span className="font-medium">{isEn ? 'Visualization:' : 'Визуализация:'}</span> Grad-CAM</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={18} className="text-emerald-500" />
            <h2 className="font-semibold text-slate-800">{isEn ? 'Segmentation model' : 'Модель сегментации'}</h2>
          </div>
          <div className="space-y-2 text-sm text-slate-600">
            <div><span className="font-medium">{isEn ? 'Architecture:' : 'Архитектура:'}</span> UNet++ EfficientNet-B5</div>
            <div><span className="font-medium">Input:</span> 512×512 RGB</div>
            <div><span className="font-medium">TTA:</span> {isEn ? 'D4 (8 augmentations)' : 'D4 (8 аугментаций)'}</div>
            <div><span className="font-medium">Threshold:</span> 0.5</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare size={18} className="text-violet-500" />
            <h2 className="font-semibold text-slate-800">{isEn ? 'RAG system' : 'RAG-система'}</h2>
          </div>
          <div className="space-y-2 text-sm text-slate-600">
            <div><span className="font-medium">Embeddings:</span> all-MiniLM-L6-v2</div>
            <div><span className="font-medium">Vector DB:</span> ChromaDB</div>
            <div><span className="font-medium">LLM:</span> {isEn ? 'Ollama Cloud model' : 'Модель Ollama Cloud'}</div>
            <div><span className="font-medium">{isEn ? 'Strategy:' : 'Стратегия:'}</span> Anti-hallucination RAG</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={18} className="text-rose-500" />
            <h2 className="font-semibold text-slate-800">{isEn ? 'Technical stack' : 'Технический стек'}</h2>
          </div>
          <div className="space-y-2 text-sm text-slate-600">
            <div><span className="font-medium">Backend:</span> Django 5 + DRF</div>
            <div><span className="font-medium">Frontend:</span> React 18 + Vite + TailwindCSS</div>
            <div><span className="font-medium">ML:</span> PyTorch 2.4, timm, SMP</div>
            <div><span className="font-medium">Reports:</span> ReportLab PDF</div>
          </div>
        </div>
      </div>

      {/* Classes table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">{isEn ? 'Pathology classes (NCT-CRC-HE-100K)' : 'Классы патологий (NCT-CRC-HE-100K)'}</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-2 text-xs text-slate-500 font-semibold uppercase">ID</th>
              <th className="text-left px-4 py-2 text-xs text-slate-500 font-semibold uppercase">English</th>
              {!isEn && <th className="text-left px-4 py-2 text-xs text-slate-500 font-semibold uppercase">Русский</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {classes.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded">{c.id}</span>
                </td>
                <td className="px-4 py-2.5 text-slate-700">{c.en}</td>
                {!isEn && <td className="px-4 py-2.5 text-slate-600">{c.ru}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
