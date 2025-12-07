import { useState } from "react";
import {
  Send,
  RotateCcw,
  Settings,
  Radio,
  Volume2,
  Clock,
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
  voiceBoost: number;
  updateRate: number;
}

export function FilterControls({
  onApplyFilter,
  syncStatus,
}: FilterControlsProps) {
  const [settings, setSettings] = useState<FilterSettings>({
    filterType: "bandpass",
    cutoffFreq: 1200,
    voiceBoost: 150,
    updateRate: 200,
  });

  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    filterType: true,
    cutoffFreq: true,
    voiceBoost: true,
    updateRate: true,
  });

  const filterTypes = [
    { value: "bypass", label: "Bypass" },
    { value: "lowpass", label: "Low-Pass" },
    { value: "bandpass", label: "Band-Pass" },
    { value: "highpass", label: "High-Pass" },
    { value: "notch", label: "Notch" },
  ];

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleReset = () => {
    const resetSettings = {
      filterType: "bypass",
      cutoffFreq: 1200,
      voiceBoost: 150,
      updateRate: 200,
    };
    setSettings(resetSettings);
    onApplyFilter(resetSettings);
  };

  const getSyncStatusColor = () => {
    if (syncStatus.includes("Not connected") || syncStatus.includes("❌")) {
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
          {/* Filter Type - Collapsible */}
          <div className="bg-slate-900/40 rounded-lg border border-slate-700/50 overflow-hidden">
            <button
              onClick={() => toggleSection("filterType")}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Radio className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-slate-200">
                  Filter Type
                </span>
              </div>
              {expandedSections.filterType ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>
            {expandedSections.filterType && (
              <div className="px-4 pb-4">
                <div className="grid grid-cols-5 gap-2">
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
            )}
          </div>

          {/* Cutoff Frequency - Collapsible */}
          <div className="bg-slate-900/40 rounded-lg border border-slate-700/50 overflow-hidden">
            <button
              onClick={() => toggleSection("cutoffFreq")}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Radio className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-slate-200">
                  Cutoff Frequency
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-blue-300">
                  {settings.cutoffFreq.toLocaleString()} Hz
                </span>
                {expandedSections.cutoffFreq ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </button>
            {expandedSections.cutoffFreq && (
              <div className="px-4 pb-4 space-y-3">
                <input
                  type="range"
                  min="100"
                  max="8000"
                  step="50"
                  value={settings.cutoffFreq}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      cutoffFreq: parseInt(e.target.value),
                    })
                  }
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
            )}
          </div>

          {/* Voice Boost - Collapsible */}
          <div className="bg-slate-900/40 rounded-lg border border-slate-700/50 overflow-hidden">
            <button
              onClick={() => toggleSection("voiceBoost")}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Volume2 className="w-4 h-4 text-green-400" />
                <span className="text-sm font-semibold text-slate-200">
                  Voice Boost
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-green-300">
                  {(settings.voiceBoost / 100).toFixed(1)}x
                </span>
                {expandedSections.voiceBoost ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </button>
            {expandedSections.voiceBoost && (
              <div className="px-4 pb-4 space-y-3">
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
            )}
          </div>

          {/* Update Rate - Collapsible */}
          <div className="bg-slate-900/40 rounded-lg border border-slate-700/50 overflow-hidden">
            <button
              onClick={() => toggleSection("updateRate")}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-semibold text-slate-200">
                  Update Rate
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-purple-300">
                  {settings.updateRate} ms
                </span>
                {expandedSections.updateRate ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </button>
            {expandedSections.updateRate && (
              <div className="px-4 pb-4 space-y-3">
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="10"
                  value={settings.updateRate}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      updateRate: parseInt(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${
                      ((settings.updateRate - 50) / (500 - 50)) * 100
                    }%, #334155 ${
                      ((settings.updateRate - 50) / (500 - 50)) * 100
                    }%, #334155 100%)`,
                  }}
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>50ms</span>
                  <span>250ms</span>
                  <span>500ms</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-700/50">
            <button
              onClick={() => onApplyFilter(settings)}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-500/20 text-blue-300 px-6 py-3 rounded-lg font-semibold hover:bg-blue-500/30 border border-blue-500/40 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
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
