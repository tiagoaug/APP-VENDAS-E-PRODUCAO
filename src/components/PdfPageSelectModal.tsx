import { useEffect, useRef, useState } from 'react';
import { Check, FileStack, Maximize2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Crop, Scissors, RotateCcw, CheckCircle2, Save, Trash2, X } from 'lucide-react';
import Modal from './Modal';
import { toast } from '../utils/toast';
import CropEditor, { CropRect, FULL_CROP, CENTER_CROP, loadImageEl } from './CropEditor';
import { PDF_RENDER_SCALE } from '../utils/labelFileImport';

export type { CropRect };

// Mostra só a REGIÃO RECORTADA de `imageSrc` (não a página inteira com um retângulo por cima)
// — o resultado final de verdade, reage a qualquer mudança de `crop` em tempo real. Usa
// background-image com tamanho/posição calculados em px (mesma técnica da lupa em
// CropEditor.tsx) porque só isso dá a precisão certa sem esticar/deformar a imagem.
function CropResultPreview({ imageSrc, crop, maxWidth, className }: { imageSrc: string; crop: CropRect; maxWidth: number; className?: string }) {
  const [aspect, setAspect] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    setAspect(null);
    loadImageEl(imageSrc).then(img => { if (!cancelled) setAspect(img.naturalWidth / img.naturalHeight); }).catch(() => {});
    return () => { cancelled = true; };
  }, [imageSrc]);

  if (!aspect) {
    return <div className={`rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse ${className || ''}`} style={{ width: maxWidth, height: maxWidth * 0.6 }} />;
  }
  const bgW = maxWidth / crop.w;
  const bgH = bgW / aspect;
  const h = crop.h * bgH;
  return (
    <div
      className={`bg-white ${className || ''}`}
      style={{
        width: maxWidth, height: h,
        backgroundImage: `url(${imageSrc})`,
        backgroundSize: `${bgW}px ${bgH}px`,
        backgroundPosition: `${-(crop.x * bgW)}px ${-(crop.y * bgH)}px`,
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}

// Como a região recortada é encaixada no retângulo da etiqueta, quando a proporção do recorte
// não bate exatamente com a da etiqueta: "contain" mostra a página inteira (pode sobrar borda
// branca), "cover" preenche a etiqueta inteira sem borda (pode cortar um pouco além do recorte
// já feito). Mesma ideia de CSS object-fit — sem isso, o recorte SEMPRE esticava pra preencher,
// distorcendo o conteúdo quando a proporção não batia.
export type FitMode = 'contain' | 'cover';

export interface CroppedPage { dataUrl: string; crop: CropRect; fitMode: FitMode; }

interface PdfPageSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  pages: string[]; // PNG dataURLs, uma por página, em ordem
  widthMm: number;
  heightMm: number;
  onConfirm: (items: CroppedPage[]) => void;
  /** Desliga o recorte separado ímpar/par (toggle + atalhos "manter só ímpares/pares") — usado
   * pelo fluxo da Lista de Separação, onde as páginas do PDF são só a tabela paginada, não
   * frente/verso alternado como nas etiquetas importadas de transportadora. Default ligado, pra
   * não mudar o fluxo geral de Importar PDF. */
  allowOddEven?: boolean;
}

// Miniaturas leves pra grade de páginas — `pages` vem do pdf.js renderizado a `scale: 3`
// (megapixels por página, pro recorte ter precisão), mas exibir isso direto num <img> de 80px
// de altura força o WebView a decodificar/compor bitmaps enormes o tempo todo, inclusive
// durante o scroll (é isso que engasgava a rolagem com PDFs de muitas páginas, ex.: 20). Aqui
// reduz cada página UMA VEZ pra ~200px de largura em JPEG (bem mais leve que o PNG original) —
// só pra exibição da grade; o recorte em si continua usando `pages` (resolução cheia).
const THUMB_WIDTH = 200;
function downsampleToThumb(src: string): Promise<string> {
  return loadImageEl(src).then(img => {
    const scale = THUMB_WIDTH / img.naturalWidth;
    const canvas = document.createElement('canvas');
    canvas.width = THUMB_WIDTH;
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.72);
  });
}

// Margem deixada em volta do conteúdo detectado (ver `detectContentBox`) — física, em mm, não
// em pixels, senão viraria maior ou menor à toa dependendo da resolução de rasterização do PDF.
// Pedido explícito do usuário: ~0,5cm abaixo do código de barras (aplicado nos 4 lados por
// simplicidade e consistência, não só embaixo).
const CONTENT_MARGIN_MM = 5;

// mm físicos → fração da imagem renderizada, na MESMA escala usada por `renderAllPdfPages`
// (ver PDF_RENDER_SCALE) — 1 ponto PDF = 25.4/72 mm, e o pdf.js rasteriza a `scale` pontos por
// pixel, então pixels = mm * (72 * scale) / 25.4.
function mmToFraction(marginMm: number, naturalPx: number): number {
  const marginPx = (marginMm * 72 * PDF_RENDER_SCALE) / 25.4;
  return marginPx / naturalPx;
}

