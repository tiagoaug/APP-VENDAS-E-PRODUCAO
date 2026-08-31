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
  Building2,
  LayoutDashboard,
  Percent,
  Camera,
} from 'lucide-react';
import { Collaborator, DashboardCardConfig, SectorId, TaskPermissionLevel } from '../types';
import { SECTORS, isDashboardCardAllowed, getTaskLevel } from '../utils/collaborators';
import { NAV_MONO_PALETTE } from '../utils/themes';
import { generateId } from '../utils/id';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import { toast } from '../utils/toast';

const TASK_LEVEL_LABELS: Record<TaskPermissionLevel, string> = { none: 'Sem acesso', view: 'Visualizar', edit: 'Editar' };

const SECTOR_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  ShoppingBag, ShoppingCart, Package, Boxes, Factory, PackageOpen, Wallet, Users, Landmark, Database, Building2,
};

interface CollaboratorsConfigViewProps {
  collaborators: Collaborator[];
  onSave: (collab: Collaborator) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  isDarkMode: boolean;
  // Lista global de cards do Dashboard (mesma usada no próprio Dashboard) — aqui serve só
  // pra listar rótulo/ordem; quais cards ficam realmente visíveis pro colaborador continua
  // filtrado pelos setores dele (isDashboardCardAllowed), então essa tela só deixa REFINAR
  // pra menos dentro do que os setores já liberam, nunca liberar um card fora deles.
  dashboardCards: DashboardCardConfig[];
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

export default function CollaboratorsConfigView({ collaborators, onSave, onDelete, isDarkMode, dashboardCards }: CollaboratorsConfigViewProps) {
  const [draft, setDraft] = useState<Collaborator | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [revealedPinId, setRevealedPinId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sectorPopup, setSectorPopup] = useState<SectorId | null>(null);
  const [expandedPhoto, setExpandedPhoto] = useState<{ url: string; name: string } | null>(null);

  const startNew = () => { setDraft(emptyDraft()); setShowPin(false); };
  const startEdit = (collab: Collaborator) => { setDraft({ ...collab }); setShowPin(false); };

  const isExistingDraft = !!draft && collaborators.some(c => c.id === draft.id);
  // Colaborador novo exige PIN de 6 dígitos. Editando um já existente, só exige que
  // o PIN não esteja vazio — assim um registro antigo com PIN fora do padrão atual
  // não trava pra sempre o salvamento de outras mudanças (ex.: setores liberados).
  const pinValid = !!draft && (isExistingDraft ? draft.pin.trim().length > 0 : draft.pin.length === 6);

  const toggleSector = (sectorId: typeof SECTORS[number]['id']) => {
    if (!draft) return;
    setDraft({
      ...draft,
      sectors: draft.sectors.includes(sectorId)
        ? draft.sectors.filter(s => s !== sectorId)
        : [...draft.sectors, sectorId],
    });
  };

  // 'edit' nunca fica salvo em taskPermissions — é o nível padrão implícito de qualquer setor
  // liberado, então gravar só os desvios (view/none) mantém colaboradores antigos (sem esse
  // campo) se comportando exatamente como hoje: acesso total ao que o setor libera.
  const setTaskLevel = (sectorId: SectorId, taskId: string, level: TaskPermissionLevel) => {
    if (!draft) return;
    const key = `${sectorId}:${taskId}`;
    const next = { ...(draft.taskPermissions || {}) };
    if (level === 'edit') delete next[key];
    else next[key] = level;
    setDraft({ ...draft, taskPermissions: next });
  };

  // Card já liberado pelos setores do colaborador (isDashboardCardAllowed) — aqui só se
  // decide se ele fica visível ou escondido pra ESSE colaborador especificamente, sem
  // mexer no card global nem liberar nada fora do que os setores já permitem.
  const isDashboardCardVisibleForDraft = (card: DashboardCardConfig) => {
    const override = draft?.dashboardConfig?.find(c => c.id === card.id);
    return override ? override.visible : card.visible;
  };

  const toggleDashboardCard = (card: DashboardCardConfig) => {
    if (!draft) return;
    const nextVisible = !isDashboardCardVisibleForDraft(card);
    const existing = draft.dashboardConfig || [];
    const next = existing.some(c => c.id === card.id)
      ? existing.map(c => c.id === card.id ? { ...c, visible: nextVisible } : c)
      : [...existing, { ...card, visible: nextVisible }];
    setDraft({ ...draft, dashboardConfig: next });
  };

  // onSave não era esperado aqui (await ausente) — o modal fechava (setDraft(null))
  // antes da escrita no Firestore terminar, então qualquer erro de gravação (rede,
  // etc.) ficava engolido em silêncio e a edição (ex.: setor marcado/desmarcado)
  // parecia "não salvar" sem nenhum aviso. Agora só fecha o modal depois de confirmar
  // que salvou, e mostra um toast nos dois casos.
  const handleSave = async () => {
    if (!draft || !draft.name.trim() || !pinValid || isSaving) return;
    setIsSaving(true);
    try {
      await onSave(draft);
      toast.show('Colaborador salvo com sucesso!');
      setDraft(null);
    } catch (e: any) {
      console.error('Erro ao salvar colaborador:', e);
      toast.show('Erro ao salvar colaborador: ' + (e?.message || e));
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(deleteTarget);
      toast.show('Colaborador excluído.');
      setDeleteTarget(null);
    } catch (e: any) {
      console.error('Erro ao excluir colaborador:', e);
      toast.show('Erro ao excluir colaborador: ' + (e?.message || e));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-32 max-w-4xl mx-auto">
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
                    {collab.photoUrl ? (
                      <button
                        type="button"
                        onClick={() => setExpandedPhoto({ url: collab.photoUrl!, name: collab.name })}
                        title="Ampliar foto"
                        aria-label={`Ampliar foto de ${collab.name}`}
                        className="w-10 h-10 rounded-2xl shrink-0 overflow-hidden"
                      >
                        <img src={collab.photoUrl} alt={collab.name} className="w-full h-full object-cover" />
                      </button>
                    ) : (
                      <div className="w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center text-white font-black text-sm" style={{ backgroundColor: collab.colorHex }}>
                        {collab.name.charAt(0).toUpperCase()}
                      </div>
                    )}
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
                {collab.isSeller && (
                  <span className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase tracking-wider">
                    <Percent size={12} /> Vendedor · {collab.commissionPercent ?? 0}% comissão
                  </span>
                )}
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
          data-guide-anchor="collab.novo"
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
              {isExistingDraft ? 'Editar Colaborador' : 'Novo Colaborador'}
            </h3>
            <button type="button" onClick={() => setDraft(null)} aria-label="Cancelar" title="Cancelar" className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>

          <div className="flex justify-center">
            <label className="relative cursor-pointer group" title="Toque para adicionar foto do colaborador">
              <div className={`w-24 h-24 rounded-3xl overflow-hidden border-2 flex items-center justify-center transition-all ${draft.photoUrl ? 'border-indigo-300 dark:border-indigo-600' : 'border-dashed border-slate-200 dark:border-slate-700'} ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                {draft.photoUrl
                  ? <img src={draft.photoUrl} alt="Foto do colaborador" className="w-full h-full object-cover" />
                  : <div className="flex flex-col items-center gap-1">
                      <Camera size={28} className="text-slate-300 dark:text-slate-600" />
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Foto</span>
                    </div>
                }
              </div>
              {draft.photoUrl && (
                <button
                  type="button"
                  onClick={e => { e.preventDefault(); setDraft({ ...draft, photoUrl: undefined }); }}
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-rose-600 transition-all"
                  title="Remover foto"
                >
                  <X size={12} strokeWidth={3} />
                </button>
              )}
              <div className="absolute inset-0 rounded-3xl bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={22} className="text-white" />
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => {
                    const result = ev.target?.result as string;
                    const img = new Image();
                    img.onload = () => {
                      const maxSide = 400;
                      const ratio = Math.min(maxSide / img.width, maxSide / img.height, 1);
                      const canvas = document.createElement('canvas');
                      canvas.width = img.width * ratio;
                      canvas.height = img.height * ratio;
                      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
                      setDraft(d => d ? { ...d, photoUrl: canvas.toDataURL('image/jpeg', 0.82) } : d);
                    };
                    img.src = result;
                  };
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }}
              />
            </label>
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

          <div className={`flex flex-col gap-3 p-4 rounded-2xl border-2 transition-all ${draft.isSeller ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-slate-50'}`}>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, isSeller: !draft.isSeller })}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-3 text-left">
                <Percent size={20} className={draft.isSeller ? 'text-amber-500' : 'text-slate-400'} />
                <div>
                  <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>É Vendedor</p>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Pode ser escolhido em Lançamento de Venda</p>
                </div>
              </div>
              <div className={`w-12 h-6 rounded-full relative shrink-0 transition-colors duration-300 ${draft.isSeller ? 'bg-amber-500' : 'bg-slate-200'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${draft.isSeller ? 'left-7' : 'left-1'}`} />
              </div>
            </button>
            {draft.isSeller && (
              <div className="flex items-center gap-3 pl-[52px]">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">Comissão</label>
                <div className="relative flex-1 max-w-[140px]">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step={0.5}
                    value={draft.commissionPercent ?? ''}
                    onChange={e => setDraft({ ...draft, commissionPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                    placeholder="0"
                    className={`w-full pl-3 pr-7 py-2 rounded-xl border-2 text-sm font-bold outline-none focus:border-amber-500 transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">%</span>
                </div>
                <p className="text-[9px] text-slate-400 font-medium leading-tight flex-1">sobre o total de cada venda dele</p>
              </div>
            )}
          </div>

          {!draft.isUnrestricted && (
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Setores liberados</label>
              <p className="text-[10px] text-slate-400 font-medium px-1 -mt-1 mb-1 leading-relaxed">
                Toque num setor pra ligar/desligar e refinar o que o colaborador vê ou edita em cada função dele.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SECTORS.map(sector => {
                  const Icon = SECTOR_ICONS[sector.icon] || Boxes;
                  const active = draft.sectors.includes(sector.id);
                  const hasCustomLevels = active && sector.tasks.some(t => getTaskLevel(draft, sector.id, t.id) !== 'edit');
                  return (
                    <button
                      key={sector.id}
                      type="button"
                      onClick={() => setSectorPopup(sector.id)}
                      className={`flex flex-col text-left p-4 rounded-2xl border-2 transition-all ${active ? (isDarkMode ? 'bg-slate-800 border-indigo-500' : 'bg-white border-indigo-500 shadow-md') : (isDarkMode ? 'bg-slate-950 border-slate-900 opacity-70' : 'bg-slate-50 border-slate-100 opacity-70')}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Icon size={18} />
                          <span className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{sector.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {hasCustomLevels && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Funções refinadas" />
                          )}
                          {active && <Check size={16} className="text-indigo-500" strokeWidth={3} />}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {sector.tasks.map(t => {
                          const level = getTaskLevel(draft, sector.id, t.id);
                          return (
                            <span
                              key={t.id}
                              className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${
                                level === 'none'
                                  ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-400 dark:text-rose-500 line-through'
                                  : level === 'view'
                                  ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {t.label}
                            </span>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(() => {
            const sector = SECTORS.find(s => s.id === sectorPopup);
            if (!sector || !draft) return null;
            const Icon = SECTOR_ICONS[sector.icon] || Boxes;
            const active = draft.sectors.includes(sector.id);
            return (
              <Modal isOpen onClose={() => setSectorPopup(null)} title={sector.label} icon={<Icon size={18} />} maxWidth="max-w-md" zIndex={92000}>
                <div className="flex flex-col gap-4">
                  <button
                    type="button"
                    onClick={() => toggleSector(sector.id)}
                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${active ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-slate-50'}`}
                  >
                    <div className="text-left">
                      <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Setor liberado</p>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{active ? 'Colaborador acessa este setor' : 'Colaborador não vê nada daqui'}</p>
                    </div>
                    <div className={`w-12 h-6 rounded-full relative shrink-0 transition-colors duration-300 ${active ? 'bg-indigo-500' : 'bg-slate-200'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${active ? 'left-7' : 'left-1'}`} />
                    </div>
                  </button>

                  {active ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Funções deste setor</p>
                      {sector.tasks.map(task => {
                        const level = getTaskLevel(draft, sector.id, task.id);
                        return (
                          <div key={task.id} className={`flex flex-col gap-2 p-3 rounded-2xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                            <span className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{task.label}</span>
                            <div className={`flex gap-0.5 p-0.5 rounded-xl ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                              {(['none', 'view', 'edit'] as TaskPermissionLevel[]).map(lvl => (
                                <button
                                  key={lvl}
                                  type="button"
                                  onClick={() => setTaskLevel(sector.id, task.id, lvl)}
                                  className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                                    level === lvl
                                      ? lvl === 'none' ? 'bg-rose-500 text-white' : lvl === 'view' ? 'bg-amber-500 text-white' : 'bg-indigo-600 text-white'
                                      : isDarkMode ? 'text-slate-400' : 'text-slate-500'
                                  }`}
                                >
                                  {TASK_LEVEL_LABELS[lvl]}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 font-medium text-center py-4 leading-relaxed">
                      Ative o setor acima pra escolher o que o colaborador pode visualizar ou editar em cada função.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setSectorPopup(null)}
                    className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
                  >
                    Concluído
                  </button>
                </div>
              </Modal>
            );
          })()}

          {!draft.isUnrestricted && draft.sectors.length > 0 && (() => {
            const allowedCards = dashboardCards.filter(card => isDashboardCardAllowed(draft, card.id));
            if (allowedCards.length === 0) return null;
            return (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Cards do Dashboard</label>
                <p className="text-[10px] text-slate-400 font-medium px-1 -mt-1 mb-1 leading-relaxed">
                  Já filtrado pelos setores marcados acima — escolha quais desses cards este colaborador vê no Dashboard dele.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {allowedCards.map(card => {
                    const visible = isDashboardCardVisibleForDraft(card);
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => toggleDashboardCard(card)}
                        className={`flex items-center justify-between gap-3 p-4 rounded-2xl border-2 transition-all text-left ${visible ? (isDarkMode ? 'bg-slate-800 border-indigo-500' : 'bg-white border-indigo-500 shadow-md') : (isDarkMode ? 'bg-slate-950 border-slate-900 opacity-60' : 'bg-slate-50 border-slate-100 opacity-60')}`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <LayoutDashboard size={16} className="shrink-0" />
                          <span className={`text-xs font-black tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{card.label}</span>
                        </span>
                        {visible && <Check size={16} className="text-indigo-500 shrink-0" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <button
            type="button"
            onClick={handleSave}
            disabled={!draft.name.trim() || !pinValid || isSaving}
            data-guide-anchor="collab.salvar"
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
          >
            {isSaving ? 'Salvando...' : 'Salvar Colaborador'}
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
