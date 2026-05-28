import { useState, useMemo } from 'react';
import { Database, Download, Upload, AlertTriangle, RefreshCw, Copy, Trash2, CheckCircle2, Eraser, X } from 'lucide-react';
import { Transaction, Purchase, Sale, ProductionConfigItem, SoleStockEntry } from '../types';

type SelectiveCategory = 'GRADES' | 'CORES' | 'SETORES' | 'ETAPAS' | 'UNIDADES' | 'PRAZOS' | 'INFESTO' | 'EMBALAGENS' | 'SOLADOS' | 'PECAS' | 'INSUMOS';

interface BackupViewProps {
  isDarkMode: boolean;
  transactions: Transaction[];
  purchases: Purchase[];
  sales: Sale[];
  productionConfigs: ProductionConfigItem[];
  gridsCount: number;
  colorsCount: number;
  sectorsCount: number;
  flowTagsCount: number;
  soleStockEntries: SoleStockEntry[];
  onDeleteTransaction: (id: string) => Promise<void>;
  onDeletePurchase: (id: string) => Promise<void>;
  onDeleteSale: (id: string) => Promise<void>;
  onResetDatabase: () => Promise<void>;
  onSelectiveDelete: (categories: SelectiveCategory[]) => Promise<void>;
}

export default function BackupView({
  isDarkMode,
  transactions,
  purchases,
  sales,
  productionConfigs,
  gridsCount,
  colorsCount,
  sectorsCount,
  flowTagsCount,
  soleStockEntries,
  onDeleteTransaction,
  onDeletePurchase,
  onDeleteSale,
  onResetDatabase,
  onSelectiveDelete,
}: BackupViewProps) {
  const [isCleaning, setIsCleaning] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSelectiveDeleting, setIsSelectiveDeleting] = useState(false);
  const [cleanMessage, setCleanMessage] = useState<string | null>(null);
  const [showFormatConfirm, setShowFormatConfirm] = useState(false);
  const [showSelectiveConfirm, setShowSelectiveConfirm] = useState(false);
  const [formatSuccess, setFormatSuccess] = useState(false);
  const [selectiveSuccess, setSelectiveSuccess] = useState(false);
  const ALL_CATEGORIES: SelectiveCategory[] = ['GRADES', 'UNIDADES', 'CORES', 'SETORES', 'ETAPAS', 'SOLADOS', 'PRAZOS', 'INFESTO', 'EMBALAGENS', 'PECAS', 'INSUMOS'];
  const [selectedCategories, setSelectedCategories] = useState<Set<SelectiveCategory>>(new Set(ALL_CATEGORIES));

  const selectiveOptions: { id: SelectiveCategory; label: string; sub: string; count: number }[] = useMemo(() => [
    { id: 'GRADES',    label: 'Grades de Tamanho',   sub: 'Configurações de grades',      count: gridsCount },
    { id: 'UNIDADES',  label: 'Unidades',             sub: 'UN, KG, M, L...',             count: productionConfigs.filter(c => c.type === 'UNIT').length },
    { id: 'CORES',     label: 'Cores',                sub: 'Catálogo de cores',            count: colorsCount },
    { id: 'SETORES',   label: 'Setores de Produção',  sub: 'Corte, costura, etc.',         count: sectorsCount },
    { id: 'ETAPAS',    label: 'Etapas / Flow Tags',   sub: 'Fluxo de produção',            count: flowTagsCount },
    { id: 'SOLADOS',   label: 'Solados / Matrizes',   sub: 'Moldes e estoque de solados',  count: productionConfigs.filter(c => c.type === 'MOLD').length + soleStockEntries.length },
    { id: 'PRAZOS',    label: 'Prazos',               sub: 'Configurações de prazo',       count: productionConfigs.filter(c => c.type === 'DEADLINE').length },
    { id: 'INFESTO',   label: 'Infesto',              sub: 'Configurações de infesto',     count: productionConfigs.filter(c => c.type === 'INFESTO').length },
    { id: 'EMBALAGENS',label: 'Padrão de Embalagens', sub: 'Modelos de embalagem',         count: productionConfigs.filter(c => c.type === 'PACKAGING').length },
    { id: 'PECAS',     label: 'Peças',                sub: 'Componentes do produto',       count: productionConfigs.filter(c => c.type === 'PIECE').length },
    { id: 'INSUMOS',   label: 'Insumos / Materiais',  sub: 'Catálogo de insumos',          count: productionConfigs.filter(c => c.type === 'MATERIAL').length },
  ], [productionConfigs, gridsCount, colorsCount, sectorsCount, flowTagsCount, soleStockEntries]);

  const toggleCategory = (id: SelectiveCategory) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const keepCls = 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50';
  const deleteCls = 'bg-rose-50 dark:bg-rose-900/20 text-rose-500 border-rose-200 dark:border-rose-800/50';

  const duplicates = useMemo(() => {
    const txDuplicates: Transaction[] = [];
    const seenTx = new Set<string>();
    transactions.forEach(tx => {
      const key = `${tx.description}-${tx.amount}-${new Date(tx.date).toISOString().split('T')[0]}-${tx.contactId || 'none'}-${tx.type}`;
      if (seenTx.has(key)) txDuplicates.push(tx); else seenTx.add(key);
    });

    const purDuplicates: Purchase[] = [];
    const seenPur = new Set<string>();
    purchases.forEach(p => {
      const key = `${p.supplierId}-${p.total}-${new Date(p.date).toISOString().split('T')[0]}-${p.type}`;
      if (seenPur.has(key)) purDuplicates.push(p); else seenPur.add(key);
    });

    const saleDuplicates: Sale[] = [];
    const seenSale = new Set<string>();
    sales.forEach(s => {
      const key = `${s.orderNumber}-${s.customerId || 'none'}-${s.total}`;
      if (seenSale.has(key)) saleDuplicates.push(s); else seenSale.add(key);
    });

    return { transactions: txDuplicates, purchases: purDuplicates, sales: saleDuplicates };
  }, [transactions, purchases, sales]);

  const totalDuplicates = duplicates.transactions.length + duplicates.purchases.length + duplicates.sales.length;

  const handleCleanDuplicates = async () => {
    if (totalDuplicates === 0) return;
    if (!confirm(`Deseja remover as ${totalDuplicates} duplicidades encontradas? Esta ação não pode ser desfeita.`)) return;

    setIsCleaning(true);
    let count = 0;
    try {
      for (const tx of duplicates.transactions) { await onDeleteTransaction(tx.id); count++; }
      for (const pur of duplicates.purchases) { await onDeletePurchase(pur.id); count++; }
      for (const sale of duplicates.sales) { await onDeleteSale(sale.id); count++; }
      setCleanMessage(`${count} registros duplicados foram removidos com sucesso!`);
    } catch (error) {
      console.error(error);
      alert('Ocorreu um erro ao limpar os dados.');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleFormatSystem = async () => {
    setIsResetting(true);
    try {
      await onResetDatabase();
      setFormatSuccess(true);
      setTimeout(() => { setFormatSuccess(false); setShowFormatConfirm(false); }, 3000);
    } catch (error) {
      console.error(error);
      setIsResetting(false);
    }
  };

  // Categories NOT checked = will be deleted
  const categoriesToDelete = useMemo(
    () => selectiveOptions.filter(o => !selectedCategories.has(o.id)),
    [selectiveOptions, selectedCategories]
  );
  const deleteCount = categoriesToDelete.length;
  const totalDeleteRecords = categoriesToDelete.reduce((sum, o) => sum + o.count, 0);

  const handleSelectiveDeleteConfirm = async () => {
    setIsSelectiveDeleting(true);
    try {
      await onSelectiveDelete(categoriesToDelete.map(o => o.id));
      setSelectiveSuccess(true);
      setSelectedCategories(new Set(ALL_CATEGORIES)); // reset: keep all again
      setTimeout(() => { setSelectiveSuccess(false); setShowSelectiveConfirm(false); }, 3000);
    } catch (error) {
      console.error(error);
      alert('Erro ao apagar os dados.');
    } finally {
      setIsSelectiveDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-32">
      <section className={`p-8 rounded-[2.5rem] border shadow-sm text-center ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className={`mx-auto mb-6 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
          <Database size={64} strokeWidth={1.5} />
        </div>
        <h2 className={`text-xl font-black tracking-tight mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Central de Dados</h2>
        <p className="text-xs text-slate-400 font-bold leading-relaxed px-4 uppercase tracking-widest">Gerencie o backup e a integridade de todas as suas informações locais.</p>
      </section>

      {/* DEDUPLICATION TOOL */}
      <section className={`p-6 rounded-[2.5rem] border shadow-sm flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Copy size={20} />
          </div>
          <div>
            <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Limpeza de Duplicidades</h3>
            <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest">Otimizar banco de dados</p>
          </div>
        </div>

        <div className={`p-4 rounded-2xl flex flex-col gap-2 ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Transações Duplicadas</span>
            <span className={`text-xs font-black ${duplicates.transactions.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{duplicates.transactions.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Compras Duplicadas</span>
            <span className={`text-xs font-black ${duplicates.purchases.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{duplicates.purchases.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Vendas Duplicadas</span>
            <span className={`text-xs font-black ${duplicates.sales.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{duplicates.sales.length}</span>
          </div>
        </div>

        {cleanMessage ? (
          <div className="bg-emerald-500/10 text-emerald-500 p-4 rounded-2xl flex items-center gap-3">
            <CheckCircle2 size={20} />
            <p className="text-[11px] font-black uppercase tracking-widest leading-relaxed">{cleanMessage}</p>
          </div>
        ) : (
          <button
            onClick={handleCleanDuplicates}
            disabled={totalDuplicates === 0 || isCleaning}
            title="Limpar Duplicidades"
            className={`w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${
              totalDuplicates > 0
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
            }`}
          >
            {isCleaning ? <RefreshCw size={18} className="animate-spin" /> : <Trash2 size={18} />}
            {isCleaning ? 'Limpando...' : totalDuplicates > 0 ? `Limpar ${totalDuplicates} Duplicidades` : 'Nenhuma Duplicidade Encontrada'}
          </button>
        )}
      </section>

      <div className="flex flex-col gap-4">
        <button
          title="Fazer Backup"
          className={`p-6 rounded-[2rem] shadow-xl flex items-center justify-between group active:scale-[0.98] transition-all ${isDarkMode ? 'bg-indigo-700 text-white shadow-none' : 'bg-indigo-600 text-white shadow-indigo-200'}`}
        >
          <div className="flex items-center gap-4 text-left">
            <Download size={28} />
            <div>
              <p className="font-bold text-sm">Fazer Backup Agora</p>
              <p className="text-[11px] opacity-70 font-black uppercase tracking-widest mt-0.5">Exportar banco de dados .json</p>
            </div>
          </div>
        </button>

        <button
          title="Restaurar Dados"
          className={`p-6 rounded-[2rem] border shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
        >
          <div className="flex items-center gap-4 text-left">
            <Upload size={28} className="text-emerald-500 dark:text-emerald-400" />
            <div>
              <p className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Restaurar Dados</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest mt-0.5">Importar arquivo compatível</p>
            </div>
          </div>
        </button>
      </div>

      {/* ZONA DE PERIGO */}
      <div className="bg-rose-50 dark:bg-rose-900/20 p-6 rounded-[2rem] border border-rose-100 dark:border-rose-900/30 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <AlertTriangle className="text-rose-600" size={24} />
          <h3 className="font-black text-[11px] text-rose-600 uppercase tracking-widest">Zona de Perigo</h3>
        </div>

        {/* LIMPEZA SELETIVA */}
        <div className={`p-5 rounded-[1.5rem] border flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-rose-100'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <Eraser size={18} />
            </div>
            <div>
              <p className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Limpeza Seletiva</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">Marcado = manter · Desmarcado = apagar</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {selectiveOptions.map(opt => {
              const isSelected = selectedCategories.has(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleCategory(opt.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all active:scale-[0.98] ${isSelected ? keepCls : deleteCls}`}
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                      isSelected
                        ? 'bg-indigo-500 border-indigo-500'
                        : 'border-rose-300 dark:border-rose-700 bg-rose-100 dark:bg-rose-900/40'
                    }`}>
                      {isSelected
                        ? <CheckCircle2 size={14} className="text-white" strokeWidth={3} />
                        : <X size={12} className="text-rose-400" strokeWidth={3} />}
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wide leading-none">{opt.label}</p>
                      <p className="text-[9px] font-bold uppercase tracking-widest opacity-60 mt-0.5">
                        {isSelected ? opt.sub : 'SERÁ APAGADO'}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black shrink-0 ml-2 px-2 py-0.5 rounded-lg ${
                    isSelected
                      ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-500'
                      : 'bg-rose-100 dark:bg-rose-900/30 text-rose-500'
                  }`}>
                    {opt.count}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={deleteCount === 0 || isSelectiveDeleting}
            onClick={() => setShowSelectiveConfirm(true)}
            className={`w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${
              deleteCount > 0
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
            }`}
          >
            {isSelectiveDeleting ? <RefreshCw size={16} className="animate-spin" /> : <Eraser size={16} />}
            {isSelectiveDeleting
              ? 'Apagando...'
              : deleteCount > 0
                ? `Apagar Não Selecionados (${totalDeleteRecords} registros)`
                : 'Tudo marcado para manter'}
          </button>
        </div>

        {/* FORMATAR TUDO */}
        <div className="flex flex-col gap-3 pt-1 border-t border-rose-200 dark:border-rose-900/40">
          <p className="text-[11px] text-rose-900/60 dark:text-rose-400/60 font-bold leading-relaxed">Apagar todos os dados permanentemente e redefinir o sistema para as configurações de fábrica.</p>
          <button
            onClick={() => setShowFormatConfirm(true)}
            disabled={isResetting}
            title="Formatar Sistema"
            className={`bg-rose-600 text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${isDarkMode ? 'shadow-none' : 'shadow-rose-100'}`}
          >
            {isResetting ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            {isResetting ? 'Formatando...' : 'Formatar Sistema'}
          </button>
        </div>
      </div>

      <div className="px-6 text-center">
        <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">Último backup: Hoje, às 08:42</p>
      </div>

      {/* CONFIRMAÇÃO: Limpeza Seletiva */}
      {showSelectiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
            <div className={`w-16 h-16 rounded-3xl mx-auto flex items-center justify-center ${selectiveSuccess ? 'bg-emerald-500' : 'bg-amber-500'}`}>
              {selectiveSuccess ? <CheckCircle2 size={32} className="text-white" strokeWidth={2.5} /> : <Eraser size={32} className="text-white" strokeWidth={2} />}
            </div>

            <div className="text-center">
              <h3 className={`text-base font-black uppercase tracking-tight mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {selectiveSuccess ? 'Dados Apagados!' : 'Confirmar Limpeza Seletiva'}
              </h3>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                {selectiveSuccess
                  ? 'Os dados não selecionados foram removidos com sucesso.'
                  : `Você está prestes a apagar ${totalDeleteRecords} registros de ${deleteCount} ${deleteCount === 1 ? 'categoria' : 'categorias'}. Esta ação não pode ser desfeita.`}
              </p>
            </div>

            {!selectiveSuccess && (
              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                {categoriesToDelete.map(opt => (
                  <div key={opt.id} className="flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide bg-rose-50 dark:bg-rose-900/20 text-rose-600 border border-rose-100 dark:border-rose-800/40">
                    <span className="flex items-center gap-1.5"><X size={11} strokeWidth={3} />{opt.label}</span>
                    <span>{opt.count} registros</span>
                  </div>
                ))}
              </div>
            )}

            {!selectiveSuccess && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setShowSelectiveConfirm(false)}
                  disabled={isSelectiveDeleting}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSelectiveDeleteConfirm}
                  disabled={isSelectiveDeleting}
                  className="flex-1 py-3 bg-amber-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  {isSelectiveDeleting ? <RefreshCw size={14} className="animate-spin" /> : <Eraser size={14} />}
                  {isSelectiveDeleting ? 'Apagando...' : 'Confirmar'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIRMAÇÃO: Formatar Sistema */}
      {showFormatConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 text-center flex flex-col items-center">
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-4 ${formatSuccess ? 'bg-emerald-500' : 'bg-rose-600'}`}>
              {formatSuccess
                ? <CheckCircle2 size={40} className="text-white" strokeWidth={2.5} />
                : <AlertTriangle size={40} className="text-white" strokeWidth={2.5} />}
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white leading-none mb-2">
              {formatSuccess ? 'Sistema Formatado!' : 'Atenção, Zona de Perigo!'}
            </h3>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
              {formatSuccess
                ? 'Todos os dados foram apagados com sucesso. O sistema foi redefinido.'
                : 'Você está prestes a EXCLUIR PERMANENTEMENTE todos os dados cadastrados (produtos, vendas, etc). Esta ação não pode ser desfeita.'}
            </p>
            {!formatSuccess && (
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setShowFormatConfirm(false)}
                  disabled={isResetting}
                  className="flex-1 py-4 px-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleFormatSystem}
                  disabled={isResetting}
                  className="flex-1 py-4 px-4 bg-rose-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all"
                >
                  {isResetting ? 'Apagando...' : 'Formatar Agora'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
