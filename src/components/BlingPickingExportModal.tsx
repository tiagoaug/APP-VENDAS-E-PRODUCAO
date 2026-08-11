import { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory } from '@capacitor/filesystem';
import {
  Share2, Printer, Image as ImageIcon, FileText, Layers, ImageOff, CheckSquare,
  Bluetooth, RefreshCw, CheckCircle2, XCircle, ChevronRight, ChevronDown, X, FileStack, Save,
} from 'lucide-react';
import Modal from './Modal';
import { PickingGroup, PickingFlatRow } from '../views/BlingPickingListView';
import { sharePDF, shareImage, printPickingList, PrintPickingListRow } from '../utils/pdfExport';
import {
  listAbleMarkPairedDevices, connectAbleMarkPrinter, isAbleMarkPrinterConnected, printAbleMarkLabel, AbleMarkPairedDevice,
} from '../lib/ablemarkPrinter';
import { toast } from '../utils/toast';

interface BlingPickingExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  groups: PickingGroup[];
  flatRows: PickingFlatRow[];
  checkedKeys: Set<string>;
  /** Pula direto pro popup de escolha de destino de impressão, sem passar pela tela de
   * opções — usado pelo atalho "Imprimir Lista de Separação" na tela principal. */
  startInPrintChoice?: boolean;
}

interface DisplayRow {
  reference: string;
  productName: string;
  variationName: string;
  size?: string;
  photoUrl?: string;
  quantidade: number;
  pedidos: string;
}

function ToggleRow({ icon, label, sublabel, value, onChange }: { icon: React.ReactNode; label: string; sublabel: string; value: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="w-full flex items-center gap-3 p-4 rounded-2xl border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all text-left">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black tracking-tight">{label}</p>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{sublabel}</p>
      </div>
      <div className={`w-11 h-6 rounded-full shrink-0 relative transition-colors ${value ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${value ? 'left-5' : 'left-0.5'}`} />
      </div>
    </button>
  );
}

type PageSize = 'a4' | '100x150';

const PAGE_SIZE_LABEL: Record<PageSize, string> = { a4: 'A4 (folha inteira)', '100x150': 'Etiqueta 100x150mm' };

const PROFILE_KEY = '@app:bling_picking_export_profile';

interface ExportProfile {
  agrupar: boolean;
  mostrarMiniaturas: boolean;
  incluirCheckbox: boolean;
  pageSize: PageSize;
}

const DEFAULT_PROFILE: ExportProfile = { agrupar: true, mostrarMiniaturas: true, incluirCheckbox: true, pageSize: 'a4' };

function loadExportProfile(): ExportProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    // perfil corrompido/indisponível — cai no padrão
  }
  return DEFAULT_PROFILE;
}

// 600x192 dots — mesmo tamanho já validado contra a BR-L100 (ver AblemarkPrinterTestModal.tsx).
const LABEL_W = 600;
const LABEL_H = 192;

