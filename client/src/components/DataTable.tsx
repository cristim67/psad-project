import { Clock } from "lucide-react";
import { formatTimestamp } from "../services/api";

interface DataTableProps {
  history: Array<{
    timestamp?: number | string | undefined;
    server_timestamp?: string | undefined;
    volume: number;
    volumeFiltered?: number;
    peakToPeak: number;
    min?: number;
    max?: number;
  }>;
}

export function DataTable({ history }: DataTableProps) {
  return (
    <div className="bg-slate-800/80 border border-slate-700/50 rounded-lg p-4 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-blue-400" />
        <h2 className="text-lg font-bold text-slate-200">Measurement Log</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Raw Amp. (%)
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Filtered (%)
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Peak-to-Peak
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                ADC Min
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                ADC Max
              </th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-500">
                  Awaiting sensor data...
                </td>
              </tr>
            ) : (
              history.slice(0, 10).map((row, index) => {
                const timestamp = row.timestamp || row.server_timestamp;
                const formattedTime = formatTimestamp(timestamp);
                return (
                  <tr
                    key={index}
                    className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-blue-300 font-mono">
                      {formattedTime !== "-" ? formattedTime : "N/A"}
                    </td>
                    <td className="py-3 px-4 text-sm font-semibold text-blue-300">
                      {row.volume}
                    </td>
                    <td className="py-3 px-4 text-sm font-semibold text-pink-300">
                      {row.volumeFiltered ?? "-"}
                    </td>
                    <td className="py-3 px-4 text-sm font-semibold text-purple-300">
                      {row.peakToPeak}
                    </td>
                    <td className="py-3 px-4 text-sm font-semibold text-slate-300">
                      {row.min ?? "-"}
                    </td>
                    <td className="py-3 px-4 text-sm font-semibold text-slate-300">
                      {row.max ?? "-"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
