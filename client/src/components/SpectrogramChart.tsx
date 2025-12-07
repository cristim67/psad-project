import { useEffect, useRef } from "react";
import { useTheme } from "../contexts/ThemeContext";

interface SpectrogramChartProps {
  history: number[][];
  isRaw: boolean;
  title: string;
  label: string;
}

const NUM_BANDS = 9;
const spectrogramWidth = 80;

// Color cache - reduces repeated calculation
const colorCache = new Map<string, string>();

function getBandColor(
  value: number,
  isRaw: boolean,
  isLightMode: boolean = false
): string {
  const cacheKey = `${value.toFixed(2)}-${isRaw}-${isLightMode}`;
  if (colorCache.has(cacheKey)) {
    return colorCache.get(cacheKey)!;
  }

  let intensity = Math.min(100, Math.max(0, value)) / 100;
  intensity = Math.pow(intensity, 0.75);

  let color: string;

  if (isLightMode) {
    // Brighter, more saturated colors for light mode with better contrast
    if (isRaw) {
      // Blue tones - vibrant blues for light mode
      if (intensity < 0.25) {
        const t = intensity / 0.25;
        color = `rgb(${Math.floor(200 + t * 30)}, ${Math.floor(
          220 + t * 25
        )}, ${Math.floor(255)})`;
      } else if (intensity < 0.5) {
        const t = (intensity - 0.25) / 0.25;
        color = `rgb(${Math.floor(100 + t * 100)}, ${Math.floor(
          150 + t * 80
        )}, ${Math.floor(255)})`;
      } else if (intensity < 0.75) {
        const t = (intensity - 0.5) / 0.25;
        color = `rgb(${Math.floor(30 + t * 100)}, ${Math.floor(
          100 + t * 100
        )}, ${Math.floor(255)})`;
      } else {
        const t = (intensity - 0.75) / 0.25;
        color = `rgb(${Math.floor(30 + t * 30)}, ${Math.floor(
          50 + t * 100
        )}, ${Math.floor(255)})`;
      }
    } else {
      // Pink/magenta tones - vibrant pinks for light mode
      if (intensity < 0.25) {
        const t = intensity / 0.25;
        color = `rgb(${Math.floor(255)}, ${Math.floor(
          220 + t * 20
        )}, ${Math.floor(240 + t * 15)})`;
      } else if (intensity < 0.5) {
        const t = (intensity - 0.25) / 0.25;
        color = `rgb(${Math.floor(255)}, ${Math.floor(
          150 + t * 80
        )}, ${Math.floor(200 + t * 55)})`;
      } else if (intensity < 0.75) {
        const t = (intensity - 0.5) / 0.25;
        color = `rgb(${Math.floor(255)}, ${Math.floor(
          100 + t * 100
        )}, ${Math.floor(150 + t * 100)})`;
      } else {
        const t = (intensity - 0.75) / 0.25;
        color = `rgb(${Math.floor(255)}, ${Math.floor(
          50 + t * 100
        )}, ${Math.floor(100 + t * 100)})`;
      }
    }
  } else {
    // Dark mode - original subtle palette
    if (isRaw) {
      if (intensity < 0.25) {
        const t = intensity / 0.25;
        color = `rgb(0, ${Math.floor(t * 60)}, ${Math.floor(t * 120)})`;
      } else if (intensity < 0.5) {
        const t = (intensity - 0.25) / 0.25;
        color = `rgb(${Math.floor(t * 40)}, ${Math.floor(
          60 + t * 80
        )}, ${Math.floor(120 + t * 100)})`;
      } else if (intensity < 0.75) {
        const t = (intensity - 0.5) / 0.25;
        color = `rgb(${Math.floor(40 + t * 100)}, ${Math.floor(
          140 + t * 60
        )}, ${Math.floor(220 + t * 35)})`;
      } else {
        const t = (intensity - 0.75) / 0.25;
        color = `rgb(${Math.floor(140 + t * 100)}, ${Math.floor(
          200 + t * 55
        )}, 255)`;
      }
    } else {
      if (intensity < 0.25) {
        const t = intensity / 0.25;
        color = `rgb(${Math.floor(t * 80)}, 0, ${Math.floor(t * 60)})`;
      } else if (intensity < 0.5) {
        const t = (intensity - 0.25) / 0.25;
        color = `rgb(${Math.floor(80 + t * 100)}, ${Math.floor(
          t * 40
        )}, ${Math.floor(60 + t * 100)})`;
      } else if (intensity < 0.75) {
        const t = (intensity - 0.5) / 0.25;
        color = `rgb(${Math.floor(180 + t * 50)}, ${Math.floor(
          40 + t * 80
        )}, ${Math.floor(160 + t * 60)})`;
      } else {
        const t = (intensity - 0.75) / 0.25;
        color = `rgb(230, ${Math.floor(120 + t * 100)}, ${Math.floor(
          220 + t * 35
        )})`;
      }
    }
  }

  // Cache only first 1000 colors to avoid filling memory
  if (colorCache.size < 1000) {
    colorCache.set(cacheKey, color);
  }

  return color;
}

