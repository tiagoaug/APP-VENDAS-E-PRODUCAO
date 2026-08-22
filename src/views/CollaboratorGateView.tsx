import { useState } from "react";
import { Users, KeyRound, LogOut, Eye, EyeOff, Lock, Fingerprint, X } from "lucide-react";
import { Collaborator } from "../types";

interface CollaboratorGateViewProps {
  collaborators: Collaborator[];
  lastActiveId: string | null;
  onConfirm: (id: string, pin: string) => boolean;
  onLogout: () => void;
  // Nome do tipo de biometria disponível neste aparelho (ex.: "Face ID", "Digital") — null
  // quando o aparelho não tem biometria disponível/cadastrada no sistema operacional.
  biometricLabel: string | null;
  // Ids de colaboradores com biometria lembrada NESTE aparelho (preferência local, não
  // sincronizada — a digital/rosto cadastrado é sempre do dono físico deste celular).
  biometricEnabledIds: string[];
  // Dispara o prompt nativo; se confirmado, já loga o colaborador (equivalente a um PIN
  // correto) e retorna true/false pro resultado.
  onBiometricLogin: (id: string) => Promise<boolean>;
  // Dispara o prompt nativo pra confirmar que a biometria funciona neste aparelho e, se ok,
  // marca esse colaborador como "lembrado" pra próximas vezes.
  onEnableBiometric: (id: string) => Promise<boolean>;
}

export default function CollaboratorGateView({ collaborators, lastActiveId, onConfirm, onLogout, biometricLabel, biometricEnabledIds, onBiometricLogin, onEnableBiometric }: CollaboratorGateViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(lastActiveId);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [useManualPin, setUseManualPin] = useState(false);
  const [rememberBiometric, setRememberBiometric] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricError, setBiometricError] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState<{ url: string; name: string } | null>(null);

  const selectCollaborator = (id: string) => {
    setSelectedId(id);
    setPin("");
    setError(false);
    setShowPin(false);
    setUseManualPin(false);
    setRememberBiometric(false);
    setBiometricError(false);
  };

  const handleConfirm = async () => {
    if (!selectedId) return;
    const ok = onConfirm(selectedId, pin);
    if (!ok) {
      setError(true);
      setPin("");
      return;
    }
    if (rememberBiometric && biometricLabel) {
      await onEnableBiometric(selectedId);
    }
  };

  const handleBiometricLogin = async (id: string) => {
    setBiometricBusy(true);
    setBiometricError(false);
    const ok = await onBiometricLogin(id);
    setBiometricBusy(false);
    if (!ok) setBiometricError(true);
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
            const biometricEnabledForThis = biometricEnabledIds.includes(collab.id);
            const showBiometricPanel = !!biometricLabel && biometricEnabledForThis && !useManualPin;

            return (
              <div key={collab.id} className="flex flex-col gap-2">
                <div
                  className={`w-full flex items-center p-4 rounded-2xl border-2 transition group text-left ${isSelected ? 'border-indigo-300 bg-indigo-50' : 'border-slate-100 bg-[#f8f9fc] hover:border-indigo-200'}`}
                >
                  {collab.photoUrl ? (
                    <button
                      type="button"
                      onClick={() => setExpandedPhoto({ url: collab.photoUrl!, name: collab.name })}
                      title="Ampliar foto"
                      aria-label={`Ampliar foto de ${collab.name}`}
                      className="w-12 h-12 rounded-full overflow-hidden shadow-inner flex-shrink-0 mr-4"
                    >
                      <img src={collab.photoUrl} alt={collab.name} className="w-full h-full object-cover" />
                    </button>
                  ) : (
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black shadow-inner flex-shrink-0 mr-4" style={{ backgroundColor: collab.colorHex }}>
                      {collab.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => selectCollaborator(collab.id)}
                    className="flex items-center flex-1 text-left"
                  >
                    <span className="text-sm font-black text-slate-800 uppercase tracking-tight truncate flex-1">{collab.name}</span>
                    {collab.locked ? <Lock size={16} className="text-rose-400 shrink-0" /> : biometricEnabledForThis && biometricLabel ? <Fingerprint size={16} className="text-indigo-400 shrink-0" /> : <KeyRound size={16} className="text-slate-400 shrink-0" />}
                  </button>
                </div>

                {isSelected && collab.locked && (
                  <div className="flex flex-col gap-2 px-1 py-2 animate-in fade-in slide-in-from-top-1 duration-150">
                    <p className="text-rose-500 text-[11px] text-center font-bold leading-relaxed">
                      Conta bloqueada após 5 tentativas incorretas.<br />Peça para o administrador desbloquear em Colaboradores.
                    </p>
                  </div>
                )}

                {isSelected && !collab.locked && showBiometricPanel && (
                  <div className="flex flex-col gap-2 px-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    <button
                      type="button"
                      disabled={biometricBusy}
                      onClick={() => handleBiometricLogin(collab.id)}
                      className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition-all disabled:opacity-60"
                    >
                      <Fingerprint size={18} />
                      {biometricBusy ? 'Verificando...' : `Entrar com ${biometricLabel}`}
                    </button>
                    {biometricError && (
                      <p className="text-rose-500 text-[11px] text-center font-bold">Não foi possível confirmar. Tente novamente ou use o PIN.</p>
                    )}
                    <button
                      type="button"
                      onClick={() => setUseManualPin(true)}
                      className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center hover:text-indigo-600 transition py-1"
                    >
                      Usar PIN em vez disso
                    </button>
                  </div>
                )}

                {isSelected && !collab.locked && !showBiometricPanel && (
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

                    {biometricLabel && !biometricEnabledForThis && (
                      <label className="flex items-center gap-2 px-1 py-1 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberBiometric}
                          onChange={e => setRememberBiometric(e.target.checked)}
                          className="w-4 h-4 rounded accent-indigo-600"
                        />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lembrar com {biometricLabel} neste aparelho</span>
                      </label>
                    )}

                    <button
                      type="button"
                      onClick={handleConfirm}
                      className="w-full bg-indigo-600 text-white font-black py-3.5 rounded-2xl uppercase tracking-widest text-xs shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition-all"
                    >
                      Entrar
                    </button>

                    {biometricLabel && biometricEnabledForThis && (
                      <button
                        type="button"
                        onClick={() => { setUseManualPin(false); setBiometricError(false); }}
                        className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center hover:text-indigo-600 transition py-1"
                      >
                        Usar {biometricLabel}
                      </button>
                    )}
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

      {expandedPhoto && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setExpandedPhoto(null)}
        >
          <div className="relative max-w-sm w-full flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
            <img src={expandedPhoto.url} alt={expandedPhoto.name} className="w-full max-h-[70vh] object-contain rounded-[2rem] shadow-2xl" />
            <p className="text-sm font-black uppercase tracking-wider text-white">{expandedPhoto.name}</p>
            <button
              type="button"
              onClick={() => setExpandedPhoto(null)}
              className="absolute -top-3 -right-3 w-9 h-9 bg-white text-slate-700 rounded-full flex items-center justify-center shadow-md hover:bg-slate-100 transition-all"
              aria-label="Fechar" title="Fechar"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
