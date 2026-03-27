import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, AlertTriangle, Pencil, Save, X } from 'lucide-react';
import { getHistory } from '../api/client';
import { useLanguage } from '../context/LanguageContext';

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function dayLabel(date, isEn) {
  return date.toLocaleDateString(isEn ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'short' });
}

function dateKeyToDate(dateKey) {
  return new Date(`${dateKey}T12:00:00`);
}

function getRisk(conf, urgent, className) {
  const cancerBoost = /adenocarcinoma|tumou?r|carcinoma|рак|карцинома|опухол/i.test(className || '') ? 15 : 0;
  return Math.round(Math.min(99, (urgent ? 60 : 5) + Math.max(0, 100 - conf) * 0.45 + cancerBoost));
}

function getPriorityReason({ confidence, urgent, title, risk, isEn }) {
  const confText = `${confidence.toFixed(1)}%`;
  if (isEn) {
    if (urgent) {
      return `High priority due to urgent flag and oncologic pattern in "${title}". Current confidence: ${confText}, priority score: ${risk}.`;
    }
    if (confidence >= 90) {
      return `High confidence finding (${confText}) suggests focused verification of this pattern. Priority score: ${risk}.`;
    }
    return `Routine priority: confidence ${confText}. Keep in daily review queue with correlation to clinical context.`;
  }

  if (urgent) {
    return `Высокий приоритет из-за флага срочности и онкологического паттерна в «${title}». Текущая уверенность: ${confText}, приоритет: ${risk}.`;
  }
  if (confidence >= 90) {
    return `Высокая уверенность модели (${confText}) требует прицельной верификации данного паттерна. Приоритет: ${risk}.`;
  }
  return `Плановый приоритет: уверенность ${confText}. Рекомендуется просмотр в общей очереди с клинико-морфологической корреляцией.`;
}

