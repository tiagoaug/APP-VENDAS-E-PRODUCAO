import { useEffect, useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { ClipboardPaste, X, Check, AlertTriangle, HelpCircle, Trash2, Plus, User, Camera as CameraIcon, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Product, Grid, Person, SaleType, Variation, OrderTextAlias } from '../types';
import ComboBox from './ComboBox';
import { parseOrderText, buildDraftBlocksFromLines, normalizeText, ParsedOrderLine, ParsedOrderResult, DraftSaleBlockInput } from '../utils/orderTextParser';
import { isHybridProduct, productHasSaleType } from '../utils/stockPools';
import { textRecognitionService } from '../services/textRecognitionService';
import { saveOrderTextAlias } from '../services/orderTextAliasService';
import { toast } from '../utils/toast';

interface PasteOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  grids: Grid[];
  people: Person[];
  orderTextAliases: OrderTextAlias[];
  isDarkMode: boolean;
  // Quando true, ao abrir já dispara a leitura de imagem da área de transferência (atalho
  // "Colar Print" do "+"  de Vendas) — em vez de esperar o usuário tocar num botão aqui dentro.
  autoOcr?: boolean;
  onConfirm: (payload: { draftBlocks: DraftSaleBlockInput[]; draftCustomerId?: string }) => void;
}

// Uma linha reconhecida pode ter mais de um tamanho ("40/41 x1") — o produto/cor/tipo de venda
// são únicos por linha, só os tamanhos formam uma lista editável (adicionar/remover/ajustar
// quantidade), espelhando como a própria linha de texto foi interpretada.
interface LineResolution {
  productId?: string;
  variationId?: string;
  saleType?: SaleType;
  entries: { size?: string; quantity: number }[];
  ignored: boolean;
}

function resolutionFromLine(line: ParsedOrderLine): LineResolution {
  return {
    productId: line.productId,
    variationId: line.variationId,
    saleType: line.saleType,
    entries: line.sizes.length > 0 ? line.sizes.map(s => ({ ...s })) : [],
    ignored: false,
  };
}

function isResolutionComplete(r: LineResolution): boolean {
  if (r.ignored) return true;
  if (!r.productId || !r.variationId || !r.saleType) return false;
  if (r.entries.length === 0) return false;
  if (r.saleType === SaleType.RETAIL) return r.entries.every(e => !!e.size && e.quantity > 0);
  return r.entries.every(e => e.quantity > 0);
}

