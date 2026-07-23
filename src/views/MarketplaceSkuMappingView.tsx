import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Tags as TagsIcon } from 'lucide-react';
import { Grid, MarketplaceSkuMapping, Product, SaleType } from '../types';
import { subscribeToSkuMappings, saveSkuMapping, deleteSkuMapping } from '../services/marketplaceService';
import { generateId } from '../utils/id';
import { toast } from '../utils/toast';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';

interface MarketplaceSkuMappingViewProps {
  isDarkMode: boolean;
  products: Product[];
  grids: Grid[];
}

export default function MarketplaceSkuMappingView({ isDarkMode, products, grids }: MarketplaceSkuMappingViewProps) {
  const [mappings, setMappings] = useState<MarketplaceSkuMapping[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MarketplaceSkuMapping | null>(null);

  const [productId, setProductId] = useState('');
  const [variationId, setVariationId] = useState('');
  const [saleType, setSaleType] = useState<SaleType>(SaleType.RETAIL);
  const [size, setSize] = useState('');
  const [externalItemId, setExternalItemId] = useState('');
  const [externalModelId, setExternalModelId] = useState('');
  const [externalSkuLabel, setExternalSkuLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => subscribeToSkuMappings(setMappings), []);

  const selectedProduct = useMemo(() => products.find((p) => p.id === productId) || null, [products, productId]);
  const selectedVariation = useMemo(() => selectedProduct?.variations.find((v) => v.id === variationId) || null, [selectedProduct, variationId]);
  const isHybrid = !!selectedProduct?.saleTypes && selectedProduct.saleTypes.length > 1;
  const availableSaleTypes = selectedProduct ? (isHybrid ? selectedProduct.saleTypes! : [selectedProduct.type]) : [];
  const grid = useMemo(() => grids.find((g) => g.id === selectedProduct?.defaultGridId) || null, [grids, selectedProduct]);

  const resetForm = () => {
    setProductId(''); setVariationId(''); setSaleType(SaleType.RETAIL); setSize('');
    setExternalItemId(''); setExternalModelId(''); setExternalSkuLabel('');
  };

  const handleSave = async () => {
    if (!selectedProduct || !selectedVariation || !externalItemId.trim()) {
      toast.show('Preencha produto, cor e o Item ID da Shopee.');
      return;
    }
    if (saleType === SaleType.RETAIL && !size) {
      toast.show('Selecione o tamanho para mapeamento de varejo.');
      return;
    }
    setSaving(true);
    try {
      const mapping: MarketplaceSkuMapping = {
        id: generateId(),
        channel: 'SHOPEE',
        externalItemId: externalItemId.trim(),
        externalModelId: externalModelId.trim() || undefined,
        externalSkuLabel: externalSkuLabel.trim() || undefined,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        variationId: selectedVariation.id,
        variationName: selectedVariation.colorName,
        size: saleType === SaleType.RETAIL ? size : undefined,
        saleType,
        createdAt: Date.now(),
      };
      await saveSkuMapping(mapping);
      toast.show('Mapeamento salvo.');
      resetForm();
      setShowForm(false);
    } catch (e: any) {
      toast.show('Erro ao salvar mapeamento: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSkuMapping(deleteTarget.id);
    } catch (e: any) {
      toast.show('Erro ao excluir mapeamento: ' + (e.message || e));
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-32">
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Excluir Mapeamento?"
        message="Este item da Shopee deixará de ser reconhecido automaticamente na importação de pedidos."
        confirmLabel="Sim, Excluir"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isDanger={true}
      />

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title="Novo Mapeamento de SKU" icon={<TagsIcon size={18} />} maxWidth="max-w-lg" zIndex={80000}>
        <div className="flex flex-col gap-4 p-1">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Produto</label>
            <select
              value={productId}
              onChange={(e) => { setProductId(e.target.value); setVariationId(''); setSize(''); }}
              className={`w-full h-11 mt-1 px-3 rounded-xl text-sm font-bold outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
            >
              <option value="">Selecione...</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.reference} · {p.name}</option>)}
            </select>
          </div>

          {selectedProduct && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cor</label>
              <select
                value={variationId}
                onChange={(e) => setVariationId(e.target.value)}
                className={`w-full h-11 mt-1 px-3 rounded-xl text-sm font-bold outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
              >
                <option value="">Selecione...</option>
                {selectedProduct.variations.map((v) => <option key={v.id} value={v.id}>{v.colorName}</option>)}
              </select>
            </div>
          )}

          {selectedProduct && isHybrid && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo de Venda</label>
              <select
                value={saleType}
                onChange={(e) => { setSaleType(e.target.value as SaleType); setSize(''); }}
                className={`w-full h-11 mt-1 px-3 rounded-xl text-sm font-bold outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
              >
                {availableSaleTypes.map((st) => <option key={st} value={st}>{st === SaleType.RETAIL ? 'Varejo (par)' : 'Atacado (caixa)'}</option>)}
              </select>
            </div>
          )}

          {selectedVariation && saleType === SaleType.RETAIL && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tamanho</label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className={`w-full h-11 mt-1 px-3 rounded-xl text-sm font-bold outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
              >
                <option value="">Selecione...</option>
                {(grid?.sizes || Object.keys(selectedVariation.stock)).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Item ID (Shopee)</label>
            <input
              value={externalItemId}
              onChange={(e) => setExternalItemId(e.target.value)}
              placeholder="ex: 123456789"
              className={`w-full h-11 mt-1 px-3 rounded-xl text-sm font-bold outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Model ID (Shopee) — opcional, se o item tiver variações</label>
            <input
              value={externalModelId}
              onChange={(e) => setExternalModelId(e.target.value)}
              placeholder="ex: 987654321"
              className={`w-full h-11 mt-1 px-3 rounded-xl text-sm font-bold outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nota / Referência — opcional</label>
            <input
              value={externalSkuLabel}
              onChange={(e) => setExternalSkuLabel(e.target.value)}
              placeholder="ex: Nome do anúncio na Shopee"
              className={`w-full h-11 mt-1 px-3 rounded-xl text-sm font-bold outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 mt-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-black text-xs uppercase tracking-widest"
          >
            {saving ? 'Salvando...' : 'Salvar Mapeamento'}
          </button>
        </div>
      </Modal>

      <div className="flex flex-col gap-3">
        {mappings.map((m) => (
          <div key={m.id} className={`p-5 rounded-[2rem] border shadow-sm flex items-center justify-between gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="min-w-0">
              <p className={`text-sm font-black tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {m.productName} · {m.variationName}{m.size ? ` · ${m.size}` : ' · Atacado'}
              </p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">
                Item {m.externalItemId}{m.externalModelId ? ` · Model ${m.externalModelId}` : ''}{m.externalSkuLabel ? ` · ${m.externalSkuLabel}` : ''}
              </p>
            </div>
            <button onClick={() => setDeleteTarget(m)} className="p-2 text-slate-200 hover:text-rose-500 shrink-0">
              <Trash2 size={16} />
            </button>
          </div>
        ))}

        <button
          onClick={() => setShowForm(true)}
          className="bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem] py-8 flex flex-col items-center justify-center gap-2 text-slate-300 dark:text-slate-700 hover:text-orange-500 dark:hover:text-orange-400 hover:border-orange-100 dark:hover:border-orange-900/30 hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-all cursor-pointer"
        >
          <Plus size={24} />
          <span className="text-[10px] font-black uppercase tracking-widest">Adicionar Mapeamento</span>
        </button>
      </div>
    </div>
  );
}
