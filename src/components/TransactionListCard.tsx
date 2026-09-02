import { Transaction, TransactionType, Account, Person, Product, Sale, Purchase, PurchaseType } from '../types';
import { TrendingUp, TrendingDown, User, Clipboard, Package, Wallet, Calendar, Clock, CheckCircle2, RefreshCcw, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePrivacyMode, PRIVACY_BLUR_CLASS } from '../contexts/PrivacyContext';

// Card completo de lançamento — extraído de FinancialView.tsx (lista principal Tudo/Entradas/
// Saídas) pra ser reaproveitado também no FinancialQueryModal.tsx ("Consultas"), que antes tinha
// uma versão mais simples e desatualizada do mesmo cartão. Mantendo um componente só, os dois
// lugares nunca voltam a divergir.
interface TransactionListCardProps {
  transaction: Transaction;
  accounts: Account[];
  people: Person[];
  products: Product[];
  sales: Sale[];
  purchases: Purchase[];
  isDarkMode: boolean;
  onOpenPurchase?: (id: string) => void;
  onOpenSale?: (id: string) => void;
  onSettle: (transaction: Transaction) => void;
  onEdit: (transaction: Transaction) => void;
  onDeleteClick: (id: string) => void;
  settlingId?: string | null;
  deletingId?: string | null;
}

