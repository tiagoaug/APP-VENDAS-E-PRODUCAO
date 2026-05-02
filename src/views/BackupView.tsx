import { useState, useMemo } from 'react';
import { Database, Download, Upload, AlertTriangle, RefreshCw, Copy, Trash2, CheckCircle2 } from 'lucide-react';
import { Transaction, Purchase, Sale } from '../types';

interface BackupViewProps {
  isDarkMode: boolean;
  transactions: Transaction[];
  purchases: Purchase[];
  sales: Sale[];
  onDeleteTransaction: (id: string) => Promise<void>;
  onDeletePurchase: (id: string) => Promise<void>;
  onDeleteSale: (id: string) => Promise<void>;
  onResetDatabase: () => Promise<void>;
}

export default function BackupView({ 
  isDarkMode, 
  transactions, 
  purchases, 
  sales,
  onDeleteTransaction,
  onDeletePurchase,
  onDeleteSale,
  onResetDatabase
}: BackupViewProps) {
  const [isCleaning, setIsCleaning] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [cleanMessage, setCleanMessage] = useState<string | null>(null);
  
  const [showFormatConfirm, setShowFormatConfirm] = useState(false);
  const [formatSuccess, setFormatSuccess] = useState(false);

  const duplicates = useMemo(() => {
    const txDuplicates: Transaction[] = [];
    const seenTx = new Set<string>();

    // Duplicates for Transactions
    // Criteria: same description, amount, date (YYYY-MM-DD), and contact
    transactions.forEach(tx => {
      const dateStr = new Date(tx.date).toISOString().split('T')[0];
      const key = `${tx.description}-${tx.amount}-${dateStr}-${tx.contactId || 'none'}-${tx.type}`;
      if (seenTx.has(key)) {
        txDuplicates.push(tx);
      } else {
        seenTx.add(key);
      }
    });

    const purDuplicates: Purchase[] = [];
    const seenPur = new Set<string>();
    purchases.forEach(p => {
      const dateStr = new Date(p.date).toISOString().split('T')[0];
      const key = `${p.supplierId}-${p.total}-${dateStr}-${p.type}`;
      if (seenPur.has(key)) {
        purDuplicates.push(p);
      } else {
        seenPur.add(key);
      }
    });

    const saleDuplicates: Sale[] = [];
    const seenSale = new Set<string>();
    sales.forEach(s => {
      const dateStr = new Date(s.date).toISOString().split('T')[0];
      const key = `${s.orderNumber}-${s.customerId || 'none'}-${s.total}`;
      if (seenSale.has(key)) {
        saleDuplicates.push(s);
      } else {
        seenSale.add(key);
      }
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
      for (const tx of duplicates.transactions) {
        await onDeleteTransaction(tx.id);
        count++;
      }
      for (const pur of duplicates.purchases) {
        await onDeletePurchase(pur.id);
        count++;
      }
      for (const sale of duplicates.sales) {
        await onDeleteSale(sale.id);
        count++;
      }
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
      setTimeout(() => {
        setFormatSuccess(false);
        setShowFormatConfirm(false);
      }, 3000);
    } catch (error) {
      console.error(error);
      setIsResetting(false);
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
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Otimizar banco de dados</p>
          </div>
        </div>

        <div className={`p-4 rounded-2xl flex flex-col gap-2 ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
           <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Transações Duplicadas</span>
              <span className={`text-xs font-black ${duplicates.transactions.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {duplicates.transactions.length}
              </span>
           </div>
           <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Compras Duplicadas</span>
              <span className={`text-xs font-black ${duplicates.purchases.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {duplicates.purchases.length}
              </span>
           </div>
           <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vendas Duplicadas</span>
              <span className={`text-xs font-black ${duplicates.sales.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {duplicates.sales.length}
              </span>
           </div>
        </div>

        {cleanMessage ? (
          <div className="bg-emerald-500/10 text-emerald-500 p-4 rounded-2xl flex items-center gap-3">
            <CheckCircle2 size={20} />
            <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">{cleanMessage}</p>
          </div>
        ) : (
          <button 
            onClick={handleCleanDuplicates}
            disabled={totalDuplicates === 0 || isCleaning}
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
        <button className={`p-6 rounded-[2rem] shadow-xl flex items-center justify-between group active:scale-[0.98] transition-all ${isDarkMode ? 'bg-indigo-700 text-white shadow-none' : 'bg-indigo-600 text-white shadow-indigo-200'}`}>
          <div className="flex items-center gap-4 text-left">
            <Download size={28} />
            <div>
              <p className="font-bold text-sm">Fazer Backup Agora</p>
              <p className="text-[10px] opacity-70 font-black uppercase tracking-widest mt-0.5">Exportar banco de dados .json</p>
            </div>
          </div>
        </button>

        <button className={`p-6 rounded-[2rem] border shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-4 text-left">
            <Upload size={28} className="text-emerald-500 dark:text-emerald-400" />
            <div>
              <p className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Restaurar Dados</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest mt-0.5">Importar arquivo compatível</p>
            </div>
          </div>
        </button>
      </div>

      <div className="bg-rose-50 dark:bg-rose-900/20 p-6 rounded-[2rem] border border-rose-100 dark:border-rose-900/30 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="text-rose-600" size={24} />
          <h3 className="font-black text-[11px] text-rose-600 uppercase tracking-widest">Zona de Perigo</h3>
        </div>
        <p className="text-[11px] text-rose-900/60 dark:text-rose-400/60 font-bold leading-relaxed">Apagar todos os dados permanentemente e redefinir o sistema para as configurações de fábrica.</p>
        <button 
          onClick={() => setShowFormatConfirm(true)}
          disabled={isResetting}
          className={`bg-rose-600 text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${isDarkMode ? 'shadow-none' : 'shadow-rose-100'}`}
        >
           {isResetting ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />} 
           {isResetting ? 'Formatando...' : 'Formatar Sistema'}
        </button>
      </div>

      <div className="px-6 text-center">
        <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">Último backup: Hoje, às 08:42</p>
      </div>

      {showFormatConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 text-center flex flex-col items-center">
            
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-4 ${formatSuccess ? 'bg-emerald-500' : 'bg-rose-600'}`}>
              {formatSuccess ? (
                <CheckCircle2 size={40} className="text-white" strokeWidth={2.5} />
              ) : (
                <AlertTriangle size={40} className="text-white" strokeWidth={2.5} />
              )}
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
