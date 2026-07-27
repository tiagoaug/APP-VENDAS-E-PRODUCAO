import { useEffect, useState } from 'react';
import { CheckCircle2, ListChecks, PackageCheck } from 'lucide-react';
import { DeliveryItemRef, Product, SaleItem, SaleType } from '../types';
import Modal from './Modal';

interface DeliveryItemsPickerProps {
  isDarkMode: boolean;
  isOpen: boolean;
  onClose: () => void;
  title: string;
  saleItems: SaleItem[];
  products: Product[];
  value: DeliveryItemRef[] | undefined;
  noteValue: string | undefined;
  // Quanto de cada item já foi alocado em OUTROS endereços deste mesmo pedido (chave via
  // deliveryItemKey) — abatido do disponível aqui, pra não deixar escolher de novo o que já
  // foi separado pra outra parada. Ausente/0 = nada alocado em outro lugar ainda.
  allocatedElsewhere?: Record<string, number>;
  onSave: (items: DeliveryItemRef[], note: string) => void;
}

export const deliveryItemKey = (it: { productId: string; variationId: string; size?: string; saleType: SaleType }) =>
  `${it.productId}|${it.variationId}|${it.size || ''}|${it.saleType}`;

// Checklist de itens a conferir num endereço de entrega — puramente informativo (não
// divide estoque nem financeiro, ver Sale.deliveryItems/AdditionalDeliveryAddress.deliveryItems).
// Reaproveitado tanto pro endereço principal quanto pra cada endereço adicional (SalesView).
export default function DeliveryItemsPicker({ isDarkMode, isOpen, onClose, title, saleItems, products, value, noteValue, allocatedElsewhere, onSave }: DeliveryItemsPickerProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  // Observação do checklist (Sale.deliveryItemsNote / AdditionalDeliveryAddress.deliveryItemsNote)
  // — mostrada como observação EXTRA na tela de entrega e no rodapé da lista aqui, em laranja.
  const [note, setNote] = useState('');

  const availableOf = (it: SaleItem) => Math.max(0, it.quantity - (allocatedElsewhere?.[deliveryItemKey(it)] || 0));

  // Recarrega a cópia local toda vez que o modal abre — edições descartadas ao cancelar não
  // devem "vazar" pra próxima vez que for aberto. Também reduz uma quantidade salva antes que
  // hoje ultrapasse o disponível (ex.: outro endereço passou a reservar mais desse item).
  useEffect(() => {
    if (!isOpen) return;
    const initial: Record<string, number> = {};
    (value || []).forEach(v => {
      const saleItem = saleItems.find(it => deliveryItemKey(it) === deliveryItemKey(v));
      const max = saleItem ? availableOf(saleItem) : v.quantity;
      const qty = Math.min(v.quantity, max);
      if (qty > 0) initial[deliveryItemKey(v)] = qty;
    });
    setQuantities(initial);
    setNote(noteValue || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, value, noteValue]);

  const setQty = (key: string, qty: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, qty));
    setQuantities(prev => {
      const next = { ...prev };
      if (clamped <= 0) delete next[key];
      else next[key] = clamped;
      return next;
    });
  };

  const selectWholeSale = () => {
    const all: Record<string, number> = {};
    saleItems.forEach(it => {
      const available = availableOf(it);
      if (available > 0) all[deliveryItemKey(it)] = available;
    });
    setQuantities(all);
  };

  const clearAll = () => setQuantities({});

  const handleSave = () => {
    const result: DeliveryItemRef[] = saleItems
      .filter(it => (quantities[deliveryItemKey(it)] || 0) > 0)
      .map(it => ({
        productId: it.productId,
        variationId: it.variationId,
        size: it.size,
        saleType: it.saleType,
        quantity: quantities[deliveryItemKey(it)],
      }));
    onSave(result, note.trim());
    onClose();
  };

  const selectedCount = Object.values(quantities).filter(q => q > 0).length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} icon={<ListChecks size={20} />} maxWidth="max-w-lg" closeLabel="Cancelar">
      <div className="flex flex-col gap-3">
        <p className="text-[10px] font-bold text-slate-400 px-1">
          Marque a quantidade de cada item entregue neste endereço — opcional, não afeta estoque nem financeiro, só ajuda a conferir na hora da entrega.
        </p>
        <button
          type="button"
          onClick={selectWholeSale}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-teal-600 text-white hover:bg-teal-700 transition-all active:scale-[0.98]"
        >
          <PackageCheck size={13} />
          Selecionar Toda a Venda
        </button>
        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto force-scrollbar">
          {saleItems.map((it, idx) => {
            const product = products.find(p => p.id === it.productId);
            const variation = product?.variations.find(v => v.id === it.variationId);
            const unit = it.saleType === SaleType.WHOLESALE ? 'cx' : 'pares';
            const key = deliveryItemKey(it);
            const qty = quantities[key] || 0;
            const allocated = allocatedElsewhere?.[key] || 0;
            const available = availableOf(it);
            return (
              <div
                key={idx}
                className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${qty > 0 ? (isDarkMode ? 'bg-teal-900/20 border-teal-700' : 'bg-teal-50 border-teal-200') : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}`}
              >
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {product?.reference && `${product.reference} · `}{product?.name}
                    {variation?.colorName && ` · ${variation.colorName}`}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400">
                    {it.size ? `Nº ${it.size} · ` : ''}{it.quantity} {unit} no pedido
                    {allocated > 0 && ` · ${allocated} já em outro endereço · ${available} disponível`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={available === 0}
                    onClick={() => setQty(key, qty - 1, available)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-base transition-all active:scale-95 disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                  >
                    −
                  </button>
                  <span className={`w-6 text-center text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{qty}</span>
                  <button
                    type="button"
                    disabled={available === 0}
                    onClick={() => setQty(key, qty + 1, available)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-base transition-all active:scale-95 disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className={`flex flex-col gap-1.5 p-3 rounded-2xl border ${isDarkMode ? 'bg-orange-900/10 border-orange-800/40' : 'bg-orange-50 border-orange-200'}`}>
          <label className="text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400">
            Observação desta entrega (opcional)
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex: item com avaria, cliente pediu pra não empilhar..."
            className={`w-full ${isDarkMode ? 'bg-slate-900/60' : 'bg-white'} border-2 border-transparent focus:border-orange-400 rounded-xl px-3 py-2 text-xs font-bold text-orange-700 dark:text-orange-300 placeholder:text-orange-400/60 transition-all outline-none resize-none`}
          />
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Limpar
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-teal-600 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 active:scale-[0.98] transition-all"
          >
            <CheckCircle2 size={14} />
            Salvar Itens
          </button>
        </div>
      </div>
    </Modal>
  );
}