export default function TransactionListCard({
  transaction, accounts, people, products, sales, purchases, isDarkMode,
  onOpenPurchase, onOpenSale, onSettle, onEdit, onDeleteClick, settlingId, deletingId,
}: TransactionListCardProps) {
  const hidePrivacy = usePrivacyMode();

  const account = accounts.find(a => a.id === transaction.accountId);
  const isPending = transaction.status === 'PENDING';

  const relatedSale = sales.find(s => s.id === transaction.relatedId);
  const relatedPurchase = purchases.find(p => p.id === transaction.relatedId);
  const isPartialPayment = /pagto parcial/i.test(transaction.description || '');
  let displayTitle = transaction.description;
  if (relatedPurchase) {
    const baseLabel = relatedPurchase.type === PurchaseType.REPLENISHMENT
      ? 'Abastecimento de Estoque'
      : relatedPurchase.type === PurchaseType.SOLE
      ? 'Compra de Solados'
      : 'Compra Geral';
    displayTitle = isPartialPayment ? `Pagamento Parcial - ${baseLabel}` : baseLabel;
  } else if (relatedSale) {
    displayTitle = `Venda #${relatedSale.orderNumber}`;
  }
  const canNavigate = !!((relatedPurchase && onOpenPurchase) || (relatedSale && onOpenSale));

  return (
    <div
      onClick={canNavigate ? () => {
        if (relatedPurchase && onOpenPurchase) onOpenPurchase(relatedPurchase.id);
        else if (relatedSale && onOpenSale) onOpenSale(relatedSale.id);
      } : undefined}
      className={`p-4 rounded-3xl border shadow-sm flex flex-col gap-3 ${canNavigate ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''} ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
    >
      {/* Linha do topo: título sempre visível por completo */}
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className={`font-black text-base uppercase tracking-tight leading-snug flex-1 min-w-0 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
          {displayTitle}
        </h3>
        {relatedSale && (
           <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 text-[9px] font-black tracking-widest shrink-0">Venda</span>
        )}
        {relatedPurchase && (
           <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 text-[9px] font-black tracking-widest shrink-0">Compra</span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${transaction.type === TransactionType.INCOME ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'}`}>
            {transaction.type === TransactionType.INCOME ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
          </div>
          <div className="flex-1 min-w-0">
            {/* Sale Details if applicable */}
            {(() => {
              const sale = relatedSale;
              if (sale) {
                return (
                  <div className="mt-1.5 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <User size={10} className="text-indigo-400" />
                      <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                        {sale.customerName || people.find(p => p.id === sale.customerId)?.name || 'Consumidor'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-bold text-slate-400 tracking-widest">
                      <span className="flex items-center gap-1">
                        <Clipboard size={10} />
                        Pedido #{sale.orderNumber}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package size={10} />
                        {(() => {
                          const totalItems = sale.items.reduce((acc, item) => acc + item.quantity, 0);
                          return `${totalItems} ${totalItems === 1 ? 'Item' : 'Itens'}`;
                        })()}
                      </span>
                    </div>
                    {/* Itens da venda — modelo/cor/tamanho e quantidade, não só o resumo acima */}
                    <div className="mt-2 space-y-0.5 pl-2 border-l border-slate-100 dark:border-slate-800">
                      {sale.items.map((item, idx) => {
                        const product = products.find(p => p.id === item.productId);
                        const variation = product?.variations.find(v => v.id === item.variationId);
                        const label = `${product?.reference ? `${product.reference} ` : ''}${product?.name || 'Produto'}${variation?.colorName ? ` ${variation.colorName}` : ''}${item.size ? ` / ${item.size}` : ''}`;
                        return (
                          <div key={idx} className="flex justify-between items-center gap-2 text-[7px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                            <span className="truncate">{label}</span>
                            <span className="shrink-0">{item.quantity}x</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              const purchase = relatedPurchase;
              if (purchase) {
                const supplier = people.find(p => p.id === purchase.supplierId);
                return (
                  <div className="mt-1.5 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                        {supplier?.name || 'Fornecedor'}
                      </span>
                    </div>
                    {purchase.notes && (
                      <p className="text-[8px] font-bold text-slate-400 truncate max-w-[200px]">
                        {purchase.notes}
                      </p>
                    )}
                    {/* Itens da compra — varia por tipo (Geral/Solados/Reposição) */}
                    <div className="mt-2 space-y-0.5 pl-2 border-l border-slate-100 dark:border-slate-800">
                      {purchase.type === PurchaseType.GENERAL && (purchase.generalItems || []).map((item, idx) => (
                        <div key={item.id || idx} className="flex justify-between items-center gap-2 text-[7px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                          <span className="truncate">{item.description}{item.quantity ? ` · ${item.quantity}${item.unit ? ` ${item.unit}` : ''}` : ''}</span>
                          <span className="shrink-0">R$ {((item.value || 0) * (item.quantity || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                      {purchase.type === PurchaseType.SOLE && (purchase.soleItems || []).map((item, idx) => {
                        const totalPairs = item.totalPairs ?? Object.values(item.quantities || {}).reduce((a, b) => a + (Number(b) || 0), 0);
                        return (
                          <div key={idx} className="flex justify-between items-center gap-2 text-[7px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                            <span className="truncate">{item.moldName} {item.colorName}</span>
                            <span className="shrink-0">{totalPairs} pares</span>
                          </div>
                        );
                      })}
                      {purchase.type === PurchaseType.REPLENISHMENT && (purchase.items || []).map((item, idx) => {
                        const product = products.find(p => p.id === item.productId);
                        const variation = product?.variations.find(v => v.id === item.variationId);
                        const label = `${product?.reference ? `${product.reference} ` : ''}${product?.name || 'Produto'}${variation?.colorName ? ` ${variation.colorName}` : ''}${item.size ? ` / ${item.size}` : ''}`;
                        return (
                          <div key={idx} className="flex justify-between items-center gap-2 text-[7px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                            <span className="truncate">{label}</span>
                            <span className="shrink-0">{item.quantity}{item.isBox ? ' cx' : 'x'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              if (transaction.contactName) {
                return (
                  <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 tracking-widest mt-0.5">
                    <User size={10} /> {transaction.contactName}
                  </div>
                );
              }

              // Beneficiário/Prestador via personId (OS de corte, mão de obra)
              const beneficiary = transaction.personId
                ? people.find(p => p.id === transaction.personId)
                : null;
              if (beneficiary) {
                return (
                  <div className="flex items-center gap-1 text-[9px] font-black text-indigo-500 dark:text-indigo-400 tracking-widest mt-0.5">
                    <User size={10} /> {beneficiary.name}
                  </div>
                );
              }

              return null;
            })()}

            {transaction.items && transaction.items.length > 0 && (
              <div className="mt-3 space-y-1 pl-3 border-l-2 border-slate-100 dark:border-slate-800/50">
                {transaction.items.map((item, idx) => (
                  <div key={item.id || idx} className="flex justify-between items-center text-[8px] font-bold text-slate-500 dark:text-slate-400 tracking-widest">
                    <span className="truncate max-w-[150px]">{item.description || 'Item sem descrição'}</span>
                    <span className="shrink-0 ml-2">R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className={`font-black text-base tracking-tight transition-all ${transaction.type === TransactionType.INCOME ? 'text-emerald-500' : 'text-rose-500'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
            {transaction.type === TransactionType.INCOME ? '+' : '-'} R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest mt-1 ${isPending ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'}`}>
            {isPending ? <Clock size={10} /> : <CheckCircle2 size={10} />}
            {isPending ? 'Pendente' : 'Confirmado'}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] text-indigo-400 dark:text-indigo-500 font-black uppercase tracking-widest flex items-center gap-1">
            <Wallet size={10} />
            {account?.name || 'Conta'}
          </span>
          <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1">
            <Calendar size={10} />
            {format(transaction.date, "dd MMM yyyy", { locale: ptBR })}
          </span>
        </div>

        <div className="flex gap-2">
          {isPending && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSettle(transaction);
              }}
              disabled={settlingId === transaction.id}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black tracking-widest shadow-xl transition-all active:scale-95 ${
                settlingId === transaction.id
                  ? 'bg-slate-200 text-slate-500 animate-pulse'
                  : 'bg-emerald-500 text-white shadow-emerald-100 hover:bg-emerald-600'
              }`}
            >
              {settlingId === transaction.id ? (
                <> <RefreshCcw size={14} className="animate-spin" /> Processando... </>
              ) : (
                <> <CheckCircle2 size={16} strokeWidth={3} /> Dar Baixa </>
              )}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(transaction);
            }}
            className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-500 active:bg-indigo-50 transition-all"
            title="Editar Lançamento"
            aria-label="Editar Lançamento"
          >
            <Edit size={18} strokeWidth={2.5} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteClick(transaction.id);
            }}
            disabled={deletingId === transaction.id}
            className={`p-3 rounded-xl transition-all ${
              deletingId === transaction.id
                ? 'bg-slate-100 text-slate-300 animate-pulse'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-500 active:bg-rose-50'
            }`}
            title="Excluir Lançamento"
            aria-label="Excluir Lançamento"
          >
            {deletingId === transaction.id ? (
              <RefreshCcw size={18} className="animate-spin" />
            ) : (
              <Trash2 size={18} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
