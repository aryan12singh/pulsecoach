import type { StrengthSet } from "@/types";

export default function StrengthSetsTable({ sets }: { sets: StrengthSet[] }) {
  if (!sets.length) return null;

  // Group by exercise
  const grouped: Record<string, StrengthSet[]> = {};
  for (const s of sets) {
    if (!grouped[s.exercise_name]) grouped[s.exercise_name] = [];
    grouped[s.exercise_name].push(s);
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([name, exSets]) => (
        <div key={name}>
          <h3 className="font-semibold text-gray-800 mb-2">{name}</h3>
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase border-b">
              <tr>
                <th className="pb-1 pr-4">Set</th>
                <th className="pb-1 pr-4">Reps</th>
                <th className="pb-1 pr-4">Weight</th>
                <th className="pb-1">RPE</th>
              </tr>
            </thead>
            <tbody>
              {exSets.map((s) => (
                <tr key={s.id} className={s.is_warmup ? "opacity-50" : ""}>
                  <td className="py-1 pr-4 text-gray-600">{s.set_number}{s.is_warmup ? " W" : ""}</td>
                  <td className="py-1 pr-4">{s.reps ?? "—"}</td>
                  <td className="py-1 pr-4">
                    {s.weight != null ? `${s.weight} ${s.weight_unit}` : "—"}
                  </td>
                  <td className="py-1">{s.rpe != null ? s.rpe : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
