import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import {
  subscribeToLabelElementsConfig,
  saveLabelElementsConfig,
  DEFAULT_OS_DATA_FIELDS,
  OsDataFieldsConfig,
} from '../services/labelElementsConfigService';

export type LabelConfigField = 'customerPrefix' | 'recipientPrefix' | 'packagingPrefix' | 'osdata';

const OS_DATA_FIELD_DEFS: { key: keyof OsDataFieldsConfig; label: string }[] = [
  { key: 'osNumber', label: 'Número da OS' },
  { key: 'providerName', label: 'Fornecedor/Setor Responsável' },
  { key: 'totalValue', label: 'Valor Total' },
  { key: 'quantity', label: 'Quantidade (pares)' },
  { key: 'valuePerPair', label: 'Valor por Par' },
  { key: 'sectorName', label: 'Setor' },
  { key: 'type', label: 'Tipo (Interna/Terceirizada)' },
  { key: 'createdAt', label: 'Data de Emissão' },
  { key: 'notes', label: 'Observações' },
];

interface Props {
  field: LabelConfigField;
  onClose: () => void;
  // Presente só quando aberto a partir da lista "Configurações de Elementos" do PCP — volta pra
  // ela em vez de simplesmente fechar. Ausente (atalho direto, ex.: da aba Conteúdo do Editor de
  // Etiqueta) = só fecha.
  onBack?: () => void;
  isDarkMode: boolean;
}

