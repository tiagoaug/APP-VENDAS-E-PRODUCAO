import { useState } from 'react';
import { Wand2, Calculator, Settings } from 'lucide-react';
import { ProductionConfigItem, Person, FlowTag, ColorValue, ProductionScreenType, ViewType } from '../types';
import ComboBox from './ComboBox';
import Modal from './Modal';
import CalculatorModal from './CalculatorModal';

interface MaterialFormFieldsProps {
  item: ProductionConfigItem;
  onChange: (item: ProductionConfigItem) => void;
  isDarkMode: boolean;
  suppliers: Person[];
  flowTags: FlowTag[];
  colors: ColorValue[];
  units: ProductionConfigItem[];
  supplyCategoryNames: string[];
  // Referências (MAT-XXX) já usadas por outros insumos — pra gerar/validar código novo sem
  // colidir. Passe já filtrado (exclui o próprio item, se for edição).
  existingReferences: string[];
  // Omitido (undefined) quando usado dentro do cadastro de Solados — sem atalho de navegar pra
  // outra tela e perder o progresso do Solado em andamento. Presente no uso normal da tela de
  // Insumos, onde sair pra configurar Categoria/Flow Tag/Fornecedor/Unidade é seguro.
  onNavigateToScreen?: (screen: ProductionScreenType | ViewType) => void;
}