const statusMeta: Record<ParsedOrderLine['status'], { label: string; dot: string; badgeLight: string; badgeDark: string }> = {
  auto: { label: 'Reconhecida', dot: 'bg-emerald-500', badgeLight: 'bg-emerald-50 text-emerald-700 border-emerald-200', badgeDark: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  review: { label: 'Revisar', dot: 'bg-amber-500', badgeLight: 'bg-amber-50 text-amber-700 border-amber-200', badgeDark: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  unmatched: { label: 'Não reconhecida', dot: 'bg-rose-500', badgeLight: 'bg-rose-50 text-rose-700 border-rose-200', badgeDark: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
};

export default function PasteOrderModal({ isOpen, onClose, products, grids, people, orderTextAliases, isDarkMode, autoOcr, onConfirm }: PasteOrderModalProps) {
  const [step, setStep] = useState<'paste' | 'review'>('paste');
  const [text, setText] = useState('');
  const [result, setResult] = useState<ParsedOrderResult | null>(null);
  const [resolutions, setResolutions] = useState<Record<number, LineResolution>>({});
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());
  const [customerId, setCustomerId] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  // Marca, por linha, se o usuário quer que a correção manual feita agora vire uma
  // correspondência "ensinada" (ver orderTextParser.ts) — só é gravada de fato ao confirmar.
  const [rememberAlias, setRememberAlias] = useState<Record<number, boolean>>({});

  // Lê uma imagem da área de transferência (print copiado) e extrai o texto via OCR — usado
  // tanto pelo botão "Colar Print" aqui dentro quanto pelo atalho "Colar Print" do "+" de
  // Vendas (autoOcr, disparado uma vez ao abrir, ver useEffect abaixo). Mesmo comportamento de
  // "anexa, nunca substitui" e "não avança sozinho pra revisão" do OCR por foto.
  const handlePasteFromClipboard = async () => {
    setOcrLoading(true);
    try {
      const clipboardItems = await navigator.clipboard.read();
      let blob: Blob | null = null;
      for (const item of clipboardItems) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) { blob = await item.getType(imageType); break; }
      }
      if (!blob) {
        toast.show('Nenhuma imagem encontrada na área de transferência. Copie um print e tente de novo.');
        return;
      }
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Falha ao ler a imagem colada'));
        reader.readAsDataURL(blob as Blob);
      });
      const base64 = dataUrl.split('base64,')[1];
      const written = await Filesystem.writeFile({ path: `paste_ocr_${Date.now()}.png`, data: base64, directory: Directory.Cache });
      const extracted = await textRecognitionService.extractText(written.uri);
      if (!extracted) return; // serviço já avisou (toast)
      setText(prev => (prev.trim() ? `${prev.trim()}\n${extracted}` : extracted));
    } catch (err: any) {
      toast.show('Não foi possível colar a imagem: ' + (err?.message || err));
    } finally {
      setOcrLoading(false);
    }
  };

  // Atalho "Colar Print" do "+" de Vendas — abre este modal já disparando a leitura da área de
  // transferência, sem precisar tocar em mais nada aqui dentro.
  useEffect(() => {
    if (isOpen && autoOcr) handlePasteFromClipboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, autoOcr]);

  if (!isOpen) return null;

  const reset = () => {
    setStep('paste');
    setText('');
    setResult(null);
    setResolutions({});
    setExpandedLines(new Set());
    setCustomerId('');
    setRememberAlias({});
  };

  const handleClose = () => { reset(); onClose(); };

  const handleProcess = () => {
    if (!text.trim()) return;
    const parsed = parseOrderText(text, products, people, grids, orderTextAliases);
    const nextResolutions: Record<number, LineResolution> = {};
    const nextExpanded = new Set<number>();
    parsed.lines.forEach(line => {
      nextResolutions[line.lineIndex] = resolutionFromLine(line);
      if (line.status !== 'auto') nextExpanded.add(line.lineIndex);
    });
    setResult(parsed);
    setResolutions(nextResolutions);
    setExpandedLines(nextExpanded);
    setCustomerId(parsed.detectedCustomer?.personId || '');
    setStep('review');
  };

  // Tira/escolhe uma foto de um print (ex.: nota do Google Keep) e extrai o texto via OCR local
  // (ML Kit) direto pro textarea — sempre ANEXA ao que já tinha (nunca substitui), pra dar pra
  // combinar foto do print com uma linha de cliente digitada à parte, em qualquer ordem. Não
  // avança sozinho pro passo de revisão: OCR de print sempre traz ruído, o usuário confere/
  // corrige o texto extraído antes de "Processar Texto".
  const handlePickPhotoForOcr = async (source: CameraSource) => {
    setOcrLoading(true);
    try {
      const photo = await Camera.getPhoto({ source, resultType: CameraResultType.Uri, quality: 90 });
      const path = photo.path || photo.webPath;
      if (!path) return;
      const extracted = await textRecognitionService.extractText(path);
      if (!extracted) return; // serviço já avisou (toast) ou o usuário cancelou
      setText(prev => (prev.trim() ? `${prev.trim()}\n${extracted}` : extracted));
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      if (!/cancel/i.test(msg)) toast.show('Erro ao selecionar imagem: ' + msg);
    } finally {
      setOcrLoading(false);
    }
  };

  const updateResolution = (lineIndex: number, patch: Partial<LineResolution>) => {
    setResolutions(prev => ({ ...prev, [lineIndex]: { ...prev[lineIndex], ...patch } }));
  };

  const toggleExpanded = (lineIndex: number) => {
    setExpandedLines(prev => {
      const next = new Set(prev);
      if (next.has(lineIndex)) next.delete(lineIndex); else next.add(lineIndex);
      return next;
    });
  };

  const handlePickProduct = (lineIndex: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    const firstVariation = product?.variations[0];
    const defaultSaleType = product ? (productHasSaleType(product, SaleType.RETAIL) ? SaleType.RETAIL : SaleType.WHOLESALE) : undefined;
    updateResolution(lineIndex, {
      productId,
      variationId: firstVariation?.id,
      saleType: defaultSaleType,
      entries: defaultSaleType === SaleType.WHOLESALE ? [{ size: undefined, quantity: 1 }] : [],
    });
  };

  const activeProducts = products; // já vem filtrado por quem chama (products ativos), sem duplicar filtro aqui

  const allResolved = result ? result.lines.every(line => isResolutionComplete(resolutions[line.lineIndex] || resolutionFromLine(line))) : false;

  // Grava alias por-produto pra cada linha marcada "Lembrar" — só no confirm (não no toggle do
  // checkbox), pra só ensinar correspondência de linha que o usuário realmente confirmou.
  const saveRememberedAliases = () => {
    if (!result) return;
    result.lines.forEach(line => {
      if (!rememberAlias[line.lineIndex]) return;
      const r = resolutions[line.lineIndex];
      const phrase = line.colorText.trim();
      if (!r?.productId || !r?.variationId || !phrase) return;
      const product = products.find(p => p.id === r.productId);
      const variation = product?.variations.find(v => v.id === r.variationId);
      saveOrderTextAlias({
        id: `${r.productId}__${normalizeText(phrase)}`, // determinístico: re-ensinar sobrescreve, não duplica
        phraseNorm: normalizeText(phrase),
        phraseRaw: phrase,
        productId: r.productId,
        productName: product ? `${product.reference} · ${product.name}` : undefined,
        variationId: r.variationId,
        variationName: variation?.colorName,
        createdAt: Date.now(),
      }).catch(err => toast.show('Erro ao salvar correspondência: ' + (err?.message || err)));
    });
  };

  const handleConfirm = () => {
    if (!result || !allResolved) return;
    const finalLines: ParsedOrderLine[] = result.lines
      .map(line => ({ line, r: resolutions[line.lineIndex] }))
      .filter(({ r }) => r && !r.ignored && r.productId && r.variationId && r.saleType)
      .map(({ line, r }) => ({
        ...line,
        productId: r.productId,
        variationId: r.variationId,
        saleType: r.saleType,
        sizes: r.entries,
      }));
    const draftBlocks = buildDraftBlocksFromLines(finalLines);
    saveRememberedAliases();
    if (draftBlocks.length === 0) { handleClose(); return; }
    onConfirm({ draftBlocks, draftCustomerId: customerId || undefined });
    reset();
  };

  return (
    <div className="fixed inset-0 z-[65000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={handleClose}>
      <div
        onClick={e => e.stopPropagation()}
        className={`w-full max-w-lg max-h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
      >
        <div className={`flex items-center justify-between px-6 py-5 border-b shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <ClipboardPaste size={18} />
            </div>
            <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {step === 'paste' ? 'Colar Pedido Digitado' : 'Conferir Itens'}
            </h3>
          </div>
          <button type="button" onClick={handleClose} className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`} aria-label="Fechar">
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {step === 'paste' ? (
            <>
              <p className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} data-guide-anchor="pasteOrder.textarea">
                Cole abaixo uma lista de itens digitada (WhatsApp, bloco de notas...) — uma linha por item.
                Não precisa arrumar antes: referência, cor, tamanho e quantidade podem vir em qualquer ordem.
              </p>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={'320 preto 38 x2\n415 branco 40/41 x1\nCliente: Jonathan Santos'}
                rows={8}
                autoFocus
                className={`w-full rounded-2xl p-4 text-[13px] font-medium leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none ${
                  isDarkMode ? 'bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border border-slate-100 text-slate-700 placeholder:text-slate-400'
                }`}
              />

              <div className="flex gap-1.5" data-guide-anchor="pasteOrder.ocr">
                <button
                  type="button"
                  onClick={() => handlePickPhotoForOcr(CameraSource.Camera)}
                  disabled={ocrLoading}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                >
                  {ocrLoading ? <Loader2 size={14} className="animate-spin" /> : <CameraIcon size={14} />} {ocrLoading ? 'Lendo imagem...' : 'Tirar Foto'}
                </button>
                <button
                  type="button"
                  onClick={() => handlePickPhotoForOcr(CameraSource.Photos)}
                  disabled={ocrLoading}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                >
                  {ocrLoading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />} {ocrLoading ? 'Lendo imagem...' : 'Escolher da Galeria'}
                </button>
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  disabled={ocrLoading}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                >
                  {ocrLoading ? <Loader2 size={14} className="animate-spin" /> : <ClipboardPaste size={14} />} {ocrLoading ? 'Lendo imagem...' : 'Colar Print'}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Banner de cliente detectado */}
              <div className={`p-3 rounded-2xl border flex flex-col gap-2 ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`} data-guide-anchor="pasteOrder.clienteDetectado">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-indigo-500 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {result?.detectedCustomer && result.detectedCustomer.confidence !== 'none'
                      ? `Cliente identificado: "${result.detectedCustomer.rawName}"`
                      : 'Nenhum cliente identificado — selecione manualmente (opcional)'}
                  </span>
                </div>
                <ComboBox
                  options={people.filter(p => p.isCustomer).map(p => ({ id: p.id, name: p.name }))}
                  value={customerId}
                  onChange={setCustomerId}
                  placeholder="SEGUIR SEM CLIENTE"
                  isDarkMode={isDarkMode}
                  compact
                  usePopupModal
                  popupZIndex={66000}
                />
              </div>

              {/* Linhas reconhecidas */}
              <div className="flex flex-col gap-2">
                {result?.lines.map(line => {
                  const r = resolutions[line.lineIndex] || resolutionFromLine(line);
                  const meta = statusMeta[line.status];
                  const expanded = expandedLines.has(line.lineIndex) || line.status !== 'auto';
                  const product = r.productId ? products.find(p => p.id === r.productId) : undefined;
                  const variation = product?.variations.find(v => v.id === r.variationId);
                  const hybrid = isHybridProduct(product);

                  return (
                    <div key={line.lineIndex} className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'border-slate-800' : 'border-slate-100'} ${r.ignored ? 'opacity-40' : ''}`}>
                      <button
                        type="button"
                        onClick={() => toggleExpanded(line.lineIndex)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                          <span className={`text-[11px] font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{line.raw}</span>
                        </div>
                        <span
                          data-guide-anchor={line.status === 'auto' ? 'pasteOrder.linhaAuto' : line.status === 'review' ? 'pasteOrder.linhaRevisar' : 'pasteOrder.linhaNaoReconhecida'}
                          className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full border shrink-0 ${isDarkMode ? meta.badgeDark : meta.badgeLight}`}
                        >
                          {meta.label}
                        </span>
                      </button>

                      {expanded && (
                        <div className={`p-3 flex flex-col gap-2 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                          {line.reasons.length > 0 && (
                            <div className="flex items-start gap-1.5 text-[9px] font-bold text-amber-500">
                              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                              <span>{line.reasons.join(' ')}</span>
                            </div>
                          )}

                          <ComboBox
                            options={activeProducts.map(p => ({ id: p.id, name: `${p.reference} · ${p.name}` }))}
                            value={r.productId || ''}
                            onChange={(id) => handlePickProduct(line.lineIndex, id)}
                            placeholder="SELECIONE O PRODUTO"
                            isDarkMode={isDarkMode}
                            compact
                            usePopupModal
                            popupZIndex={66000}
                          />

                          {product && (
                            <ComboBox
                              options={product.variations.map(v => ({ id: v.id, name: v.colorName }))}
                              value={r.variationId || ''}
                              onChange={(variationId) => updateResolution(line.lineIndex, { variationId })}
                              placeholder="SELECIONE A COR"
                              isDarkMode={isDarkMode}
                              compact
                              usePopupModal
                              popupZIndex={66000}
                            />
                          )}

                          {product && r.variationId && line.status !== 'auto' && (
                            <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-indigo-500" data-guide-anchor="pasteOrder.lembrarCorrespondencia">
                              <input
                                type="checkbox"
                                checked={!!rememberAlias[line.lineIndex]}
                                onChange={(e) => setRememberAlias(prev => ({ ...prev, [line.lineIndex]: e.target.checked }))}
                              />
                              Lembrar esta correspondência da próxima vez
                            </label>
                          )}

                          {product && hybrid && (
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateResolution(line.lineIndex, { saleType: SaleType.RETAIL, entries: [] })}
                                className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${r.saleType === SaleType.RETAIL ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                              >
                                Varejo (por tamanho)
                              </button>
                              <button
                                type="button"
                                onClick={() => updateResolution(line.lineIndex, { saleType: SaleType.WHOLESALE, entries: [{ size: undefined, quantity: 1 }] })}
                                className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${r.saleType === SaleType.WHOLESALE ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                              >
                                Atacado (grade)
                              </button>
                            </div>
                          )}

                          {product && variation && r.saleType === SaleType.RETAIL && (
                            <SizeEntriesEditor
                              isDarkMode={isDarkMode}
                              variation={variation}
                              grids={grids}
                              product={product}
                              entries={r.entries}
                              onChange={(entries) => updateResolution(line.lineIndex, { entries })}
                            />
                          )}

                          {product && r.saleType === SaleType.WHOLESALE && (
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Quantidade (grades/caixas)</span>
                              <input
                                type="number"
                                min={1}
                                value={r.entries[0]?.quantity ?? 1}
                                onChange={(e) => updateResolution(line.lineIndex, { entries: [{ size: undefined, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) }] })}
                                className={`w-16 py-1.5 px-2 rounded-lg text-xs font-black text-center ${isDarkMode ? 'bg-slate-800 border border-slate-700 text-white' : 'bg-slate-50 border border-slate-200 text-slate-700'}`}
                              />
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => updateResolution(line.lineIndex, { ignored: !r.ignored })}
                            className={`self-start flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest ${r.ignored ? 'text-emerald-500' : 'text-rose-500'}`}
                          >
                            <Trash2 size={11} /> {r.ignored ? 'Linha ignorada — toque para desfazer' : 'Ignorar esta linha'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {(result?.unparsedRawLines.length || 0) > 0 && (
                <div className={`p-3 rounded-2xl border flex flex-col gap-1.5 ${isDarkMode ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <HelpCircle size={12} /> Linhas não reconhecidas como item
                  </span>
                  {result?.unparsedRawLines.map((line, i) => (
                    <p key={i} className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{line}</p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className={`p-4 border-t shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          {step === 'paste' ? (
            <button
              type="button"
              onClick={handleProcess}
              disabled={!text.trim()}
              data-guide-anchor="pasteOrder.processar"
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40"
            >
              <ClipboardPaste size={16} /> Processar Texto
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('paste')}
                className={`px-4 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!allResolved}
                data-guide-anchor="pasteOrder.criarPedido"
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40"
              >
                <Check size={16} /> Criar Pedido com Estes Itens
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Editor de tamanhos de uma linha Varejo — lista de {tamanho, quantidade}, uma linha reconhecida
// com "40/41 x1" já chega aqui com duas entradas prontas; dá pra adicionar/remover/ajustar.
function SizeEntriesEditor({ isDarkMode, variation, grids, product, entries, onChange }: {
  isDarkMode: boolean; variation: Variation; grids: Grid[]; product: Product;
  entries: { size?: string; quantity: number }[]; onChange: (entries: { size?: string; quantity: number }[]) => void;
}) {
  const grid = grids.find(g => g.id === product.defaultGridId);
  const sizeOptions = Array.from(new Set([...Object.keys(variation.stock || {}).filter(k => k !== 'WHOLESALE'), ...(grid?.sizes || [])]));

  const update = (idx: number, patch: Partial<{ size?: string; quantity: number }>) => {
    onChange(entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };
  const remove = (idx: number) => onChange(entries.filter((_, i) => i !== idx));
  const add = () => onChange([...entries, { size: sizeOptions[0], quantity: 1 }]);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tamanhos</span>
      {entries.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <select
            value={entry.size || ''}
            onChange={(e) => update(idx, { size: e.target.value })}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black outline-none ${isDarkMode ? 'bg-slate-800 border border-slate-700 text-white' : 'bg-slate-50 border border-slate-200 text-slate-700'}`}
          >
            <option value="">Tamanho...</option>
            {sizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            type="number"
            min={1}
            value={entry.quantity}
            onChange={(e) => update(idx, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
            className={`w-16 py-1.5 px-2 rounded-lg text-xs font-black text-center ${isDarkMode ? 'bg-slate-800 border border-slate-700 text-white' : 'bg-slate-50 border border-slate-200 text-slate-700'}`}
          />
          <button type="button" onClick={() => remove(idx)} className="p-1.5 text-rose-500 shrink-0"><Trash2 size={13} /></button>
        </div>
      ))}
      <button type="button" onClick={add} className={`self-start flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        <Plus size={11} /> Adicionar Tamanho
      </button>
    </div>
  );
}