export function SpectrogramChart({
  history,
  isRaw,
  title,
  label,
}: SpectrogramChartProps) {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const lastHistoryRef = useRef<number[][]>([]);

  useEffect(() => {
    // Skip if history hasn't changed
    if (
      history.length === lastHistoryRef.current.length &&
      history.length > 0 &&
      JSON.stringify(history[history.length - 1]) ===
        JSON.stringify(
          lastHistoryRef.current[lastHistoryRef.current.length - 1]
        )
    ) {
      return;
    }
    lastHistoryRef.current = history;

    // Anulează frame-ul anterior
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Use requestAnimationFrame for smooth rendering
    animationFrameRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;
      const marginLeft = 50;
      const marginBottom = 5;
      const marginTop = 15;
      const plotW = w - marginLeft - 25;
      const plotH = h - marginBottom - marginTop;

      // Theme-aware colors
      const bgColor = theme === "light" ? "#f8fafc" : "#0f172a";
      const plotBgColor = theme === "light" ? "#ffffff" : "#1e293b";
      const textColor = theme === "light" ? "#475569" : "#64748b";
      const labelBgColor =
        theme === "light"
          ? "rgba(248, 250, 252, 0.9)"
          : "rgba(15, 23, 42, 0.9)";
      const labelTextColor = theme === "light" ? "#475569" : "#94a3b8";
      const borderColor = theme === "light" ? "#cbd5e1" : "#475569";

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = plotBgColor;
      ctx.fillRect(marginLeft, marginTop, plotW, plotH);

      if (history.length === 0) {
        ctx.fillStyle = textColor;
        ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          "Awaiting FFT data...",
          marginLeft + plotW / 2,
          marginTop + plotH / 2
        );
        return;
      }

      const colWidth = plotW / spectrogramWidth;
      const bandHeight = plotH / NUM_BANDS;

      // Draw spectrogram
      const isLightMode = theme === "light";
      history.forEach((bands, colIndex) => {
        const x = marginLeft + colIndex * colWidth;
        for (let band = 0; band < NUM_BANDS; band++) {
          const y = marginTop + plotH - (band + 1) * bandHeight;
          const value = bands[band] || 0;
          ctx.fillStyle = getBandColor(value, isRaw, isLightMode);
          ctx.fillRect(x, y, colWidth + 1, bandHeight + 1);
        }
      });

      // Draw frequency labels
      ctx.font = "10px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "right";
      const freqLabels = [
        "250",
        "500",
        "1k",
        "1.5k",
        "2k",
        "2.5k",
        "3k",
        "4k",
        "8k",
      ];

      for (let i = 0; i < NUM_BANDS; i += 2) {
        const y = marginTop + plotH - (i + 0.5) * bandHeight;
        ctx.fillStyle = labelBgColor;
        ctx.fillRect(0, y - 7, marginLeft - 4, 14);
        ctx.fillStyle = labelTextColor;
        if (freqLabels[i]) {
          ctx.fillText(freqLabels[i], marginLeft - 6, y + 3);
        }
      }

      // Draw current line
      if (history.length > 0) {
        const lineX = marginLeft + history.length * colWidth;
        ctx.strokeStyle = isRaw ? "#60a5fa" : "#f472b6";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lineX, marginTop);
        ctx.lineTo(lineX, marginTop + plotH);
        ctx.stroke();
      }

      // Draw legend
      const legendW = 14;
      const legendX = w - legendW - 6;
      const legendH = plotH * 0.7;
      const legendY = marginTop + (plotH - legendH) / 2;

      for (let i = 0; i < legendH; i++) {
        const intensity = ((legendH - i) / legendH) * 100;
        ctx.fillStyle = getBandColor(intensity, isRaw, isLightMode);
        ctx.fillRect(legendX, legendY + i, legendW, 1);
      }

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(legendX, legendY, legendW, legendH);

      ctx.font = "9px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = labelTextColor;
      ctx.fillText("Max", legendX + legendW / 2, legendY - 4);
      ctx.fillText("Min", legendX + legendW / 2, legendY + legendH + 12);
    });

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [history, isRaw, theme]);

  return (
    <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-lg p-4 shadow-lg">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-slate-900 dark:text-slate-200 font-semibold text-sm">
          {title}
        </h3>
        <span
          className={`text-xs px-2 py-1 rounded font-medium border ${
            label === "RAW"
              ? "bg-blue-500/20 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/30 dark:border-blue-500/30"
              : "bg-pink-500/20 dark:bg-pink-500/20 text-pink-600 dark:text-pink-300 border-pink-500/30 dark:border-pink-500/30"
          }`}
        >
          {label}
        </span>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full rounded bg-slate-50 dark:bg-slate-900"
          style={{ height: "180px" }}
        />
      </div>
    </div>
  );
}