export default function Planner() {
  const { lang } = useLanguage();
  const isEn = lang === 'en';
  const [rows, setRows] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const todayKey = new Date().toISOString().slice(0, 10);
  const [selectedDayKey, setSelectedDayKey] = useState(todayKey);
  const [editingKey, setEditingKey] = useState(null);
  const [draft, setDraft] = useState({ title: '', dateKey: '', urgent: false, aiReason: '' });

  useEffect(() => {
    setLoading(true);
    getHistory({ page: 1, per_page: 200 })
      .then((res) => setRows(res.data.results || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const now = new Date();
    const baseTasks = rows
      .map((x, i) => {
        const confidence = Number(x.confidence || 0);
        const urgent = Boolean(x.is_urgent);
        const due = new Date(now);
        due.setDate(now.getDate() + Math.floor(i / 2));
        const title = isEn ? (x.class_name || `Class ${x.class_id}`) : (x.class_name_ru || x.class_name || `Класс ${x.class_id}`);
        const risk = getRisk(confidence, urgent, x.class_name || title);
        return {
          key: `${x.id}-${i}`,
          id: x.id,
          date: due,
          dateKey: due.toISOString().slice(0, 10),
          confidence,
          urgent,
          risk,
          title,
          aiReason: getPriorityReason({ confidence, urgent, title, risk, isEn }),
        };
      })
      .sort((a, b) => b.risk - a.risk);

    setTasks((prev) => {
      const prevMap = new Map(prev.map((task) => [task.key, task]));
      return baseTasks.map((task) => {
        const existing = prevMap.get(task.key);
        if (!existing) {
          return task;
        }
        const merged = {
          ...task,
          title: existing.title,
          date: existing.date,
          dateKey: existing.dateKey,
          urgent: existing.urgent,
          aiReason: existing.aiReason,
        };
        return {
          ...merged,
          risk: getRisk(merged.confidence, merged.urgent, merged.title),
        };
      });
    });
  }, [rows, isEn]);

  const selectedDate = useMemo(() => dateKeyToDate(selectedDayKey), [selectedDayKey]);
  const selectedTasks = useMemo(
    () => tasks.filter((task) => task.dateKey === selectedDayKey).sort((a, b) => b.risk - a.risk),
    [tasks, selectedDayKey],
  );

  function beginEdit(task) {
    setEditingKey(task.key);
    setDraft({
      title: task.title,
      dateKey: task.dateKey,
      urgent: task.urgent,
      aiReason: task.aiReason,
    });
  }

  function cancelEdit() {
    setEditingKey(null);
    setDraft({ title: '', dateKey: '', urgent: false, aiReason: '' });
  }

  function saveEdit(task) {
    const nextTitle = (draft.title || '').trim() || task.title;
    const nextDateKey = draft.dateKey || task.dateKey;
    const nextDate = dateKeyToDate(nextDateKey);
    const nextUrgent = Boolean(draft.urgent);
    const nextRisk = getRisk(task.confidence, nextUrgent, nextTitle);
    const nextReason = (draft.aiReason || '').trim() || getPriorityReason({
      confidence: task.confidence,
      urgent: nextUrgent,
      title: nextTitle,
      risk: nextRisk,
      isEn,
    });

    setTasks((prev) => prev.map((item) => (
      item.key === task.key
        ? {
          ...item,
          title: nextTitle,
          dateKey: nextDateKey,
          date: nextDate,
          urgent: nextUrgent,
          risk: nextRisk,
          aiReason: nextReason,
        }
        : item
    )));
    setSelectedDayKey(nextDateKey);
    cancelEdit();
  }

  const monthStart = startOfMonth(monthCursor);
  const monthEnd = endOfMonth(monthCursor);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - ((monthStart.getDay() + 6) % 7));
  const gridDays = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const dayTasks = tasks.filter((task) => task.dateKey === key);
    gridDays.push({
      key,
      date: d,
      inMonth: d >= monthStart && d <= monthEnd,
      count: dayTasks.length,
      maxRisk: dayTasks.reduce((max, task) => Math.max(max, task.risk), 0),
    });
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <CalendarDays size={24} className="text-blue-600" />
          {isEn ? 'Clinical Planner' : 'Клинический планер'}
        </h1>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              className="text-sm px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200"
              onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
            >
              {isEn ? 'Previous' : 'Назад'}
            </button>
            <div className="text-sm font-semibold text-slate-700">
              {monthCursor.toLocaleDateString(isEn ? 'en-US' : 'ru-RU', { month: 'long', year: 'numeric' })}
            </div>
            <button
              className="text-sm px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200"
              onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
            >
              {isEn ? 'Next' : 'Далее'}
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 text-xs text-slate-500 mb-2">
            {(isEn ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']).map((d) => (
              <div key={d} className="text-center">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {gridDays.map((d) => {
              const isToday = d.key === todayKey;
              const isSelected = d.key === selectedDayKey;
              const riskClass = d.maxRisk >= 80 ? 'bg-red-100 border-red-300' : d.maxRisk >= 60 ? 'bg-amber-100 border-amber-300' : 'bg-slate-50 border-slate-200';
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setSelectedDayKey(d.key)}
                  className={`w-full text-left min-h-20 border rounded-xl p-2 transition ${d.inMonth ? riskClass : 'bg-slate-50/50 border-slate-100 text-slate-300'} ${isToday ? 'ring-2 ring-blue-500' : ''} ${isSelected ? 'ring-2 ring-emerald-500' : ''}`}
                >
                  <div className="text-xs font-semibold">{d.date.getDate()}</div>
                  {d.count > 0 && (
                    <div className="mt-2 text-[11px] px-1.5 py-0.5 rounded bg-white inline-block border border-slate-200">
                      {d.count} {isEn ? 'task(s)' : 'задач'}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
          <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Clock3 size={16} className="text-blue-600" />
            {isEn ? 'Selected day plan' : 'План на выбранный день'}
          </h2>
          <div className="text-xs text-slate-500 mb-3">
            {isEn ? 'Date:' : 'Дата:'} {dayLabel(selectedDate, isEn)} · {selectedTasks.length} {isEn ? 'task(s)' : 'задач'}
          </div>

          {loading ? (
            <div className="text-sm text-slate-500">{isEn ? 'Loading...' : 'Загрузка...'}</div>
          ) : selectedTasks.length === 0 ? (
            <div className="text-sm text-slate-500">{isEn ? 'No tasks for this day' : 'На этот день задач нет'}</div>
          ) : (
            <div className="space-y-2">
              {selectedTasks.map((task) => (
                <div key={task.key} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-slate-800 truncate">#{task.id} · {task.title}</div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${task.risk >= 80 ? 'text-red-600' : task.risk >= 60 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {task.risk}
                      </span>
                      <button
                        type="button"
                        onClick={() => beginEdit(task)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50"
                      >
                        <Pencil size={12} /> {isEn ? 'Edit' : 'Изменить'}
                      </button>
                    </div>
                  </div>

                  {editingKey === task.key ? (
                    <div className="mt-2 space-y-2">
                      <input
                        value={draft.title}
                        onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                        className="w-full text-sm border border-slate-300 rounded-md px-2 py-1.5"
                        placeholder={isEn ? 'Task title' : 'Название задачи'}
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={draft.dateKey}
                          onChange={(e) => setDraft((prev) => ({ ...prev, dateKey: e.target.value }))}
                          className="w-full text-sm border border-slate-300 rounded-md px-2 py-1.5"
                        />
                        <label className="inline-flex items-center gap-2 text-xs border border-slate-300 rounded-md px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={draft.urgent}
                            onChange={(e) => setDraft((prev) => ({ ...prev, urgent: e.target.checked }))}
                          />
                          {isEn ? 'Urgent' : 'Срочно'}
                        </label>
                      </div>

                      <textarea
                        value={draft.aiReason}
                        onChange={(e) => setDraft((prev) => ({ ...prev, aiReason: e.target.value }))}
                        className="w-full text-xs border border-slate-300 rounded-md px-2 py-1.5 min-h-20"
                        placeholder={isEn ? 'AI comment: why this task is prioritized' : 'Комментарий AI: почему задача в приоритете'}
                      />

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(task)}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                        >
                          <Save size={12} /> {isEn ? 'Save' : 'Сохранить'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50"
                        >
                          <X size={12} /> {isEn ? 'Cancel' : 'Отмена'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-xs text-slate-500 mt-1">
                        {isEn
                          ? `${task.urgent ? 'Urgent' : 'Routine'} · confidence ${task.confidence.toFixed(1)}%`
                          : `${task.urgent ? 'Срочно' : 'Планово'} · уверенность ${task.confidence.toFixed(1)}%`}
                      </div>
                      <div className="text-xs text-slate-600 mt-2 p-2 rounded-md bg-slate-50 border border-slate-200">
                        <span className="font-medium">{isEn ? 'AI reason:' : 'Причина AI:'}</span> {task.aiReason}
                      </div>
                    </>
                  )}

                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <AlertTriangle size={11} /> {dayLabel(task.date, isEn)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
