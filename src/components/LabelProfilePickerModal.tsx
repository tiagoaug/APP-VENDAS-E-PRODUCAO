import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShoppingBag, Factory, Plus, Tag, Maximize2, X, ChevronLeft, Ruler } from 'lucide-react';
import Modal from './Modal';
import { LabelFile, Sector } from '../types';
import { renderLabelElementsToCanvas } from '../utils/labelCanvasRenderer';

interface LabelProfilePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  labelFiles: LabelFile[];
  sectors: Sector[];
  onSelectProfile: (file: LabelFile) => void;
  // Chamado só depois de escolher o tamanho (preset ou manual) na etapa "Tamanho da Etiqueta"
  // abaixo — nenhum tamanho fica implícito/hardcoded mais (ver TAMANHO_PRESETS).
  onCreateNew: (widthMm: number, heightMm: number) => void;
}

const NO_SECTOR_KEY = '__none__';

// Mesmos presets de PrintLabelEditorModal.tsx/PrintOSModal.tsx (THERMAL_SIZES) — duplicado de
// propósito (mesmo padrão já usado nesses dois arquivos) já que aqui é só a etapa "Criar Novo
// Perfil" escolhendo o tamanho inicial da etiqueta em branco, sem nenhuma outra dependência.
const SIZE_PRESETS: { label: string; widthMm: number; heightMm: number; star?: boolean }[] = [
  { label: '75 × 24 mm',  widthMm: 75,  heightMm: 24, star: true },
  { label: '38 × 25 mm',  widthMm: 38,  heightMm: 25 },
  { label: '50 × 30 mm',  widthMm: 50,  heightMm: 30 },
  { label: '57 × 40 mm',  widthMm: 57,  heightMm: 40 },
  { label: '80 × 40 mm',  widthMm: 80,  heightMm: 40 },
  { label: '80 × 50 mm',  widthMm: 80,  heightMm: 50 },
  { label: '100 × 50 mm', widthMm: 100, heightMm: 50 },
  { label: '100 × 40 mm', widthMm: 100, heightMm: 40 },
  { label: '40 × 30 mm',  widthMm: 40,  heightMm: 30 },
];

