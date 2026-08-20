import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShoppingBag, Factory, Plus, Tag, Maximize2, X } from 'lucide-react';
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
  onCreateNew: () => void;
}

const NO_SECTOR_KEY = '__none__';

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
      <button key={file.id} type="button" onClick={() => onSelectProfile(file)} className={rowCls}>
        <div
          className={`relative shrink-0 rounded-lg overflow-hidden border flex items-center justify-center ${isDarkMode ? 'border-slate-700 bg-white' : 'border-slate-200 bg-white'}`}
          style={{ width: 64, height: Math.min(64, 64 / aspect) }}
        >
          {thumbnails[file.id] ? (
            <>
              <img src={thumbnails[file.id]} alt="" className="w-full h-full object-contain" draggable={false} />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setExpandedFile(file); }}
                className="absolute bottom-0.5 right-0.5 p-1 rounded-md bg-slate-900/70 text-white active:scale-90 transition-transform"
                aria-label="Ver etiqueta ampliada"
              >
                <Maximize2 size={10} />
              </button>
            </>
          ) : (
            <div className="w-full h-full animate-pulse bg-slate-100" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{file.name}</p>
          <p className="text-[9px] font-bold text-slate-400 mt-0.5">{file.widthMm} × {file.heightMm} mm</p>
        </div>
      </button>
    );
  };

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title="Escolher Perfil de Etiqueta" icon={<Tag size={20} />} maxWidth="max-w-md" zIndex={96000}>
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
          onClick={onCreateNew}
          className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Plus size={14} /> Criar Novo Perfil
        </button>
      </div>
    </Modal>

    {expandedFile && thumbnails[expandedFile.id] && createPortal(
      <div className="fixed inset-0 z-[97500] flex flex-col items-center justify-center p-6" onClick={() => setExpandedFile(null)}>
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
        <button
          type="button"
          onClick={() => setExpandedFile(null)}
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
