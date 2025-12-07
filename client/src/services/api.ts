/**
 * Audio Data Processing Utilities
 * All communication is done via WebSocket, so this file only contains
 * data processing and utility functions.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface AudioData {
  source: string;
  volume: number;
  volumeFiltered?: number;
  peakToPeak: number;
  min?: number;
  max?: number;
  avg?: number;
  bands?: number[];
  bandsFiltered?: number[];
  timestamp?: string | number;
  server_timestamp?: string;
  client?: string;
  calibrated?: boolean;
}

// ============================================================================
// DATA PROCESSING FUNCTIONS
// ============================================================================

/**
 * Process and normalize audio data
 * Ensures all values are within valid ranges
 */
export function processAudioData(data: AudioData): AudioData {
  return {
    ...data,
    volume: Math.max(0, Math.min(100, data.volume || 0)),
    volumeFiltered:
      data.volumeFiltered !== undefined
        ? Math.max(0, Math.min(100, data.volumeFiltered))
        : undefined,
    peakToPeak: Math.max(0, data.peakToPeak || 0),
    bands: data.bands?.map((band) => Math.max(0, Math.min(100, band))),
    bandsFiltered: data.bandsFiltered?.map((band) =>
      Math.max(0, Math.min(100, band))
    ),
  };
}

/**
 * Calculate statistics from audio data array
 */
export function calculateAudioStats(data: AudioData[]): {
  avgVolume: number;
  avgVolumeFiltered: number;
  maxVolume: number;
  minVolume: number;
  avgPeakToPeak: number;
} {
  if (data.length === 0) {
    return {
      avgVolume: 0,
      avgVolumeFiltered: 0,
      maxVolume: 0,
      minVolume: 0,
      avgPeakToPeak: 0,
    };
  }

  const volumes = data.map((d) => d.volume);
  const volumesFiltered = data
    .map((d) => d.volumeFiltered)
    .filter((v): v is number => v !== undefined);
  const peakToPeaks = data.map((d) => d.peakToPeak);

  return {
    avgVolume: volumes.reduce((a, b) => a + b, 0) / volumes.length,
    avgVolumeFiltered:
      volumesFiltered.length > 0
        ? volumesFiltered.reduce((a, b) => a + b, 0) / volumesFiltered.length
        : 0,
    maxVolume: Math.max(...volumes),
    minVolume: Math.min(...volumes),
    avgPeakToPeak: peakToPeaks.reduce((a, b) => a + b, 0) / peakToPeaks.length,
  };
}

/**
 * Filter audio data by source
 */
export function filterBySource(data: AudioData[], source: string): AudioData[] {
  return data.filter((d) => d.source === source);
}

/**
 * Get only ESP32 data from array
 */
export function getESP32Data(data: AudioData[]): AudioData[] {
  return filterBySource(data, "esp32");
}

/**
 * Validate audio data structure
 */
export function isValidAudioData(data: any): data is AudioData {
  return (
    typeof data === "object" &&
    data !== null &&
    data.source === "esp32" &&
    typeof data.volume === "number" &&
    typeof data.peakToPeak === "number"
  );
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(
  timestamp: string | number | undefined
): string {
  if (!timestamp) return "-";

  try {
    const date =
      typeof timestamp === "number" ? new Date(timestamp) : new Date(timestamp);

    if (isNaN(date.getTime())) return "-";

    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "-";
  }
}

/**
 * Calculate band energy percentage
 */
export function calculateBandEnergy(bands: number[] | undefined): number {
  if (!bands || bands.length === 0) return 0;
  const sum = bands.reduce((a, b) => a + b, 0);
  return sum / bands.length;
}

/**
 * Get dominant frequency band (highest energy)
 */
export function getDominantBand(bands: number[] | undefined): number {
  if (!bands || bands.length === 0) return -1;
  let maxIndex = 0;
  let maxValue = bands[0];

  for (let i = 1; i < bands.length; i++) {
    if (bands[i] > maxValue) {
      maxValue = bands[i];
      maxIndex = i;
    }
  }

  return maxIndex;
}