// Formulário completo de cadastro/edição de Insumo (Material) — extraído de
// ProductionConfigView.tsx (branch `type === 'MATERIAL'` de GenericConfigList) pra poder ser
// reaproveitado também dentro do popup "Selecionar Insumo" dos Solados (fallback "Cadastre um
// insumo aqui"), sem duplicar as ~260 linhas de JSX nem arriscar as duas cópias divergirem com
// o tempo. Autocontido de propósito: tem sua PRÓPRIA calculadora e seu PRÓPRIO modal de
// "Estoque e Preço por Cor" (zIndex mais alto, 85000+) em vez de compartilhar o estado global
// do GenericConfigList que o hospeda — evita qualquer conflito entre "o que está sendo editado
// lá fora" (ex.: o Solado) e "o insumo sendo criado/editado aqui dentro".
export default function MaterialFormFields({
  item, onChange, isDarkMode, suppliers, flowTags, colors, units, supplyCategoryNames, existingReferences, onNavigateToScreen,
}: MaterialFormFieldsProps) {
  const [activeCalc, setActiveCalc] = useState<{ initialValue: number; onResult: (val: number) => void } | null>(null);
  const [isStockColorModalOpen, setIsStockColorModalOpen] = useState(false);
  const [editingStockColors, setEditingStockColors] = useState<Record<string, number>>({});
  const [editingPriceColors, setEditingPriceColors] = useState<Record<string, number>>({});
  const [stockPackagesInput, setStockPackagesInput] = useState('');

  const selectedUnitName = units.find(u => u.id === item.metadata?.unitId)?.name || '';
  const isKgMaterialUnit = selectedUnitName.trim().toUpperCase() === 'KG';

  const renderLabel = (id: string, text: string, screen?: ProductionScreenType | ViewType, required: boolean = false) => (
    <div className="flex items-center justify-between ml-2">
      <label htmlFor={id} className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
        {text} {required && '*'}
      </label>
      {screen && onNavigateToScreen && (
        <button
          type="button"
          onClick={() => {
            if (confirm(`Deseja sair da edição atual para configurar ${text}? Salve suas alterações primeiro!`)) {
              onNavigateToScreen(screen);
            }
          }}
          className="p-1 rounded-lg bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 transition-all"
          title={`Configurar ${text}`}
        >
          <Settings size={10} />
        </button>
      )}
    </div>
  );

  const generateReference = () => {
    const usedCodes = existingReferences.map(r => r.toUpperCase().trim()).filter(Boolean);
    let counter = 1;
    let newCode = `MAT-${counter.toString().padStart(3, '0')}`;
    while (usedCodes.includes(newCode)) {
      counter++;
      newCode = `MAT-${counter.toString().padStart(3, '0')}`;
    }
    onChange({ ...item, metadata: { ...item.metadata, reference: newCode } });
  };

  const openStockColorModal = (colorIds: string[]) => {
    const stockMap = item.metadata?.stockByColor || {};
    const priceMap = item.metadata?.priceByColor || {};
    const newStock: Record<string, number> = {};
    const newPrice: Record<string, number> = {};
    colorIds.forEach(id => {
      newStock[id] = stockMap[id] ?? 0;
      newPrice[id] = priceMap[id] ?? (item.metadata?.baseCost || 0);
    });
    setEditingStockColors(newStock);
    setEditingPriceColors(newPrice);
    setIsStockColorModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {renderLabel('mat-master-category', 'Categoria Mestre', ViewType.CATEGORIES, true)}
          <ComboBox
            options={supplyCategoryNames.map(cat => ({ id: cat, name: cat }))}
            value={item.metadata?.masterCategory || ''}
            onChange={(val) => onChange({ ...item, metadata: { ...item.metadata, masterCategory: val as any } })}
            placeholder="Selecionar..."
            isDarkMode={isDarkMode}
            usePopupModal
            popupZIndex={85000}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="mat-reference" className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Referência / Código</label>
          <div className="relative group">
            <input id="mat-reference" type="text" value={item.metadata?.reference || ''} title="Referência" placeholder="REFERÊNCIA" onChange={(e) => onChange({ ...item, metadata: { ...item.metadata, reference: e.target.value.toUpperCase() } })} className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`} />
            <button type="button" onClick={generateReference} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 active:scale-95 transition-all" title="Gerar Código Automático"><Wand2 size={16} /></button>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="mat-name" className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Nome do Material *</label>
        <input id="mat-name" type="text" value={item.name || ''} title="Nome do Material" placeholder="NOME DO MATERIAL" onChange={(e) => onChange({ ...item, name: e.target.value.toUpperCase() })} required className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`} />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {renderLabel('mat-flowtag', 'Flow Tag (Estágio)', 'FLOW_TAGS')}
          <ComboBox
            options={[{ id: '', name: 'Nenhuma' }, ...flowTags.map(tag => ({ id: tag.id, name: tag.name }))]}
            value={item.metadata?.flowTagId || ''}
            onChange={(val) => onChange({ ...item, metadata: { ...item.metadata, flowTagId: val } })}
            placeholder="Nenhuma..."
            isDarkMode={isDarkMode}
            usePopupModal
            popupZIndex={85000}
          />
        </div>
        <div className="flex flex-col gap-2">
          {renderLabel('mat-supplier', 'Fornecedor Principal', ViewType.PEOPLE)}
          <ComboBox
            options={[{ id: '', name: 'Nenhum' }, ...suppliers.map(p => ({ id: p.id, name: p.name }))]}
            value={item.metadata?.supplierId || ''}
            onChange={(val) => onChange({ ...item, metadata: { ...item.metadata, supplierId: val } })}
            placeholder="Nenhum..."
            isDarkMode={isDarkMode}
            usePopupModal
            popupZIndex={85000}
          />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {renderLabel('mat-unit', 'Unidade', 'UNIDADES', true)}
          <ComboBox
            options={units.map(u => ({ id: u.id, name: u.name }))}
            value={item.metadata?.unitId || ''}
            onChange={(val) => onChange({ ...item, metadata: { ...item.metadata, unitId: val } })}
            placeholder="Selecionar..."
            isDarkMode={isDarkMode}
            usePopupModal
            popupZIndex={85000}
          />
        </div>
        {isKgMaterialUnit ? (
          <>
            <div className="flex flex-col gap-2">
              <label htmlFor="mat-pkg-weight" className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Peso da Embalagem (kg)</label>
              <div className="relative group">
                <input
                  id="mat-pkg-weight"
                  type="text"
                  inputMode="decimal"
                  value={item.metadata?.packageWeight || ''}
                  title="Peso da Embalagem"
                  onChange={(e) => {
                    const packageWeight = Number(e.target.value) || 0;
                    const packagePrice = item.metadata?.packagePrice || 0;
                    const baseCost = packageWeight > 0 ? parseFloat((packagePrice / packageWeight).toFixed(4)) : 0;
                    onChange({ ...item, metadata: { ...item.metadata, packageWeight, baseCost } });
                  }}
                  placeholder="0,00"
                  className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}
                />
                <button
                  type="button"
                  title="Abrir Calculadora"
                  aria-label="Abrir calculadora para definir peso da embalagem"
                  onClick={() => setActiveCalc({
                    initialValue: item.metadata?.packageWeight || 0,
                    onResult: (val) => {
                      const packagePrice = item.metadata?.packagePrice || 0;
                      const baseCost = val > 0 ? parseFloat((packagePrice / val).toFixed(4)) : 0;
                      onChange({ ...item, metadata: { ...item.metadata, packageWeight: val, baseCost } });
                    }
                  })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"
                ><Calculator size={16} /></button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="mat-pkg-price" className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Preço da Embalagem (R$)</label>
              <div className="relative group">
                <input
                  id="mat-pkg-price"
                  type="text"
                  inputMode="decimal"
                  value={item.metadata?.packagePrice || ''}
                  title="Preço da Embalagem"
                  onChange={(e) => {
                    const packagePrice = Number(e.target.value) || 0;
                    const packageWeight = item.metadata?.packageWeight || 0;
                    const baseCost = packageWeight > 0 ? parseFloat((packagePrice / packageWeight).toFixed(4)) : 0;
                    onChange({ ...item, metadata: { ...item.metadata, packagePrice, baseCost } });
                  }}
                  placeholder="0,00"
                  className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}
                />
                <button
                  type="button"
                  title="Abrir Calculadora"
                  aria-label="Abrir calculadora para definir preço da embalagem"
                  onClick={() => setActiveCalc({
                    initialValue: item.metadata?.packagePrice || 0,
                    onResult: (val) => {
                      const packageWeight = item.metadata?.packageWeight || 0;
                      const baseCost = packageWeight > 0 ? parseFloat((val / packageWeight).toFixed(4)) : 0;
                      onChange({ ...item, metadata: { ...item.metadata, packagePrice: val, baseCost } });
                    }
                  })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"
                ><Calculator size={16} /></button>
              </div>
            </div>
            <div className={`flex items-center justify-between px-5 py-3 rounded-2xl ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Valor por Kg (calculado)</span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">R$ {(item.metadata?.baseCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2"><label htmlFor="mat-cost" className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Custo Base</label><div className="relative group"><input id="mat-cost" type="number" step="0.01" value={item.metadata?.baseCost || ''} title="Custo Base" onChange={(e) => onChange({ ...item, metadata: { ...item.metadata, baseCost: Number(e.target.value) } })} placeholder="0,00" className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`} /><button type="button" title="Abrir Calculadora" aria-label="Abrir calculadora para definir custo base" onClick={() => setActiveCalc({ initialValue: item.metadata?.baseCost || 0, onResult: (val) => onChange({ ...item, metadata: { ...item.metadata, baseCost: val } }) })} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"><Calculator size={16} /></button></div></div>
            <div className="flex flex-col gap-2"><label htmlFor="mat-width" className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Largura (m)</label><div className="relative group"><input id="mat-width" type="number" step="0.01" value={item.metadata?.width || ''} title="Largura" onChange={(e) => onChange({ ...item, metadata: { ...item.metadata, width: Number(e.target.value) } })} placeholder="0,00" className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`} /><button type="button" title="Abrir Calculadora" aria-label="Abrir calculadora para definir largura" onClick={() => setActiveCalc({ initialValue: item.metadata?.width || 0, onResult: (val) => onChange({ ...item, metadata: { ...item.metadata, width: val } }) })} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"><Calculator size={16} /></button></div></div>
          </>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          {renderLabel('mat-colors', 'Cores Disponíveis', ViewType.COLORS)}
          <button
            type="button"
            onClick={() => {
              const next = !(item.metadata?.noColor);
              onChange({ ...item, metadata: { ...item.metadata, noColor: next, colorIds: next ? [] : item.metadata?.colorIds } });
            }}
            title="Este material não usa cor — oculta a seleção de cores no produto"
            className={`shrink-0 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${item.metadata?.noColor ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
          >
            Sem Cor
          </button>
        </div>
        {item.metadata?.noColor ? (
          <p className={`text-[10px] font-bold uppercase tracking-widest px-2 py-3 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Este material não usa cor — a seleção de cor fica oculta e não é obrigatória ao usar este material em um produto.
          </p>
        ) : (
          <div className={`p-4 rounded-2xl border-2 flex flex-wrap gap-2 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>{colors.map(color => { const isSelected = (item.metadata?.colorIds || []).includes(color.id); return (<button key={color.id} type="button" onClick={() => { const currentIds = item.metadata?.colorIds || []; const wasSelected = isSelected; const newIds = wasSelected ? currentIds.filter(id => id !== color.id) : [...currentIds, color.id]; onChange({ ...item, metadata: { ...item.metadata, colorIds: newIds } }); if (!wasSelected) openStockColorModal(newIds); }} className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${isSelected ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-900 text-slate-500' : 'bg-white text-slate-400 border border-slate-100'}`}>{color.name}</button>); })}</div>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 ml-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Estoque Atual</label>
            {selectedUnitName && (
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                {selectedUnitName}
              </span>
            )}
          </div>
          {(item.metadata?.colorIds?.length || 0) > 0 ? (
            <button
              type="button"
              onClick={() => openStockColorModal(item.metadata?.colorIds || [])}
              className={`w-full px-6 py-4 rounded-2xl font-bold text-xs outline-none transition-all border-2 flex items-center justify-between gap-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white hover:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 hover:border-indigo-200'}`}
            >
              <span className="tracking-widest">{Object.values(item.metadata?.stockByColor || {}).reduce((a, b) => a + (b || 0), 0)}</span>
              <span className="flex items-center gap-1.5 text-indigo-500 text-[9px] font-black uppercase tracking-widest">
                <Settings size={12} /> Estoque e Preço por Cor
              </span>
            </button>
          ) : null}
          {(item.metadata?.colorIds?.length || 0) > 0 && Object.keys(item.metadata?.stockByColor || {}).length > 0 && (
            <div className={`p-3 rounded-xl flex flex-wrap gap-2 ${isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50'}`}>
              {Object.entries(item.metadata?.stockByColor || {}).map(([colorId, qty]) => {
                const color = colors.find(c => c.id === colorId);
                if (!color) return null;
                return (
                  <div key={colorId} className={`flex items-center gap-1.5 px-2 py-1 rounded-md border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <div className="w-2 h-2 rounded-full border border-slate-200 shrink-0" style={{ backgroundColor: color.hex || '#ccc' }} />
                    <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase">{color.name}</span>
                    <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 ml-1">{Number(qty).toLocaleString('pt-BR')}{selectedUnitName ? ` ${selectedUnitName}` : ''}</span>
                  </div>
                );
              })}
            </div>
          )}
          {!((item.metadata?.colorIds?.length || 0) > 0) && (
            <div className="relative group">
              <input
                id="mat-stock"
                type="number"
                step="0.01"
                value={item.metadata?.stock || ''}
                title="Estoque Atual"
                onChange={(e) => onChange({ ...item, metadata: { ...item.metadata, stock: Number(e.target.value) } })}
                placeholder="0,00"
                className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}
              />
              <button type="button" title="Abrir Calculadora" aria-label="Abrir calculadora para definir estoque" onClick={() => setActiveCalc({ initialValue: item.metadata?.stock || 0, onResult: (val) => onChange({ ...item, metadata: { ...item.metadata, stock: val } }) })} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"><Calculator size={16} /></button>
            </div>
          )}
          {!((item.metadata?.colorIds?.length || 0) > 0) && isKgMaterialUnit && !!item.metadata?.packageWeight && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={stockPackagesInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setStockPackagesInput(val);
                  const qty = parseFloat(val.replace(',', '.')) || 0;
                  const weight = item.metadata?.packageWeight || 0;
                  onChange({ ...item, metadata: { ...item.metadata, stock: parseFloat((qty * weight).toFixed(4)) } });
                }}
                placeholder="0"
                title="Nº de embalagens em estoque — converte para o estoque em kg usando o Peso da Embalagem"
                className={`w-24 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}
              />
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight">
                Embalagens em estoque (× {item.metadata?.packageWeight || 0}kg = converte pro Estoque Atual)
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="mat-min-stock" className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Estoque Mínimo</label>
          <div className="relative group">
            <input id="mat-min-stock" type="number" step="0.01" value={item.metadata?.minStock || ''} title="Estoque Mínimo" onChange={(e) => onChange({ ...item, metadata: { ...item.metadata, minStock: Number(e.target.value) } })} placeholder="0,00" className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`} />
            <button type="button" title="Abrir Calculadora" aria-label="Abrir calculadora para definir estoque mínimo" onClick={() => setActiveCalc({ initialValue: item.metadata?.minStock || 0, onResult: (val) => onChange({ ...item, metadata: { ...item.metadata, minStock: val } }) })} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"><Calculator size={16} /></button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isStockColorModalOpen}
        onClose={() => setIsStockColorModalOpen(false)}
        title="ESTOQUE E PREÇO POR COR"
        zIndex={85000}
      >
        <div className="flex flex-col gap-6 p-2">
          <div className={`p-4 rounded-2xl border-2 border-dashed ${isDarkMode ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed text-center">
              Informe a quantidade em estoque e o custo de cada cor disponível deste insumo. <br />
              O estoque global será atualizado com a soma dos estoques por cor.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {(item.metadata?.colorIds || []).map((colorId: string) => {
              const color = colors.find(c => c.id === colorId);
              if (!color) return null;
              return (
                <div key={colorId} className={`p-3 rounded-2xl border-2 flex flex-col gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full border shadow-sm shrink-0" style={{ backgroundColor: color.hex || '#ccc' }} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                      {color.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex flex-col gap-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Estoque</span>
                      <div className="relative group">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={editingStockColors[colorId] ?? ''}
                          onChange={(e) => setEditingStockColors(prev => ({ ...prev, [colorId]: Number(e.target.value) }))}
                          placeholder="0,00"
                          className={`w-full px-4 py-3 rounded-xl font-bold text-xs outline-none transition-all border-2 pr-10 text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'}`}
                        />
                        <button type="button" title="Abrir Calculadora" aria-label="Abrir calculadora de estoque" onClick={() => setActiveCalc({ initialValue: editingStockColors[colorId] || 0, onResult: (val) => setEditingStockColors(prev => ({ ...prev, [colorId]: val })) })} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-indigo-500 transition-all"><Calculator size={14} /></button>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Custo (R$)</span>
                      <div className="relative group">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={editingPriceColors[colorId] ?? ''}
                          onChange={(e) => setEditingPriceColors(prev => ({ ...prev, [colorId]: Number(e.target.value) }))}
                          placeholder="0,00"
                          className={`w-full px-4 py-3 rounded-xl font-bold text-xs outline-none transition-all border-2 pr-10 text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'}`}
                        />
                        <button type="button" title="Abrir Calculadora" aria-label="Abrir calculadora de custo" onClick={() => setActiveCalc({ initialValue: editingPriceColors[colorId] || 0, onResult: (val) => setEditingPriceColors(prev => ({ ...prev, [colorId]: val })) })} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-indigo-500 transition-all"><Calculator size={14} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={() => setIsStockColorModalOpen(false)}
              className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border-2 ${isDarkMode ? 'border-slate-800 text-slate-400 hover:bg-slate-800' : 'border-slate-100 text-slate-400 hover:bg-slate-50'}`}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                const newStock = Object.values(editingStockColors).reduce((a, b) => a + (b || 0), 0);
                onChange({
                  ...item,
                  metadata: {
                    ...item.metadata,
                    stockByColor: editingStockColors,
                    priceByColor: editingPriceColors,
                    stock: newStock,
                  }
                });
                setIsStockColorModalOpen(false);
              }}
              className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
            >
              Salvar Balanço
            </button>
          </div>
        </div>
      </Modal>

      <CalculatorModal
        isOpen={!!activeCalc}
        onClose={() => setActiveCalc(null)}
        initialValue={activeCalc?.initialValue || 0}
        onResult={(val) => { activeCalc?.onResult(val); setActiveCalc(null); }}
        isDarkMode={isDarkMode}
        zIndex={90000}
      />
    </div>
  );
}
