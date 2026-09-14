import { useMemo, useState } from "react";
import { Users, KeyRound, LogOut, Eye, EyeOff, Lock, Fingerprint, X, Search } from "lucide-react";
import { Collaborator } from "../types";
import CustomPinKeypad from "../components/CustomPinKeypad";
import { PIN_LENGTH } from "../utils/pinKeypad";

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
  // Dica da senha (Collaborator.pinHint, ver CollaboratorsConfigView.tsx) — nunca mostra a
  // senha em si, só o lembrete que o gestor cadastrou, pra quem esquecer não precisar chamar
  // ninguém toda vez.
  const [showHint, setShowHint] = useState(false);
  const [useManualPin, setUseManualPin] = useState(false);
  const [rememberBiometric, setRememberBiometric] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricError, setBiometricError] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState<{ url: string; name: string } | null>(null);
  // Busca por nome — só aparece com equipes grandes (ver "collaborators.length > 8" abaixo).
  // O último colaborador usado NESTE aparelho fica sempre fixado no topo da lista (antes/depois
  // do filtro), pra reentrar rápido sem digitar nada quando é sempre a mesma pessoa no celular.
  const [search, setSearch] = useState("");
  const sortedCollaborators = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term ? collaborators.filter(c => c.name.toLowerCase().includes(term)) : collaborators;
    return [...filtered].sort((a, b) => {
      if (a.id === lastActiveId) return -1;
      if (b.id === lastActiveId) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [collaborators, search, lastActiveId]);

  const selectCollaborator = (id: string) => {
    setSelectedId(id);
    setPin("");
    setError(false);
    setShowPin(false);
    setShowHint(false);
    setUseManualPin(false);
    setRememberBiometric(false);
    setBiometricError(false);
  };

  // "Diminuir"/voltar pra lista inteira — enquanto alguém está selecionado, a lista fica
  // reduzida a só essa pessoa (ver `visibleCollaborators` abaixo), pra sobrar tela inteira pro
  // teclado personalizado em vez de dividir espaço com as outras dezenas de colegas.
  const backToList = () => {
    setSelectedId(null);
    setPin("");
    setError(false);
  };

  const visibleCollaborators = selectedId ? sortedCollaborators.filter(c => c.id === selectedId) : sortedCollaborators;

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
        <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-3 relative mt-2">
          <div className="absolute -top-2 w-10 h-2 bg-indigo-400/30 blur-md rounded-full"></div>
          <Users className="text-white" size={22} strokeWidth={1.5} />
        </div>

        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-1">Quem é Você?</h1>
        <p className="text-[11px] font-bold text-slate-400 italic uppercase tracking-widest mb-4">Selecione seu nome para continuar</p>

        <div className="w-full bg-white p-5 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-white relative z-10 flex flex-col gap-3">
          {!selectedId && collaborators.length > 8 && (
            <div className="relative shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={15} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar seu nome..."
                data-guide-anchor="collabGate.buscar"
                className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-[#f8f9fc] text-xs font-bold text-slate-700 placeholder:text-slate-400 outline-none focus:bg-white border-2 border-transparent focus:border-indigo-100 transition"
              />
            </div>
          )}
          {selectedId && collaborators.length > 1 && (
            <button
              type="button"
              onClick={backToList}
              data-guide-anchor="collabGate.trocarPessoa"
              className="self-start text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition py-1"
            >
              ← Trocar pessoa
            </button>
          )}
          <div className={`flex flex-col gap-2 ${selectedId ? '' : 'max-h-[46vh] overflow-y-auto pr-0.5 -mr-0.5'}`}>
          {visibleCollaborators.map(collab => {
            const isSelected = selectedId === collab.id;
            const biometricEnabledForThis = biometricEnabledIds.includes(collab.id);
            const showBiometricPanel = !!biometricLabel && biometricEnabledForThis && !useManualPin;

            return (
              <div key={collab.id} className="flex flex-col gap-2">
                <div
                  className={`w-full flex items-center p-2.5 rounded-2xl border-2 transition group text-left ${isSelected ? 'border-indigo-300 bg-indigo-50' : 'border-slate-100 bg-[#f8f9fc] hover:border-indigo-200'}`}
                >
                  {collab.photoUrl ? (
                    <button
                      type="button"
                      onClick={() => setExpandedPhoto({ url: collab.photoUrl!, name: collab.name })}
                      data-guide-anchor="collabGate.fotoAmpliar"
                      title="Ampliar foto"
                      aria-label={`Ampliar foto de ${collab.name}`}
                      className="w-9 h-9 rounded-full overflow-hidden shadow-inner flex-shrink-0 mr-3"
                    >
                      <img src={collab.photoUrl} alt={collab.name} className="w-full h-full object-cover" />
                    </button>
                  ) : (
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black shadow-inner flex-shrink-0 mr-3" style={{ backgroundColor: collab.colorHex }}>
                      {collab.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => selectCollaborator(collab.id)}
                    data-guide-anchor="collabGate.selecionar"
                    className="flex items-center flex-1 text-left"
                  >
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight truncate flex-1">{collab.name}</span>
                    {collab.locked ? <Lock size={14} className="text-rose-400 shrink-0" /> : biometricEnabledForThis && biometricLabel ? <Fingerprint size={14} className="text-indigo-400 shrink-0" /> : <KeyRound size={14} className="text-slate-400 shrink-0" />}
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
                      data-guide-anchor="collabGate.biometria"
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
                      data-guide-anchor="collabGate.usarPin"
                      className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center hover:text-indigo-600 transition py-1"
                    >
                      Usar PIN em vez disso
                    </button>
                  </div>
                )}

                {isSelected && !collab.locked && !showBiometricPanel && (
                  <div className="flex flex-col gap-2 px-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="relative">
                      {/* readOnly de propósito — o valor só muda pelo teclado personalizado
                          abaixo (CustomPinKeypad), nunca pelo teclado nativo do celular. */}
                      <input
                        type="text"
                        readOnly
                        value={showPin ? pin : "•".repeat(pin.length)}
                        placeholder="TOQUE NO TECLADO ABAIXO"
                        className={`w-full px-4 py-4 pr-12 rounded-2xl bg-[#f8f9fc] border-2 text-slate-800 text-sm font-bold placeholder:normal-case placeholder:text-[10px] placeholder:tracking-widest placeholder:text-slate-400 outline-none transition tracking-[0.3em] text-center cursor-default ${error ? 'border-rose-400' : 'border-transparent'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(v => !v)}
                        data-guide-anchor="collabGate.pinMostrarToggle"
                        title={showPin ? "Ocultar PIN" : "Mostrar PIN"}
                        aria-label={showPin ? "Ocultar PIN" : "Mostrar PIN"}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition"
                      >
                        {showPin ? <EyeOff size={18} strokeWidth={2.5} /> : <Eye size={18} strokeWidth={2.5} />}
                      </button>
                    </div>
                    {error && <p className="text-rose-500 text-[11px] text-center font-bold">PIN incorreto</p>}

                    {collab.pinHint && (
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowHint(v => !v)}
                          data-guide-anchor="collabGate.dicaToggle"
                          className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition py-1"
                        >
                          {showHint ? 'Ocultar dica' : 'Esqueceu? Ver dica'}
                        </button>
                        {showHint && (
                          <p className="text-xs text-slate-500 font-bold text-center italic px-4">"{collab.pinHint}"</p>
                        )}
                      </div>
                    )}

                    <CustomPinKeypad value={pin} onChange={(v) => { setPin(v); setError(false); }} onSubmit={handleConfirm} maxLength={PIN_LENGTH} />

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

                    {biometricLabel && biometricEnabledForThis && (
                      <button
                        type="button"
                        onClick={() => { setUseManualPin(false); setBiometricError(false); }}
                        data-guide-anchor="collabGate.usarBiometria"
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
          </div>

          <button
            type="button"
            onClick={onLogout}
            data-guide-anchor="collabGate.sair"
            className="flex items-center justify-center gap-2 mt-1 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-500 transition shrink-0"
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
              data-guide-anchor="collabGate.fotoFechar"
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
