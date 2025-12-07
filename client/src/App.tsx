import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { useWebSocket } from "./hooks/useWebSocket";
import { StatusBar } from "./components/StatusBar";
import { MetricsCards } from "./components/MetricsCards";
import { WaveformChart } from "./components/WaveformChart";
import { SpectrogramChart } from "./components/SpectrogramChart";
import { FrequencyBands } from "./components/FrequencyBands";
import { FilterControls, FilterSettings } from "./components/FilterControls";
import { DataTable } from "./components/DataTable";
import { formatTimestamp } from "./services/api";

const NUM_BANDS = 9;
const maxPoints = 100;
const spectrogramWidth = 120;

function App() {
  const { isConnected, isESP32Connected, lastData, sendFilterSettings } =
    useWebSocket();

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
  const [syncStatus, setSyncStatus] = useState<string>("Not connected");

  useEffect(() => {
    if (!lastData) return;

    const volume = lastData.volume;
    const volumeFiltered = lastData.volumeFiltered ?? lastData.volume;

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

    // Use formatTimestamp to safely handle timestamp
    const formattedTime = formatTimestamp(
      lastData.timestamp || lastData.server_timestamp
    );
    setLastUpdate(formattedTime);

    setDataHistory((prev) => {
      const newHistory = [lastData, ...prev];
      return newHistory.slice(0, 20);
    });
  }, [lastData]);

  const handleApplyFilter = (settings: FilterSettings) => {
    const success = sendFilterSettings(settings);
    if (success) {
      const typeName =
        settings.filterType.charAt(0).toUpperCase() +
        settings.filterType.slice(1);
      setSyncStatus(`${typeName} @ ${settings.cutoffFreq}Hz`);
      setTimeout(() => setSyncStatus("Ready"), 3000);
    } else {
      setSyncStatus("Not connected");
    }
  };

  const currentMetrics = {
    volume: lastData?.volume ?? 0,
    volumeFiltered: lastData?.volumeFiltered ?? 0,
    peakToPeak: lastData?.peakToPeak ?? 0,
    min: lastData?.min ?? 0,
    max: lastData?.max ?? 0,
    avg: lastData?.avg ?? 0,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="container mx-auto px-4 py-6 max-w-[1800px]">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl shadow-lg">
              <Radio className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">
                Audio Analysis Platform
              </h1>
              <p className="text-slate-400 text-sm">
                Real-Time Signal Processing & FFT Analysis
              </p>
            </div>
            {isConnected && (
              <div className="ml-auto flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-2">
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse shadow-lg shadow-blue-400/40" />
                <span className="text-blue-300 font-semibold text-sm">
                  LIVE
                </span>
              </div>
            )}
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

          <MetricsCards {...currentMetrics} />

          <DataTable history={dataHistory} />
        </div>
      </div>
    </div>
  );
}

export default App;
