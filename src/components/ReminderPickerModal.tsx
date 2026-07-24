import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Bell, X, AlarmClock, BellOff, Play, Star, Trash2, Plus, Check, BellRing } from "lucide-react";
import DateTimePicker from "./DateTimePicker";
import { ReminderTonePattern, ReminderProfile } from "../types";
import { REMINDER_TONE_META } from "../services/notificationService";
import { REMINDER_TONE_LIBRARY, ReminderToneWave } from "../data/reminderTones";
import {
  subscribeToReminderProfiles,
  saveReminderProfile,
  deleteReminderProfile,
  seedDefaultReminderProfilesIfEmpty,
} from "../services/reminderProfileService";

// Prévia audível dos 30 padrões — toca direto no navegador/WebView via Web Audio
// API, usando as mesmas notas/formas de onda da biblioteca que gera os .wav do
// Android (src/data/reminderTones.ts), pra ouvir e escolher sem esperar uma
// notificação nativa real chegar alguns segundos depois.
let previewAudioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtxClass) return null;
  if (!previewAudioCtx || previewAudioCtx.state === "closed") {
    previewAudioCtx = new AudioCtxClass();
  }
  if (previewAudioCtx.state === "suspended") {
    previewAudioCtx.resume().catch(() => {});
  }
  return previewAudioCtx;
}

function playNote(ctx: AudioContext, wave: ReminderToneWave, freq: number, startTime: number, durationSec: number, volume: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = wave;
  osc.frequency.value = freq;
  const fade = Math.min(0.015, durationSec / 4);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + fade);
  gain.gain.setValueAtTime(volume, Math.max(startTime + fade, startTime + durationSec - fade));
  gain.gain.linearRampToValueAtTime(0, startTime + durationSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + durationSec);
}

function playTonePreview(pattern: ReminderTonePattern) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const def = REMINDER_TONE_LIBRARY.find((t) => t.id === pattern);
  if (!def) return;
  const now = ctx.currentTime + 0.02;
  for (const note of def.notes) {
    // Volume um pouco mais alto na prévia (alto-falantes de notebook/celular
    // são mais fracos que o toque de notificação real do sistema).
    playNote(ctx, note.wave, note.freq, now + note.start, note.dur, Math.min(1, note.vol * 1.6));
  }
}

interface ReminderPickerModalProps {
  isDarkMode: boolean;
  label?: string;
  title: string;
  onTitleChange: (v: string) => void;
  at: number | null | undefined;
  onAtChange: (v: number | null) => void;
  alarmMode: boolean;
  onAlarmModeChange: (v: boolean) => void;
  combineMode?: boolean;
  onCombineModeChange?: (v: boolean) => void;
  soundPattern: ReminderTonePattern;
  onSoundPatternChange: (v: ReminderTonePattern) => void;
}