// Acha a caixa (em frações 0..1 da página) que envolve o conteúdo de verdade (texto, código de
// barras, QR) ignorando a margem/área em branco ao redor — muitas etiquetas de transportadora
// vêm numa página A4 com o bloco útil só numa parte dela, e "ajustar à etiqueta" sem detectar
// isso só recortava pela proporção em torno do CENTRO da página inteira, quase não cortando
// nada quando a folha já era proporcionalmente parecida com a etiqueta (mesmo sobrando bastante
// área em branco por baixo do bloco de verdade). Escaneia numa versão pequena (rápido, a
// posição em frações não depende da resolução) procurando pixels que não sejam quase-brancos.
// Não força a proporção da etiqueta — quem cuida de encaixar/preencher sem distorcer é o
// "Ajuste ao tamanho da etiqueta" (Conter/Cobrir) na hora de desenhar.
async function detectContentBox(imageSrc: string): Promise<CropRect | null> {
  const img = await loadImageEl(imageSrc);
  const scanW = 300;
  const scanH = Math.max(1, Math.round(img.naturalHeight * (scanW / img.naturalWidth)));
  const canvas = document.createElement('canvas');
  canvas.width = scanW;
  canvas.height = scanH;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, scanW, scanH);
  ctx.drawImage(img, 0, 0, scanW, scanH);
  const { data } = ctx.getImageData(0, 0, scanW, scanH);
  const WHITE_THRESHOLD = 246; // quase-branco (folha/margem) — abaixo disso conta como conteúdo
  let minX = scanW, minY = scanH, maxX = -1, maxY = -1;
  for (let y = 0; y < scanH; y++) {
    for (let x = 0; x < scanW; x++) {
      const i = (y * scanW + x) * 4;
      if (data[i] < WHITE_THRESHOLD || data[i + 1] < WHITE_THRESHOLD || data[i + 2] < WHITE_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // nada detectado (página em branco)
  const padX = mmToFraction(CONTENT_MARGIN_MM, img.naturalWidth);
  const padY = mmToFraction(CONTENT_MARGIN_MM, img.naturalHeight);
  const x = Math.max(0, minX / scanW - padX);
  const y = Math.max(0, minY / scanH - padY);
  const w = Math.min(1 - x, (maxX - minX) / scanW + padX * 2);
  const h = Math.min(1 - y, (maxY - minY) / scanH + padY * 2);
  return { x, y, w, h };
}

type CropGroup = 'all' | 'odd' | 'even';

// Preset de configuração de recorte salvo pelo usuário — pra não ter que refazer todo o ajuste
// (recorte único/ímpar-par, cada recorte, conter/cobrir) toda vez que importa um PDF do mesmo
// modelo (ex.: sempre a mesma etiqueta de uma transportadora/marketplace). Fica salvo local no
// aparelho (não é um catálogo compartilhado como os tamanhos de etiqueta) — não inclui recortes
// manuais por página específica, já que esses dependem da posição exata dentro de UM PDF.
const CROP_PRESETS_KEY = 'labelCropPresets';
interface CropPreset {
  id: string;
  name: string;
  splitOddEven: boolean;
  groupCrops: Record<CropGroup, CropRect>;
  fitMode: FitMode;
  // Qual atalho (Página inteira/Recorte central/Ajustar à etiqueta) gerou o recorte salvo —
  // guardado só pra reconstituir o destaque visual certo ao reaplicar o preset.
  cropPresetSource: 'full' | 'center' | 'fit' | null;
}
function readCropPresets(): CropPreset[] {
  try {
    const raw = localStorage.getItem(CROP_PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function writeCropPresets(presets: CropPreset[]) {
  try {
    localStorage.setItem(CROP_PRESETS_KEY, JSON.stringify(presets));
  } catch {
    /* localStorage indisponível — preset simplesmente não persiste, sem quebrar a tela */
  }
}

/** PDF de várias páginas importado como etiqueta, em duas etapas:
 * 1) Selecionar Páginas — escolhe quais páginas do PDF viram etiqueta (clique ou visualizador).
 * 2) Recortar — desenha um recorte (crop) ajustável, com alças nos 4 cantos, sobre a página de
 *    referência. Pode ser um recorte único pra todas, ou um recorte diferente pra páginas
 *    ímpares e outro pra pares (replicado em cada grupo). Cada página também pode ganhar um
 *    recorte manual próprio pelo visualizador (sobrepõe o recorte do grupo só pra ela). */
export default function PdfPageSelectModal({
  isOpen, onClose, isDarkMode, pages, widthMm, heightMm, onConfirm, allowOddEven = true,
}: PdfPageSelectModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(pages.map((_, i) => i)));
  // Qual atalho (Todas/Nenhuma/Ímpares/Pares) foi clicado por último — feedback visual de
  // qual opção está "marcada" (o tamanho de `selected` sozinho não diferencia "Nenhuma" de
  // "Só pares com uma página só", por exemplo). Some quando o usuário mexe manualmente numa
  // miniatura, já que aí nenhum atalho descreve mais o estado exato da seleção.
  const [lastSelectAction, setLastSelectAction] = useState<'all' | 'none' | 'odd' | 'even' | null>('all');
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [viewerCropMode, setViewerCropMode] = useState(false);
  const [viewerCrop, setViewerCrop] = useState<CropRect>(FULL_CROP);
  // Feedback visual (qual dos 3 atalhos — Página inteira/Recorte central/Ajustar à etiqueta —
  // foi clicado por último) nos dois editores de recorte (principal e o do visualizador de
  // página); some ao arrastar manualmente (ver `setEditingCropManual`/`setViewerCropManual`).
  const [lastCropPreset, setLastCropPreset] = useState<'full' | 'center' | 'fit' | null>(null);
  const [lastViewerCropPreset, setLastViewerCropPreset] = useState<'full' | 'center' | 'fit' | null>(null);

  const [splitOddEven, setSplitOddEven] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CropGroup>('all');
  const [groupCrops, setGroupCrops] = useState<Record<CropGroup, CropRect>>({ all: FULL_CROP, odd: FULL_CROP, even: FULL_CROP });
  const [pageOverrides, setPageOverrides] = useState<Record<number, CropRect>>({});
  // Quais grupos (all/odd/even) o usuário já bateu o martelo "esse recorte está bom" — só
  // feedback visual/confiança, o recorte já vale mesmo sem confirmar (é aplicado ao vivo);
  // isso aqui não bloqueia nada, só sinaliza "revisado".
  const [confirmedGroups, setConfirmedGroups] = useState<Set<CropGroup>>(new Set());
  // Qual página mostrar como referência no editor de recorte — por padrão a 1ª do grupo, mas
  // pode ser trocada (ver botões Anterior/Próxima) pra ajustar olhando outra página, já que
  // o problema pode não aparecer logo na primeira (ex.: só a 2ª página precisa de ajuste fino).
  const [manualRefIndex, setManualRefIndex] = useState<number | null>(null);
  // Alterna o editor principal entre "recorte do grupo" (all/odd/even, replicado) e "recorte só
  // desta página" (grava em pageOverrides) — evita ter que sair pro visualizador/lupa só pra
  // ajustar uma página específica; navegar com Anterior/Próxima enquanto isso está ligado deixa
  // ajustar página por página em sequência.
  const [pageSpecificMode, setPageSpecificMode] = useState(false);
  // Como o recorte final entra na etiqueta quando a proporção não bate exatamente — "contain"
  // (mostra tudo, pode sobrar borda branca) é o padrão porque NUNCA corta além do que o usuário
  // já ajustou no recorte; "cover" (preenche, pode cortar um pouco além) já cortou cantos/letras
  // por causa dessa margem extra, mesmo com o recorte em si estando correto.
  const [fitMode, setFitMode] = useState<FitMode>('contain');
  // Acordeão de seleção de páginas fica fechado por padrão — a escolha já foi feita no passo 1,
  // então o foco natural do passo 2 é o recorte; abre só quem quiser reajustar a seleção aqui.
  const [pagesExpanded, setPagesExpanded] = useState(false);
  // A área de visualização/ajuste do recorte (arrastar, alças) vive num popup à parte — todas
  // as OPÇÕES que influenciam o recorte (grupo, página específica, presets, conter/cobrir)
  // ficam juntas no card principal, fora do popup.
  const [showCropPopup, setShowCropPopup] = useState(false);
  const [cropPresets, setCropPresets] = useState<CropPreset[]>(() => readCropPresets());
  const [showSavePresetForm, setShowSavePresetForm] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');
  // Feedback visual (qual preset foi aplicado por último) — some assim que qualquer opção de
  // recorte muda manualmente depois, senão ficaria marcado "aplicado" pra uma config que já
  // não bate mais com o preset salvo.
  const [appliedPresetId, setAppliedPresetId] = useState<string | null>(null);

  // No passo 1, depois de aplicar um preset, pergunta se o usuário quer pular direto pra
  // impressão (o preset já traz recorte pronto, não precisa nem passar pela tela de recorte)
  // ou conferir/ajustar antes — guarda o preset aplicado só pra saber que o popup deve aparecer.
  const [presetActionPopup, setPresetActionPopup] = useState<CropPreset | null>(null);

  const applyCropPreset = (p: CropPreset) => {
    setSplitOddEven(p.splitOddEven);
    setGroupCrops(p.groupCrops);
    setFitMode(p.fitMode);
    setEditingGroup('all');
    setConfirmedGroups(new Set());
    setLastCropPreset(p.cropPresetSource ?? null); // presets salvos antes desse campo existir
    setAppliedPresetId(p.id);
    toast.show(`Preset "${p.name}" aplicado!`);
  };

  const handlePresetFromStep1 = (p: CropPreset) => {
    applyCropPreset(p);
    setPresetActionPopup(p);
  };

  const handleGoToPrintWithPreset = () => {
    setPresetActionPopup(null);
    onConfirm(selectedIndexes.map(i => ({ dataUrl: pages[i], crop: resolveCropForIndex(i), fitMode })));
  };

  const handleGoToConfigWithPreset = () => {
    setPresetActionPopup(null);
    setStep(2);
  };

  const handleSaveCropPreset = () => {
    const name = presetNameInput.trim();
    if (!name) {
      toast.show('Dê um nome ao preset antes de salvar.');
      return;
    }
    const preset: CropPreset = { id: `preset_${Date.now()}`, name, splitOddEven, groupCrops, fitMode, cropPresetSource: lastCropPreset };
    setCropPresets(prev => {
      const next = [...prev, preset];
      writeCropPresets(next);
      return next;
    });
    setPresetNameInput('');
    setShowSavePresetForm(false);
    toast.show('Preset salvo!');
  };

  const handleDeleteCropPreset = (id: string) => {
    setCropPresets(prev => {
      const next = prev.filter(p => p.id !== id);
      writeCropPresets(next);
      return next;
    });
  };

  // Gera as miniaturas leves (ver `downsampleToThumb`) uma vez por PDF importado — em paralelo,
  // preenchendo a grade assim que cada uma fica pronta. Enquanto uma miniatura ainda não
  // terminou, a grade cai pro `pages[idx]` original (só aquele item específico fica pesado até
  // a miniatura chegar, não a lista toda).
  const [thumbPages, setThumbPages] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    setThumbPages([]);
    pages.forEach((p, idx) => {
      downsampleToThumb(p).then(thumb => {
        if (cancelled) return;
        setThumbPages(prev => {
          const next = prev.length === pages.length ? [...prev] : new Array(pages.length).fill('');
          next[idx] = thumb;
          return next;
        });
      }).catch(() => { /* falhou a miniatura — renderThumb cai pro original */ });
    });
    return () => { cancelled = true; };
  }, [pages]);

  // Reseta tudo quando a modal abre com um PDF DE VERDADE novo — não a cada reabertura. Sem o
  // `lastResetPagesRef`, voltar da prévia de impressão pra cá (mesmo `pages`, só reabrindo)
  // apagava toda a seleção/recorte já feito, obrigando a refazer tudo do zero.
  const lastResetPagesRef = useRef<string[] | null>(null);
  useEffect(() => {
    if (isOpen && lastResetPagesRef.current !== pages) {
      lastResetPagesRef.current = pages;
      setStep(1);
      setSelected(new Set(pages.map((_, i) => i)));
      setLastSelectAction('all');
      setSplitOddEven(false);
      setEditingGroup('all');
      setGroupCrops({ all: FULL_CROP, odd: FULL_CROP, even: FULL_CROP });
      setPageOverrides({});
      setConfirmedGroups(new Set());
      setPageSpecificMode(false);
      setFitMode('contain');
      setAppliedPresetId(null);
    }
  }, [isOpen, pages]);

  // Se o fluxo que abriu esta modal desliga ímpar/par (ver `allowOddEven`), garante que nenhum
  // recorte separado fique "preso" ativo — trata como se sempre fosse "mesmo recorte pra todas".
  useEffect(() => {
    if (!allowOddEven && splitOddEven) setSplitOddEven(false);
  }, [allowOddEven, splitOddEven]);

  const toggle = (idx: number) => {
    setLastSelectAction(null);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const quickCls = (active: boolean) =>
    `flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
      active ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
    }`;

  const selectedIndexes = Array.from(selected).sort((a, b) => a - b);

  // Resolve o recorte "efetivo" de uma página: override manual dela > recorte do grupo
  // (ímpar/par) se separado > recorte único.
  const resolveCropForIndex = (idx: number): CropRect => {
    if (pageOverrides[idx]) return pageOverrides[idx];
    if (splitOddEven) return idx % 2 === 0 ? groupCrops.odd : groupCrops.even;
    return groupCrops.all;
  };

  // Páginas do grupo sendo editado (só ímpares, só pares, ou todas as selecionadas) — a
  // referência mostrada no editor pode ser qualquer uma dessas, não só a primeira.
  const groupIndexes = splitOddEven
    ? selectedIndexes.filter(i => (i % 2 === 0) === (editingGroup === 'odd')) // "ímpar" (1-indexed) = índice par (0-based)
    : selectedIndexes;
  const referenceIndex = (manualRefIndex !== null && groupIndexes.includes(manualRefIndex)) ? manualRefIndex : groupIndexes[0];
  const referencePage = referenceIndex !== undefined ? pages[referenceIndex] : null;
  const refPos = referenceIndex !== undefined ? groupIndexes.indexOf(referenceIndex) : -1;

  const activeGroupKey: CropGroup = splitOddEven ? editingGroup : 'all';
  const activeCrop = groupCrops[activeGroupKey];
  const setActiveCrop = (c: CropRect) => {
    setGroupCrops(prev => ({ ...prev, [activeGroupKey]: c }));
    // Qualquer ajuste depois de confirmado invalida a confirmação — evita mostrar "confirmado"
    // pra um recorte que já mudou de novo.
    setConfirmedGroups(prev => { if (!prev.has(activeGroupKey)) return prev; const next = new Set(prev); next.delete(activeGroupKey); return next; });
  };
  const isActiveGroupConfirmed = confirmedGroups.has(activeGroupKey);

  // Recorte efetivamente editado no CropEditor principal: se "recorte só desta página" está
  // ligado, edita o override daquela página (partindo do recorte do grupo, se ainda não tem
  // um manual); senão edita o recorte do grupo, como sempre.
  const hasPageOverride = referenceIndex !== undefined && !!pageOverrides[referenceIndex];
  const editingCrop = (pageSpecificMode && referenceIndex !== undefined)
    ? (pageOverrides[referenceIndex] ?? activeCrop)
    : activeCrop;
  const setEditingCrop = (c: CropRect) => {
    if (pageSpecificMode && referenceIndex !== undefined) {
      setPageOverrides(prev => ({ ...prev, [referenceIndex]: c }));
    } else {
      setActiveCrop(c);
      // Além de guardar em `groupCrops` (usado pelo indicador "confirmado" e ao salvar preset),
      // grava o MESMO recorte como override explícito em cada página do grupo sendo editado.
      // `resolveCropForIndex` sempre confere override de página primeiro — é o caminho já
      // comprovado que chega certinho até a etiqueta final; sem isso, o recorte "de grupo"
      // dependia só de `groupCrops` e podia não pegar na hora de gerar o arquivo.
      setPageOverrides(prev => {
        const next = { ...prev };
        groupIndexes.forEach(i => { next[i] = c; });
        return next;
      });
    }
  };
  // Arrastar o recorte manualmente (alças/mover) não é nenhum dos 3 atalhos — some o
  // destaque, senão um atalho ficaria marcado "ativo" mesmo depois do usuário mexer à mão.
  const setEditingCropManual = (c: CropRect) => { setLastCropPreset(null); setAppliedPresetId(null); setEditingCrop(c); };

  // Detecta o bloco de conteúdo de verdade (ver `detectContentBox`) e usa ele como recorte —
  // aplicado ao grupo (ou à página específica, se `pageSpecificMode` estiver ligado), então
  // "ajustar à etiqueta" no recorte único (não separado ímpar/par) já vale pra TODAS as páginas
  // selecionadas de uma vez. Não força a proporção da etiqueta no recorte em si — se não bater
  // exatamente, quem resolve sem distorcer é o Conter/Cobrir na hora de desenhar.
  const applyFitToLabel = async (imageSrc: string, setCrop: (c: CropRect) => void) => {
    try {
      const contentBox = await detectContentBox(imageSrc);
      setCrop(contentBox || FULL_CROP);
    } catch (err: any) {
      toast.show('Erro ao ajustar à etiqueta: ' + (err?.message || err));
    }
  };

  const renderThumb = (idx: number) => {
    const isSel = selected.has(idx);
    const hasOverride = !!pageOverrides[idx];
    return (
      <div
        key={idx}
        className={`relative rounded-xl overflow-hidden border-2 transition-all ${
          isSel ? 'border-indigo-500' : isDarkMode ? 'border-slate-800' : 'border-slate-200'
        }`}
      >
        <button type="button" onClick={() => toggle(idx)} className="block w-full">
          <img src={thumbPages[idx] || pages[idx]} alt={`Página ${idx + 1}`} className="w-full h-20 object-contain bg-white" />
          <div className={`text-[8px] font-black text-center py-0.5 ${isDarkMode ? 'bg-slate-900/80 text-slate-300' : 'bg-white/90 text-slate-600'}`}>
            Pág. {idx + 1} · <span className={idx % 2 === 0 ? 'text-indigo-400' : 'text-amber-500'}>{idx % 2 === 0 ? 'Í' : 'P'}</span>
          </div>
        </button>
        {isSel && (
          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center pointer-events-none">
            <Check size={10} className="text-white" strokeWidth={3} />
          </div>
        )}
        {hasOverride && (
          <div className="absolute bottom-6 right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center pointer-events-none" title="Recorte manual">
            <Scissors size={9} className="text-white" />
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            setViewingIndex(idx);
            setViewerCropMode(false);
            setViewerCrop(resolveCropForIndex(idx));
            setLastViewerCropPreset(null);
          }}
          title="Ampliar página"
          className="absolute top-1 left-1 w-5 h-5 rounded-full bg-slate-900/70 flex items-center justify-center"
        >
          <Maximize2 size={10} className="text-white" />
        </button>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={step === 1 ? 'Selecionar Páginas' : 'Recortar Etiqueta'}
      icon={step === 1 ? <FileStack size={20} /> : <Crop size={20} />}
      maxWidth="max-w-md"
      zIndex={97000}
    >
      <div className="flex flex-col gap-4">
        {step === 1 ? (
          <>
            <p className="text-[10px] font-bold text-center text-slate-400 uppercase tracking-widest">
              {pages.length} página(s) no PDF — marque as que você quer importar
            </p>

            {/* Presets de recorte já aplicáveis aqui — quem já sabe qual configuração vai usar
                (ex.: sempre a mesma etiqueta de uma transportadora) nem precisa passar pelo
                passo de recorte pra escolher: aplica de cara e segue direto pro "Próximo". */}
            {cropPresets.length > 0 && (
              <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-gradient-to-b from-amber-500 to-amber-600 border-b-[3px] border-amber-700 shadow-[0_6px_16px_-4px_rgba(217,119,6,0.45)]">
                <span className="text-[9px] font-black uppercase tracking-widest text-white">Usar preset de recorte salvo</span>
                <span className="text-[9px] font-bold text-white/80 normal-case -mt-1">Clique aqui para escolher um preset</span>
                <div className="flex flex-wrap gap-1.5">
                  {cropPresets.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePresetFromStep1(p)}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        appliedPresetId === p.id ? 'bg-emerald-500 text-white' : 'bg-white text-amber-600 hover:bg-amber-50 animate-pulse'
                      }`}
                    >
                      {appliedPresetId === p.id && <Check size={11} className="inline mr-1 -mt-0.5" />}
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
              {pages.map((_, idx) => renderThumb(idx))}
            </div>

            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => setStep(2)}
              className="flex items-center justify-center gap-2 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40"
            >
              Próximo — {selected.size} selecionada(s)
            </button>
          </>
        ) : (
          <>
            {/* Acordeão — Seleção de páginas: agrupa TUDO relacionado a "quais páginas" (atalhos
                + grade de miniaturas), separado do card de recorte pra não misturar as duas
                decisões. Já veio escolhido no passo 1, então fica fechado por padrão. */}
            <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
              <button type="button" onClick={() => setPagesExpanded(v => !v)} className="w-full flex items-center justify-between gap-2 p-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-rose-500">Seleção de páginas</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-indigo-500">{selectedIndexes.length} de {pages.length}</span>
                  {pagesExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </button>
              {pagesExpanded && (
                <div className="flex flex-col gap-2 p-3 pt-0">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button type="button" onClick={() => { setLastSelectAction('all'); setSelected(new Set(pages.map((_, i) => i))); }} className={quickCls(lastSelectAction === 'all')}>
                      Todas
                    </button>
                    <button type="button" onClick={() => { setLastSelectAction('none'); setSelected(new Set()); }} className={quickCls(lastSelectAction === 'none')}>
                      Nenhuma
                    </button>
                    {allowOddEven && (
                      <>
                        <button type="button" onClick={() => { setLastSelectAction('odd'); setSelected(prev => new Set(Array.from(prev).filter(i => i % 2 === 0))); }} className={quickCls(lastSelectAction === 'odd')}>
                          Manter só ímpares
                        </button>
                        <button type="button" onClick={() => { setLastSelectAction('even'); setSelected(prev => new Set(Array.from(prev).filter(i => i % 2 === 1))); }} className={quickCls(lastSelectAction === 'even')}>
                          Manter só pares
                        </button>
                      </>
                    )}
                  </div>

                  <p className="text-[9px] font-bold text-center text-slate-400">
                    Etiquetas com <Scissors size={9} className="inline text-amber-500" /> âmbar têm recorte manual próprio (ajuste pelo visualizador, ícone de lupa)
                  </p>

                  <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto">
                    {selectedIndexes.length > 0
                      ? selectedIndexes.map(idx => renderThumb(idx))
                      : <p className="col-span-3 text-center text-[10px] font-bold text-slate-400 py-4">Nenhuma página selecionada.</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Card único — Recorte: TODAS as opções que influenciam o recorte juntas (grupo,
                navegação, recorte específico por página, presets, ajuste ao tamanho). A
                visualização/ajuste em si (arrastar, alças) fica num popup à parte, aberto pelo
                botão "Abrir área de recorte" abaixo — só o que decide COMO recortar fica aqui. */}
            <div className={`flex flex-col gap-2 p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
              <span className="text-[9px] font-black uppercase tracking-widest text-rose-500">Recorte</span>

              {allowOddEven && (
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => { setAppliedPresetId(null); setSplitOddEven(false); }} className={quickCls(!splitOddEven)}>
                    Mesmo recorte pra todas
                  </button>
                  <button type="button" onClick={() => { setAppliedPresetId(null); setSplitOddEven(true); }} className={quickCls(splitOddEven)}>
                    Recorte diferente ímpar/par
                  </button>
                </div>
              )}
              {allowOddEven && splitOddEven && (
                <>
                  <span className="text-[8px] font-black uppercase tracking-widest text-rose-500">Lado sendo editado</span>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => setEditingGroup('odd')} className={quickCls(editingGroup === 'odd')}>
                      Editando: Ímpares
                    </button>
                    <button type="button" onClick={() => setEditingGroup('even')} className={quickCls(editingGroup === 'even')}>
                      Editando: Pares
                    </button>
                  </div>
                </>
              )}

              {referencePage ? (
                <>
                  {groupIndexes.length > 1 && (
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={refPos <= 0}
                        onClick={() => setManualRefIndex(groupIndexes[refPos - 1])}
                        className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest disabled:opacity-30 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                      >
                        <ChevronLeft size={13} /> Anterior
                      </button>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        Vendo pág. {referenceIndex! + 1} ({refPos + 1}/{groupIndexes.length})
                      </span>
                      <button
                        type="button"
                        disabled={refPos >= groupIndexes.length - 1}
                        onClick={() => setManualRefIndex(groupIndexes[refPos + 1])}
                        className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest disabled:opacity-30 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                      >
                        Próxima <ChevronRight size={13} />
                      </button>
                    </div>
                  )}

                  {/* Miniatura da página de referência (a que "Vendo pág." mostra) — já mostra
                      SÓ a área recortada (o resultado de verdade), atualiza na hora com
                      qualquer preset/ajuste. Botão de lupa expande pro popup; X fecha ele. */}
                  <div className="relative mx-auto rounded-xl overflow-hidden border-2 border-indigo-300 dark:border-indigo-700" style={{ width: 220 }}>
                    {/* Resolução cheia aqui — a miniatura leve (thumbPages) é só pra grade com
                        até dezenas de páginas ao mesmo tempo; essa prévia é uma imagem só, sem
                        risco de travar o scroll, e o usuário precisa ver detalhe (texto/código
                        de barras) com nitidez. */}
                    <CropResultPreview imageSrc={referencePage} crop={editingCrop} maxWidth={220} />
                    <button
                      type="button"
                      onClick={() => setShowCropPopup(true)}
                      title="Expandir miniatura"
                      className="absolute top-1 left-1 w-6 h-6 rounded-full bg-slate-900/70 flex items-center justify-center"
                    >
                      <Maximize2 size={12} className="text-white" />
                    </button>
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-slate-900/70 text-white text-[8px] font-black uppercase tracking-widest">
                      Pág. {referenceIndex! + 1} · <span className={referenceIndex! % 2 === 0 ? 'text-indigo-300' : 'text-amber-300'}>{referenceIndex! % 2 === 0 ? 'Ímpar' : 'Par'}</span>
                    </span>
                  </div>

                  {/* Recorte específico por página — liga um modo em que o editor (no popup)
                      passa a ajustar só a página que está sendo vista (não o grupo inteiro). Dá
                      pra navegar com Anterior/Próxima com o modo ligado pra ajustar página por
                      página, sem precisar abrir o visualizador separado. */}
                  <div className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border ${isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <span className="text-[9px] font-black uppercase tracking-widest text-rose-500">
                      {pageSpecificMode ? `Editando só a pág. ${referenceIndex! + 1}` : 'Recorte específico por página'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPageSpecificMode(v => !v)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all shrink-0 ${
                        pageSpecificMode ? 'bg-amber-500 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Scissors size={11} /> {pageSpecificMode ? 'Ligado' : 'Ligar'}
                    </button>
                  </div>
                  {pageSpecificMode && hasPageOverride && (
                    <button
                      type="button"
                      onClick={() => setPageOverrides(prev => { const next = { ...prev }; delete next[referenceIndex!]; return next; })}
                      className={`flex items-center justify-center gap-2 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                    >
                      <RotateCcw size={12} /> Remover recorte desta página (usar o do grupo)
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowCropPopup(true)}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white"
                  >
                    <Crop size={14} /> Abrir área de recorte
                  </button>

                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => { setLastCropPreset('full'); setAppliedPresetId(null); setEditingCrop(FULL_CROP); }} className={quickCls(lastCropPreset === 'full')}>
                      Página inteira
                    </button>
                    <button type="button" onClick={() => { setLastCropPreset('center'); setAppliedPresetId(null); setEditingCrop(CENTER_CROP); }} className={quickCls(lastCropPreset === 'center')}>
                      Recorte central
                    </button>
                    <button
                      type="button"
                      onClick={() => { setLastCropPreset('fit'); setAppliedPresetId(null); applyFitToLabel(referencePage, setEditingCrop); }}
                      className={quickCls(lastCropPreset === 'fit')}
                    >
                      Ajustar à etiqueta
                    </button>
                  </div>

                  {/* Ajuste ao tamanho da etiqueta — vale pra TODAS as páginas do lote de uma
                      vez. Só entra em jogo quando o recorte escolhido não tem exatamente a
                      proporção da etiqueta — antes disso ser esticado sempre, distorcendo o
                      conteúdo quando não batia. */}
                  <div className={`flex flex-col gap-1.5 pt-2 mt-1 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                    <span className="text-[8px] font-black uppercase tracking-widest text-rose-500">Ajuste ao tamanho da etiqueta</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => { setAppliedPresetId(null); setFitMode('contain'); }}
                        className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                          fitMode === 'contain' ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        Conter
                        <span className="text-[7px] font-bold opacity-70 normal-case">mostra a página inteira</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAppliedPresetId(null); setFitMode('cover'); }}
                        className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                          fitMode === 'cover' ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        Cobrir
                        <span className="text-[7px] font-bold opacity-70 normal-case">preenche, pode cortar</span>
                      </button>
                    </div>
                  </div>

                  {/* Presets de recorte — salva a "receita" (recorte único/ímpar-par + conter/
                      cobrir) pra reaplicar de cara da próxima vez que importar um PDF do mesmo
                      modelo (ex.: sempre a etiqueta de uma mesma transportadora), sem refazer
                      tudo. Não guarda recortes manuais por página (esses são específicos de UM
                      PDF já importado, não fazem sentido reaplicados noutro). */}
                  <div className={`flex flex-col gap-1.5 pt-2 mt-1 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                    <span className="text-[8px] font-black uppercase tracking-widest text-rose-500">Presets de recorte salvos</span>
                    {cropPresets.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        {cropPresets.map(p => {
                          const isApplied = appliedPresetId === p.id;
                          return (
                            <div
                              key={p.id}
                              className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${
                                isApplied
                                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                  : isDarkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-white'
                              }`}
                            >
                              <button type="button" onClick={() => applyCropPreset(p)} className="flex-1 flex items-center gap-1.5 text-left text-xs font-bold truncate">
                                {isApplied && <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />}
                                <span className={`truncate ${isApplied ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>{p.name}</span>
                              </button>
                              <button type="button" onClick={() => handleDeleteCropPreset(p.id)} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 shrink-0">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {showSavePresetForm ? (
                      <div className="flex gap-2">
                        <input
                          value={presetNameInput}
                          onChange={e => setPresetNameInput(e.target.value)}
                          placeholder="Nome do preset (ex: Shopee)"
                          autoFocus
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold outline-none ${isDarkMode ? 'bg-slate-800 text-white placeholder:text-slate-500' : 'bg-white text-slate-900 placeholder:text-slate-400'}`}
                        />
                        <button type="button" onClick={handleSaveCropPreset} className="p-2.5 rounded-lg bg-indigo-600 text-white shrink-0"><Check size={14} /></button>
                        <button type="button" onClick={() => { setShowSavePresetForm(false); setPresetNameInput(''); }} className={`p-2.5 rounded-lg shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}><X size={14} /></button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowSavePresetForm(true)}
                        className={`flex items-center justify-center gap-2 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                      >
                        <Save size={12} /> Salvar recorte atual como preset
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-center text-[10px] font-bold text-slate-400 py-4">Selecione ao menos uma página pra recortar.</p>
              )}
            </div>

            {/* Confirmar recorte — abaixo do card, como fechamento da etapa de recorte. */}
            {referencePage && (
              pageSpecificMode ? (
                <p className="text-center text-[9px] font-bold text-slate-400">
                  Recorte manual desta página — já aplicado, sem precisar confirmar.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmedGroups(prev => new Set(prev).add(activeGroupKey));
                    toast.show(splitOddEven ? `Recorte para ${editingGroup === 'odd' ? 'ímpares' : 'pares'} confirmado!` : 'Recorte confirmado!');
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    isActiveGroupConfirmed ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white'
                  }`}
                >
                  <CheckCircle2 size={14} /> {isActiveGroupConfirmed ? 'Recorte confirmado' : 'Confirmar recorte'}
                </button>
              )
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`px-4 flex items-center justify-center gap-1.5 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
              >
                <ChevronLeft size={16} /> Voltar
              </button>
              <button
                type="button"
                disabled={selected.size === 0}
                onClick={() => onConfirm(selectedIndexes.map(i => ({ dataUrl: pages[i], crop: resolveCropForIndex(i), fitMode })))}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40"
              >
                Importar {selected.size} página(s)
              </button>
            </div>
          </>
        )}
      </div>

      {/* Popup — área de visualização/ajuste do recorte (arrastar, alças) da página de
          referência. Todas as opções que decidem COMO recortar ficam no card "Recorte", fora
          daqui — este popup só mostra a imagem e deixa ajustar a caixa. */}
      {showCropPopup && referencePage && (
        <Modal isOpen onClose={() => setShowCropPopup(false)} title="Área de Recorte" icon={<Crop size={20} />} maxWidth="max-w-md" zIndex={98000}>
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-bold text-center text-slate-400 uppercase tracking-widest">
              Arraste pra mover, use os cantos pra redimensionar
            </p>
            <CropEditor imageSrc={referencePage} crop={editingCrop} onChangeCrop={setEditingCropManual} isDarkMode={isDarkMode} />

            {/* Prévia do resultado — só a área recortada, atualiza ao vivo enquanto arrasta. */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Prévia do resultado</span>
              <CropResultPreview imageSrc={referencePage} crop={editingCrop} maxWidth={220} className="rounded-xl border-2 border-indigo-300 dark:border-indigo-700" />
            </div>

            <button
              type="button"
              onClick={() => setShowCropPopup(false)}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-indigo-600 text-white"
            >
              <Check size={16} /> Concluir
            </button>
          </div>
        </Modal>
      )}

      {/* Depois de aplicar um preset ainda no passo 1 — pergunta se pula direto pra impressão
          (o preset já traz o recorte pronto) ou se quer conferir/ajustar na tela de recorte. */}
      {presetActionPopup && (
        <Modal isOpen onClose={() => setPresetActionPopup(null)} title="Preset Aplicado" icon={<Check size={20} />} maxWidth="max-w-sm" zIndex={99500}>
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold text-center text-slate-500 dark:text-slate-400">
              Preset "{presetActionPopup.name}" aplicado a {selectedIndexes.length} página(s). O que você quer fazer agora?
            </p>
            <button
              type="button"
              onClick={handleGoToPrintWithPreset}
              className="flex items-center justify-center gap-2 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-indigo-600 text-white"
            >
              Ir direto para a impressão
            </button>
            <button
              type="button"
              onClick={handleGoToConfigWithPreset}
              className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
            >
              Conferir/ajustar o recorte
            </button>
          </div>
        </Modal>
      )}

      {/* Visualizador em tamanho grande — abre ao ampliar uma miniatura, em qualquer passo.
          No passo 2, também permite um recorte manual só dessa página (sobrepõe o do grupo). */}
      {viewingIndex !== null && (
        <Modal isOpen onClose={() => setViewingIndex(null)} title={`Página ${viewingIndex + 1} de ${pages.length}`} maxWidth="max-w-lg" zIndex={99000}>
          <div className="flex flex-col gap-3">
            {viewerCropMode ? (
              <>
                <CropEditor imageSrc={pages[viewingIndex]} crop={viewerCrop} onChangeCrop={c => { setLastViewerCropPreset(null); setViewerCrop(c); }} isDarkMode={isDarkMode} />
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => { setLastViewerCropPreset('full'); setViewerCrop(FULL_CROP); }} className={quickCls(lastViewerCropPreset === 'full')}>Página inteira</button>
                  <button type="button" onClick={() => { setLastViewerCropPreset('center'); setViewerCrop(CENTER_CROP); }} className={quickCls(lastViewerCropPreset === 'center')}>Recorte central</button>
                  <button
                    type="button"
                    onClick={() => { setLastViewerCropPreset('fit'); if (viewingIndex !== null) applyFitToLabel(pages[viewingIndex], setViewerCrop); }}
                    className={quickCls(lastViewerCropPreset === 'fit')}
                  >
                    Ajustar à etiqueta
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { setPageOverrides(prev => ({ ...prev, [viewingIndex]: viewerCrop })); setViewerCropMode(false); }}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-indigo-600 text-white"
                >
                  <Check size={16} /> Salvar recorte desta página
                </button>
              </>
            ) : (
              <img
                src={pages[viewingIndex]}
                alt={`Página ${viewingIndex + 1}`}
                className={`w-full rounded-xl bg-white border-2 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}
              />
            )}

            {step === 2 && !viewerCropMode && (
              <button
                type="button"
                onClick={() => { setViewerCrop(resolveCropForIndex(viewingIndex)); setViewerCropMode(true); setLastViewerCropPreset(null); }}
                className="flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-amber-500 text-white"
              >
                <Scissors size={16} /> Recortar esta página
              </button>
            )}
            {step === 2 && !viewerCropMode && pageOverrides[viewingIndex] && (
              <button
                type="button"
                onClick={() => setPageOverrides(prev => { const next = { ...prev }; delete next[viewingIndex]; return next; })}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
              >
                <RotateCcw size={13} /> Usar recorte padrão (remover o manual)
              </button>
            )}
            {!viewerCropMode && (
              <button
                type="button"
                onClick={() => { toggle(viewingIndex); setViewingIndex(null); }}
                className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase tracking-widest ${
                  selected.has(viewingIndex) ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-500' : 'bg-indigo-600 text-white'
                }`}
              >
                {selected.has(viewingIndex) ? 'Remover da seleção' : 'Selecionar esta página'}
              </button>
            )}
          </div>
        </Modal>
      )}
    </Modal>
  );
}
