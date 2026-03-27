export default function ConfidenceBar({ value, label, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };

  const getColor = (v) => {
    if (v >= 80) return colors.green;
    if (v >= 60) return colors.blue;
    if (v >= 40) return colors.amber;
    return colors.red;
  };

  const barColor = color === 'auto' ? getColor(value) : colors[color] || colors.blue;

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-600 truncate max-w-[70%]">{label}</span>
          <span className="font-semibold text-slate-800">{value?.toFixed(1)}%</span>
        </div>
      )}
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(value || 0, 100)}%` }}
        />
      </div>
    </div>
  );
}
