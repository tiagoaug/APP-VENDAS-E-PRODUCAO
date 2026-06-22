import { useState } from 'react';
import {
  UserCog,
  Plus,
  Pencil,
  Trash2,
  Check,
  ShoppingBag,
  ShoppingCart,
  Package,
  Boxes,
  Factory,
  PackageOpen,
  Wallet,
  Users,
  Landmark,
  Database,
  ShieldCheck,
  X,
  Eye,
  EyeOff,
  Sparkles,
  Lock,
} from 'lucide-react';
import { Collaborator } from '../types';
import { SECTORS } from '../utils/collaborators';
import { NAV_MONO_PALETTE } from '../utils/themes';
import { generateId } from '../utils/id';
import ConfirmDialog from '../components/ConfirmDialog';

const SECTOR_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  ShoppingBag, ShoppingCart, Package, Boxes, Factory, PackageOpen, Wallet, Users, Landmark, Database,
};

interface CollaboratorsConfigViewProps {
  collaborators: Collaborator[];
  onSave: (collab: Collaborator) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  isDarkMode: boolean;
}

function emptyDraft(): Collaborator {
  return {
    id: generateId(),
    name: '',
    pin: '',
    colorHex: NAV_MONO_PALETTE[4],
    isUnrestricted: false,
    sectors: [],
    canUseAI: true,
  };
}

