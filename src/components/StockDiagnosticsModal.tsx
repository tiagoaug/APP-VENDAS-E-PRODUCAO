import { useState, useMemo } from "react";
import { Product, StockLot, ProductionLot, Sale } from "../types";
import { Wrench, CheckCircle2, AlertTriangle, TrendingUp, Boxes, Settings } from "lucide-react";
import Modal from "./Modal";
import { toast } from '../utils/toast';
import { useStockLotDuplicates, DuplicateStockByRefColor } from '../hooks/useStockLotDuplicates';
import StockDuplicateDiagnosticModal from './StockDuplicateDiagnosticModal';
import { buildSeparationReconcileGroups, SeparationReconcileGroup } from '../utils/separationReconcile';
import { buildStockDuplicateFixPlan, StockDuplicateFixPlan } from '../utils/stockDuplicateFix';
import { buildOrphanedFinalizedKeyFixes } from '../utils/finalizedKeyRepair';
import { buildUndercreditGroups, UndercreditGroup } from '../utils/stockUndercreditFix';
import { buildOrphanedReservedLots, OrphanedReservedLot, ORPHANED_RESOLVED_STORAGE_KEY, readResolvedOrphanedLotKeys } from '../utils/stockOrphanedReservations';

const UNDERCREDIT_RESOLVED_KEY = 'pcp_resolved_undercredit_v1';

const StockDiagnosticsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  products: Product[];
  stockLots: StockLot[];
  lots: ProductionLot[];
  sales: Sale[];
  onFixPkgAllocations?: () => Promise<{ fixed: number; total: number }>;
  onReconcileSeparationGroup?: (group: SeparationReconcileGroup) => Promise<void>;
  onApplyStockDuplicateFix?: (plan: StockDuplicateFixPlan) => Promise<void>;
  onRepairOrphanedFinalizedKeys?: () => Promise<{ fixed: number; lotsTouched: number }>;
  onApplyUndercreditFix?: (group: UndercreditGroup) => Promise<void>;
  onReleaseOrphanedLot?: (entry: OrphanedReservedLot) => Promise<void>;
}> = ({
  isOpen, onClose, isDarkMode, products, stockLots, lots, sales,
  onFixPkgAllocations, onReconcileSeparationGroup, onApplyStockDuplicateFix,
  onRepairOrphanedFinalizedKeys, onApplyUndercreditFix, onReleaseOrphanedLot,
}) => {
  const [fixingAlloc, setFixingAlloc] = useState(false);
  const [fixAllocResult, setFixAllocResult] = useState<{ fixed: number; total: number } | null>(null);
  const [showFixAllocModal, setShowFixAllocModal] = useState(false);
  const [showStockDiagnosticModal, setShowStockDiagnosticModal] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [showUndercreditModal, setShowUndercreditModal] = useState(false);
  const [showOrphanedModal, setShowOrphanedModal] = useState(false);
  const [fixingFinalizedKeys, setFixingFinalizedKeys] = useState(false);
  const [fixingUndercreditKey, setFixingUndercreditKey] = useState<string | null>(null);
  const [fixingOrphanedKey, setFixingOrphanedKey] = useState<string | null>(null);

  const { duplicateStockLotGroups, duplicateStockByRefColor, markResolved: markStockDuplicatesResolved } = useStockLotDuplicates(stockLots, lots);

  const separationReconcileGroups = useMemo(() => buildSeparationReconcileGroups(stockLots), [stockLots]);
  const orphanedFinalizedKeyFixes = useMemo(() => buildOrphanedFinalizedKeyFixes(lots), [lots]);
  const allUndercreditGroups = useMemo(() => buildUndercreditGroups(products, stockLots), [products, stockLots]);

  const [undercreditResolved, setUndercreditResolved] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(UNDERCREDIT_RESOLVED_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const dismissUndercreditGroup = (g: UndercreditGroup) => {
    setUndercreditResolved(prev => {
      const next = { ...prev, [g.key]: true };
      try { localStorage.setItem(UNDERCREDIT_RESOLVED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const undercreditGroups = useMemo(
    () => allUndercreditGroups.filter(g => !undercreditResolved[g.key]),
    [allUndercreditGroups, undercreditResolved]
  );

  const allOrphanedLots = useMemo(() => buildOrphanedReservedLots(stockLots, sales, products), [stockLots, sales, products]);
  const [orphanedResolved, setOrphanedResolved] = useState<Record<string, boolean>>(readResolvedOrphanedLotKeys);
  const dismissOrphanedLot = (entry: OrphanedReservedLot) => {
    setOrphanedResolved(prev => {
      const next = { ...prev, [entry.key]: true };
      try { localStorage.setItem(ORPHANED_RESOLVED_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const orphanedLots = useMemo(
    () => allOrphanedLots.filter(e => !orphanedResolved[e.key]),
    [allOrphanedLots, orphanedResolved]
  );

  const pkgAllocIssuesCount = useMemo(() => {
    return products.reduce((count, product) => {
      const hasIssue = product.variations.some((v) => {
        const boxQty = v.stock?.['WHOLESALE'] ?? 0;
        const totalAlloc = (v.stockPkgAllocations || []).reduce((s, a) => s + a.qty, 0);
        return totalAlloc > boxQty;
      });
      return hasIssue ? count + 1 : count;
    }, 0);
  }, [products]);

  const handleFixStockDuplicateGroup = async (group: DuplicateStockByRefColor) => {
    if (!onApplyStockDuplicateFix) return;
    const plan = buildStockDuplicateFixPlan(group, duplicateStockLotGroups, products);
    await onApplyStockDuplicateFix(plan);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Diagnósticos e Correções"
        icon={<Settings size={20} />}
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col gap-2.5">
          {onFixPkgAllocations && (
            <button
              type="button"
              disabled={fixingAlloc}
              onClick={async () => {
                setFixingAlloc(true);
                try {
                  const result = await onFixPkgAllocations();
                  setFixAllocResult(result);
                  setShowFixAllocModal(true);
                } finally {
                  setFixingAlloc(false);
                }
              }}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-[1.2rem] transition-all active:scale-[0.99] disabled:opacity-60 ${isDarkMode ? 'bg-slate-800 border border-slate-700 text-slate-300' : 'bg-slate-50 border border-slate-100 text-slate-500'}`}
              title="Corrigir alocações de embalagem inconsistentes"
              aria-label="Corrigir inconsistências nas alocações de embalagem"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-orange-500/15 text-orange-400' : 'bg-orange-100 text-orange-600'}`}>
                  <Wrench size={16} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {fixingAlloc ? 'Corrigindo...' : 'Corrigir Alocações de Embalagem'}
                </span>
              </div>
              {!fixingAlloc && (
                pkgAllocIssuesCount > 0 ? (
                  <span className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-black shrink-0 animate-pulse-amber-ring">
                    {pkgAllocIssuesCount}
                  </span>
                ) : (
                  <CheckCircle2 size={16} strokeWidth={2.5} className="text-emerald-500 shrink-0" />
                )
              )}
            </button>
          )}

          {onReconcileSeparationGroup && (
            <button
              type="button"
              onClick={() => setShowReconcileModal(true)}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-[1.2rem] transition-all active:scale-[0.99] ${isDarkMode ? 'bg-slate-800 border border-slate-700 text-slate-300' : 'bg-slate-50 border border-slate-100 text-slate-500'}`}
              title="Reconciliar Separações"
              aria-label="Corrigir estoque de separações pendentes de reconciliação"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-100 text-rose-600'}`}>
                  <Wrench size={16} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col items-start text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest">Reconciliar Separações</span>
                  <span className="text-[8px] font-bold normal-case tracking-normal text-slate-400">Separação antiga que reservou a caixa sem descontar do contador</span>
                </div>
              </div>
              {separationReconcileGroups.length > 0 ? (
                <span className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black shrink-0 animate-pulse-rose-ring">
                  {separationReconcileGroups.length}
                </span>
              ) : (
                <CheckCircle2 size={16} strokeWidth={2.5} className="text-emerald-500 shrink-0" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowStockDiagnosticModal(true)}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-[1.2rem] transition-all active:scale-[0.99] ${isDarkMode ? 'bg-slate-800 border border-slate-700 text-slate-300' : 'bg-slate-50 border border-slate-100 text-slate-500'}`}
            title="Diagnóstico de Estoque Duplicado"
            aria-label="Ver diagnóstico de estoque duplicado"
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-fuchsia-500/15 text-fuchsia-400' : 'bg-fuchsia-100 text-fuchsia-600'}`}>
                <AlertTriangle size={16} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col items-start text-left">
                <span className="text-[10px] font-black uppercase tracking-widest">Diagnóstico de Estoque</span>
                <span className="text-[8px] font-bold normal-case tracking-normal text-slate-400">Mesma caixa de produção contada mais de uma vez no estoque</span>
              </div>
            </div>
            {duplicateStockLotGroups.length > 0 ? (
              <span className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black shrink-0 animate-pulse-rose-ring">
                {duplicateStockLotGroups.length}
              </span>
            ) : (
              <CheckCircle2 size={16} strokeWidth={2.5} className="text-emerald-500 shrink-0" />
            )}
          </button>

          {onRepairOrphanedFinalizedKeys && (
            <button
              type="button"
              disabled={fixingFinalizedKeys}
              onClick={async () => {
                setFixingFinalizedKeys(true);
                try {
                  const { fixed, lotsTouched } = await onRepairOrphanedFinalizedKeys();
                  toast.show(fixed > 0
                    ? `${fixed} item(ns) corrigido(s) em ${lotsTouched} mapa(s) — status de finalizado restaurado.`
                    : 'Nenhum item órfão encontrado — nada a corrigir.');
                } finally {
                  setFixingFinalizedKeys(false);
                }
              }}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-[1.2rem] transition-all active:scale-[0.99] disabled:opacity-60 ${isDarkMode ? 'bg-slate-800 border border-slate-700 text-slate-300' : 'bg-slate-50 border border-slate-100 text-slate-500'}`}
              title="Reparar Finalizados"
              aria-label="Corrigir marcações de finalizado órfãs"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-teal-500/15 text-teal-400' : 'bg-teal-100 text-teal-600'}`}>
                  <Wrench size={16} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col items-start text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {fixingFinalizedKeys ? 'Corrigindo...' : 'Reparar Finalizados'}
                  </span>
                  <span className="text-[8px] font-bold normal-case tracking-normal text-slate-400">Mapa marcado como finalizado sem crédito de estoque correspondente</span>
                </div>
              </div>
              {!fixingFinalizedKeys && (
                orphanedFinalizedKeyFixes.length > 0 ? (
                  <span className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-orange-500 text-white text-[10px] font-black shrink-0 animate-pulse-orange-ring">
                    {orphanedFinalizedKeyFixes.length}
                  </span>
                ) : (
                  <CheckCircle2 size={16} strokeWidth={2.5} className="text-emerald-500 shrink-0" />
                )
              )}
            </button>
          )}

          {onApplyUndercreditFix && (
            <button
              type="button"
              onClick={() => setShowUndercreditModal(true)}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-[1.2rem] transition-all active:scale-[0.99] ${isDarkMode ? 'bg-slate-800 border border-slate-700 text-slate-300' : 'bg-slate-50 border border-slate-100 text-slate-500'}`}
              title="Estoque Não Creditado"
              aria-label="Ver produção que nunca somou no contador de estoque"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-sky-500/15 text-sky-400' : 'bg-sky-100 text-sky-600'}`}>
                  <TrendingUp size={16} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col items-start text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest">Estoque Não Creditado</span>
                  <span className="text-[8px] font-bold normal-case tracking-normal text-slate-400">Caixa produzida (StockLot) que nunca somou no contador do produto</span>
                </div>
              </div>
              {undercreditGroups.length > 0 ? (
                <span className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-black shrink-0 animate-pulse-amber-ring">
                  {undercreditGroups.length}
                </span>
              ) : (
                <CheckCircle2 size={16} strokeWidth={2.5} className="text-emerald-500 shrink-0" />
              )}
            </button>
          )}

          {onReleaseOrphanedLot && (
            <button
              type="button"
              onClick={() => setShowOrphanedModal(true)}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-[1.2rem] transition-all active:scale-[0.99] ${isDarkMode ? 'bg-slate-800 border border-slate-700 text-slate-300' : 'bg-slate-50 border border-slate-100 text-slate-500'}`}
              title="Reservas Órfãs"
              aria-label="Ver caixas reservadas presas em vendas que não as referenciam mais"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-violet-500/15 text-violet-400' : 'bg-violet-100 text-violet-600'}`}>
                  <Boxes size={16} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col items-start text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest">Reservas Órfãs</span>
                  <span className="text-[8px] font-bold normal-case tracking-normal text-slate-400">Caixa reservada presa numa venda que não a referencia (ou que foi excluída)</span>
                </div>
              </div>
              {orphanedLots.length > 0 ? (
                <span className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-violet-500 text-white text-[10px] font-black shrink-0 animate-pulse-violet-ring">
                  {orphanedLots.length}
                </span>
              ) : (
                <CheckCircle2 size={16} strokeWidth={2.5} className="text-emerald-500 shrink-0" />
              )}
            </button>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showFixAllocModal}
        onClose={() => setShowFixAllocModal(false)}
        title="Correção de Embalagens"
        icon={<Wrench size={20} />}
        maxWidth="max-w-sm"
      >
        {fixAllocResult && (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${fixAllocResult.fixed > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>
              <CheckCircle2 size={32} strokeWidth={2.5} />
            </div>
            <div>
              <p className={`text-2xl font-black tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {fixAllocResult.fixed} de {fixAllocResult.total}
              </p>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                {fixAllocResult.fixed > 0
                  ? `${fixAllocResult.fixed} produto(s) tinham embalagem alocada além do estoque e foram corrigidos.`
                  : 'Nenhuma inconsistência encontrada — estoque e embalagens já estão consistentes.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowFixAllocModal(false)}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
            >
              Fechar
            </button>
          </div>
        )}
      </Modal>

      <StockDuplicateDiagnosticModal
        isOpen={showStockDiagnosticModal}
        onClose={() => setShowStockDiagnosticModal(false)}
        isDarkMode={isDarkMode}
        groups={duplicateStockByRefColor}
        onMarkResolved={markStockDuplicatesResolved}
        onFixNow={onApplyStockDuplicateFix ? handleFixStockDuplicateGroup : undefined}
      />

      <Modal
        isOpen={showReconcileModal}
        onClose={() => setShowReconcileModal(false)}
        title="Reconciliar Separações"
        icon={<Wrench size={20} />}
        maxWidth="max-w-lg"
      >
        {separationReconcileGroups.length === 0 ? (
          <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 py-10">Nenhuma pendência encontrada — nada a reconciliar.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-bold text-slate-400 leading-relaxed px-1">
              Separações feitas antes da correção do desconto de estoque — o valor abaixo ainda não foi descontado do produto. "Corrigir Agora" desconta e marca como resolvido.
            </p>
            {separationReconcileGroups.map(g => (
              <div key={g.key} className={`rounded-2xl border p-4 flex flex-col gap-2 ${isDarkMode ? 'bg-rose-900/15 border-rose-800/40' : 'bg-rose-50 border-rose-100'}`}>
                <p className={`text-[12px] font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {g.productReference ? `${g.productReference} — ` : ''}{g.productName} · {g.variationName}
                </p>
                <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total a descontar</span>
                  <span className="text-[14px] font-black text-rose-500">
                    {g.isWholesale ? `${g.totalToDeduct} cx` : `${g.totalToDeduct} pares`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onReconcileSeparationGroup?.(g)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
                >
                  <Wrench size={12} strokeWidth={3} /> Corrigir Agora
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showUndercreditModal}
        onClose={() => setShowUndercreditModal(false)}
        title="Estoque Não Creditado"
        icon={<TrendingUp size={20} />}
        maxWidth="max-w-lg"
      >
        {undercreditGroups.length === 0 ? (
          <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 py-10">Nenhuma pendência encontrada — todo crédito de produção está refletido no estoque.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-bold text-slate-400 leading-relaxed px-1">
              Produção que entrou no histórico de estoque (Mapa/Pedido), mas nunca somou no contador do produto — o valor abaixo já existe fisicamente, só falta somar. "Corrigir Agora" só soma, nunca desconta.
            </p>
            {undercreditGroups.map(g => (
              <div key={g.key} className={`rounded-2xl border p-4 flex flex-col gap-2 ${isDarkMode ? 'bg-amber-900/15 border-amber-800/40' : 'bg-amber-50 border-amber-100'}`}>
                <p className={`text-[12px] font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {g.productReference ? `${g.productReference} — ` : ''}{g.productName} · {g.variationName}
                </p>
                <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total a somar</span>
                  <span className="text-[14px] font-black text-amber-500">
                    {g.isWholesale
                      ? `${g.missingBoxes} cx`
                      : `${Object.values(g.missingSizes || {}).reduce((s, q) => s + q, 0)} pares`}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={fixingUndercreditKey === g.key}
                  onClick={async () => {
                    setFixingUndercreditKey(g.key);
                    try {
                      await onApplyUndercreditFix?.(g);
                    } finally {
                      setFixingUndercreditKey(prev => prev === g.key ? null : prev);
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60 ${isDarkMode ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-amber-600 text-white hover:bg-amber-700'}`}
                >
                  <Wrench size={12} strokeWidth={3} /> {fixingUndercreditKey === g.key ? 'Corrigindo...' : 'Corrigir Agora'}
                </button>
                <button
                  type="button"
                  onClick={() => dismissUndercreditGroup(g)}
                  title="Já incluí essa caixa no estoque por fora (Balanço/edição direta) — não mexe em estoque, só some daqui"
                  className={`self-center text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all active:scale-95 ${isDarkMode ? 'bg-slate-700/60 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white' : 'bg-slate-200 border-slate-300 text-slate-600 hover:bg-slate-300 hover:text-slate-800'}`}
                >
                  Já Resolvi Manualmente
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showOrphanedModal}
        onClose={() => setShowOrphanedModal(false)}
        title="Reservas Órfãs"
        icon={<Boxes size={20} />}
        maxWidth="max-w-lg"
      >
        {orphanedLots.length === 0 ? (
          <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 py-10">Nenhuma pendência encontrada — todas as reservas estão vinculadas a um pedido de verdade.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-bold text-slate-400 leading-relaxed px-1">
              Caixa/par marcado como reservado (separado) pra um pedido, mas que o próprio pedido não referencia mais — ou porque o pedido foi excluído, ou porque a separação foi refeita sem liberar a reserva anterior. Sobra do bug de concorrência da separação de caixas (já corrigido). "Corrigir Agora" devolve a caixa pro estoque disponível e soma de volta no contador.
            </p>
            {orphanedLots.map(entry => (
              <div key={entry.key} className={`rounded-2xl border p-4 flex flex-col gap-2 ${isDarkMode ? 'bg-violet-900/15 border-violet-800/40' : 'bg-violet-50 border-violet-100'}`}>
                <p className={`text-[12px] font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {entry.productReference ? `${entry.productReference} — ` : ''}{entry.productName} · {entry.variationName}
                </p>
                <p className="text-[9px] font-bold text-slate-400">
                  {entry.reason === 'sale_missing'
                    ? `Pedido ${entry.saleOrderNumber || entry.lot.saleOrderNumber || ''} não existe mais`
                    : `Pedido #${entry.saleOrderNumber} (${entry.customerName}) não referencia mais essa caixa`}
                </p>
                <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Presa desde</span>
                  <span className="text-[12px] font-black text-violet-500">
                    {entry.lot.createdAt ? new Date(entry.lot.createdAt).toLocaleDateString('pt-BR') : '—'}
                    {' · '}
                    {entry.lot.boxQty !== undefined && entry.lot.boxQty !== null
                      ? `${entry.lot.boxQty} cx`
                      : `${entry.lot.totalPairs || 0} pares`}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={fixingOrphanedKey === entry.key}
                  onClick={async () => {
                    setFixingOrphanedKey(entry.key);
                    try {
                      await onReleaseOrphanedLot?.(entry);
                    } finally {
                      setFixingOrphanedKey(prev => prev === entry.key ? null : prev);
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60 ${isDarkMode ? 'bg-violet-500/20 text-violet-300 hover:bg-violet-500/30' : 'bg-violet-600 text-white hover:bg-violet-700'}`}
                >
                  <Wrench size={12} strokeWidth={3} /> {fixingOrphanedKey === entry.key ? 'Corrigindo...' : 'Corrigir Agora'}
                </button>
                <button
                  type="button"
                  onClick={() => dismissOrphanedLot(entry)}
                  title="Já corrigi isso por fora (recontagem física + Balanço) — não mexe em estoque, só some daqui"
                  className={`self-center text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all active:scale-95 ${isDarkMode ? 'bg-slate-700/60 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white' : 'bg-slate-200 border-slate-300 text-slate-600 hover:bg-slate-300 hover:text-slate-800'}`}
                >
                  Já Resolvi Manualmente
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
};

export default StockDiagnosticsModal;
