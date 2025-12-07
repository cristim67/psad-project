interface FrequencyBandsProps {
  bands: number[];
  isRaw: boolean;
  title: string;
}

export function FrequencyBands({ bands, isRaw, title }: FrequencyBandsProps) {
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

  return (
    <div className="bg-slate-800/80 border border-slate-700/50 rounded-lg p-4 shadow-lg">
      <h3
        className={`text-sm font-semibold mb-4 ${
          isRaw ? "text-blue-300" : "text-pink-300"
        }`}
      >
        {title}
      </h3>
      <div className="flex justify-between items-end h-28 gap-1 bg-slate-900/50 rounded-lg p-3">
        {bands.map((value, index) => {
          const height = Math.max(4, (value / 100) * 100);
          return (
            <div
              key={index}
              className="flex flex-col items-center flex-1 gap-2"
            >
              <div
                className={`w-full rounded-t transition-all duration-300 ${
                  isRaw
                    ? "bg-gradient-to-t from-blue-600 via-blue-500 to-blue-400"
                    : "bg-gradient-to-t from-pink-600 via-pink-500 to-pink-400"
                }`}
                style={{
                  height: `${height}px`,
                  boxShadow: isRaw
                    ? `0 0 8px rgba(96, 165, 250, ${(value / 100) * 0.4})`
                    : `0 0 8px rgba(244, 114, 182, ${(value / 100) * 0.4})`,
                }}
              />
              <span className="text-[9px] text-slate-500 font-medium whitespace-nowrap">
                {freqLabels[index]}
              </span>
            </div>
          );
        })}
      </div>
      <div className="text-center text-xs text-slate-500 mt-3">
        Frequency (Hz) — Voice Range
      </div>
    </div>
  );
}