// Popup único reaproveitado em dois pontos: a lista "Configurações de Elementos" (PCP > Ações
// Rápidas) e o atalho direto na aba Conteúdo do LabelEditorView, pro campo já selecionado no
// elemento (ver "Campo vinculado" em LabelEditorView.tsx) — mesma UI, minha fonte única de
// verdade pra não os dois ficarem divergindo com o tempo.
export default function LabelElementConfigPopup({ field, onClose, onBack, isDarkMode }: Props) {
  const [osDataFieldsConfig, setOsDataFieldsConfig] = useState<OsDataFieldsConfig>(DEFAULT_OS_DATA_FIELDS);
  const [prefixConfig, setPrefixConfig] = useState({ customerPrefix: '', recipientPrefix: '', packagingPrefix: '' });
  const [prefixValue, setPrefixValue] = useState('');
  const [loadedInitialValue, setLoadedInitialValue] = useState(false);

  useEffect(() => {
    const unsub = subscribeToLabelElementsConfig(cfg => {
      setOsDataFieldsConfig(cfg.osDataFields);
      setPrefixConfig({ customerPrefix: cfg.customerPrefix, recipientPrefix: cfg.recipientPrefix, packagingPrefix: cfg.packagingPrefix });
      setLoadedInitialValue(prev => {
        if (!prev && field !== 'osdata') setPrefixValue(cfg[field]);
        return true;
      });
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field]);

  const toggleOsDataField = (key: keyof OsDataFieldsConfig) => {
    const next = { ...osDataFieldsConfig, [key]: !osDataFieldsConfig[key] };
    setOsDataFieldsConfig(next);
    saveLabelElementsConfig({ osDataFields: next });
  };

  const savePrefix = () => {
    saveLabelElementsConfig({ [field]: prefixValue });
    onClose();
  };

  // Prévia simbólica de etiqueta real: highlight na linha do campo sendo editado, com o valor
  // digitado ao vivo (linha de prefixo) ou os campos ligados/desligados ao vivo (bloco da OS, no
  // mesmo formato — partes unidas por " | " — usado por resolveLabelBinding em
  // labelFieldResolvers.ts). A "Embalagem" mostra a grade em mini colunas (numeração em cima,
  // quantidade embaixo), igual ao elemento Grade real, em vez de um texto corrido. Valores de
  // exemplo são só ilustrativos, não vêm de nenhum pedido real.
  const renderLabelPreview = (highlight: 'customer' | 'recipient' | 'packaging' | 'osdata') => {
    const customerText = `${field === 'customerPrefix' ? prefixValue : prefixConfig.customerPrefix}Nome do Cliente`;
    const recipientText = `${field === 'recipientPrefix' ? prefixValue : prefixConfig.recipientPrefix}Nome do Destinatário`;
    const packagingPrefixText = field === 'packagingPrefix' ? prefixValue : prefixConfig.packagingPrefix;
    const packagingGridExample = [{ sz: '38', qty: 1 }, { sz: '39', qty: 2 }, { sz: '40', qty: 3 }, { sz: '41', qty: 2 }];
    const osParts: string[] = [];
    if (osDataFieldsConfig.osNumber) osParts.push('OS-1234');
    if (osDataFieldsConfig.providerName) osParts.push('Fornecedor Exemplo');
    if (osDataFieldsConfig.totalValue) osParts.push('R$ 450,00');
    if (osDataFieldsConfig.quantity) osParts.push('12 pares');
    if (osDataFieldsConfig.valuePerPair) osParts.push('R$ 37,50/par');
    if (osDataFieldsConfig.sectorName) osParts.push('Costura');
    if (osDataFieldsConfig.type) osParts.push('Terceirizada');
    if (osDataFieldsConfig.createdAt) osParts.push('09/09/2026');
    if (osDataFieldsConfig.notes) osParts.push('Entrega urgente');
    const osText = osParts.length > 0 ? osParts.join(' | ') : '(nenhum campo ativo)';
    const lineCls = (key: string) => `px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-wide truncate transition-colors ${highlight === key ? 'bg-teal-500 text-white ring-2 ring-teal-300' : 'bg-slate-100 text-slate-400'}`;
    return (
      <div className={`rounded-xl border-2 border-dashed p-3 flex flex-col gap-1.5 ${isDarkMode ? 'border-slate-700 bg-slate-950' : 'border-slate-300 bg-slate-50'}`}>
        <span className="text-[7px] font-black uppercase tracking-widest text-slate-400">Prévia simbólica da etiqueta</span>
        <div className="rounded-lg bg-white p-2.5 flex flex-col gap-1 shadow-inner border border-slate-200">
          <span className="text-[8px] font-black uppercase tracking-wide text-slate-300 truncate">Tênis Modelo XYZ · Preto</span>
          <span className="text-[8px] font-bold text-slate-300">38x1-39x2-40x3</span>
          <span className={lineCls('customer')}>{customerText}</span>
          <span className={lineCls('recipient')}>{recipientText}</span>
          <div className={`px-2 py-1 rounded-md transition-colors flex items-center gap-2 ${highlight === 'packaging' ? 'bg-teal-500 ring-2 ring-teal-300' : 'bg-slate-100'}`}>
            {packagingPrefixText && (
              <span className={`text-[8px] font-black uppercase tracking-wide shrink-0 ${highlight === 'packaging' ? 'text-white' : 'text-slate-400'}`}>{packagingPrefixText}</span>
            )}
            <div className="flex gap-1.5">
              {packagingGridExample.map(g => (
                <div key={g.sz} className="flex flex-col items-center leading-none">
                  <span className={`text-[7px] font-black ${highlight === 'packaging' ? 'text-white' : 'text-slate-500'}`}>{g.sz}</span>
                  <span className={`text-[7px] font-black rounded px-1 mt-0.5 ${highlight === 'packaging' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-400'}`}>{g.qty}</span>
                </div>
              ))}
            </div>
          </div>
          <span className={lineCls('osdata')}>{osText}</span>
        </div>
      </div>
    );
  };

  const title = field === 'customerPrefix' ? 'Cliente' : field === 'recipientPrefix' ? 'Destinatário' : field === 'packagingPrefix' ? 'Embalagem' : 'Dados da OS';
  const subtitle = field === 'osdata' ? 'Escolha o que aparece nesse campo' : 'Texto fixo antes do valor';
  const placeholder = field === 'customerPrefix' ? 'Ex: Cliente: ' : field === 'recipientPrefix' ? 'Ex: Destino: ' : 'Ex: Embalagem: ';

  return createPortal(
    <div className="fixed inset-0 z-[96700] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className={`relative w-full max-w-sm max-h-[85vh] overflow-y-auto custom-scrollbar rounded-[2rem] shadow-2xl border p-5 flex flex-col gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button type="button" onClick={onBack}
                className={`p-1.5 rounded-lg shrink-0 ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
                <ChevronDown size={16} className="rotate-90" />
              </button>
            )}
            <div>
              <span className="text-[12px] font-black uppercase tracking-widest block leading-none">{title}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1 block">{subtitle}</span>
            </div>
          </div>
          <button type="button" title="Fechar" onClick={onClose}
            className={`p-1.5 rounded-lg shrink-0 ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
            <X size={16} />
          </button>
        </div>

        {field === 'osdata' ? (
          <>
            {renderLabelPreview('osdata')}
            {OS_DATA_FIELD_DEFS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleOsDataField(f.key)}
                data-guide-anchor="pcp.configOsDataCampo"
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-colors ${osDataFieldsConfig[f.key] ? (isDarkMode ? 'bg-teal-950/50 border-teal-500' : 'bg-teal-50 border-teal-300') : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200')}`}
              >
                <span className={`text-[10px] font-black uppercase tracking-widest ${osDataFieldsConfig[f.key] ? 'text-teal-600' : isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  {f.label}
                </span>
                <span className={`w-9 h-5 rounded-full relative shrink-0 transition-colors ${osDataFieldsConfig[f.key] ? 'bg-teal-600' : isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${osDataFieldsConfig[f.key] ? 'translate-x-4' : ''}`} />
                </span>
              </button>
            ))}
          </>
        ) : (
          <>
            <input
              type="text"
              autoFocus
              value={prefixValue}
              onChange={(e) => setPrefixValue(e.target.value)}
              placeholder={placeholder}
              data-guide-anchor="pcp.configElementosPrefixoInput"
              className={`w-full px-4 py-3 rounded-xl text-sm font-bold outline-none ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-900'}`}
            />
            {renderLabelPreview(field === 'customerPrefix' ? 'customer' : field === 'recipientPrefix' ? 'recipient' : 'packaging')}
            <button
              type="button"
              onClick={savePrefix}
              data-guide-anchor="pcp.configElementosPrefixoSalvar"
              className="w-full py-3 rounded-2xl bg-teal-600 text-white text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all"
            >
              Salvar
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
