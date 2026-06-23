import { useRef, useState } from "react";

interface AnalogClockProps {
  hour24: number;
  minute: number;
  onChange: (hour24: number, minute: number) => void;
  isDarkMode?: boolean;
}

const SIZE = 220;
const CENTER = SIZE / 2;
const NUM_RADIUS = CENTER - 30;
const HAND_HOUR_RADIUS = CENTER - 62;
const HAND_MIN_RADIUS = CENTER - 34;

function pointOnCircle(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + radius * Math.sin(rad), y: CENTER - radius * Math.cos(rad) };
}

function angleFromPoint(x: number, y: number) {
  const dx = x - CENTER;
  const dy = y - CENTER;
  let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function AnalogClock({ hour24, minute, onChange, isDarkMode = false }: AnalogClockProps) {
  const [mode, setMode] = useState<"hour" | "minute">("hour");
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);

  const isPM = hour24 >= 12;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  const setHour12 = (h: number, pm: boolean) => {
    const h24 = pm ? (h % 12) + 12 : h % 12;
    onChange(h24, minute);
  };

  const handlePointer = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * SIZE;
    const y = ((clientY - rect.top) / rect.height) * SIZE;
    const angle = angleFromPoint(x, y);
    if (mode === "hour") {
      let h = Math.round(angle / 30) % 12;
      if (h === 0) h = 12;
      setHour12(h, isPM);
    } else {
      const m = Math.round(angle / 6) % 60;
      onChange(hour24, m);
    }
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    draggingRef.current = true;
    handlePointer(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    handlePointer(e.clientX, e.clientY);
  };
  const onPointerUp = () => {
    if (draggingRef.current && mode === "hour") setMode("minute");
    draggingRef.current = false;
  };

  const faceColor = isDarkMode ? "#1e293b" : "#f8fafc";
  const numberColor = isDarkMode ? "#cbd5e1" : "#475569";
  const numberColorActive = "#ffffff";
  const handColor = "#4f46e5";
  const tickColor = isDarkMode ? "#334155" : "#e2e8f0";

  const handAngle = mode === "hour" ? (hour12 % 12) * 30 : minute * 6;
  const handRadius = mode === "hour" ? HAND_HOUR_RADIUS : HAND_MIN_RADIUS;
  const handEnd = pointOnCircle(handAngle, handRadius);

  const hourNumbers = Array.from({ length: 12 }, (_, i) => i + 1);
  const minuteMarks = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Display digital + AM/PM */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("hour")}
          className={`px-3 py-1.5 rounded-xl text-lg font-black tabular-nums transition-all ${mode === "hour" ? "bg-indigo-600 text-white" : isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}
        >
          {pad(hour12)}
        </button>
        <span className="text-lg font-black text-slate-400">:</span>
        <button
          type="button"
          onClick={() => setMode("minute")}
          className={`px-3 py-1.5 rounded-xl text-lg font-black tabular-nums transition-all ${mode === "minute" ? "bg-indigo-600 text-white" : isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}
        >
          {pad(minute)}
        </button>
        <div className="flex flex-col gap-0.5 ml-1">
          <button
            type="button"
            onClick={() => setHour12(hour12, false)}
            className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all ${!isPM ? "bg-indigo-600 text-white" : isDarkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => setHour12(hour12, true)}
            className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all ${isPM ? "bg-indigo-600 text-white" : isDarkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}
          >
            PM
          </button>
        </div>
      </div>

      {/* Clock face */}
      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        className="touch-none select-none cursor-pointer"
      >
        <circle cx={CENTER} cy={CENTER} r={CENTER - 2} fill={faceColor} />

        {/* Hand */}
        <line x1={CENTER} y1={CENTER} x2={handEnd.x} y2={handEnd.y} stroke={handColor} strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={handEnd.x} cy={handEnd.y} r={16} fill={handColor} opacity={0.18} />
        <circle cx={CENTER} cy={CENTER} r={3.5} fill={handColor} />

        {mode === "hour"
          ? hourNumbers.map((h) => {
              const { x, y } = pointOnCircle(h * 30, NUM_RADIUS);
              const active = h === hour12;
              return (
                <text
                  key={h}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={14}
                  fontWeight={900}
                  fill={active ? numberColorActive : numberColor}
                  className="pointer-events-none"
                >
                  {h}
                </text>
              );
            })
          : minuteMarks.map((m) => {
              const { x, y } = pointOnCircle(m * 6, NUM_RADIUS);
              const active = minute === m;
              return (
                <text
                  key={m}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={13}
                  fontWeight={900}
                  fill={active ? numberColorActive : numberColor}
                  className="pointer-events-none"
                >
                  {pad(m)}
                </text>
              );
            })}

        {/* Tick marks for the other granularity, subtle */}
        {mode === "minute" &&
          Array.from({ length: 60 }, (_, i) => i)
            .filter((m) => m % 5 !== 0)
            .map((m) => {
              const { x, y } = pointOnCircle(m * 6, NUM_RADIUS + 14);
              return <circle key={m} cx={x} cy={y} r={1} fill={tickColor} className="pointer-events-none" />;
            })}
      </svg>
    </div>
  );
}