export default function CollaboratorsConfigView({ collaborators, onSave, onDelete, isDarkMode }: CollaboratorsConfigViewProps) {
  const [draft, setDraft] = useState<Collaborator | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [revealedPinId, setRevealedPinId] = useState<string | null>(null);

  const startNew = () => { setDraft(emptyDraft()); setShowPin(false); };
  const startEdit = (collab: Collaborator) => { setDraft({ ...collab }); setShowPin(false); };

  const toggleSector = (sectorId: typeof SECTORS[number]['id']) => {
    if (!draft) return;
    setDraft({
      ...draft,
      sectors: draft.sectors.includes(sectorId)
        ? draft.sectors.filter(s => s !== sectorId)
        : [...draft.sectors, sectorId],
    });
  };

  const handleSave = () => {
    if (!draft || !draft.name.trim() || draft.pin.length !== 6) return;
    onSave(draft);
    setDraft(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    onDelete(deleteTarget);
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-col gap-8 pb-10 max-w-4xl mx-auto">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            <UserCog size={24} />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Colaboradores</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed italic">
          Cadastre quem usa o sistema e escolha quais setores cada um pode acessar. Sem nenhum
          colaborador cadastrado, o acesso continua livre para todos.
        </p>
      </header>

      {collaborators.length === 0 && !draft && (
        <div className={`p-8 rounded-[3rem] border-2 border-dashed text-center flex flex-col items-center gap-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <p className="text-xs text-slate-400 font-medium italic max-w-md mx-auto leading-relaxed">
            Nenhum colaborador cadastrado ainda — atualmente, todos que acessam o app têm acesso completo a todas as telas.
          </p>
          <button
            type="button"
            onClick={() => setDraft({ ...emptyDraft(), name: 'Gerente', isUnrestricted: true })}
            className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-95"
          >
            Criar primeiro colaborador
          </button>
        </div>
      )}

      {collaborators.length > 0 && !draft && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {collaborators.map(collab => {
            const isRevealed = revealedPinId === collab.id;
            return (
              <div
                key={collab.id}
                className={`flex flex-col gap-3 p-5 rounded-[2rem] border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl shrink-0" style={{ backgroundColor: collab.colorHex }} />
                    <p className={`text-base font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{collab.name}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => startEdit(collab)} title="Editar" aria-label={`Editar ${collab.name}`} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                      <Pencil size={15} />
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(collab.id)} title="Excluir" aria-label={`Excluir ${collab.name}`} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {collab.isUnrestricted ? (
                  <span className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider">
                    <ShieldCheck size={12} /> Acesso Total
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {collab.sectors.length === 0 && (
                      <span className="text-[10px] text-slate-400 italic">Nenhum setor liberado</span>
                    )}
                    {collab.sectors.map(sId => (
                      <span key={sId} className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {SECTORS.find(s => s.id === sId)?.label}
                      </span>
                    ))}
                  </div>
                )}

                {collab.locked && (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-900/20">
                    <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-rose-500">
                      <Lock size={13} /> Bloqueado (5 tentativas)
                    </span>
                    <button
                      type="button"
                      onClick={() => onSave({ ...collab, locked: false, failedAttempts: 0 })}
                      className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-[9px] font-black uppercase tracking-widest transition-colors"
                    >
                      Desbloquear
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setRevealedPinId(isRevealed ? null : collab.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">PIN</span>
                  <span className="flex items-center gap-2">
                    <span className={`text-sm font-black tracking-[0.3em] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {isRevealed ? collab.pin : '••••••'}
                    </span>
                    {isRevealed ? <EyeOff size={14} className="text-slate-400" /> : <Eye size={14} className="text-slate-400" />}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!draft && (
        <button
          type="button"
          onClick={startNew}
          className={`flex items-center justify-center gap-2 p-5 rounded-[2rem] border-2 border-dashed transition-all ${isDarkMode ? 'border-slate-800 text-slate-400 hover:border-indigo-500/40 hover:text-indigo-400' : 'border-slate-200 text-slate-500 hover:border-indigo-500/40 hover:text-indigo-600'}`}
        >
          <Plus size={18} />
          <span className="text-[11px] font-black uppercase tracking-widest">Novo Colaborador</span>
        </button>
      )}

      {draft && (
        <div className={`flex flex-col gap-6 p-6 rounded-[2.5rem] border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xl'}`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-base font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {collaborators.some(c => c.id === draft.id) ? 'Editar Colaborador' : 'Novo Colaborador'}
            </h3>
            <button type="button" onClick={() => setDraft(null)} aria-label="Cancelar" title="Cancelar" className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Nome</label>
            <input
              type="text"
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder="Ex: João - Comprador"
              className={`px-4 py-3 rounded-2xl border-2 text-sm font-bold outline-none focus:border-indigo-500 transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">PIN (6 dígitos)</label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={draft.pin}
                onChange={e => setDraft({ ...draft, pin: e.target.value.replace(/\D/g, '') })}
                placeholder="000000"
                className={`w-full px-4 py-3 pr-11 rounded-2xl border-2 text-sm font-bold outline-none focus:border-indigo-500 transition-colors tracking-[0.3em] ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
              />
              <button
                type="button"
                onClick={() => setShowPin(v => !v)}
                title={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition"
              >
                {showPin ? <EyeOff size={16} strokeWidth={2.5} /> : <Eye size={16} strokeWidth={2.5} />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Cor</label>
            <div className="flex flex-wrap gap-2">
              {NAV_MONO_PALETTE.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDraft({ ...draft, colorHex: c })}
                  title={c}
                  aria-label={`Cor ${c}`}
                  className={`w-8 h-8 rounded-xl border transition-all ${draft.colorHex === c ? 'border-indigo-500 scale-110 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700 hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDraft({ ...draft, isUnrestricted: !draft.isUnrestricted })}
            className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${draft.isUnrestricted ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-slate-50'}`}
          >
            <div className="flex items-center gap-3 text-left">
              <ShieldCheck size={20} className={draft.isUnrestricted ? 'text-emerald-500' : 'text-slate-400'} />
              <div>
                <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Acesso Total (sem restrições)</p>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Ex: Gerente — vê e faz tudo</p>
              </div>
            </div>
            <div className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${draft.isUnrestricted ? 'bg-emerald-500' : 'bg-slate-200'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${draft.isUnrestricted ? 'left-7' : 'left-1'}`} />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setDraft({ ...draft, canUseAI: !draft.canUseAI })}
            className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${draft.canUseAI ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-slate-50'}`}
          >
            <div className="flex items-center gap-3 text-left">
              <Sparkles size={20} className={draft.canUseAI ? 'text-violet-500' : 'text-slate-400'} />
              <div>
                <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Pode usar Assistente IA</p>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Acesso ao assistente inteligente</p>
              </div>
            </div>
            <div className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${draft.canUseAI ? 'bg-violet-500' : 'bg-slate-200'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${draft.canUseAI ? 'left-7' : 'left-1'}`} />
            </div>
          </button>

          {!draft.isUnrestricted && (
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Setores liberados</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SECTORS.map(sector => {
                  const Icon = SECTOR_ICONS[sector.icon] || Boxes;
                  const active = draft.sectors.includes(sector.id);
                  return (
                    <button
                      key={sector.id}
                      type="button"
                      onClick={() => toggleSector(sector.id)}
                      className={`flex flex-col text-left p-4 rounded-2xl border-2 transition-all ${active ? (isDarkMode ? 'bg-slate-800 border-indigo-500' : 'bg-white border-indigo-500 shadow-md') : (isDarkMode ? 'bg-slate-950 border-slate-900 opacity-70' : 'bg-slate-50 border-slate-100 opacity-70')}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Icon size={18} />
                          <span className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{sector.label}</span>
                        </div>
                        {active && <Check size={16} className="text-indigo-500 shrink-0" strokeWidth={3} />}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {sector.tasks.map((t, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[8px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            {t}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={!draft.name.trim() || draft.pin.length !== 6}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
          >
            Salvar Colaborador
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Excluir Colaborador"
        message="Tem certeza que deseja excluir este colaborador? Ele perderá o acesso configurado imediatamente."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isDanger
      />
    </div>
  );
}
