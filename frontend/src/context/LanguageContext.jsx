import { createContext, useContext, useMemo, useState } from 'react';

const LanguageContext = createContext(null);

const TEXT = {
  ru: {
    navDashboard: 'Дашборд',
    navAnalyze: 'Полный анализ',
    navClassify: 'Классификация',
    navSegment: 'Сегментация',
    navPlanner: 'Планер',
    navChat: 'AI-ассистент',
    navHistory: 'История',
    navAbout: 'О системе',
    appSubtitle: 'Патоморфология',
    disclaimer: 'Только для исследовательских целей · Не является медицинским заключением',
    checking: 'Проверка...',
    modelsNotReady: 'Не все модели загружены',
    ragOnline: 'RAG Engine: Online',
    chatTitle: 'AI-ассистент',
    chatSubtitle: 'RAG-система на основе медицинской базы знаний',
    chatGreeting: 'Здравствуйте! Я медицинский AI-ассистент BioVision. Задайте вопрос по гистопатологии или результатам анализа.',
    chatPlaceholder: 'Задайте вопрос по патологии...',
    chatExamples: 'Примеры вопросов:',
    chatError: 'Ошибка получения ответа. Попробуйте снова.',
  },
  en: {
    navDashboard: 'Dashboard',
    navAnalyze: 'Full analysis',
    navClassify: 'Classification',
    navSegment: 'Segmentation',
    navPlanner: 'Planner',
    navChat: 'AI assistant',
    navHistory: 'History',
    navAbout: 'About',
    appSubtitle: 'Pathomorphology',
    disclaimer: 'For research purposes only · Not a medical diagnosis',
    checking: 'Checking...',
    modelsNotReady: 'Not all models are ready',
    ragOnline: 'RAG Engine: Online',
    chatTitle: 'AI assistant',
    chatSubtitle: 'RAG system powered by medical knowledge base',
    chatGreeting: 'Hello! I am BioVision medical AI assistant. Ask a question about histopathology or analysis results.',
    chatPlaceholder: 'Ask a pathology question...',
    chatExamples: 'Example questions:',
    chatError: 'Failed to get response. Please try again.',
  },
};

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('app_lang') || 'ru');

  const changeLang = (next) => {
    const normalized = next === 'en' ? 'en' : 'ru';
    setLang(normalized);
    localStorage.setItem('app_lang', normalized);
    document.documentElement.lang = normalized;
  };

  const value = useMemo(() => ({
    lang,
    setLang: changeLang,
    t: (key) => TEXT[lang]?.[key] || TEXT.ru[key] || key,
  }), [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
