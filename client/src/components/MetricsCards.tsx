import {
  TrendingUp,
  Volume2,
  Maximize2,
  ArrowDown,
  ArrowUp,
  Activity,
} from "lucide-react";

interface MetricsCardsProps {
  volume: number;
  volumeFiltered: number;
  peakToPeak: number;
  min: number;
  max: number;
  avg: number;
}

export function MetricsCards({
  volume,
  volumeFiltered,
  peakToPeak,
  min,
  max,
  avg,
}: MetricsCardsProps) {
  const metrics = [
    {
      title: "Raw Amplitude",
      value: volume,
      unit: "%",
      icon: Volume2,
      color: "blue",
    },
    {
      title: "Filtered Amplitude",
      value: volumeFiltered,
      unit: "%",
      icon: TrendingUp,
      color: "pink",
    },
    {
      title: "Peak-to-Peak",
      value: peakToPeak,
      unit: "units",
      icon: Maximize2,
      color: "purple",
    },
    {
      title: "ADC Minimum",
      value: min,
      unit: "",
      icon: ArrowDown,
      color: "slate",
    },
    {
      title: "ADC Maximum",
      value: max,
      unit: "",
      icon: ArrowUp,
      color: "slate",
    },
    {
      title: "Mean Value",
      value: Math.round(avg),
      unit: "",
      icon: Activity,
      color: "slate",
    },
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case "blue":
        return {
          icon: "text-blue-400",
          value: "text-blue-300",
        };
      case "pink":
        return {
          icon: "text-pink-400",
          value: "text-pink-300",
        };
      case "purple":
        return {
          icon: "text-purple-400",
          value: "text-purple-300",
        };
      default:
        return {
          icon: "text-slate-300",
          value: "text-slate-200",
        };
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        const colors = getColorClasses(metric.color);
        return (
          <div
            key={metric.title}
            className="bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-lg p-4 hover:scale-105 transition-transform duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-xs uppercase tracking-wide font-medium">
                {metric.title}
              </span>
              <Icon className={`w-4 h-4 ${colors.icon}`} />
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-bold ${colors.value}`}>
                {metric.value}
              </span>
              {metric.unit && (
                <span className="text-slate-500 text-sm">{metric.unit}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
