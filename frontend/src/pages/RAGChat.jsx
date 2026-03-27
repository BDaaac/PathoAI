import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Loader2, Bot, User } from 'lucide-react';
import { ragQuery } from '../api/client';
import { useLanguage } from '../context/LanguageContext';

const SUGGESTED = {
  ru: [
    'Что такое колоректальная аденокарцинома?',
    'Чем Cancer-Associated Stroma отличается от нормальной стромы?',
    'Как интерпретировать площадь поражения при сегментации?',
    'Что означает высокая уверенность модели?',
    'Каковы рекомендации при обнаружении опухолевого эпителия?',
  ],
  en: [
    'What is colorectal adenocarcinoma?',
    'How is cancer-associated stroma different from normal stroma?',
    'How should segmentation lesion area be interpreted?',
    'What does high model confidence mean?',
    'What are recommendations for detected tumor epithelium?',
  ],
};

export default function RAGChat() {
  const { lang, t } = useLanguage();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: t('chatGreeting'),
      sources: [],
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setMessages([{ role: 'assistant', content: t('chatGreeting'), sources: [] }]);
  }, [lang, t]);

  const sendMessage = async (text) => {
    const q = (text || input).trim();
    if (!q) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setLoading(true);

    try {
      const res = await ragQuery({ question: q, language: lang });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.data.answer, sources: res.data.sources }
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: t('chatError'), sources: [] }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-120px)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <MessageSquare size={24} className="text-blue-600" />
          {t('chatTitle')}
        </h1>
        <p className="text-slate-500 text-sm mt-1">{t('chatSubtitle')}</p>
      </div>

      {/* Chat window */}
      <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Bot size={16} className="text-blue-600" />
                </div>
              )}
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                }`}>
                  <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                </div>
                {msg.sources?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {msg.sources.map((s) => (
                      <span key={s.index} className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                        [{s.index}] {s.source}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                  <User size={16} className="text-slate-600" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Bot size={16} className="text-blue-600" />
              </div>
              <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3">
                <Loader2 size={16} className="animate-spin text-slate-400" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggested questions */}
        {messages.length <= 1 && (
          <div className="px-4 pb-3">
            <p className="text-xs text-slate-400 mb-2">{t('chatExamples')}</p>
            <div className="flex flex-wrap gap-2">
              {(SUGGESTED[lang] || SUGGESTED.ru).map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-full transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-slate-200 p-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={t('chatPlaceholder')}
            disabled={loading}
            className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
