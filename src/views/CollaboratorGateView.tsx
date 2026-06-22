import { useState } from "react";
import { Users, KeyRound, LogOut, Eye, EyeOff, Lock } from "lucide-react";
import { Collaborator } from "../types";

interface CollaboratorGateViewProps {
  collaborators: Collaborator[];
  lastActiveId: string | null;
  onConfirm: (id: string, pin: string) => boolean;
  onLogout: () => void;
}

export default function CollaboratorGateView({ collaborators, lastActiveId, onConfirm, onLogout }: CollaboratorGateViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(lastActiveId);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const selectCollaborator = (id: string) => {
    setSelectedId(id);
    setPin("");
    setError(false);
    setShowPin(false);
  };

  const handleConfirm = () => {
    if (!selectedId) return;
    const ok = onConfirm(selectedId, pin);
    if (!ok) {
      setError(true);
      setPin("");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#f8f9fc] p-6 font-sans">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-6 relative mt-4">
          <div className="absolute -top-2 w-10 h-2 bg-indigo-400/30 blur-md rounded-full"></div>
          <Users className="text-white" size={30} strokeWidth={1.5} />
        </div>

        <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter mb-1">Quem é Você?</h1>
        <p className="text-[11px] font-bold text-slate-400 italic uppercase tracking-widest mb-10">Selecione seu nome para continuar</p>

        <div className="w-full bg-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-white relative z-10 flex flex-col gap-3">
          {collaborators.map(collab => {
            const isSelected = selectedId === collab.id;
            return (
              <div key={collab.id} className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => selectCollaborator(collab.id)}
                  className={`w-full flex items-center p-4 rounded-2xl border-2 transition group text-left ${isSelected ? 'border-indigo-300 bg-indigo-50' : 'border-slate-100 bg-[#f8f9fc] hover:border-indigo-200'}`}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black shadow-inner flex-shrink-0 mr-4" style={{ backgroundColor: collab.colorHex }}>
                    {collab.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-black text-slate-800 uppercase tracking-tight truncate flex-1">{collab.name}</span>
                  {collab.locked ? <Lock size={16} className="text-rose-400 shrink-0" /> : <KeyRound size={16} className="text-slate-400 shrink-0" />}
                </button>

                {isSelected && collab.locked && (
                  <div className="flex flex-col gap-2 px-1 py-2 animate-in fade-in slide-in-from-top-1 duration-150">
                    <p className="text-rose-500 text-[11px] text-center font-bold leading-relaxed">
                      Conta bloqueada após 5 tentativas incorretas.<br />Peça para o administrador desbloquear em Colaboradores.
                    </p>
                  </div>
                )}

                {isSelected && !collab.locked && (
                  <div className="flex flex-col gap-2 px-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="relative">
                      <input
                        type={showPin ? "text" : "password"}
                        inputMode="numeric"
                        maxLength={6}
                        autoFocus
                        value={pin}
                        onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setError(false); }}
                        onKeyDown={e => { if (e.key === "Enter") handleConfirm(); }}
                        placeholder="DIGITE SEU PIN"
                        className={`w-full px-4 py-4 pr-12 rounded-2xl bg-[#f8f9fc] border-2 text-slate-800 text-sm font-bold placeholder:uppercase placeholder:tracking-widest placeholder:text-slate-400 outline-none transition tracking-[0.3em] text-center ${error ? 'border-rose-400' : 'border-transparent focus:border-indigo-100 focus:bg-white'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(v => !v)}
                        title={showPin ? "Ocultar PIN" : "Mostrar PIN"}
                        aria-label={showPin ? "Ocultar PIN" : "Mostrar PIN"}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition"
                      >
                        {showPin ? <EyeOff size={18} strokeWidth={2.5} /> : <Eye size={18} strokeWidth={2.5} />}
                      </button>
                    </div>
                    {error && <p className="text-rose-500 text-[11px] text-center font-bold">PIN incorreto</p>}
                    <button
                      type="button"
                      onClick={handleConfirm}
                      className="w-full bg-indigo-600 text-white font-black py-3.5 rounded-2xl uppercase tracking-widest text-xs shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition-all"
                    >
                      Entrar
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center justify-center gap-2 mt-2 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-500 transition"
          >
            <LogOut size={14} />
            Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
}