// Tela 1 do fluxo de impressão de etiquetas (Vendas e PCP) — lista os perfis já criados, com uma
// prévia real (renderizada a partir dos elementos salvos, com placeholders nos campos vinculados
// quando não há uma venda/pedido específico ainda) antes de abrir o editor (tela 2,
// LabelEditorView). Separado por tópico: "Vendas" (modelos com isSalesTemplate) e "Setores"
// (modelos com isProductionTemplate, sub-agrupados por sectorId). As duas seções ficam sempre
// visíveis — quem decide em qual tópico um modelo novo é salvo é o chamador (Vendas ou PCP), via
// o que ele passa como productionContext ao abrir o editor.
export default function LabelProfilePickerModal({
  isOpen, onClose, isDarkMode, labelFiles, sectors, onSelectProfile, onCreateNew,
}: LabelProfilePickerModalProps) {
  const salesTemplates = labelFiles.filter(f => f.isSalesTemplate);
  const productionTemplates = labelFiles.filter(f => f.isProductionTemplate);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  // Prévia ampliada — reaproveita a MESMA imagem já renderizada pra miniatura (renderizada em
  // LABEL_DOTS_PER_MM, a resolução de impressão de verdade, ver labelCanvasRenderer.ts); a
  // miniatura de 64px só parecia "baixa resolução" por estar pequena na tela, não por ter sido
  // renderizada em baixa qualidade — só precisa de um jeito de mostrar ela maior.
  const [expandedFile, setExpandedFile] = useState<LabelFile | null>(null);
  // Etapa "Tamanho da Etiqueta" — aberta ao tocar "Criar Novo Perfil", antes de navegar pro
  // editor de verdade (ver onCreateNew). Reseta sempre que o modal fecha/reabre.
  const [pickingSize, setPickingSize] = useState(false);
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');

  useEffect(() => {
    if (!isOpen) { setPickingSize(false); setCustomWidth(''); setCustomHeight(''); }
  }, [isOpen]);

  const customWidthNum = Number(customWidth.replace(',', '.'));
  const customHeightNum = Number(customHeight.replace(',', '.'));
  const customSizeValid = customWidthNum > 0 && customHeightNum > 0;

  const productionGroups = useMemo(() => {
    const bySector = new Map<string, LabelFile[]>();
    productionTemplates.forEach(f => {
      const key = f.sectorId || NO_SECTOR_KEY;
      if (!bySector.has(key)) bySector.set(key, []);
      bySector.get(key)!.push(f);
    });
    const groups = Array.from(bySector.entries()).map(([key, files]) => ({
      key, sector: key === NO_SECTOR_KEY ? null : sectors.find(s => s.id === key) || null, files,
    }));
    groups.sort((a, b) => {
      if (a.key === NO_SECTOR_KEY) return 1;
      if (b.key === NO_SECTOR_KEY) return -1;
      return (a.sector?.order ?? 0) - (b.sector?.order ?? 0);
    });
    return groups;
  }, [productionTemplates, sectors]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    [...salesTemplates, ...productionTemplates].forEach(file => {
      if (thumbnails[file.id]) return;
      renderLabelElementsToCanvas(file.elements, file.widthMm, file.heightMm)
        .then(canvas => { if (!cancelled) setThumbnails(prev => ({ ...prev, [file.id]: canvas.toDataURL('image/png') })); })
        .catch(() => { /* miniatura opcional — se falhar, a linha só fica sem prévia */ });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, labelFiles]);

  const rowCls = `w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition-all active:scale-[0.98] ${isDarkMode ? 'bg-slate-800/60 hover:bg-slate-800' : 'bg-slate-50 hover:bg-slate-100'}`;

  const renderFileRow = (file: LabelFile) => {
    const aspect = file.widthMm / file.heightMm;
    return (
      <div key={file.id} className={rowCls.replace('active:scale-[0.98]', '')}>
        <div
          role="button"
          tabIndex={thumbnails[file.id] ? 0 : -1}
          onClick={(e) => { e.stopPropagation(); if (thumbnails[file.id]) setExpandedFile(file); }}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && thumbnails[file.id]) { e.preventDefault(); setExpandedFile(file); } }}
          aria-label={thumbnails[file.id] ? 'Ver etiqueta ampliada' : undefined}
          data-guide-anchor="labelProfilePicker.ampliarMiniatura"
          className={`relative shrink-0 rounded-lg overflow-hidden border flex items-center justify-center transition-all ${thumbnails[file.id] ? 'cursor-zoom-in hover:ring-2 hover:ring-indigo-400 active:scale-95' : ''} ${isDarkMode ? 'border-slate-700 bg-white' : 'border-slate-200 bg-white'}`}
          style={{ width: 64, height: Math.min(64, 64 / aspect) }}
        >
          {thumbnails[file.id] ? (
            <>
              <img src={thumbnails[file.id]} alt="" className="w-full h-full object-contain" draggable={false} />
              <div className="absolute bottom-0.5 right-0.5 p-1 rounded-md bg-slate-900/70 text-white pointer-events-none">
                <Maximize2 size={10} />
              </div>
            </>
          ) : (
            <div className="w-full h-full animate-pulse bg-slate-100" />
          )}
        </div>
        <button type="button" onClick={() => onSelectProfile(file)} data-guide-anchor="labelProfilePicker.selecionarPerfil" className="min-w-0 flex-1 text-left active:scale-[0.98] transition-transform">
          <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{file.name}</p>
          <p className="text-[9px] font-bold text-slate-400 mt-0.5">{file.widthMm} × {file.heightMm} mm</p>
        </button>
      </div>
    );
  };

  const chooseSize = (widthMm: number, heightMm: number) => {
    setPickingSize(false);
    onCreateNew(widthMm, heightMm);
  };

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={pickingSize ? 'Tamanho da Etiqueta' : 'Escolher Perfil de Etiqueta'}
      icon={pickingSize ? <Ruler size={20} /> : <Tag size={20} />}
      maxWidth="max-w-md"
      zIndex={96000}
    >
      {pickingSize ? (
        <div className="flex flex-col gap-5">
          <button
            type="button"
            onClick={() => setPickingSize(false)}
            data-guide-anchor="labelProfilePicker.voltarEscolhaPerfil"
            className={`self-start flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <ChevronLeft size={14} /> Voltar
          </button>

          <div className="flex flex-col gap-2">
            <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Tamanhos comuns</span>
            <div className="grid grid-cols-2 gap-2">
              {SIZE_PRESETS.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => chooseSize(p.widthMm, p.heightMm)}
                  data-guide-anchor="labelProfilePicker.escolherTamanhoPreset"
                  className={`relative flex items-center justify-center gap-1.5 py-3 rounded-2xl text-[11px] font-black transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800/60 hover:bg-slate-800 text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-800'}`}
                >
                  {p.star && <span className="absolute top-1.5 right-2 text-amber-400 text-xs">★</span>}
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Tamanho personalizado (mm)</span>
            <div className="flex items-center gap-2">
              <input
                type="number" inputMode="decimal" min={1} placeholder="Largura"
                value={customWidth} onChange={e => setCustomWidth(e.target.value)}
                className={`w-full px-3 py-2.5 rounded-xl text-sm font-bold outline-none border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'}`}
              />
              <span className={`text-xs font-black ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>×</span>
              <input
                type="number" inputMode="decimal" min={1} placeholder="Altura"
                value={customHeight} onChange={e => setCustomHeight(e.target.value)}
                className={`w-full px-3 py-2.5 rounded-xl text-sm font-bold outline-none border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'}`}
              />
            </div>
            <button
              type="button"
              disabled={!customSizeValid}
              onClick={() => chooseSize(customWidthNum, customHeightNum)}
              data-guide-anchor="labelProfilePicker.usarTamanhoPersonalizado"
              className="w-full py-3 rounded-2xl bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              Usar Este Tamanho
            </button>
          </div>
        </div>
      ) : (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            <ShoppingBag size={13} className="text-sky-500" /> Vendas
          </span>
          {salesTemplates.length === 0 ? (
            <p className="text-[10px] font-bold text-slate-400 text-center py-3">Nenhum modelo salvo ainda — crie um novo abaixo.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {salesTemplates.map(renderFileRow)}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            <Factory size={13} className="text-violet-500" /> Setores
          </span>
          {productionGroups.length === 0 ? (
            <p className="text-[10px] font-bold text-slate-400 text-center py-3">Nenhum modelo de setor salvo ainda — crie um novo abaixo.</p>
          ) : (
            productionGroups.map(group => (
              <div key={group.key} className="flex flex-col gap-2">
                <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 pl-1">
                  {group.sector && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: group.sector.color }} />}
                  {group.sector?.name || 'Sem Setor'}
                </span>
                <div className="flex flex-col gap-2">
                  {group.files.map(renderFileRow)}
                </div>
              </div>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={() => setPickingSize(true)}
          data-guide-anchor="labelProfilePicker.criarNovoPerfil"
          className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Plus size={14} /> Criar Novo Perfil
        </button>
      </div>
      )}
    </Modal>

    {expandedFile && thumbnails[expandedFile.id] && createPortal(
      <div className="fixed inset-0 z-[97500] flex flex-col items-center justify-center p-6" onClick={() => setExpandedFile(null)}>
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
        <button
          type="button"
          onClick={() => setExpandedFile(null)}
          data-guide-anchor="labelProfilePicker.fecharAmpliada"
          className="absolute top-5 right-5 p-2 rounded-full bg-white/10 text-white active:scale-90 transition-transform"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>
        <img
          src={thumbnails[expandedFile.id]}
          alt={expandedFile.name}
          className="relative max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl bg-white"
          draggable={false}
          onClick={(e) => e.stopPropagation()}
        />
        <p className="relative mt-4 text-center text-xs font-black uppercase tracking-widest text-white">
          {expandedFile.name} — {expandedFile.widthMm} × {expandedFile.heightMm} mm
        </p>
      </div>,
      document.body,
    )}
    </>
  );
}