function buildPickingLabelDataUrl(row: DisplayRow, incluirCheckbox: boolean): string {
  const canvas = document.createElement('canvas');
  canvas.width = LABEL_W;
  canvas.height = LABEL_H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, LABEL_W, LABEL_H);
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  const padX = incluirCheckbox ? 60 : 16;
  if (incluirCheckbox) {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeRect(16, 16, 32, 32);
  }

  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(`${row.reference} — ${row.variationName}`, padX, 14, LABEL_W - padX - 16);

  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(row.productName, padX, 56, LABEL_W - padX - 16);

  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(`Tam ${row.size || 'Atacado'}`, padX, 96);

  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${row.quantidade}x`, LABEL_W - 16, 96);
  ctx.textAlign = 'left';

  ctx.font = '22px sans-serif';
  ctx.fillText(`Pedidos: ${row.pedidos}`, padX, 160, LABEL_W - padX - 16);

  return canvas.toDataURL('image/png');
}

async function buildPickingListJpg(rows: DisplayRow[], mostrarMiniaturas: boolean, incluirCheckbox: boolean, pageSize: PageSize): Promise<string> {
  const compact = pageSize === '100x150';
  const rowH = compact ? 34 : 64;
  const width = compact ? 420 : 900;
  const headerH = compact ? 38 : 90;
  const thumbSize = compact ? 26 : 48;
  const checkboxSize = compact ? 14 : 24;
  const fontTitle = compact ? 'bold 13px sans-serif' : 'bold 26px sans-serif';
  const fontDate = compact ? '8px sans-serif' : '13px sans-serif';
  const fontName = compact ? 'bold 9px sans-serif' : 'bold 15px sans-serif';
  const fontSub = compact ? '7px sans-serif' : '12px sans-serif';
  const fontQty = compact ? 'bold 13px sans-serif' : 'bold 22px sans-serif';
  const height = headerH + rows.length * rowH + 20;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, headerH);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = fontTitle;
  ctx.fillText(compact ? 'Lista de Separação' : 'Lista de Separação — Pedidos Bling', width / 2, compact ? 16 : 34);
  ctx.font = fontDate;
  ctx.fillText(new Date().toLocaleString('pt-BR'), width / 2, compact ? 28 : 62);
  ctx.textAlign = 'left';

  const checkboxX = compact ? 8 : 16;
  const thumbX = incluirCheckbox ? (compact ? 26 : 56) : (compact ? 8 : 16);
  const textX = thumbX + (mostrarMiniaturas ? (compact ? 30 : 56) : 0);

  // Carrega todas as miniaturas antes de desenhar (senão a imagem pode não estar pronta na
  // hora do drawImage síncrono).
  const images = new Map<string, HTMLImageElement>();
  if (mostrarMiniaturas) {
    await Promise.all(
      rows.map(
        (r) =>
          r.photoUrl &&
          !images.has(r.photoUrl) &&
          new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => { images.set(r.photoUrl!, img); resolve(); };
            img.onerror = () => resolve();
            img.src = r.photoUrl!;
          })
      )
    );
  }

  rows.forEach((r, i) => {
    const y = headerH + i * rowH;
    ctx.fillStyle = i % 2 === 0 ? '#f8fafc' : '#ffffff';
    ctx.fillRect(0, y, width, rowH);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(0, y, width, rowH);

    if (incluirCheckbox) {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = compact ? 1 : 2;
      ctx.strokeRect(checkboxX, y + rowH / 2 - checkboxSize / 2, checkboxSize, checkboxSize);
    }

    if (mostrarMiniaturas) {
      const img = r.photoUrl ? images.get(r.photoUrl) : undefined;
      const thumbY = y + (rowH - thumbSize) / 2;
      if (img) {
        ctx.drawImage(img, thumbX, thumbY, thumbSize, thumbSize);
      } else {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize);
      }
    }

    ctx.fillStyle = '#0f172a';
    ctx.font = fontName;
    ctx.fillText(`${r.reference} · ${r.variationName}${r.size ? ` · ${r.size}` : ' · Atacado'}`, textX, y + rowH * 0.35);
    ctx.font = fontSub;
    ctx.fillStyle = '#64748b';
    ctx.fillText(`${r.productName} — Pedidos ${r.pedidos}`, textX, y + rowH * 0.7);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = fontQty;
    ctx.fillText(String(r.quantidade), width - (compact ? 8 : 20), y + rowH / 2 + (compact ? 4 : 6));
    ctx.textAlign = 'left';
  });

  return canvas.toDataURL('image/jpeg', 0.9);
}

export default function BlingPickingExportModal({ isOpen, onClose, isDarkMode, groups, flatRows, checkedKeys, startInPrintChoice }: BlingPickingExportModalProps) {
  const [savedProfile] = useState(() => loadExportProfile());
  const [agrupar, setAgrupar] = useState(savedProfile.agrupar);
  const [mostrarMiniaturas, setMostrarMiniaturas] = useState(savedProfile.mostrarMiniaturas);
  const [incluirCheckbox, setIncluirCheckbox] = useState(savedProfile.incluirCheckbox);
  const [pageSize, setPageSize] = useState<PageSize>(savedProfile.pageSize);
  const [paperOpen, setPaperOpen] = useState(false);
  const [printChoiceOpen, setPrintChoiceOpen] = useState(false);
  const [thermalOpen, setThermalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSaveProfile = () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ agrupar, mostrarMiniaturas, incluirCheckbox, pageSize }));
    toast.show('Perfil de exportação salvo — carrega automático da próxima vez.');
  };

  useEffect(() => {
    if (isOpen && startInPrintChoice) setPrintChoiceOpen(true);
    if (!isOpen) setPrintChoiceOpen(false);
  }, [isOpen, startInPrintChoice]);

  const [devices, setDevices] = useState<AbleMarkPairedDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [thermalConnected, setThermalConnected] = useState(false);

  const displayRows: DisplayRow[] = agrupar
    ? groups.map((g) => ({
        reference: g.reference,
        productName: g.productName,
        variationName: g.variationName,
        size: g.size,
        photoUrl: g.photoUrl,
        quantidade: g.totalQty,
        pedidos: Array.from(new Set(g.contributions.map((c) => c.orderNumero))).join(', '),
      }))
    : flatRows.map((r) => ({
        reference: r.reference,
        productName: r.productName,
        variationName: r.variationName,
        size: r.size,
        photoUrl: r.photoUrl,
        quantidade: r.quantidade,
        pedidos: r.orderNumero,
      }));

  const handleShareJpg = async () => {
    setBusy(true);
    try {
      const dataUrl = await buildPickingListJpg(displayRows, mostrarMiniaturas, incluirCheckbox, pageSize);
      await shareImage(dataUrl, `Lista_Separacao_${new Date().toISOString().slice(0, 10)}`);
    } catch (e: any) {
      toast.show('Erro ao gerar JPG: ' + (e.message || e));
    } finally {
      setBusy(false);
    }
  };

  const handleSharePdf = async () => {
    setBusy(true);
    try {
      const compact = pageSize === '100x150';
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: compact ? [100, 150] : 'a4' });
      const pageWidth = compact ? 100 : 210;
      const headerH = compact ? 12 : 30;

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, headerH, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(compact ? 11 : 18);
      doc.text('Lista de Separação', pageWidth / 2, compact ? 6 : 14, { align: 'center' });
      doc.setFontSize(compact ? 6.5 : 9);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date().toLocaleString('pt-BR'), pageWidth / 2, compact ? 10 : 22, { align: 'center' });

      const head = [[...(incluirCheckbox ? [''] : []), 'Referência', 'Produto', 'Cor', 'Tamanho', 'Qtd', 'Pedidos']];
      const body = displayRows.map((r) => [
        ...(incluirCheckbox ? [''] : []),
        r.reference,
        r.productName,
        r.variationName,
        r.size || 'Atacado',
        String(r.quantidade),
        r.pedidos,
      ]);

      autoTable(doc, {
        startY: headerH + (compact ? 2 : 8),
        head,
        body,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: compact ? 6.5 : 9 },
        bodyStyles: { fontSize: compact ? 6 : 8.5, cellPadding: compact ? 1.2 : 3 },
        margin: compact ? { left: 2, right: 2 } : undefined,
      });

      await sharePDF(doc, `Lista_Separacao_${new Date().toISOString().slice(0, 10)}`);
    } catch (e: any) {
      toast.show('Erro ao gerar PDF: ' + (e.message || e));
    } finally {
      setBusy(false);
    }
  };

  const handleNativePrint = () => {
    setPrintChoiceOpen(false);
    const rows: PrintPickingListRow[] = displayRows.map((r) => ({ ...r }));
    printPickingList({ rows, mostrarMiniaturas, incluirCheckbox, pageSize });
  };

  const openThermalFlow = async () => {
    setPrintChoiceOpen(false);
    setThermalOpen(true);
    const ok = await isAbleMarkPrinterConnected();
    setThermalConnected(ok);
  };

  const handleListDevices = async () => {
    setLoadingDevices(true);
    try {
      const list = await listAbleMarkPairedDevices();
      setDevices(list);
      if (list.length === 0) toast.show('Nenhum dispositivo pareado encontrado — pareie a impressora no Bluetooth do Android primeiro.');
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleConnect = async (address: string) => {
    setConnecting(true);
    try {
      const { connected, error } = await connectAbleMarkPrinter(address);
      setThermalConnected(connected);
      if (!connected) toast.show('Falha ao conectar: ' + (error || 'sem detalhe'));
    } finally {
      setConnecting(false);
    }
  };

  const handlePrintThermalLabels = async () => {
    const selected = agrupar ? groups.filter((g) => checkedKeys.has(g.key)) : [];
    if (selected.length === 0) {
      toast.show('Marque pelo menos uma referência na lista pra imprimir as etiquetas.');
      return;
    }
    setBusy(true);
    try {
      for (const g of selected) {
        const row: DisplayRow = {
          reference: g.reference,
          productName: g.productName,
          variationName: g.variationName,
          size: g.size,
          photoUrl: g.photoUrl,
          quantidade: g.totalQty,
          pedidos: Array.from(new Set(g.contributions.map((c) => c.orderNumero))).join(', '),
        };
        const dataUrl = buildPickingLabelDataUrl(row, incluirCheckbox);
        const base64 = dataUrl.split('base64,')[1];
        const written = await Filesystem.writeFile({ path: `bling_pick_${g.key.replace(/[^a-zA-Z0-9]/g, '_')}.png`, data: base64, directory: Directory.Cache });
        const { sent, error } = await printAbleMarkLabel(written.uri, 2, 2);
        if (!sent) {
          toast.show(`Falha ao imprimir ${g.reference}: ${error || 'sem detalhe'}`);
          break;
        }
      }
      toast.show('Etiquetas enviadas pra impressora.');
      setThermalOpen(false);
    } catch (e: any) {
      toast.show('Erro ao imprimir etiquetas: ' + (e.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen && !printChoiceOpen && !thermalOpen} onClose={onClose} title="Exportar Lista de Separação" icon={<Share2 size={18} />} maxWidth="max-w-lg" zIndex={85000}>
        <div className="flex flex-col gap-1">
          <p className="px-1 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Opções</p>
          <ToggleRow icon={<Layers size={18} />} label="Agrupar itens" sublabel={agrupar ? 'Soma referências repetidas' : 'Lista simples por pedido'} value={agrupar} onChange={() => setAgrupar((v) => !v)} />
          <ToggleRow icon={<ImageOff size={18} />} label="Mostrar miniaturas" sublabel={mostrarMiniaturas ? 'Com foto do produto' : 'Sem foto'} value={mostrarMiniaturas} onChange={() => setMostrarMiniaturas((v) => !v)} />
          <ToggleRow icon={<CheckSquare size={18} />} label="Incluir checkbox" sublabel={incluirCheckbox ? 'Caixinha pra marcar no papel' : 'Sem caixinha'} value={incluirCheckbox} onChange={() => setIncluirCheckbox((v) => !v)} />

          <button onClick={() => setPaperOpen((v) => !v)} className="w-full flex items-center gap-3 p-4 rounded-2xl border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all text-left">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              <FileStack size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black tracking-tight">Tamanho do papel</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{PAGE_SIZE_LABEL[pageSize]}</p>
            </div>
            <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${paperOpen ? 'rotate-180' : ''}`} />
          </button>
          {paperOpen && (
            <div className="flex flex-col gap-1.5 px-2 pb-2">
              {(Object.keys(PAGE_SIZE_LABEL) as PageSize[]).map((ps) => (
                <button
                  key={ps}
                  onClick={() => { setPageSize(ps); setPaperOpen(false); }}
                  className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-left ${pageSize === ps ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                >
                  <span className="text-xs font-black">{PAGE_SIZE_LABEL[ps]}</span>
                  {pageSize === ps && <CheckCircle2 size={15} />}
                </button>
              ))}
            </div>
          )}

          <button onClick={handleSaveProfile} className="mx-1 mt-1 flex items-center justify-center gap-2 h-10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            <Save size={13} /> Salvar como perfil padrão
          </button>

          <p className="px-1 pt-4 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Ação</p>
          <div className="grid grid-cols-2 gap-2 px-1">
            <button onClick={handleShareJpg} disabled={busy || displayRows.length === 0} className="h-12 rounded-2xl bg-indigo-600 disabled:opacity-40 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5">
              <ImageIcon size={14} /> JPG
            </button>
            <button onClick={handleSharePdf} disabled={busy || displayRows.length === 0} className="h-12 rounded-2xl bg-indigo-600 disabled:opacity-40 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5">
              <FileText size={14} /> PDF
            </button>
          </div>
          <button
            onClick={() => setPrintChoiceOpen(true)}
            disabled={displayRows.length === 0}
            className="mx-1 mt-2 h-12 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 disabled:opacity-40 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <Printer size={14} /> Imprimir
          </button>
        </div>
      </Modal>

      {printChoiceOpen && (
        <div className="fixed inset-0 z-[90000] flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm" onClick={() => setPrintChoiceOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-[2rem] p-5 flex flex-col gap-3 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
          >
            <div className="flex items-center justify-between px-1">
              <p className="text-sm font-black uppercase tracking-widest">Imprimir em...</p>
              <button onClick={() => setPrintChoiceOpen(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <button onClick={handleNativePrint} className={`flex items-center justify-between p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
              <div className="flex items-center gap-3">
                <Printer size={18} className="text-indigo-500" />
                <div className="text-left">
                  <p className="text-xs font-black">Impressão Nativa</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Diálogo de impressão do Android</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </button>
            <button onClick={openThermalFlow} className={`flex items-center justify-between p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
              <div className="flex items-center gap-3">
                <Bluetooth size={18} className="text-indigo-500" />
                <div className="text-left">
                  <p className="text-xs font-black">Impressora Térmica Ablemark</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">1 etiqueta por referência marcada</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </button>
          </div>
        </div>
      )}

      <Modal isOpen={thermalOpen} onClose={() => setThermalOpen(false)} title="Impressora Térmica Ablemark" icon={<Bluetooth size={18} />} maxWidth="max-w-md" zIndex={90000}>
        <div className="flex flex-col gap-4">
          <div className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl ${thermalConnected ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'}`}>
            {thermalConnected ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            <p className="text-[10px] font-black uppercase tracking-widest">{thermalConnected ? 'Impressora conectada' : 'Impressora não conectada'}</p>
          </div>

          {!thermalConnected && (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleListDevices}
                disabled={loadingDevices}
                className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
              >
                <RefreshCw size={14} className={loadingDevices ? 'animate-spin' : ''} /> Listar dispositivos pareados
              </button>
              {devices.map((d) => (
                <button
                  key={d.address}
                  onClick={() => handleConnect(d.address)}
                  disabled={connecting}
                  className={`flex items-center gap-2 px-4 py-3 rounded-2xl border-2 ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}
                >
                  <Bluetooth size={14} className="text-indigo-500 shrink-0" />
                  <span className="text-xs font-black truncate">{d.name}</span>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={handlePrintThermalLabels}
            disabled={!thermalConnected || busy}
            className="w-full h-12 rounded-2xl bg-emerald-600 disabled:opacity-40 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <Printer size={16} /> {busy ? 'Imprimindo...' : `Imprimir ${checkedKeys.size} Etiqueta(s)`}
          </button>
        </div>
      </Modal>
    </>
  );
}
