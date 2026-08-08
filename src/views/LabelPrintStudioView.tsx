import { useEffect, useState } from 'react';
import {
  Bluetooth, CheckCircle2, XCircle, RefreshCw, Ruler, Plus, Trash2,
  FilePlus, Upload, FolderOpen, X, ChevronDown, ChevronUp, RotateCcw,
} from 'lucide-react';
import { LabelPaperSize, LabelFile } from '../types';
import {
  AbleMarkPairedDevice,
  listAbleMarkPairedDevices,
  connectAbleMarkPrinter,
  disconnectAbleMarkPrinter,
  isAbleMarkPrinterConnected,
  resetAbleMarkPrinter,
} from '../lib/ablemarkPrinter';
import { toast } from '../utils/toast';

// Mesmos presets usados no editor de etiqueta de produto (PrintLabelEditorModal), replicados
// aqui porque não são exportados de lá — mantém os tamanhos comuns disponíveis sem exigir
// cadastro manual pra casos padrão.
const PRESET_SIZES: { name: string; widthMm: number; heightMm: number }[] = [
  { name: '75 × 24 mm', widthMm: 75, heightMm: 24 },
  { name: '38 × 25 mm', widthMm: 38, heightMm: 25 },
  { name: '50 × 30 mm', widthMm: 50, heightMm: 30 },
  { name: '57 × 40 mm', widthMm: 57, heightMm: 40 },
  { name: '80 × 40 mm', widthMm: 80, heightMm: 40 },
  { name: '80 × 50 mm', widthMm: 80, heightMm: 50 },
  { name: '100 × 50 mm', widthMm: 100, heightMm: 50 },
  { name: '40 × 30 mm', widthMm: 40, heightMm: 30 },
];

export interface OpenEditorParams {
  widthMm: number;
  heightMm: number;
  paperSizeId?: string;
  existingFile?: LabelFile;
  importedImageDataUrl?: string;
}

interface LabelPrintStudioViewProps {
  isDarkMode: boolean;
  labelPaperSizes: LabelPaperSize[];
  labelFiles: LabelFile[];
  onAddPaperSize: (size: { name: string; widthMm: number; heightMm: number }) => Promise<void>;
  onDeletePaperSize: (id: string) => Promise<void>;
  onDeleteFile: (id: string) => Promise<void>;
  onOpenEditor: (params: OpenEditorParams) => void;
  onImportFile: (selectedSize: { widthMm: number; heightMm: number; paperSizeId?: string }) => void;
}

type SelectedSize = { name: string; widthMm: number; heightMm: number; paperSizeId?: string };