export default function ReminderPickerModal({
  isDarkMode,
  label = "Lembrete (opcional)",
  title,
  onTitleChange,
  at,
  onAtChange,
  alarmMode,
  onAlarmModeChange,
  combineMode = false,
  onCombineModeChange,
  soundPattern,
  onSoundPatternChange,
}: ReminderPickerModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [profiles, setProfiles] = useState<ReminderProfile[]>([]);
  const [newProfileName, setNewProfileName] = useState("");
  const [showSaveProfile, setShowSaveProfile] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    seedDefaultReminderProfilesIfEmpty();
    const unsub = subscribeToReminderProfiles(setProfiles);
    return () => unsub();
  }, [isOpen]);

  const applyProfile = (p: ReminderProfile) => {
    onAlarmModeChange(p.alarmMode);
    onCombineModeChange?.(!!p.combineMode);
    onSoundPatternChange(p.soundPattern);
  };

  const handleSaveProfile = async () => {
    if (!newProfileName.trim()) return;
    await saveReminderProfile({ name: newProfileName.trim(), alarmMode, combineMode, soundPattern });
    setNewProfileName("");
    setShowSaveProfile(false);
  };

  const summary = at
    ? `${new Date(at).toLocaleDateString("pt-BR")} · ${String(new Date(at).getHours()).padStart(2, "0")}:${String(new Date(at).getMinutes()).padStart(2, "0")}${title ? ` — ${title}` : ""}`
    : "Nenhum lembrete configurado";

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-3 block tracking-widest leading-none">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left ${
          isDarkMode ? "bg-slate-800 border-slate-700 hover:border-slate-600" : "bg-slate-50 border-slate-100 hover:border-slate-200"
        }`}
      >
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${at ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500" : "bg-slate-200/60 dark:bg-slate-700 text-slate-400"}`}>
          {at ? <Bell size={15} /> : <BellOff size={15} />}
        </div>
        <span className={`flex-1 text-[11px] font-bold truncate ${at ? (isDarkMode ? "text-white" : "text-slate-700") : "text-slate-400"}`}>
          {summary}
        </span>
        {at && (
          <span
            role="button"
            title="Remover lembrete"
            onClick={(e) => {
              e.stopPropagation();
              onAtChange(null);
              onTitleChange("");
            }}
            className="text-rose-400 hover:text-rose-500 shrink-0"
          >
            <X size={14} />
          </span>
        )}
      </button>

      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[65000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
            <div className={`relative w-full max-w-md max-h-[88vh] overflow-y-auto custom-scrollbar rounded-[2rem] shadow-2xl border flex flex-col ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-50 dark:border-slate-800/50 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Bell size={18} />
                  </div>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Configurar Lembrete</h2>
                </div>
                <button type="button" onClick={() => setIsOpen(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all" aria-label="Fechar">
                  <X size={22} />
                </button>
              </div>

              <div className="flex-1 flex flex-col gap-4 p-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] uppercase font-black text-slate-400 px-1 tracking-widest">Título</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    placeholder="Título do lembrete..."
                    className={`w-full border-none rounded-2xl px-4 py-3 text-[12px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 ${isDarkMode ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-700"}`}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[9px] uppercase font-black text-slate-400 px-1 tracking-widest">Data e hora</label>
                  <DateTimePicker value={at} onChange={onAtChange} isDarkMode={isDarkMode} placeholder="Definir data e hora do lembrete" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[9px] uppercase font-black text-slate-400 px-1 tracking-widest">Tipo de aviso</label>
                  <div className={`flex p-1 rounded-2xl gap-1 ${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`}>
                    <button
                      type="button"
                      onClick={() => { onAlarmModeChange(true); onCombineModeChange?.(false); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        alarmMode && !combineMode ? "bg-rose-500 text-white shadow-sm" : "text-slate-400"
                      }`}
                    >
                      <AlarmClock size={13} /> Alarme
                    </button>
                    {onCombineModeChange && (
                      <button
                        type="button"
                        onClick={() => { onAlarmModeChange(true); onCombineModeChange(true); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          alarmMode && combineMode ? "bg-amber-500 text-white shadow-sm" : "text-slate-400"
                        }`}
                      >
                        <BellRing size={13} /> Alarme + Notif.
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { onAlarmModeChange(false); onCombineModeChange?.(false); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        !alarmMode ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400"
                      }`}
                    >
                      <Bell size={13} /> Notificação
                    </button>
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 px-1 leading-relaxed">
                    {alarmMode && combineMode
                      ? "Toca o alarme insistente E deixa uma notificação de texto separada na bandeja, mesmo depois de dispensar o alarme."
                      : alarmMode
                      ? "Toca insistente e precisa ser dispensado no próprio aviso — pra não deixar passar."
                      : "Aviso único, no padrão de toque escolhido abaixo."}
                  </p>
                </div>

                {(!alarmMode || combineMode) && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] uppercase font-black text-slate-400 px-1 tracking-widest">Padrão de toque e vibração</label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {REMINDER_TONE_META.map((meta) => (
                        <div
                          key={meta.id}
                          className={`flex items-center gap-2.5 p-2.5 rounded-2xl border transition-all ${
                            soundPattern === meta.id
                              ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700"
                              : isDarkMode
                              ? "bg-slate-800/50 border-slate-800"
                              : "bg-slate-50 border-slate-100"
                          }`}
                        >
                          <button type="button" onClick={() => onSoundPatternChange(meta.id)} className="flex-1 flex flex-col items-start text-left">
                            <span className={`text-[11px] font-black ${soundPattern === meta.id ? "text-indigo-600 dark:text-indigo-400" : isDarkMode ? "text-white" : "text-slate-700"}`}>{meta.label}</span>
                            <span className="text-[9px] font-bold text-slate-400">{meta.description}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => playTonePreview(meta.id)}
                            title="Ouvir"
                            aria-label={`Ouvir toque ${meta.label}`}
                            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 ${isDarkMode ? "bg-indigo-900/40 text-indigo-300 hover:bg-indigo-900/60" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"}`}
                          >
                            <Play size={14} fill="currentColor" />
                          </button>
                          {soundPattern === meta.id && <Check size={16} className="text-indigo-500 shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Perfis salvos</label>
                    <button
                      type="button"
                      onClick={() => setShowSaveProfile((v) => !v)}
                      className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-indigo-500"
                    >
                      <Plus size={12} /> Salvar atual
                    </button>
                  </div>

                  {showSaveProfile && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        placeholder="Nome do perfil..."
                        className={`flex-1 border-none rounded-xl px-3 py-2 text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 ${isDarkMode ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-700"}`}
                      />
                      <button
                        type="button"
                        onClick={handleSaveProfile}
                        disabled={!newProfileName.trim()}
                        className="px-3 rounded-xl bg-indigo-600 text-white disabled:opacity-40"
                        aria-label="Confirmar salvar perfil"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    {profiles.length === 0 && (
                      <p className="text-[9px] font-bold text-slate-400 px-1 italic">Nenhum perfil salvo ainda.</p>
                    )}
                    {profiles.map((p) => {
                      const active = p.alarmMode === alarmMode && !!p.combineMode === !!combineMode && p.soundPattern === soundPattern;
                      const toneLabel = REMINDER_TONE_META.find((m) => m.id === p.soundPattern)?.label || p.soundPattern;
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
                            active
                              ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700"
                              : isDarkMode
                              ? "bg-slate-800/50 border-slate-800"
                              : "bg-slate-50 border-slate-100"
                          }`}
                        >
                          <button type="button" onClick={() => applyProfile(p)} className="flex-1 flex items-center gap-2 text-left">
                            <Star size={13} className={active ? "text-indigo-500" : "text-slate-300"} />
                            <div className="flex flex-col">
                              <span className={`text-[11px] font-black ${isDarkMode ? "text-white" : "text-slate-700"}`}>{p.name}</span>
                              <span className="text-[9px] font-bold text-slate-400">{p.alarmMode ? (p.combineMode ? `Alarme + Notificação — ${toneLabel}` : "Alarme") : `Notificação — ${toneLabel}`}</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteReminderProfile(p.id)}
                            title="Excluir perfil"
                            aria-label={`Excluir perfil ${p.name}`}
                            className="text-slate-300 hover:text-rose-500 transition-colors shrink-0 p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-6 pt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-full py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-indigo-600 text-white flex items-center justify-center gap-1.5"
                >
                  <Check size={14} /> Concluído
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
