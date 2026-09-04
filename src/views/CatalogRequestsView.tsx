import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CatalogRequest, CatalogRequestStatus, Person, Product } from '../types';
import { ArrowLeft, Inbox, Check, X, AlertTriangle, Calendar, Trash2, Images } from 'lucide-react';
import { format } from 'date-fns';

interface CatalogRequestsViewProps {
  catalogRequests: CatalogRequest[];
  people: Person[];
  products: Product[];
  onBack: () => void;
  isDarkMode: boolean;
  onImportCatalogRequest: (request: CatalogRequest) => void;
  onDismissCatalogRequest: (requestId: string) => Promise<void>;
  // Apaga de vez um pedido já descartado — sem isso a aba Descartados só crescia pra sempre.
  onDeleteCatalogRequest: (requestId: string) => Promise<void>;
}

const TABS: { id: CatalogRequestStatus; label: string }[] = [
  { id: 'PENDING', label: 'Pendentes' },
  { id: 'IMPORTED', label: 'Importados' },
  { id: 'DISMISSED', label: 'Descartados' },
];

// Disponível AGORA pra essa linha específica do pedido — pares por tamanho (Varejo) ou
// caixas (Atacado, size ausente). Lido direto de variation.stock (não usa stockPools.ts
// porque aqui a pergunta é "quanto tem NESSE tamanho", não o pool agregado do produto).
function getLineAvailability(product: Product | undefined, variationId: string, size: string | undefined): number {
  const variation = product?.variations.find(v => v.id === variationId);
  if (!variation) return 0;
  return variation.stock?.[size || 'WHOLESALE'] || 0;
}

// "Pedido" não dizia a unidade de verdade — caixa (Atacado) e par (Varejo) não são a mesma
// coisa, e misturar os dois sob a mesma palavra genérica confundia a conferência de estoque.
function unitLabel(saleType: 'RETAIL' | 'WHOLESALE', quantity: number): string {
  if (saleType === 'WHOLESALE') return quantity === 1 ? 'caixa' : 'caixas';
  return quantity === 1 ? 'par' : 'pares';
}

