import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Radio, Sun, Moon } from "lucide-react";
import { useWebSocket } from "./hooks/useWebSocket";
import { useTheme } from "./contexts/ThemeContext";
import { StatusBar } from "./components/StatusBar";
import { MetricsCards } from "./components/MetricsCards";
import { WaveformChart } from "./components/WaveformChart";
import { SpectrogramChart } from "./components/SpectrogramChart";
import { FrequencyBands } from "./components/FrequencyBands";
import { FilterControls, FilterSettings } from "./components/FilterControls";
import { DataTable } from "./components/DataTable";
import { SignalQuality } from "./components/SignalQuality";
import { formatTimestamp } from "./services/api";

const NUM_BANDS = 9;
const maxPoints = 60;
const spectrogramWidth = 80;

function App() {
  const { isConnected, isESP32Connected, lastData, sendFilterSettings } =
    useWebSocket();
  const { theme, toggleTheme } = useTheme();

  const [waveformDataRaw, setWaveformDataRaw] = useState<number[]>([]);
  const [waveformDataFiltered, setWaveformDataFiltered] = useState<number[]>(
    []
  );
  const [spectrogramHistoryRaw, setSpectrogramHistoryRaw] = useState<
    number[][]
  >([]);
  const [spectrogramHistoryFiltered, setSpectrogramHistoryFiltered] = useState<
    number[][]
  >([]);
  const [bandsRaw, setBandsRaw] = useState<number[]>(
    new Array(NUM_BANDS).fill(0)
  );
  const [bandsFiltered, setBandsFiltered] = useState<number[]>(
    new Array(NUM_BANDS).fill(0)
  );
  const [dataHistory, setDataHistory] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>("-");
  const [syncStatus, setSyncStatus] = useState<string>("Not applied");

  // Aggressive throttle for smoothness - update at most every 150ms
  const lastUpdateTime = useRef<number>(0);
  const UPDATE_THROTTLE_MS = 150;

  useEffect(() => {
    if (!lastData) return;

    // Process only if enough time has passed
    const now = Date.now();
    if (now - lastUpdateTime.current < UPDATE_THROTTLE_MS) {
      return; // Skip update for smoothness
    }
    lastUpdateTime.current = now;

    const volume = lastData.volume;
    const volumeFiltered = lastData.volumeFiltered ?? lastData.volume;

    // Batch updates for performance
    setWaveformDataRaw((prev) => {
      const newData = [...prev, volume];
      return newData.length > maxPoints ? newData.slice(-maxPoints) : newData;
    });

    setWaveformDataFiltered((prev) => {
      const newData = [...prev, volumeFiltered];
      return newData.length > maxPoints ? newData.slice(-maxPoints) : newData;
    });

    if (lastData.bands && Array.isArray(lastData.bands)) {
      setBandsRaw(lastData.bands);
      setSpectrogramHistoryRaw((prev) => {
        const newHistory = [...prev, lastData.bands!];
        return newHistory.length > spectrogramWidth
          ? newHistory.slice(-spectrogramWidth)
          : newHistory;
      });
    }

    if (lastData.bandsFiltered && Array.isArray(lastData.bandsFiltered)) {
      setBandsFiltered(lastData.bandsFiltered);
      setSpectrogramHistoryFiltered((prev) => {
        const newHistory = [...prev, lastData.bandsFiltered!];
        return newHistory.length > spectrogramWidth
          ? newHistory.slice(-spectrogramWidth)
          : newHistory;
      });
    }

    const formattedTime = formatTimestamp(
      lastData.timestamp || lastData.server_timestamp
    );
    setLastUpdate(formattedTime);

    setDataHistory((prev) => {
      const newHistory = [lastData, ...prev];
      return newHistory.slice(0, 20);
    });
  }, [lastData]);

  const handleApplyFilter = useCallback(
    (settings: FilterSettings) => {
      const success = sendFilterSettings(settings);
      if (success) {
        const typeName =
          settings.filterType.charAt(0).toUpperCase() +
          settings.filterType.slice(1);
        setSyncStatus(`${typeName} @ ${settings.cutoffFreq}Hz`);
        setTimeout(() => setSyncStatus("Ready"), 3000);
      } else {
        setSyncStatus("Not applied");
      }
    },
    [sendFilterSettings]
  );

  const currentMetrics = useMemo(
    () => ({
      volume: lastData?.volume ?? 0,
      volumeFiltered: lastData?.volumeFiltered ?? 0,
      peakToPeak: lastData?.peakToPeak ?? 0,
      min: lastData?.min ?? 0,
      max: lastData?.max ?? 0,
      avg: lastData?.avg ?? 0,
    }),
    [lastData]
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors duration-200">
      <div className="container mx-auto px-4 py-6 max-w-[1800px]">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-500/10 dark:bg-blue-500/10 border border-blue-500/30 dark:border-blue-500/30 rounded-xl shadow-lg">
              <Radio className="w-8 h-8 text-blue-500 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                Audio Analysis Platform
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Real-Time Signal Processing & FFT Analysis
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-5 h-5 text-slate-700" />
                )}
              </button>
              {isConnected && (
                <div className="flex items-center gap-2 bg-green-500/10 dark:bg-green-500/10 border border-green-500/30 dark:border-green-500/30 rounded-lg px-4 py-2 relative overflow-hidden">
                  <div className="absolute inset-0 bg-green-500/5 dark:bg-green-500/5 animate-pulse" />
                  <div className="relative flex items-center gap-2">
                    <div className="relative">
                      <div className="w-3 h-3 bg-green-500 dark:bg-green-400 rounded-full animate-ping absolute" />
                      <div className="w-3 h-3 bg-green-500 dark:bg-green-400 rounded-full relative shadow-lg shadow-green-500/50 dark:shadow-green-400/50" />
                    </div>
                    <span className="text-green-600 dark:text-green-300 font-bold text-sm tracking-wider">
                      LIVE
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <StatusBar
            isConnected={isConnected}
            isESP32Connected={isESP32Connected}
            lastUpdate={lastUpdate}
          />
        </div>

        <div className="space-y-6">
          <FilterControls
            onApplyFilter={handleApplyFilter}
            syncStatus={syncStatus}
          />

          <div className="grid lg:grid-cols-2 gap-6">
            <WaveformChart
              data={waveformDataRaw}
              color="#60a5fa"
              title="Time-Domain Signal"
              label="RAW"
              maxPoints={maxPoints}
            />
            <SpectrogramChart
              history={spectrogramHistoryRaw}
              isRaw={true}
              title="Frequency Spectrogram"
              label="RAW"
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <WaveformChart
              data={waveformDataFiltered}
              color="#f472b6"
              title="Time-Domain Signal"
              label="FILTERED"
              maxPoints={maxPoints}
            />
            <SpectrogramChart
              history={spectrogramHistoryFiltered}
              isRaw={false}
              title="Frequency Spectrogram"
              label="FILTERED"
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <FrequencyBands
              bands={bandsRaw}
              isRaw={true}
              title="Voice FFT — Raw Signal"
            />
            <FrequencyBands
              bands={bandsFiltered}
              isRaw={false}
              title="Voice FFT — Filtered Signal"
            />
          </div>

          <SignalQuality
            snrRaw={lastData?.snrRaw}
            snrFiltered={lastData?.snrFiltered}
            mse={lastData?.mse}
            psnr={lastData?.psnr}
          />

          <MetricsCards {...currentMetrics} />

          <DataTable history={dataHistory} />
        </div>
      </div>
    </div>
  );
}

export default App;
