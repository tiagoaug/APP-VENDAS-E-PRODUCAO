import { Delete, CornerDownLeft } from 'lucide-react';
import { PIN_DIGITS, PIN_LETTERS, PIN_SPECIALS } from '../utils/pinKeypad';

interface CustomPinKeypadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  maxLength?: number;
  isDarkMode?: boolean;
}

// Teclado próprio pra digitar o PIN/senha do colaborador — nunca abre o teclado nativo do
// celular (o campo que mostra o valor é sempre `readOnly`, ver CollaboratorGateView.tsx e
// SettingsView.tsx). Conjunto fixo de caracteres (ver utils/pinKeypad.ts): letras e caracteres
// especiais em cima, números embaixo em layout de teclado numérico de sempre.
export default function CustomPinKeypad({ value, onChange, onSubmit, maxLength = 6, isDarkMode }: CustomPinKeypadProps) {
  const press = (ch: string) => {
    if (value.length >= maxLength) return;
    onChange(value + ch);
  };
  const backspace = () => onChange(value.slice(0, -1));

  const keyClass = `h-11 rounded-xl flex items-center justify-center text-sm font-black uppercase active:scale-90 transition-all ${
    isDarkMode ? 'bg-slate-800 text-white active:bg-slate-700' : 'bg-slate-100 text-slate-800 active:bg-slate-200'
  }`;

  return (
    <div className="flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
      <div className="grid grid-cols-5 gap-1.5">
        {PIN_LETTERS.map((l) => (
          <button key={l} type="button" onClick={() => press(l)} className={keyClass}>{l}</button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {PIN_SPECIALS.map((s) => (
          <button key={s} type="button" onClick={() => press(s)} className={keyClass}>{s}</button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {PIN_DIGITS.slice(0, 9).map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className={keyClass}>{d}</button>
        ))}
        <button type="button" onClick={backspace} className={`${keyClass} text-rose-500`} aria-label="Apagar" title="Apagar">
          <Delete size={16} />
        </button>
        <button type="button" onClick={() => press('0')} className={keyClass}>0</button>
        <div />
      </div>
      <button
        type="button"
        onClick={onSubmit}
        className="h-12 rounded-xl bg-indigo-600 text-white font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
      >
        <CornerDownLeft size={16} /> Entrar
      </button>
    </div>
  );
}