export default function CatalogRequestsView({
  catalogRequests,
  people,
  products,
  onBack,
  isDarkMode,
  onImportCatalogRequest,
  onDismissCatalogRequest,
  onDeleteCatalogRequest,
}: CatalogRequestsViewProps) {
  const [activeTab, setActiveTab] = useState<CatalogRequestStatus>('PENDING');
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Popup "ver fotos" — miniatura de CADA modelo+cor do pedido de uma vez (o card já mostra
  // a foto do produto, mas só uma por item; um pedido pode ter cores diferentes do mesmo
  // modelo, cada uma com sua própria foto de variação).
  const [previewRequest, setPreviewRequest] = useState<CatalogRequest | null>(null);

  const filtered = useMemo(
    () => catalogRequests.filter(r => r.status === activeTab).sort((a, b) => b.submittedAt - a.submittedAt),
    [catalogRequests, activeTab]
  );

  const pendingCount = useMemo(() => catalogRequests.filter(r => r.status === 'PENDING').length, [catalogRequests]);

  return (
    <div className="flex flex-col gap-6 pb-32">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors text-slate-400" title="Voltar" aria-label="Voltar">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">Pedidos Recebidos</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Catálogo Público — revise antes de confirmar</p>
        </div>
      </div>

      <div className={`flex p-1 rounded-2xl border gap-1 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-sm' : isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
          >
            {tab.label}
            {tab.id === 'PENDING' && pendingCount > 0 && (
              <span className={`min-w-[16px] h-4 px-1 rounded-full text-[9px] flex items-center justify-center ${activeTab === tab.id ? 'bg-white text-indigo-600' : 'bg-rose-500 text-white'}`}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-200 dark:text-slate-800">
            <Inbox size={64} strokeWidth={1} className="mb-4" />
            <p className="text-[10px] font-black tracking-widest italic">Nenhum pedido aqui</p>
          </div>
        )}

        {filtered.map(request => {
          const person = people.find(p => p.id === request.personId);
          return (
            <div key={request.id} className={`p-4 rounded-2xl border shadow-sm flex flex-col gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-sm font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{person?.name || 'Cliente'}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1">
                    <Calendar size={10} /> {(() => {
                      try { return format(request.submittedAt, "dd/MM/yyyy 'às' HH:mm"); } catch { return ''; }
                    })()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewRequest(request)}
                  title="Ver fotos de todos os modelos e cores"
                  aria-label="Ver fotos de todos os modelos e cores"
                  className={`p-2 rounded-full shrink-0 transition-all ${isDarkMode ? 'bg-slate-800 text-indigo-400 hover:bg-slate-700' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                >
                  <Images size={16} strokeWidth={2.5} />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {request.items.map((item, itemIdx) => {
                  const product = products.find(p => p.id === item.productId);
                  return (
                    <div key={itemIdx} className={`rounded-xl p-3 ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
                      <p className={`text-[11px] font-black uppercase tracking-wide truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                        {product?.reference ? `${product.reference} ` : ''}{product?.name || 'Produto removido'}
                      </p>
                      {/* Miniatura POR COR (variation.photoUrl, cai pra photoUrl do produto só
                          se a cor não tiver foto própria) — não a foto de capa da referência,
                          pra não passar a impressão de que todas as cores são a mesma foto. */}
                      <div className="flex flex-col gap-2 mt-1.5">
                        {item.variations.map((v, vIdx) => {
                          const variation = product?.variations.find(vv => vv.id === v.variationId);
                          const available = getLineAvailability(product, v.variationId, v.size);
                          const isShort = available < v.quantity;
                          const colorPhoto = variation?.photoUrl || product?.photoUrl;
                          return (
                            <div key={vIdx} className="flex items-center gap-2">
                              {colorPhoto ? (
                                <img src={colorPhoto} alt={variation?.colorName} className="w-8 h-8 rounded-md object-cover shrink-0 bg-slate-200" />
                              ) : (
                                <div className="w-8 h-8 rounded-md bg-slate-200 dark:bg-slate-700 shrink-0" />
                              )}
                              <div className="flex items-center justify-between gap-2 text-[10px] flex-1 min-w-0">
                                <span className={`font-bold truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {variation?.colorName || 'Cor'}{v.size ? ` · ${v.size}` : ' · Caixa'}
                                </span>
                                {/* Falta de estoque: tudo vermelho, aviso não pode se diluir. Caixa
                                    (Atacado) com estoque OK: pedido em verde, estoque em azul —
                                    duas cores separadas pra não confundir qual número é qual (par/
                                    Varejo continua as duas partes em verde, só um número mesmo). */}
                                {isShort ? (
                                  <span className="font-black flex items-center gap-1 shrink-0 text-rose-500">
                                    <AlertTriangle size={11} />
                                    {v.quantity} {unitLabel(item.saleType, v.quantity)} · só {available} em estoque
                                  </span>
                                ) : item.saleType === 'WHOLESALE' ? (
                                  <span className="font-black shrink-0">
                                    <span className="text-emerald-600">{v.quantity} {unitLabel(item.saleType, v.quantity)}</span>
                                    <span className="text-blue-600"> · {available} em estoque</span>
                                  </span>
                                ) : (
                                  <span className="font-black shrink-0 text-emerald-600">
                                    {v.quantity} {unitLabel(item.saleType, v.quantity)} · {available} em estoque
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {request.customerNote && (
                <p className={`text-[11px] italic ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>"{request.customerNote}"</p>
              )}

              {request.status === 'PENDING' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onImportCatalogRequest(request)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                  >
                    <Check size={14} /> Importar como Venda
                  </button>
                  <button
                    type="button"
                    disabled={dismissingId === request.id}
                    onClick={async () => {
                      setDismissingId(request.id);
                      try { await onDismissCatalogRequest(request.id); } finally { setDismissingId(null); }
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {request.status === 'DISMISSED' && (
                <button
                  type="button"
                  disabled={deletingId === request.id}
                  onClick={async () => {
                    if (!confirm('Apagar este pedido descartado? Não pode ser desfeito.')) return;
                    setDeletingId(request.id);
                    try { await onDeleteCatalogRequest(request.id); } finally { setDeletingId(null); }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
                >
                  <Trash2 size={14} /> Apagar
                </button>
              )}
            </div>
          );
        })}
      </div>

      {previewRequest && createPortal(
        <div
          className="fixed inset-0 z-[70000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setPreviewRequest(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm max-h-[80vh] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
          >
            <div className={`flex items-center justify-between px-6 py-5 border-b shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Images size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className={`text-sm font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {people.find(p => p.id === previewRequest.personId)?.name || 'Cliente'}
                  </h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Todos os modelos e cores</p>
                </div>
              </div>
              <button type="button" onClick={() => setPreviewRequest(null)} className={`p-2 rounded-full shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`} aria-label="Fechar">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3 overflow-y-auto">
              {previewRequest.items.map((item, itemIdx) => {
                const product = products.find(p => p.id === item.productId);
                return item.variations.map((v, vIdx) => {
                  const variation = product?.variations.find(vv => vv.id === v.variationId);
                  const colorPhoto = variation?.photoUrl || product?.photoUrl;
                  return (
                    <div key={`${itemIdx}-${vIdx}`} className="flex items-center gap-3">
                      {colorPhoto ? (
                        <img src={colorPhoto} alt={variation?.colorName} className="w-14 h-14 rounded-xl object-cover shrink-0 bg-slate-200" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className={`text-[11px] font-black uppercase tracking-wide truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                          {product?.reference ? `${product.reference} ` : ''}{product?.name || 'Produto removido'}
                        </p>
                        <p className={`text-[10px] font-bold mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {variation?.colorName || 'Cor'}{v.size ? ` · ${v.size}` : ' · Caixa'} · {v.quantity} {unitLabel(item.saleType, v.quantity)}
                        </p>
                      </div>
                    </div>
                  );
                });
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