export default function LabelPrintStudioView({
  isDarkMode, labelPaperSizes, labelFiles,
  onAddPaperSize, onDeletePaperSize, onDeleteFile, onOpenEditor, onImportFile,
}: LabelPrintStudioViewProps) {
  const [devices, setDevices] = useState<AbleMarkPairedDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [selectedSize, setSelectedSize] = useState<SelectedSize | null>(
    PRESET_SIZES[0] ? { ...PRESET_SIZES[0] } : null,
  );
  const [sizesExpanded, setSizesExpanded] = useState(false);
  const [showAddSize, setShowAddSize] = useState(false);
  const [newSizeName, setNewSizeName] = useState('');
  const [newSizeWidth, setNewSizeWidth] = useState('');
  const [newSizeHeight, setNewSizeHeight] = useState('');
  const [savingSize, setSavingSize] = useState(false);

  useEffect(() => {
    isAbleMarkPrinterConnected().then(setConnected);
  }, []);

  const handleListDevices = async () => {
    setLoadingDevices(true);
    try {
      const list = await listAbleMarkPairedDevices();
      setDevices(list);
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleConnect = async (address: string) => {
    setSelectedAddress(address);
    setConnecting(true);
    try {
      const { connected: ok } = await connectAbleMarkPrinter(address);
      setConnected(ok);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectAbleMarkPrinter();
    setConnected(false);
  };

  const handleResetConnection = async () => {
    setResetting(true);
    try {
      await resetAbleMarkPrinter();
      setConnected(false);
      setDevices([]);
      toast.show('Conexão e cache resetados — conecte novamente.');
    } finally {
      setResetting(false);
    }
  };

  const handleAddSize = async () => {
    const widthMm = parseFloat(newSizeWidth.replace(',', '.'));
    const heightMm = parseFloat(newSizeHeight.replace(',', '.'));
    if (!newSizeName.trim() || !widthMm || !heightMm || widthMm <= 0 || heightMm <= 0) return;
    setSavingSize(true);
    try {
      await onAddPaperSize({ name: newSizeName.trim(), widthMm, heightMm });
      setNewSizeName('');
      setNewSizeWidth('');
      setNewSizeHeight('');
      setShowAddSize(false);
    } finally {
      setSavingSize(false);
    }
  };

  const cardCls = `p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`;
  const sectionTitleCls = 'text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3';

  return (
    <div className="flex flex-col gap-5">
      {/* Conexão */}
      <div className={connected
        ? `p-4 rounded-2xl border-2 ${isDarkMode ? 'bg-emerald-900/20 border-emerald-500/40' : 'bg-emerald-50 border-emerald-300'}`
        : cardCls}
      >
        <div className="flex items-center justify-between mb-3">
          <span className={connected ? 'text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3' : sectionTitleCls}>
            Impressora (Ablemark BR-L100)
          </span>
          {connected ? (
            <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={14} /> Conectada
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[10px] font-black text-rose-500">
              <XCircle size={13} /> Desconectada
            </span>
          )}
        </div>

        {connected ? (
          <button
            type="button"
            onClick={handleDisconnect}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
          >
            <CheckCircle2 size={13} /> Desconectar
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleListDevices}
              disabled={loadingDevices}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <RefreshCw size={13} className={loadingDevices ? 'animate-spin' : ''} /> Listar dispositivos pareados
            </button>
            {devices.map(d => (
              <button
                key={d.address}
                type="button"
                onClick={() => handleConnect(d.address)}
                disabled={connecting}
                className={`flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border-2 transition-all ${
                  selectedAddress === d.address
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Bluetooth size={13} className="text-indigo-500 shrink-0" />
                  <span className="text-xs font-black truncate">{d.name}</span>
                </div>
                {connecting && selectedAddress === d.address && <RefreshCw size={13} className="animate-spin text-indigo-400" />}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={handleResetConnection}
          disabled={resetting}
          className="w-full flex items-center justify-center gap-1.5 mt-2 py-2 text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 disabled:opacity-40"
        >
          <RotateCcw size={12} className={resetting ? 'animate-spin' : ''} /> {resetting ? 'Resetando...' : 'Resetar conexão e cache (se a impressão falhar)'}
        </button>
      </div>

      {/* Tamanhos de etiqueta */}
      <div className={cardCls}>
        <button
          type="button"
          onClick={() => setSizesExpanded(v => !v)}
          className={`w-full flex items-center justify-between gap-2 ${sizesExpanded ? 'mb-3' : ''}`}
        >
          <span className={`${sectionTitleCls} mb-0`}>Tamanho da etiqueta</span>
          <div className="flex items-center gap-2">
            {selectedSize && (
              <span className="text-[10px] font-bold text-indigo-500 truncate max-w-[110px]">{selectedSize.name}</span>
            )}
            {sizesExpanded ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
          </div>
        </button>

        {sizesExpanded && (
          <>
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={() => setShowAddSize(v => !v)}
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-500"
              >
                {showAddSize ? <X size={13} /> : <Plus size={13} />} {showAddSize ? 'Cancelar' : 'Cadastrar'}
              </button>
            </div>

            {showAddSize && (
              <div className="flex flex-col gap-2 mb-3 p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
                <input
                  value={newSizeName}
                  onChange={e => setNewSizeName(e.target.value)}
                  placeholder="Nome (ex: Etiqueta de caixa)"
                  className={`px-3 py-2 rounded-lg text-xs font-bold outline-none ${isDarkMode ? 'bg-slate-800 text-white placeholder:text-slate-500' : 'bg-white text-slate-900 placeholder:text-slate-400'}`}
                />
                <div className="flex gap-2">
                  <input
                    value={newSizeWidth}
                    onChange={e => setNewSizeWidth(e.target.value)}
                    inputMode="decimal"
                    placeholder="Largura (mm)"
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold outline-none ${isDarkMode ? 'bg-slate-800 text-white placeholder:text-slate-500' : 'bg-white text-slate-900 placeholder:text-slate-400'}`}
                  />
                  <input
                    value={newSizeHeight}
                    onChange={e => setNewSizeHeight(e.target.value)}
                    inputMode="decimal"
                    placeholder="Altura (mm)"
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold outline-none ${isDarkMode ? 'bg-slate-800 text-white placeholder:text-slate-500' : 'bg-white text-slate-900 placeholder:text-slate-400'}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddSize}
                  disabled={savingSize}
                  className="py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40"
                >
                  Salvar tamanho
                </button>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              {PRESET_SIZES.map(s => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => setSelectedSize({ ...s })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left transition-all ${
                    selectedSize?.name === s.name && !selectedSize?.paperSizeId
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : isDarkMode ? 'border-transparent bg-slate-800/50' : 'border-transparent bg-slate-50'
                  }`}
                >
                  <Ruler size={13} className="text-slate-400 shrink-0" />
                  <span className="text-xs font-bold">{s.name}</span>
                </button>
              ))}
              {labelPaperSizes.map(s => (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${
                    selectedSize?.paperSizeId === s.id
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : isDarkMode ? 'border-transparent bg-slate-800/50' : 'border-transparent bg-slate-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedSize({ name: s.name, widthMm: s.widthMm, heightMm: s.heightMm, paperSizeId: s.id })}
                    className="flex-1 flex items-center gap-2 text-left min-w-0"
                  >
                    <Ruler size={13} className="text-indigo-400 shrink-0" />
                    <span className="text-xs font-bold truncate">{s.name} — {s.widthMm}×{s.heightMm}mm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeletePaperSize(s.id)}
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Arquivos */}
      <div className={cardCls}>
        <span className={sectionTitleCls}>Arquivo de etiqueta</span>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            disabled={!selectedSize}
            onClick={() => selectedSize && onOpenEditor({ widthMm: selectedSize.widthMm, heightMm: selectedSize.heightMm, paperSizeId: selectedSize.paperSizeId })}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40"
          >
            <FilePlus size={14} /> Novo arquivo
          </button>
          <button
            type="button"
            disabled={!selectedSize}
            onClick={() => selectedSize && onImportFile({ widthMm: selectedSize.widthMm, heightMm: selectedSize.heightMm, paperSizeId: selectedSize.paperSizeId })}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
          >
            <Upload size={14} /> Importar arquivo
          </button>
        </div>

        {labelFiles.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {labelFiles.map(f => (
              <div
                key={f.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}
              >
                <button
                  type="button"
                  onClick={() => onOpenEditor({ widthMm: f.widthMm, heightMm: f.heightMm, paperSizeId: f.paperSizeId, existingFile: f })}
                  className="flex-1 flex items-center gap-2 text-left min-w-0"
                >
                  <FolderOpen size={13} className="text-indigo-400 shrink-0" />
                  <span className="text-xs font-bold truncate">{f.name}</span>
                  <span className="text-[9px] font-bold text-slate-400 shrink-0">{f.widthMm}×{f.heightMm}mm</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteFile(f.id)}
                  className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
