import { useRef, useEffect, useState, useCallback } from "react";

interface DigitalTimeScrollerProps {
  hour: number; // 0-23
  minute: number; // 0-59
  onChange: (hour: number, minute: number) => void;
  isDarkMode?: boolean;
}

const ITEM_H = 34;
const VISIBLE = 3; // linhas visíveis (a do meio é a selecionada)
const PAD = ITEM_H * Math.floor(VISIBLE / 2);
const pad = (n: number) => String(n).padStart(2, "0");

function Column({ max, value, onSelect, isDarkMode }: { max: number; value: number; onSelect: (v: number) => void; isDarkMode?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [liveValue, setLiveValue] = useState(value);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProgrammatic = useRef(false);

  useEffect(() => {
    setLiveValue(value);
    const el = ref.current;
    if (!el) return;
    isProgrammatic.current = true;
    el.scrollTo({ top: value * ITEM_H, behavior: "auto" });
    const t = setTimeout(() => { isProgrammatic.current = false; }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(max, idx));
    setLiveValue(clamped);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (!isProgrammatic.current) onSelect(clamped);
    }, 120);
  }, [max, onSelect]);

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={handleScroll}
        className="snap-y snap-mandatory overflow-y-scroll no-scrollbar"
        style={{ height: ITEM_H * VISIBLE, paddingTop: PAD, paddingBottom: PAD }}
      >
        {Array.from({ length: max + 1 }, (_, n) => {
          const dist = Math.abs(n - liveValue);
          const opacity = dist === 0 ? 1 : dist === 1 ? 0.45 : 0.2;
          const scale = dist === 0 ? 1 : 0.82;
          return (
            <div
              key={n}
              className="snap-center flex items-center justify-center font-black tabular-nums select-none"
              style={{ height: ITEM_H, opacity, transform: `scale(${scale})`, fontSize: dist === 0 ? 20 : 15, color: dist === 0 ? (isDarkMode ? "#fff" : "#0f172a") : isDarkMode ? "#94a3b8" : "#64748b" }}
            >
              {pad(n)}
            </div>
          );
        })}
      </div>
      {/* fade nas bordas pra indicar que rola */}
      <div className={`absolute top-0 left-0 right-0 h-3 pointer-events-none bg-gradient-to-b ${isDarkMode ? "from-slate-800" : "from-white"} to-transparent`} />
      <div className={`absolute bottom-0 left-0 right-0 h-3 pointer-events-none bg-gradient-to-t ${isDarkMode ? "from-slate-800" : "from-white"} to-transparent`} />
    </div>
  );
}

export default function DigitalTimeScroller({ hour, minute, onChange, isDarkMode = false }: DigitalTimeScrollerProps) {
  return (
    <div className={`relative flex items-center justify-center gap-1 rounded-2xl border px-4 ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-100"}`}>
      {/* Faixa central destacada */}
      <div
        className={`absolute left-2 right-2 rounded-xl pointer-events-none ${isDarkMode ? "bg-slate-700/60" : "bg-white shadow-sm"}`}
        style={{ height: ITEM_H, top: "50%", transform: "translateY(-50%)" }}
      />
      <Column max={23} value={hour} onSelect={(h) => onChange(h, minute)} isDarkMode={isDarkMode} />
      <span className="text-lg font-black text-indigo-500 z-10 pb-0.5">:</span>
      <Column max={59} value={minute} onSelect={(m) => onChange(hour, m)} isDarkMode={isDarkMode} />
    </div>
  );
}
