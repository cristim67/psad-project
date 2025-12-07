import { TrendingUp } from "lucide-react";

interface SignalQualityProps {
  snrRaw?: number;
  snrFiltered?: number;
}

function getSNRStatus(snr: number): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (snr < 10) {
    return {
      label: "POOR",
      color: "text-red-300",
      bgColor: "bg-red-500/20 border-red-500/40",
    };
  } else if (snr < 20) {
    return {
      label: "FAIR",
      color: "text-yellow-300",
      bgColor: "bg-yellow-500/20 border-yellow-500/40",
    };
  } else if (snr < 30) {
    return {
      label: "GOOD",
      color: "text-green-300",
      bgColor: "bg-green-500/20 border-green-500/40",
    };
  } else {
    return {
      label: "EXCELLENT",
      color: "text-emerald-300",
      bgColor: "bg-emerald-500/20 border-emerald-500/40",
    };
  }
}

function getSNRBarWidth(snr: number): number {
  // Normalize SNR to 0-100% for bar
  // SNR poate fi negativ până la ~40-50 dB
  const minSNR = -10;
  const maxSNR = 50;
  const normalized = ((snr - minSNR) / (maxSNR - minSNR)) * 100;
  return Math.max(0, Math.min(100, normalized));
}

export function SignalQuality({ snrRaw, snrFiltered }: SignalQualityProps) {
  const rawSNR = snrRaw ?? 0;
  const filteredSNR = snrFiltered ?? 0;
  const improvement = filteredSNR - rawSNR;
  const improvementRatio = rawSNR > 0 ? filteredSNR / rawSNR : 0;

  const rawStatus = getSNRStatus(rawSNR);
  const filteredStatus = getSNRStatus(filteredSNR);

  const rawBarWidth = getSNRBarWidth(rawSNR);
  const filteredBarWidth = getSNRBarWidth(filteredSNR);

  return (
    <div className="bg-slate-800/80 border border-slate-700/50 rounded-xl shadow-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/30">
          <TrendingUp className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-100">Signal Quality</h3>
          <p className="text-xs text-slate-400">
            Signal-to-Noise Ratio Analysis
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* RAW SIGNAL */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-300">
                RAW SIGNAL
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold border ${rawStatus.bgColor} ${rawStatus.color}`}
              >
                {rawStatus.label}
              </span>
            </div>
            <span className="text-lg font-bold text-blue-300">
              SNR: {rawSNR.toFixed(1)} dB
            </span>
          </div>
          <div className="relative h-4 bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
              style={{ width: `${rawBarWidth}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-full w-full bg-slate-800/30" />
            </div>
          </div>
        </div>

        {/* FILTERED SIGNAL */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-300">
                FILTERED SIGNAL
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold border ${filteredStatus.bgColor} ${filteredStatus.color}`}
              >
                {filteredStatus.label}
              </span>
            </div>
            <span className="text-lg font-bold text-pink-300">
              SNR: {filteredSNR.toFixed(1)} dB
            </span>
          </div>
          <div className="relative h-4 bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-pink-500 to-pink-400 transition-all duration-300"
              style={{ width: `${filteredBarWidth}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-full w-full bg-slate-800/30" />
            </div>
          </div>
        </div>
      </div>

      {/* IMPROVEMENT */}
      {improvement > 0 && (
        <div className="pt-4 border-t border-slate-700/50">
          <div className="flex items-center justify-center gap-2 text-slate-300">
            <span className="text-sm font-medium">Improvement:</span>
            <span className="text-lg font-bold text-green-300">
              +{improvement.toFixed(1)} dB
            </span>
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-sm text-slate-400">
              ({improvementRatio.toFixed(1)}x cleaner!)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
