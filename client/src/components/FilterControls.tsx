import { useState, useEffect } from "react";
import {
  Send,
  RotateCcw,
  Settings,
  Radio,
  Volume2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface FilterControlsProps {
  onApplyFilter: (settings: FilterSettings) => void;
  syncStatus: string;
}

export interface FilterSettings {
  filterType: string;
  cutoffFreq: number;
  cutoffFreqHigh?: number; // Opțional, doar pentru bandpass
  voiceBoost: number;
}

export function FilterControls({
  onApplyFilter,
  syncStatus,
}: FilterControlsProps) {
  const [settings, setSettings] = useState<FilterSettings>({
    filterType: "bandpass",
    cutoffFreq: 500,
    cutoffFreqHigh: 2500,
    voiceBoost: 100,
  });

  const [isExpanded, setIsExpanded] = useState(false);

  const filterTypes = [
    { value: "lowpass", label: "Low-Pass" },
    { value: "bandpass", label: "Band-Pass" },
    { value: "highpass", label: "High-Pass" },
  ];

  // Previne ajustarea automată a cutoffFreqHigh când se schimbă cutoffFreq
  useEffect(() => {
    if (
      settings.filterType === "bandpass" &&
      settings.cutoffFreqHigh &&
      settings.cutoffFreqHigh < settings.cutoffFreq + 100
    ) {
      // Doar dacă devine invalid, ajustează-l, dar nu când se schimbă cutoffFreq
      // Această verificare se face doar la schimbarea filterType sau la inițializare
    }
  }, [settings.filterType]); // Doar când se schimbă tipul de filtru

  const handleReset = () => {
    const resetSettings = {
      filterType: "bypass",
      cutoffFreq: 1200,
      cutoffFreqHigh: 2500,
      voiceBoost: 100,
    };
    setSettings(resetSettings);
    onApplyFilter(resetSettings);
  };

  const getSyncStatusColor = () => {
    if (syncStatus.includes("Not applied") || syncStatus.includes("❌")) {
      return "bg-red-500/10 text-red-300 border-red-500/30";
    }
    if (syncStatus.includes("Ready") || syncStatus.includes("⚪")) {
      return "bg-blue-500/10 text-blue-300 border-blue-500/30";
    }
    return "bg-blue-500/10 text-blue-300 border-blue-500/30";
  };

  return (
    <div className="bg-slate-800/80 border border-slate-700/50 rounded-xl shadow-xl overflow-hidden">
      {/* Header - Clickable Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-6 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/30">
            <Settings className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-bold text-slate-100">
              Filter Controls
            </h3>
            <p className="text-xs text-slate-400">
              Adjust audio processing parameters
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`text-xs px-3 py-1.5 rounded-lg font-medium border ${getSyncStatusColor()}`}
          >
            {syncStatus}
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Content - Collapsible */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-3">
          {/* Filter Type */}
          <div className="bg-slate-900/40 rounded-lg border border-slate-700/50 overflow-hidden p-4">
            <div className="flex items-center gap-3 mb-3">
              <Radio className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">
                Filter Type
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {filterTypes.map((type) => {
                const isActive = settings.filterType === type.value;
                return (
                  <button
                    key={type.value}
                    onClick={() =>
                      setSettings({ ...settings, filterType: type.value })
                    }
                    className={`px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 border ${
                      isActive
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-lg shadow-blue-500/20"
                        : "bg-slate-800/50 text-slate-300 border-slate-700/50 hover:bg-slate-700/50"
                    }`}
                  >
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cutoff Frequency */}
          <div className="bg-slate-900/40 rounded-lg border border-slate-700/50 overflow-hidden p-4">
            <div className="flex items-center gap-3 mb-3">
              <Radio className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">
                {settings.filterType === "bandpass"
                  ? "Low Cutoff"
                  : "Cutoff Frequency"}
              </span>
              <span className="text-lg font-bold text-blue-300 ml-auto">
                {settings.cutoffFreq.toLocaleString()} Hz
              </span>
            </div>
            <div className="space-y-3">
              <input
                type="range"
                min="100"
                max="8000"
                step="50"
                value={settings.cutoffFreq}
                onChange={(e) => {
                  const newCutoffFreq = parseInt(e.target.value);
                  setSettings({
                    ...settings,
                    cutoffFreq: newCutoffFreq,
                  });
                }}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                    ((settings.cutoffFreq - 100) / (8000 - 100)) * 100
                  }%, #334155 ${
                    ((settings.cutoffFreq - 100) / (8000 - 100)) * 100
                  }%, #334155 100%)`,
                }}
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>100 Hz</span>
                <span>2 kHz</span>
                <span>4 kHz</span>
                <span>6 kHz</span>
                <span>8 kHz</span>
              </div>
            </div>
          </div>

          {/* Cutoff Frequency High - Only for Band-Pass */}
          {settings.filterType === "bandpass" && (
            <div className="bg-slate-900/40 rounded-lg border border-slate-700/50 overflow-hidden p-4">
              <div className="flex items-center gap-3 mb-3">
                <Radio className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-slate-200">
                  High Cutoff
                </span>
                <span className="text-lg font-bold text-blue-300 ml-auto">
                  {settings.cutoffFreqHigh || 2500} Hz
                </span>
              </div>
              <div className="space-y-3">
                <input
                  type="range"
                  min="100"
                  max="8000"
                  step="50"
                  value={settings.cutoffFreqHigh || 2500}
                  onChange={(e) => {
                    const newHigh = parseInt(e.target.value);
                    setSettings({
                      ...settings,
                      cutoffFreqHigh: newHigh,
                    });
                  }}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                      (((settings.cutoffFreqHigh || 2500) - 100) /
                        (8000 - 100)) *
                      100
                    }%, #334155 ${
                      (((settings.cutoffFreqHigh || 2500) - 100) /
                        (8000 - 100)) *
                      100
                    }%, #334155 100%)`,
                  }}
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>100 Hz</span>
                  <span>2 kHz</span>
                  <span>4 kHz</span>
                  <span>6 kHz</span>
                  <span>8 kHz</span>
                </div>
              </div>
            </div>
          )}

          {/* Voice Boost */}
          <div className="bg-slate-900/40 rounded-lg border border-slate-700/50 overflow-hidden p-4">
            <div className="flex items-center gap-3 mb-3">
              <Volume2 className="w-4 h-4 text-green-400" />
              <span className="text-sm font-semibold text-slate-200">
                Voice Boost
              </span>
              <span className="text-lg font-bold text-green-300 ml-auto">
                {(settings.voiceBoost / 100).toFixed(1)}x
              </span>
            </div>
            <div className="space-y-3">
              <input
                type="range"
                min="100"
                max="300"
                step="10"
                value={settings.voiceBoost}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    voiceBoost: parseInt(e.target.value),
                  })
                }
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #22c55e 0%, #22c55e ${
                    ((settings.voiceBoost - 100) / (300 - 100)) * 100
                  }%, #334155 ${
                    ((settings.voiceBoost - 100) / (300 - 100)) * 100
                  }%, #334155 100%)`,
                }}
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>1.0x</span>
                <span>2.0x</span>
                <span>3.0x</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-700/50 flex gap-3">
            <button
              onClick={() => onApplyFilter(settings)}
              className="flex-1 flex items-center justify-center gap-2 bg-green-500/20 text-green-300 px-6 py-3 rounded-lg font-semibold hover:bg-green-500/30 border border-green-500/40 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Send className="w-4 h-4" />
              Apply Filter
            </button>
            <button
              onClick={handleReset}
              className="flex items-center justify-center gap-2 bg-slate-800/50 text-slate-300 px-6 py-3 rounded-lg font-semibold hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-600 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>
      )}

      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #64748b;
          cursor: pointer;
          border: 2px solid #475569;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          transition: all 0.2s;
        }
        
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.15);
          background: #94a3b8;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #64748b;
          cursor: pointer;
          border: 2px solid #475569;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          transition: all 0.2s;
        }
        
        input[type="range"]::-moz-range-thumb:hover {
          transform: scale(1.15);
          background: #94a3b8;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
        }
      `}</style>
    </div>
  );
}
