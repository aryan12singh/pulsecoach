interface Props {
  label: string;
  value: string | number | null;
  unit?: string;
  trend?: number | null;
}

export default function MetricCard({ label, value, unit, trend }: Props) {
  const trendColor = trend == null ? "" : trend > 0 ? "text-green-600" : "text-red-500";
  const trendSign = trend != null && trend > 0 ? "+" : "";

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-1">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-gray-900">
        {value != null ? value : "—"}
        {value != null && unit && <span className="text-base font-normal text-gray-500 ml-1">{unit}</span>}
      </p>
      {trend != null && (
        <p className={`text-xs ${trendColor}`}>
          {trendSign}{trend} vs prev 30d
        </p>
      )}
    </div>
  );
}
