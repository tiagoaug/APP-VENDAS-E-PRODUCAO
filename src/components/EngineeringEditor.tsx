import React, { useState, useEffect } from 'react';
import {
  X, Scissors, Box, Calculator, Sparkles, Plus,
  ArrowUpDown, Trash2, Info, ChevronLeft, Save,
  CheckCircle2, ChevronRight, Footprints, ChevronDown, Grid3X3, Database,
  Percent, DollarSign, Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ProductionConfigItem, ComponentConsumption, Sector,
  ColorValue, Grid, SectorNote
} from '../types';
import Modal from './Modal';
import CalculatorModal from './CalculatorModal';
import EngineeringPickerModal from './EngineeringPickerModal';

// Categorias que usam o cadastro financeiro simples (Nome + % ou R$ fixo, com base de
// cálculo quando %) em vez do formulário de Peça/Material ou Genérico — Impostos, Fretes e
// Comissões/Assessoria. Impostos assume % por padrão; Fretes/Comissões assumem R$ fixo.
const SIMPLE_FORM_CATEGORIES = ['TAXES', 'SHIPPING', 'COMMISSIONS'];

// Normaliza nomes de cor para comparação (maiúsculas, sem acentos, espaços colapsados)
const normalizeColorName = (name: string) =>
  name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');

interface EngineeringEditorProps {
  key?: any;
  isDarkMode: boolean;
  consumption: ComponentConsumption;
  onSave: (consumption: ComponentConsumption) => void;
  onCancel: () => void;
  productionConfigs: ProductionConfigItem[];
  colors: ColorValue[];
  sectors: Sector[];
  grids: Grid[];
  productionGridId: string;
  defaultGridId: string;
  toolMapping: { [size: string]: string };
  activeVariationColor?: { name: string, hex: string };
  productReference?: string;
  productName?: string;
  onSaveConfigItem?: (item: ProductionConfigItem) => Promise<void>;
  /** Instruções por Setor da cor sendo editada — usado para pré-preencher a observação ao
   * escolher um setor que já tem nota cadastrada em Fluxo de Setores/Serviços. */
  sectorNotes?: Record<string, SectorNote[]>;
  /** IDs dos setores habilitados no Roteiro de Produção do modelo — usado para restringir o
   * seletor de Fluxo de Setores/Serviços só aos setores que este modelo realmente usa. */
  productionRoute?: string[];
  /** Natureza do custo da categoria sendo editada (FIXED/VARIABLE) — quando FIXED, exibe o
   * campo de Produção Estimada (pares/dia) para diluir o valor mensal em custo por par. */
  categoryCostType?: 'FIXED' | 'VARIABLE';
  /** Custo Total do Produto já fechado, excluindo o próprio item sendo editado (e outros
   * Impostos recalculados sobre essa mesma base) — usado no mini card de prévia em tempo
   * real, e como base de "% sobre o Custo" quando a categoria é Impostos. */
  costBeforeThisItem?: number;
  productPairsDay?: number;
  productWorkDays?: number;
}

export default function EngineeringEditor({
  isDarkMode,
  consumption,
  onSave,
  onCancel,
  productionConfigs,
  colors,
  sectors,
  grids,
  productionGridId,
  defaultGridId,
  toolMapping,
  activeVariationColor,
  productReference,
  productName,
  onSaveConfigItem,
  sectorNotes,
  productionRoute,
  categoryCostType,
  costBeforeThisItem = 0,
  productPairsDay = 0,
  productWorkDays = 26
}: EngineeringEditorProps) {
  const [editing, setEditing] = useState<ComponentConsumption>({ ...consumption });
  const [newServiceId, setNewServiceId] = useState('');
  const [newServiceCost, setNewServiceCost] = useState<number | string>(0);
  const [newServiceNoteName, setNewServiceNoteName] = useState('');
  const [newServiceNote, setNewServiceNote] = useState('');
  const [showServiceCostCalc, setShowServiceCostCalc] = useState(false);
  const [showToolMapping, setShowToolMapping] = useState(false);
  const [showConsumptionBreakdown, setShowConsumptionBreakdown] = useState(false);
  const [calcExpression, setCalcExpression] = useState(consumption.quantity ? consumption.quantity.toString().replace('.', ',') : '');
  const material = productionConfigs.find(m => m.id === editing.materialId);
  const materialUnitName = productionConfigs.find(c => c.id === material?.metadata?.unitId)?.name || 'PEÇAS';
  // Cor só é obrigatória se o material selecionado tiver cores cadastradas no cadastro do
  // insumo — materiais sem cor (ex: um adesivo genérico) não devem travar a confirmação.
  const materialRequiresColor = (material?.metadata?.colorIds?.length || 0) > 0;
  const [calcQty, setCalcQty] = useState(consumption.quantity ? consumption.quantity.toString().replace('.', ',') : '1');
  const [calcUnitVal, setCalcUnitVal] = useState(
    (consumption.unitValue && consumption.unitValue > 0) 
      ? consumption.unitValue.toString().replace('.', ',') 
      : (material?.metadata?.baseCost || 0).toString().replace('.', ',')
  );
  const [unitValManualEdited, setUnitValManualEdited] = useState(!!(consumption.unitValue && consumption.unitValue > 0));
  const [activeCalcField, setActiveCalcField] = useState<'qty' | 'unit' | null>(null);
  const [qtyMode, setQtyMode] = useState<'simple' | 'yield' | 'weighing'>('simple');
  const [qtyEmbalagem, setQtyEmbalagem] = useState((material?.metadata?.packageWeight || 1).toString().replace('.', ','));
  const [embalagemManualEdited, setEmbalagemManualEdited] = useState(false);
  const [qtyRendimento, setQtyRendimento] = useState('1');
  const [pesoInicial, setPesoInicial] = useState('');
  const [pesoFinal, setPesoFinal] = useState('');
  const [qtdParesPesagem, setQtdParesPesagem] = useState('');
  // Edição do Valor Unit. (R$/kg) via embalagem — parte do cadastro do material, mas editável
  // aqui pra ajustar um lote específico sem precisar mudar o cadastro global do insumo.
  const [showPackageEditor, setShowPackageEditor] = useState(false);
  const [pkgWeightOverride, setPkgWeightOverride] = useState((material?.metadata?.packageWeight || 0).toString().replace('.', ','));
  const [pkgPriceOverride, setPkgPriceOverride] = useState((material?.metadata?.packagePrice || 0).toString().replace('.', ','));
  const [pieceSearch, setPieceSearch] = useState(consumption.name || '');
  const [materialSearch, setMaterialSearch] = useState(material?.name || '');
  const [toolSearch, setToolSearch] = useState(productionConfigs.find(t => t.id === editing.toolId)?.name || '');
  const [showQuickAddMaterial, setShowQuickAddMaterial] = useState(false);
  const [quickAddMaterialName, setQuickAddMaterialName] = useState('');
  const [quickAddCategory, setQuickAddCategory] = useState('');
  const [quickAddUnitId, setQuickAddUnitId] = useState('');
  const [quickAddBaseCost, setQuickAddBaseCost] = useState('');
  const [quickAddObservacao, setQuickAddObservacao] = useState('');
  const [isSavingQuickMaterial, setIsSavingQuickMaterial] = useState(false);
  const [showQuickCostCalc, setShowQuickCostCalc] = useState(false);
  const [showPiecePicker, setShowPiecePicker] = useState(false);
  const [showToolPicker, setShowToolPicker] = useState(false);
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showServiceFlow, setShowServiceFlow] = useState(false);

  const pieces = productionConfigs.filter(c => c.type === 'PIECE');
  const materials = productionConfigs.filter(c => c.type === 'MATERIAL');
  const tools = productionConfigs.filter(c => c.type === 'TOOL');
  const units = productionConfigs.filter(c => c.type === 'UNIT');
  // Só setores habilitados no Roteiro de Produção do modelo — evita listar todo o quadro de
  // setores da fábrica quando só alguns fazem parte da sequência deste modelo.
  const modelSectors = sectors
    .filter(s => (productionRoute || []).includes(s.id))
    .sort((a, b) => a.order - b.order);

  const masterCategory = material?.metadata?.masterCategory?.toUpperCase() || '';
  const isCuttingPiece = editing.category === 'CUTTING_PIECE';
  const noToolCategories = ['AVIAMENTOS', 'QUIMICOS', 'EMBALAGENS', 'LINHAS', 'MATERIAL DE CONSUMO', 'ADESIVOS', 'COLA', 'METAIS'];
  const needsTool = editing.toolId ? true : (isCuttingPiece && (!noToolCategories.some(cat => masterCategory.includes(cat)) || masterCategory === ''));

  const evaluate = (expr: string) => {
    try {
      const normalized = expr.replace(',', '.');
      if (!normalized || !/^[0-9+\-*/(). ]+$/.test(normalized)) return 0;
      return Number(eval(normalized)) || 0;
    } catch { return 0; }
  };

  const updateQuantity = (qStr: string, uStr: string) => {
    const q = evaluate(qStr);
    // Para itens de consumo direto, a quantidade salva na engenharia é o fator de consumo (calcQty)
    setEditing(prev => ({ ...prev, quantity: q }));
  };

  // Recalcula o Valor Unit. (R$/kg) a partir de peso/preço da embalagem — mesma fórmula do
  // cadastro do material (packagePrice ÷ packageWeight), só que editável por item, pra ajustar
  // uma compra/lote específico sem alterar o cadastro global do insumo.
  const computePackageUnitVal = (weight: string, price: string) => {
    const w = parseFloat(weight.replace(',', '.')) || 0;
    const p = parseFloat(price.replace(',', '.')) || 0;
    const result = w > 0 ? p / w : 0;
    const str = result.toFixed(4).replace('.', ',');
    setCalcUnitVal(str);
    setUnitValManualEdited(true);
    updateQuantity(calcQty, str);
  };

  const computeYieldQty = (emb: string, rend: string) => {
    const e = parseFloat(emb.replace(',', '.')) || 0;
    const r = parseFloat(rend.replace(',', '.')) || 1;
    const result = r > 0 ? e / r : 0;
    const str = result.toFixed(4).replace('.', ',');
    setCalcQty(str);
    updateQuantity(str, calcUnitVal);
  };

  // Rendimento por pesagem: pesa a embalagem/pote antes e depois de produzir um lote, e divide
  // a diferença pela quantidade de pares feitos — dá o consumo real por par, sem depender do
  // peso nominal cadastrado na embalagem (que pode variar por umidade, sobra, etc.).
  const computeWeighingQty = (pi: string, pf: string, qtdPares: string) => {
    const p1 = parseFloat(pi.replace(',', '.')) || 0;
    const p2 = parseFloat(pf.replace(',', '.')) || 0;
    const qtd = parseFloat(qtdPares.replace(',', '.')) || 0;
    const result = qtd > 0 ? (p1 - p2) / qtd : 0;
    const str = result.toFixed(4).replace('.', ',');
    setCalcQty(str);
    updateQuantity(str, calcUnitVal);
  };

  const handleCalcBlur = () => {
    try {
      const normalized = calcExpression.replace(',', '.');
      if (!normalized) {
        setEditing({ ...editing, quantity: 0 });
        return;
      }
      // Simple evaluator for +, -, *, /
      if (/^[0-9+\-*/(). ]+$/.test(normalized)) {
        const result = eval(normalized);
        const finalVal = Number(result) || 0;
        setEditing({ ...editing, quantity: finalVal });
        setCalcExpression(finalVal.toString().replace('.', ','));
      }
    } catch (e) {
      // Revert to current quantity if invalid
      setCalcExpression(editing.quantity.toString().replace('.', ','));
    }
  };

  // Scroll to top when opening
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Inicializar calcUnitVal com o valor do material quando o componente abre (apenas se não houver valor manual salvo)
  useEffect(() => {
    if (unitValManualEdited && consumption.unitValue && consumption.unitValue > 0) return;
    
    // Inicialização do preço se não houver valor manual
    if (material && !unitValManualEdited) {
      const cost = material.metadata?.baseCost || 0;
      setCalcUnitVal(cost.toString().replace('.', ','));
    }
  }, []);

  // Recalcular quantidade quando o mapeamento mudar (global ou local)
  useEffect(() => {
    // Somente recalcula automaticamente se NÃO estiver ignorando a quantidade (modo manual)
    if (editing.ignoreQuantity) return;

    const tool = productionConfigs.find(t => t.id === editing.toolId);
    const material = productionConfigs.find(m => m.id === editing.materialId);
    if (tool && material) {
      const newQty = calculateConsumption(tool, material, editing.piecesPerPair || 2, editing.toolMapping, false);
      if (Math.abs(newQty - editing.quantity) > 0.0001) {
        setEditing(prev => ({ ...prev, quantity: newQty }));
      }
    }
  }, [toolMapping, productionConfigs, editing.toolId, editing.materialId, editing.piecesPerPair, editing.toolMapping, editing.ignoreQuantity]);

  const calculateConsumption = (tool: ProductionConfigItem, material: ProductionConfigItem, piecesPerPair: number = 2, localMapping?: { [size: string]: string }, ignoreQuantity: boolean = false) => {
    if (!tool || !tool.metadata) return 0;

    const sizeAreas = tool.metadata.sizeAreas || {};
    const conjugation = tool.metadata.conjugation || 1;
    const productGrid = grids.find(g => g.id === (productionGridId || defaultGridId));
    
    const unit = productionConfigs.find(c => c.id === material?.metadata?.unitId);
    const unitName = unit?.name || '';
    // MTL = Metro Linear, MT = Metro, also check common variations
    const isLinear = ['MT', 'MTL', 'ML'].includes(unitName.toUpperCase()) ||
      unitName.toUpperCase().includes('METRO') ||
      unitName.toUpperCase().includes('LINEAR');
    const width = material?.metadata?.width || 1.4;

    const calculateSingleSize = (area: number) => {
      // area is already stored in m² (e.g. 0.045 m²)
      if (!area || isNaN(area) || area <= 0) return 0;
      if (isLinear) return area / (width || 1); // m² ÷ largura(m) = metro linear
      return area; // already m²
    };

    let baseConsumption = 0;
    if (productGrid?.sizes?.length && Object.keys(sizeAreas).length > 0) {
      let totalCons = 0;
      let count = 0;
      productGrid.sizes.forEach(size => {
        const mappedSize = localMapping?.[size] || toolMapping?.[size] || size;
        const areaVal = sizeAreas[mappedSize] || sizeAreas[String(mappedSize).trim()] || sizeAreas[size] || 0;
        const area = Number(areaVal);
        if (area > 0) {
          totalCons += calculateSingleSize(area);
          count++;
        }
      });
      if (count > 0) baseConsumption = totalCons / count;
      else baseConsumption = calculateSingleSize(Number(Object.values(sizeAreas)[0]) || 0);
    } else {
      baseConsumption = calculateSingleSize(Number(Object.values(sizeAreas)[0]) || 0);
    }

    if (ignoreQuantity) return baseConsumption * piecesPerPair;
    const res = (baseConsumption / conjugation) * piecesPerPair;
    return isNaN(res) ? 0 : res;
  };

  const handleMaterialChange = (materialId: string) => {
    const mat = productionConfigs.find(m => m.id === materialId);
    if (mat) {
      if (!unitValManualEdited) {
        const cost = mat.metadata?.baseCost || 0;
        setCalcUnitVal(cost.toString().replace('.', ','));
      }
      // Peso da embalagem cadastrado no insumo (ex: "Lata 14kg") pré-preenche o campo
      // "Embalagem" do modo Rendimento — evita redigitar o mesmo peso a cada peça que usa
      // esse material.
      if (!embalagemManualEdited && mat.metadata?.packageWeight) {
        const emb = mat.metadata.packageWeight.toString().replace('.', ',');
        setQtyEmbalagem(emb);
        if (qtyMode === 'yield') computeYieldQty(emb, qtyRendimento);
      }
      // Peso/preço da embalagem do editor de "Valor Unit. por Embalagem" volta a refletir o
      // cadastro do novo material selecionado.
      setPkgWeightOverride((mat.metadata?.packageWeight || 0).toString().replace('.', ','));
      setPkgPriceOverride((mat.metadata?.packagePrice || 0).toString().replace('.', ','));
    }

    const tool = productionConfigs.find(t => t.id === editing.toolId);
    let newQuantity = editing.quantity;

    if (mat) {
      const mc = mat?.metadata?.masterCategory?.toUpperCase() || '';
      const noToolCats = ['AVIAMENTOS', 'QUIMICOS', 'EMBALAGENS', 'LINHAS', 'MATERIAL DE CONSUMO', 'ADESIVOS', 'COLA', 'METAIS'];
      const isNoTool = editing.category !== 'CUTTING_PIECE' || noToolCats.some(cat => mc.includes(cat));
      
      if (!isNoTool && tool) {
        newQuantity = calculateConsumption(tool, mat, editing.piecesPerPair || 2, editing.toolMapping, editing.ignoreQuantity || false);
      }
    }

    // Cruzamento automático: se o insumo tem cores cadastradas e alguma delas tem o
    // MESMO nome da cor da variação atual (cabedal), pré-seleciona essa cor — evita
    // que o usuário escolha manualmente a cor errada do insumo para esta variação.
    let autoColorId = '';
    const matColorIds = mat?.metadata?.colorIds;
    if (matColorIds?.length && activeVariationColor?.name) {
      const targetName = normalizeColorName(activeVariationColor.name);
      const matchedColor = colors.find(c => matColorIds.includes(c.id) && normalizeColorName(c.name) === targetName);
      if (matchedColor) autoColorId = matchedColor.id;
    }

    setEditing({ ...editing, materialId, quantity: newQuantity, colorId: autoColorId });
  };

  const handleToolChange = (toolId: string) => {
    const tool = productionConfigs.find(t => t.id === toolId);
    const material = productionConfigs.find(m => m.id === editing.materialId);
    
    if (tool && material) {
      const qty = calculateConsumption(tool, material, editing.piecesPerPair || 2, editing.toolMapping, editing.ignoreQuantity || false);
      setEditing({ ...editing, toolId, quantity: qty });
    } else {
      setEditing({ ...editing, toolId });
    }

    // Automatically open mapping modal when a tool is selected
    if (toolId) {
      setShowToolMapping(true);
    }
  };

  const openQuickAddMaterial = (nameOverride?: string) => {
    setShowMaterialPicker(false);
    setQuickAddMaterialName((nameOverride ?? materialSearch).trim());
    setQuickAddCategory('');
    setQuickAddUnitId('');
    setQuickAddBaseCost('');
    setQuickAddObservacao('');
    setShowQuickAddMaterial(true);
  };

  const handleSaveQuickMaterial = async () => {
    if (!quickAddMaterialName.trim() || !onSaveConfigItem || isSavingQuickMaterial) return;
    setIsSavingQuickMaterial(true);
    try {
      const newId = `m-${Date.now()}`;
      const newMaterial: ProductionConfigItem = {
        id: newId,
        name: quickAddMaterialName.trim().toUpperCase(),
        description: quickAddObservacao.trim() || quickAddCategory,
        type: 'MATERIAL',
        createdAt: Date.now(),
        metadata: {
          masterCategory: quickAddCategory,
          reference: '',
          unitId: quickAddUnitId,
          baseCost: parseFloat(quickAddBaseCost.replace(',', '.')) || 0,
          width: 0,
          colorIds: [],
          flowTagId: '',
          supplierId: ''
        }
      };
      await onSaveConfigItem(newMaterial);
      setEditing(prev => ({ ...prev, materialId: newId }));
      setMaterialSearch(newMaterial.name);
      setShowQuickAddMaterial(false);
    } catch (err) {
      console.error('Erro ao cadastrar insumo:', err);
    } finally {
      setIsSavingQuickMaterial(false);
    }
  };

  const handleQuickAddPiece = async (nameOverride?: string) => {
    const name = (nameOverride ?? pieceSearch).trim();
    if (!name || !onSaveConfigItem) return;

    // Check if it already exists
    const exists = productionConfigs.find(p => p.type === 'PIECE' && p.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      setEditing({ ...editing, name: exists.name });
      setPieceSearch(exists.name);
      setShowPiecePicker(false);
      return;
    }

    const newItem: ProductionConfigItem = {
      id: `p-${Date.now()}`,
      name,
      description: 'PECA',
      type: 'PIECE',
      createdAt: Date.now(),
      metadata: { pieceType: 'PECA' }
    };

    try {
      await onSaveConfigItem(newItem);
      setEditing({ ...editing, name: newItem.name });
      setPieceSearch(newItem.name);
      setShowPiecePicker(false);
    } catch (err) {
      console.error("Erro ao adicionar peça rápida:", err);
    }
  };

  // Prévia em tempo real do impacto deste item no Custo Total do Produto — mesma fórmula
  // usada ao confirmar (Impostos: % sobre custo/venda ou R$ fixo; demais: Qtd × Valor Unit.,
  // diluído se a categoria for Fixo Variável), mas recalculada a cada tecla digitada.
  const isFixedCategory = categoryCostType === 'FIXED';
  // Impostos assume % quando valueType ainda não foi definido; Fretes/Comissões assumem R$
  // fixo — mesmo default aplicado na criação do item (ProductFormView), repetido aqui só
  // como salvaguarda pra itens antigos sem o campo preenchido.
  const isPercentMode = editing.valueType ? editing.valueType === 'percentage' : editing.category === 'TAXES';
  const thisItemLiveCost = SIMPLE_FORM_CATEGORIES.includes(editing.category)
    ? (!isPercentMode
        ? evaluate(calcUnitVal)
        : (evaluate(calcUnitVal) / 100) * costBeforeThisItem)
    : (() => {
        const liveQty = (needsTool && !editing.ignoreQuantity) ? editing.quantity : evaluate(calcQty);
        const raw = liveQty * evaluate(calcUnitVal);
        if (!isFixedCategory) return raw;
        if (productPairsDay <= 0) return 0;
        return (raw / productWorkDays) / productPairsDay;
      })();
  const newTotalPreview = costBeforeThisItem + thisItemLiveCost;
  const simpleFormLabel = editing.category === 'SHIPPING' ? 'Nome do Frete' : editing.category === 'COMMISSIONS' ? 'Nome da Comissão/Assessoria' : 'Nome do Imposto';
  const simpleFormPlaceholder = editing.category === 'SHIPPING' ? 'Ex: Frete Rodoviário, Sedex...' : editing.category === 'COMMISSIONS' ? 'Ex: Comissão Vendedor, Assessoria Contábil...' : 'Ex: Simples Nacional, ICMS...';
  const simpleFormValueLabel = isPercentMode
    ? (editing.category === 'SHIPPING' ? 'Alíquota de Frete (%)' : editing.category === 'COMMISSIONS' ? 'Alíquota de Comissão (%)' : 'Alíquota (%)')
    : (editing.category === 'SHIPPING' ? 'Valor de Fretes' : editing.category === 'COMMISSIONS' ? 'Valor de Comissão e Assessoria' : 'Valor (R$)');

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`h-full pb-32 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
    >
      {/* Header - Not sticky anymore to avoid overlapping parent modal header */}
      <div className={`p-6 border-b flex items-center gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={onCancel}
            title="Voltar"
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="min-w-0">
            <h3 className="text-base font-black uppercase tracking-[0.1em] text-indigo-600 dark:text-indigo-400">Configurar Engenharia</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {(productReference || productName) && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-900/50">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 truncate max-w-[180px]">
                    {productReference}{productReference && productName ? ' — ' : ''}{productName}
                  </span>
                </div>
              )}
              {activeVariationColor && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div
                    className="w-2.5 h-2.5 rounded-full border border-black/10"
                    style={{ backgroundColor: activeVariationColor.hex }}
                  />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    COR: {activeVariationColor.name}
                  </span>
                </div>
              )}
              {editing.name && editing.name.length < 25 && !editing.name.includes('-') && (
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  COMPONENTE: <span className="text-slate-600 dark:text-slate-300">{editing.name}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-1 py-4 sm:p-6 space-y-5 sm:space-y-8 max-w-3xl mx-auto">

        {/* Mini card de prévia — mostra em tempo real o impacto deste item e o novo Custo
            Total do Produto, conforme os campos são preenchidos, sem precisar salvar. */}
        <div className={`p-4 rounded-[2rem] border-2 flex items-center gap-4 ${isDarkMode ? 'bg-emerald-950/20 border-emerald-900/40' : 'bg-emerald-50 border-emerald-100'}`}>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
            <Calculator size={20} />
          </div>
          <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Este Item</span>
              <span className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                R$ {thisItemLiveCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex flex-col items-end min-w-0">
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 text-right">Novo Custo Total</span>
              <span className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                R$ {newTotalPreview.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Tipo de Lançamento: Peça/Material (formulário completo) x Genérico (mão de obra,
            serviço avulso — sem material/faca cadastrados). Não faz sentido pra Peças de
            Corte, que sempre exigem Faca + Material. */}
        {editing.category !== 'CUTTING_PIECE' && !SIMPLE_FORM_CATEGORIES.includes(editing.category) && (
          <div className={`flex p-1.5 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <button
              type="button"
              onClick={() => setEditing(prev => ({ ...prev, entryType: 'PIECE' }))}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${editing.entryType !== 'GENERIC' ? (isDarkMode ? 'bg-slate-600 text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm') : 'text-slate-400'}`}
            >
              Peça / Material
            </button>
            <button
              type="button"
              onClick={() => setEditing(prev => ({ ...prev, entryType: 'GENERIC' }))}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${editing.entryType === 'GENERIC' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}`}
            >
              Genérico (Mão de Obra/Serviço)
            </button>
          </div>
        )}

        {editing.category !== 'CUTTING_PIECE' && !SIMPLE_FORM_CATEGORIES.includes(editing.category) && (
          <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-2xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
            <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-relaxed">
              Em "Peça / Material" o insumo é do Cadastro de Materiais e é rastreado na Necessidade de Compra do modelo. Em "Genérico" não há vínculo com material — o item entra só na formação do custo do produto, sem precisar cadastrar um material pra isso.
            </p>
          </div>
        )}

        {SIMPLE_FORM_CATEGORIES.includes(editing.category) ? (
          <div className={`p-4 sm:p-8 rounded-[2.5rem] border-2 shadow-sm space-y-6 ${isDarkMode ? 'bg-rose-950/20 border-rose-900/50' : 'bg-rose-50/50 border-rose-100'}`}>
            <div className="flex flex-col gap-3">
              <label className="text-[11px] font-black uppercase tracking-[0.2em] text-rose-600 dark:text-rose-400 px-1">{simpleFormLabel}</label>
              <input
                type="text"
                placeholder={simpleFormPlaceholder}
                className={`w-full border-2 rounded-2xl px-6 py-4 text-sm font-black outline-none transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-rose-500' : 'bg-white border-white focus:border-rose-400 shadow-sm'}`}
                value={editing.name || ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>

            {isPercentMode && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Base de Cálculo</label>
                <div className={`py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-center ${isDarkMode ? 'bg-slate-600 text-white shadow-sm' : 'bg-slate-100 text-slate-800 shadow-sm'}`}>
                  Sobre o Custo
                </div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1 leading-relaxed">
                  {`Custo Total antes dos impostos: R$ ${costBeforeThisItem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  {' · '}Valor que incide: <span className="text-rose-500 dark:text-rose-400">R$ {thisItemLiveCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </p>
              </div>
            )}

            <div className="relative">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">{simpleFormValueLabel}</label>
              <div className="relative mt-2">
                <input
                  type="text"
                  value={calcUnitVal}
                  onChange={(e) => { setCalcUnitVal(e.target.value); setUnitValManualEdited(true); }}
                  className={`w-full pl-6 pr-24 py-5 rounded-2xl font-black text-sm outline-none border-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-rose-500' : 'bg-white border-slate-200 text-slate-900 focus:border-rose-500 shadow-sm'}`}
                />
                <button
                  type="button"
                  onClick={() => setActiveCalcField('unit')}
                  title="Abrir Calculadora"
                  aria-label="Abrir calculadora para definir o valor"
                  className="absolute right-12 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  <Calculator size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(prev => ({ ...prev, valueType: (!prev.valueType || prev.valueType === 'percentage') ? 'fixed' : 'percentage' }))}
                  title="Alternar entre alíquota em porcentagem (%) ou valor fixo (R$)"
                  aria-label="Alternar tipo de valor"
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                    isPercentMode
                      ? (isDarkMode ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-50 text-rose-600')
                      : (isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                  }`}
                >
                  {isPercentMode ? <Percent size={15} strokeWidth={2.5} /> : <DollarSign size={15} strokeWidth={2.5} />}
                </button>
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1 mt-1.5">
                Clique no ícone para alternar entre porcentagem (%) ou valor fixo (R$)
              </p>
            </div>

            <CalculatorModal
              isOpen={activeCalcField !== null}
              onClose={() => setActiveCalcField(null)}
              isDarkMode={isDarkMode}
              initialValue={evaluate(calcUnitVal)}
              onResult={(val) => {
                setCalcUnitVal(val.toString().replace('.', ','));
                setUnitValManualEdited(true);
                setActiveCalcField(null);
              }}
            />
          </div>
        ) : editing.entryType === 'GENERIC' ? (
          <div className={`p-4 sm:p-8 rounded-[2.5rem] border-2 shadow-sm space-y-6 ${isDarkMode ? 'bg-indigo-950/20 border-indigo-900/50' : 'bg-indigo-50/50 border-indigo-100'}`}>
            <div className="flex flex-col gap-3">
              <label className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 px-1">Nome do Serviço / Item</label>
              <input
                type="text"
                placeholder="Ex: Corte, Costura, Mão de Obra..."
                className={`w-full border-2 rounded-2xl px-6 py-4 text-sm font-black outline-none transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-white focus:border-indigo-400 shadow-sm'}`}
                value={editing.name || ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4 items-end">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Unidade</label>
                <button
                  type="button"
                  onClick={() => setShowUnitPicker(true)}
                  className={`w-full px-3 py-5 rounded-2xl font-black text-sm outline-none border-2 transition-all text-center uppercase ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white hover:border-indigo-500/50' : 'bg-white border-slate-200 text-slate-900 hover:border-indigo-300 shadow-sm'}`}
                >
                  {units.find(u => u.id === editing.unitId)?.name || <span className="text-slate-400 dark:text-slate-500">UN...</span>}
                </button>
              </div>
              <div className="relative">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center block mb-2">Quantidade</label>
                <input
                  type="text"
                  value={calcQty}
                  onChange={(e) => { setCalcQty(e.target.value); updateQuantity(e.target.value, calcUnitVal); }}
                  className={`w-full px-3 py-5 rounded-2xl font-black text-sm outline-none border-2 transition-all text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600 shadow-sm'}`}
                />
                <button
                  type="button"
                  onClick={() => setActiveCalcField('qty')}
                  title="Abrir Calculadora de Quantidade"
                  aria-label="Abrir calculadora para definir a quantidade"
                  className="absolute right-2 top-[38px] p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  <Calculator size={16} />
                </button>
              </div>
              <div className="relative">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center block mb-2">Valor Unit.</label>
                <input
                  type="text"
                  value={calcUnitVal}
                  onChange={(e) => { setCalcUnitVal(e.target.value); setUnitValManualEdited(true); updateQuantity(calcQty, e.target.value); }}
                  className={`w-full px-3 py-5 rounded-2xl font-black text-sm outline-none border-2 transition-all text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600 shadow-sm'}`}
                />
                <button
                  type="button"
                  onClick={() => setActiveCalcField('unit')}
                  title="Abrir Calculadora de Valor Unitário"
                  aria-label="Abrir calculadora para definir o valor unitário"
                  className="absolute right-2 top-[38px] p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  <Calculator size={16} />
                </button>
              </div>
            </div>

            <EngineeringPickerModal
              isOpen={showUnitPicker}
              onClose={() => setShowUnitPicker(false)}
              title="Unidade"
              options={units.map(u => ({ id: u.id, name: u.name }))}
              selectedId={editing.unitId}
              onSelect={(id) => setEditing({ ...editing, unitId: id })}
              isDarkMode={isDarkMode}
              searchPlaceholder="Pesquisar unidade..."
              emptyHint="Nenhuma unidade cadastrada ainda"
            />

            <div className={`p-6 rounded-[2rem] border-2 border-dashed flex items-center justify-between ${isDarkMode ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Subtotal</span>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">R$</span>
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  {(evaluate(calcQty) * evaluate(calcUnitVal)).toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>

            <CalculatorModal
              isOpen={activeCalcField !== null}
              onClose={() => setActiveCalcField(null)}
              isDarkMode={isDarkMode}
              initialValue={evaluate(activeCalcField === 'qty' ? calcQty : calcUnitVal)}
              onResult={(val) => {
                const valStr = val.toString().replace('.', ',');
                if (activeCalcField === 'qty') {
                  setCalcQty(valStr);
                  updateQuantity(valStr, calcUnitVal);
                } else {
                  setCalcUnitVal(valStr);
                  setUnitValManualEdited(true);
                  updateQuantity(calcQty, valStr);
                }
                setActiveCalcField(null);
              }}
            />
          </div>
        ) : (
        <>
        {/* NOME DA PEÇA */}
        <div className={`p-4 sm:p-8 rounded-[2.5rem] border-2 shadow-sm ${isDarkMode ? 'bg-indigo-950/20 border-indigo-900/50' : 'bg-indigo-50/50 border-indigo-100'}`}>
          <div className="flex flex-col gap-3">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 px-1">Nome do Componente / Peça</label>
            <button
              type="button"
              onClick={() => setShowPiecePicker(true)}
              className={`w-full flex items-center justify-between border-2 rounded-2xl pl-6 pr-4 py-4 text-sm font-black text-left transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white hover:border-indigo-500/50' : 'bg-white border-white hover:border-indigo-200 shadow-sm'}`}
            >
              <span className={editing.name ? '' : 'text-slate-400 dark:text-slate-500 font-bold'}>
                {editing.name || 'Ex: Lateral, Gáspea, Biqueira...'}
              </span>
              <ChevronDown size={18} className="text-slate-400 shrink-0" />
            </button>
          </div>
        </div>

        <EngineeringPickerModal
          isOpen={showPiecePicker}
          onClose={() => setShowPiecePicker(false)}
          title="Nome do Componente / Peça"
          icon={<Database size={18} />}
          options={pieces.map(p => ({ id: p.id, name: p.name }))}
          selectedId={pieces.find(p => p.name === editing.name)?.id}
          onSelect={(id) => {
            const p = pieces.find(x => x.id === id);
            if (!p) return;
            setEditing({ ...editing, name: p.name });
            setPieceSearch(p.name);
          }}
          isDarkMode={isDarkMode}
          searchPlaceholder="Pesquisar ou digitar novo nome..."
          emptyHint="Nenhuma peça cadastrada ainda"
          onCreateNew={onSaveConfigItem ? (term) => handleQuickAddPiece(term) : undefined}
          createLabel={(term) => `Criar nova peça: "${term}"`}
        />

        {needsTool && (
          <div className={`p-4 sm:p-8 rounded-[2.5rem] border-2 shadow-xl space-y-6 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                <Scissors size={28} />
              </div>
              <div className="flex flex-col gap-3 flex-1 min-w-0">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Faca / Molde Técnica</label>
                <button
                  type="button"
                  onClick={() => setShowToolPicker(true)}
                  className={`w-full flex items-center justify-between gap-2 text-sm font-black text-left transition-all ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                >
                  <span className={toolSearch ? '' : 'text-slate-400 dark:text-slate-500 font-bold'}>
                    {toolSearch || 'Selecionar Faca...'}
                  </span>
                  <ChevronDown size={18} className="text-slate-400 shrink-0" />
                </button>
              </div>
            </div>

            <EngineeringPickerModal
              isOpen={showToolPicker}
              onClose={() => setShowToolPicker(false)}
              title="Faca / Molde Técnica"
              icon={<Scissors size={18} />}
              options={tools.map(t => ({ id: t.id, name: t.name }))}
              selectedId={editing.toolId}
              onSelect={(id) => {
                handleToolChange(id);
                const t = tools.find(x => x.id === id);
                setToolSearch(t?.name || '');
              }}
              isDarkMode={isDarkMode}
              searchPlaceholder="Pesquisar faca..."
              emptyHint="Nenhuma faca cadastrada ainda — cadastre em Configurações de Produção"
            />

            {/* RESUMO TÉCNICO E FINANCEIRO (CORTADOS) */}
            {editing.materialId && editing.toolId && (
              <div className={`p-6 rounded-[2rem] border-2 border-dashed flex items-center justify-between ${isDarkMode ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Consumo Médio</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-slate-900 dark:text-white">
                      {editing.quantity.toFixed(4).replace('.', ',')}
                    </span>
                    <span className="text-[10px] font-black text-slate-400 uppercase">
                      {productionConfigs.find(u => u.id === material?.metadata?.unitId)?.name || 'UN'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Custo Previsto</span>
                  <div className="flex items-baseline justify-end gap-1">
                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">R$</span>
                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                      {(editing.quantity * (material?.metadata?.baseCost || 0)).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {editing.toolId && (
              <>
                <button 
                  onClick={() => setShowToolMapping(true)}
                  title="Abrir Mapeamento de Tamanhos"
                  aria-label="Configurar mapeamento de tamanhos para esta faca"
                  className={`w-full py-4 px-6 rounded-[2rem] flex items-center justify-between transition-all active:scale-[0.98] ${isDarkMode ? 'bg-indigo-900/20 text-indigo-400 border-2 border-indigo-500/30' : 'bg-indigo-50 text-indigo-600 border-2 border-indigo-200'}`}
                >
                  <div className="flex items-center gap-3">
                    <ArrowUpDown size={20} />
                    <div>
                      <span className="text-xs font-black uppercase tracking-widest block text-indigo-600 dark:text-indigo-400">Mapeamento de Tamanhos</span>
                      <span className="text-[11px] font-bold uppercase tracking-widest opacity-70">Ajuste fino de facas</span>
                    </div>
                  </div>
                  <ChevronRight size={18} />
                </button>

                <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-2xl border ${isDarkMode ? 'bg-indigo-950/30 border-indigo-900/50' : 'bg-indigo-50 border-indigo-100'}`}>
                  <Info size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300 uppercase tracking-widest leading-relaxed">
                    Aqui você determina, para cada tamanho do cabedal, qual tamanho da faca aponta na conjugação — ou seja, qual faca corta aquele tamanho quando a faca conjuga (corta) mais de um tamanho por vez. Esse mapeamento reflete direto no material escolhido, de acordo com o consumo (área) de cada faca.
                  </p>
                </div>

                <Modal
                  isOpen={showToolMapping}
                  onClose={() => setShowToolMapping(false)}
                  title="Mapeamento de Facas"
                  closeLabel="Fechar Mapeamento de Facas"
                >
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center justify-between px-4">
                      <span className="text-[9px] font-black text-white uppercase tracking-widest bg-rose-500 px-3 py-1 rounded-full">Nº do Cabedal</span>
                      <span className="text-[9px] font-black text-white uppercase tracking-widest bg-rose-500 px-3 py-1 rounded-full">Nº da Faca que Corta</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                      {(() => {
                        const productGrid = grids.find(g => g.id === (productionGridId || defaultGridId));
                        const tool = productionConfigs.find(t => t.id === editing.toolId);
                        if (!productGrid || !tool) return null;

                        const toolSizes = tool.metadata?.sizes || [];

                        return productGrid.sizes.map(size => {
                          const currentMap = editing.toolMapping?.[size] || toolMapping?.[size] || size;
                          
                          return (
                            <div key={size} className={`flex items-center justify-between p-4 rounded-2xl ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100 shadow-sm'}`}>
                              <div className="flex flex-col items-center">
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">G {size}</span>
                                <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 drop-shadow-sm">{size}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Faca:</span>
                                <div className="relative">
                                  <select 
                                    className={`pl-5 pr-12 py-3.5 rounded-xl text-sm font-black outline-none appearance-none cursor-pointer border-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'}`}
                                    value={currentMap}
                                    title={`Faca para o tamanho ${size}`}
                                    onChange={(e) => {
                                      const newMapping = { ...(editing.toolMapping || {}) };
                                      newMapping[size] = e.target.value;
                                      setEditing({ ...editing, toolMapping: newMapping });
                                    }}
                                  >
                                    {toolSizes.map(ts => (
                                      <option key={ts} value={ts}>{ts}</option>
                                    ))}
                                    {!toolSizes.includes(size) && <option value={size}>{size}</option>}
                                  </select>
                                  <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    <div className={`pt-6 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'} space-y-4`}>
                      <div className="flex items-center gap-2 mb-6">
                        <Grid3X3 size={20} className="text-indigo-500" />
                        <span className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Matriz de Área Resultante (mm²)</span>
                      </div>
                      
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                        {(() => {
                          const tool = productionConfigs.find(t => t.id === editing.toolId);
                          const productGrid = grids.find(g => g.id === (productionGridId || defaultGridId));
                          if (!tool || !productGrid) return null;

                          return productGrid.sizes.map(size => {
                            const mappedSize = editing.toolMapping?.[size] || toolMapping?.[size] || size;
                            const s = String(mappedSize).trim();
                            const areaVal = tool.metadata?.sizeAreas?.[s] ?? tool.metadata?.sizeAreas?.[mappedSize] ?? tool.metadata?.sizeAreas?.[size];
                            const hasValue = areaVal !== undefined && areaVal !== null;
                            
                            return (
                              <div key={size} className={`flex flex-col items-center p-4 rounded-2xl border-2 ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-100 shadow-sm'}`}>
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">G {size}</span>
                                <span className={`text-sm font-black leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                  {hasValue ? Number(areaVal).toFixed(2).replace('.', ',') : '---'}
                                </span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>
                </Modal>
              </>
            )}
          </div>
        )}
        {material && (!needsTool || editing.ignoreQuantity) && (
          <div className={`p-4 sm:p-8 rounded-[2.5rem] border shadow-2xl space-y-8 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            {/* MATERIAL + UNID. em linha única — clicável, abre o mesmo seletor de insumo */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">Material</label>
              <button
                type="button"
                onClick={() => setShowMaterialPicker(true)}
                className={`w-full px-5 py-4 rounded-2xl border-2 flex items-center justify-between gap-3 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 hover:border-indigo-500/50' : 'bg-slate-50 border-slate-100 hover:border-indigo-300'}`}
              >
                <span className={`font-black text-sm truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{material.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-indigo-300 border border-slate-700' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                    {productionConfigs.find(u => u.id === material?.metadata?.unitId)?.name || 'UN'}
                  </span>
                  <ChevronDown size={16} className="text-slate-400" />
                </div>
              </button>
            </div>

            {/* QTY & UNIT VAL FIELDS */}
            <div className="flex flex-col gap-3">

              {/* Toggle — acima de tudo, largura da coluna de Quantidade */}
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Quantidade</label>
                <div className={`inline-flex gap-0.5 p-0.5 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <button
                    type="button"
                    onClick={() => setQtyMode('simple')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${qtyMode === 'simple' ? (isDarkMode ? 'bg-slate-600 text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm') : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  >
                    Simples
                  </button>
                  <button
                    type="button"
                    onClick={() => { setQtyMode('yield'); computeYieldQty(qtyEmbalagem, qtyRendimento); }}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${qtyMode === 'yield' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  >
                    Rendimento
                  </button>
                  <button
                    type="button"
                    onClick={() => { setQtyMode('weighing'); computeWeighingQty(pesoInicial, pesoFinal, qtdParesPesagem); }}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${qtyMode === 'weighing' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  >
                    Pesagem
                  </button>
                </div>
                {/* Basis: por par ou por grade — só visível para categoria PACKAGING */}
                {editing.category === 'PACKAGING' && (
                  <div className={`inline-flex gap-0.5 p-0.5 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <button
                      type="button"
                      onClick={() => setEditing(prev => ({ ...prev, consumptionBasis: 'pair' }))}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${(!editing.consumptionBasis || editing.consumptionBasis === 'pair') ? (isDarkMode ? 'bg-slate-600 text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm') : 'text-slate-400'}`}
                    >
                      /par
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(prev => ({ ...prev, consumptionBasis: 'grade', quantity: 1 }));
                        setCalcQty('1');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${editing.consumptionBasis === 'grade' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400'}`}
                    >
                      /grade
                    </button>
                  </div>
                )}
                {/* Modalidade: restringe em qual canal (atacado/varejo) este consumo entra na
                    Necessidade de Compra — só visível para PACKAGING. */}
                {editing.category === 'PACKAGING' && (
                  <div className={`inline-flex gap-0.5 p-0.5 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <button
                      type="button"
                      onClick={() => setEditing(prev => ({ ...prev, salesChannel: 'WHOLESALE' }))}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${editing.salesChannel === 'WHOLESALE' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400'}`}
                    >
                      Atacado
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(prev => ({ ...prev, salesChannel: 'RETAIL' }))}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${editing.salesChannel === 'RETAIL' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400'}`}
                    >
                      Varejo
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(prev => ({ ...prev, salesChannel: 'BOTH' }))}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${(!editing.salesChannel || editing.salesChannel === 'BOTH') ? (isDarkMode ? 'bg-slate-600 text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm') : 'text-slate-400'}`}
                    >
                      Ambos
                    </button>
                  </div>
                )}
              </div>

              {editing.category === 'PACKAGING' && (
                <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-2xl border ${isDarkMode ? 'bg-indigo-950/30 border-indigo-900/50' : 'bg-indigo-50 border-indigo-100'}`}>
                  <Info size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300 uppercase tracking-widest leading-relaxed">
                    Modalidade decide em qual canal essa embalagem entra na Necessidade de Compra — use quando o mesmo modelo vende em atacado e varejo com embalagens diferentes (ex: "Caixa Coletiva" /grade em Atacado, "Caixa Unitária" /par em Varejo), pra não somar as duas pro mesmo par. "Ambos" mantém o comportamento padrão (sempre soma, independente do canal do pedido).
                  </p>
                </div>
              )}

              {/* Inputs principais — sempre alinhados lado a lado */}
              <div className="grid grid-cols-3 gap-4 items-end">
                {/* Quantidade — col-span-2, sempre o mesmo input */}
                <div className="col-span-2 relative">
                  <input
                    id="quantity-input"
                    type="text"
                    value={calcQty}
                    readOnly={qtyMode !== 'simple'}
                    title={qtyMode === 'yield' ? 'Quantidade calculada pelo rendimento' : qtyMode === 'weighing' ? 'Quantidade calculada pela pesagem' : 'Quantidade'}
                    placeholder="0"
                    onChange={qtyMode === 'simple' ? (e) => { setCalcQty(e.target.value); updateQuantity(e.target.value, calcUnitVal); } : undefined}
                    className={`w-full px-6 py-5 rounded-2xl font-black text-sm outline-none border-2 transition-all ${
                      qtyMode === 'yield'
                        ? (isDarkMode ? 'bg-indigo-950/40 border-indigo-900/40 text-indigo-300 cursor-default' : 'bg-indigo-50 border-indigo-100 text-indigo-700 cursor-default')
                        : qtyMode === 'weighing'
                        ? (isDarkMode ? 'bg-teal-950/40 border-teal-900/40 text-teal-300 cursor-default' : 'bg-teal-50 border-teal-100 text-teal-700 cursor-default')
                        : (isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600 shadow-sm')
                    }`}
                  />
                  {qtyMode === 'simple' && (
                    <>
                      <div className="absolute right-3 top-[22px]">
                        <button
                          type="button"
                          onClick={() => setActiveCalcField('qty')}
                          title="Abrir Calculadora de Quantidade"
                          aria-label="Abrir calculadora para definir a quantidade"
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                        >
                          <Calculator size={16} />
                        </button>
                      </div>
                    </>
                  )}
                  {qtyMode === 'yield' && (
                    <span className="absolute left-1/2 -translate-x-1/2 bottom-1.5 text-[8px] font-black uppercase tracking-widest text-indigo-400">
                      {qtyEmbalagem || '1'} ÷ {qtyRendimento || '1'}
                    </span>
                  )}
                  {qtyMode === 'weighing' && (
                    <span className="absolute left-1/2 -translate-x-1/2 bottom-1.5 text-[8px] font-black uppercase tracking-widest text-teal-400">
                      ({pesoInicial || '0'} - {pesoFinal || '0'}) ÷ {qtdParesPesagem || '0'}
                    </span>
                  )}
                </div>

                {/* Valor Unitário — col-span-1, fixo */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    <label htmlFor="unit-val-input" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Valor Unit.</label>
                    {materialUnitName.toUpperCase() === 'KG' && (
                      <button
                        type="button"
                        onClick={() => setShowPackageEditor(v => !v)}
                        title="Alterar valor da embalagem para recalcular o Valor Unit. (R$/kg)"
                        className={`flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest text-center leading-tight transition-all active:scale-95 ${showPackageEditor ? 'bg-orange-600 text-white' : 'bg-orange-500 text-white hover:bg-orange-600'}`}
                      >
                        <Package size={9} className="shrink-0" /> Clique para mudar preço da embalagem
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="unit-val-input"
                      type="text"
                      value={calcUnitVal}
                      onChange={(e) => { setCalcUnitVal(e.target.value); setUnitValManualEdited(true); updateQuantity(calcQty, e.target.value); }}
                      className={`w-full px-3 py-5 rounded-2xl font-black text-sm outline-none border-2 transition-all text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600 shadow-sm'}`}
                    />
                    <button
                      onClick={() => setActiveCalcField('unit')}
                      title="Abrir Calculadora de Valor Unitário"
                      aria-label="Abrir calculadora para definir o valor unitário"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                    <Calculator size={16} />
                  </button>
                </div>
              </div>
            </div>

              {/* Editor de Valor Unit. por Embalagem — só para materiais em KG. Recalcula o
                  R$/kg a partir de peso/preço da embalagem desse lote, sem mudar o cadastro
                  global do insumo. */}
              {showPackageEditor && materialUnitName.toUpperCase() === 'KG' && (
                <div className={`p-4 rounded-2xl border-2 flex flex-col gap-3 ${isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Peso da Embalagem (kg)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={pkgWeightOverride}
                        onChange={(e) => { setPkgWeightOverride(e.target.value); computePackageUnitVal(e.target.value, pkgPriceOverride); }}
                        placeholder="0"
                        title="Peso da embalagem — pré-preenchido do cadastro do insumo"
                        className={`w-full px-4 py-3 rounded-xl font-black text-sm outline-none border-2 transition-all text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 shadow-sm'}`}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Preço da Embalagem (R$)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={pkgPriceOverride}
                        onChange={(e) => { setPkgPriceOverride(e.target.value); computePackageUnitVal(pkgWeightOverride, e.target.value); }}
                        placeholder="0"
                        title="Preço da embalagem — pré-preenchido do cadastro do insumo, editável para este lote"
                        className={`w-full px-4 py-3 rounded-xl font-black text-sm outline-none border-2 transition-all text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 shadow-sm'}`}
                      />
                    </div>
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1 leading-relaxed">
                    Valor Unit. (R$/kg) = Preço da Embalagem ÷ Peso da Embalagem. Ajuste aqui para refletir o preço de uma compra específica, sem alterar o cadastro do insumo.
                  </p>
                </div>
              )}

              {/* Categoria Fixo Variável (ex: Folha de Pagamento, Impostos) — valor fixo mensal
                  (Qtd × Valor Unit.) cujo custo por par VARIA conforme a produção, diluído
                  usando a Produção Estimada (Pares/Dia) e os Dias Trabalhados/Mês configurados
                  uma única vez no card "Custo Total do Produto" (não por item). */}
              {categoryCostType === 'FIXED' && (
                <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-2xl border ${isDarkMode ? 'bg-orange-950/20 border-orange-900/40' : 'bg-orange-50 border-orange-100'}`}>
                  <Info size={14} className="text-orange-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-bold text-orange-600 dark:text-orange-300 uppercase tracking-widest leading-relaxed">
                    Categoria Fixo Variável — Qtd × Valor Unit. é tratado como valor fixo MENSAL, cujo custo por par varia conforme a produção. Diluído usando a "Produção Estimada" e os "Dias Trabalhados/Mês" do produto (configure no card "Custo Total do Produto", no topo da Ficha Técnica). Sem esses dados preenchidos lá, este item não entra no custo total.
                  </p>
                </div>
              )}

              {/* Campos de Rendimento — aparecem abaixo do par principal */}
              {qtyMode === 'yield' && (
                <div className={`p-4 rounded-2xl border-2 flex flex-col gap-3 ${isDarkMode ? 'bg-indigo-950/30 border-indigo-900/40' : 'bg-indigo-50/60 border-indigo-100'}`}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-indigo-400 text-center">
                        Embalagem{!embalagemManualEdited && material?.metadata?.packageWeight ? ' (cadastro)' : ''}
                      </label>
                      <input
                        type="text"
                        value={qtyEmbalagem}
                        onChange={(e) => { setQtyEmbalagem(e.target.value); setEmbalagemManualEdited(true); computeYieldQty(e.target.value, qtyRendimento); }}
                        placeholder="1"
                        title="Quantidade/peso da embalagem do produto — pré-preenchido do cadastro do insumo quando disponível, editável"
                        className={`w-full px-4 py-3 rounded-xl font-black text-sm outline-none border-2 transition-all text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-indigo-200 text-slate-900 focus:border-indigo-500 shadow-sm'}`}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-indigo-400 text-center">Rendimento (pares)</label>
                      <input
                        type="text"
                        value={qtyRendimento}
                        onChange={(e) => { setQtyRendimento(e.target.value); computeYieldQty(qtyEmbalagem, e.target.value); }}
                        placeholder="1"
                        title="Rendimento em pares por embalagem"
                        className={`w-full px-4 py-3 rounded-xl font-black text-sm outline-none border-2 transition-all text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-indigo-200 text-slate-900 focus:border-indigo-500 shadow-sm'}`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">
                      {qtyEmbalagem || '1'} ÷ {qtyRendimento || '1'} = qtd/par
                    </span>
                    <span className={`text-sm font-black ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
                      {calcQty}
                      <span className="text-[9px] font-bold ml-1">
                        {productionConfigs.find(u => u.id === material?.metadata?.unitId)?.name || 'UN'}
                      </span>
                    </span>
                  </div>
                </div>
              )}

              {/* Campos de Pesagem — descobre o rendimento real pesando a embalagem antes/depois
                  de produzir um lote, em vez de usar o peso nominal cadastrado. */}
              {qtyMode === 'weighing' && (
                <div className={`p-4 rounded-2xl border-2 flex flex-col gap-3 ${isDarkMode ? 'bg-teal-950/30 border-teal-900/40' : 'bg-teal-50/60 border-teal-100'}`}>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-teal-500 text-center">Pesagem Inicial</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={pesoInicial}
                        onChange={(e) => { setPesoInicial(e.target.value); computeWeighingQty(e.target.value, pesoFinal, qtdParesPesagem); }}
                        placeholder="0"
                        title="Peso da embalagem antes de produzir o lote"
                        className={`w-full px-4 py-3 rounded-xl font-black text-sm outline-none border-2 transition-all text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-teal-500' : 'bg-white border-teal-200 text-slate-900 focus:border-teal-500 shadow-sm'}`}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-teal-500 text-center">Pesagem Final</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={pesoFinal}
                        onChange={(e) => { setPesoFinal(e.target.value); computeWeighingQty(pesoInicial, e.target.value, qtdParesPesagem); }}
                        placeholder="0"
                        title="Peso da embalagem depois de produzir o lote"
                        className={`w-full px-4 py-3 rounded-xl font-black text-sm outline-none border-2 transition-all text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-teal-500' : 'bg-white border-teal-200 text-slate-900 focus:border-teal-500 shadow-sm'}`}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-teal-500 text-center">Pares Feitos</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={qtdParesPesagem}
                        onChange={(e) => { setQtdParesPesagem(e.target.value); computeWeighingQty(pesoInicial, pesoFinal, e.target.value); }}
                        placeholder="0"
                        title="Quantidade de pares produzidos nesse lote"
                        className={`w-full px-4 py-3 rounded-xl font-black text-sm outline-none border-2 transition-all text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-teal-500' : 'bg-white border-teal-200 text-slate-900 focus:border-teal-500 shadow-sm'}`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-teal-500">
                      ({pesoInicial || '0'} - {pesoFinal || '0'}) ÷ {qtdParesPesagem || '0'} = qtd/par
                    </span>
                    <span className={`text-sm font-black ${isDarkMode ? 'text-teal-300' : 'text-teal-700'}`}>
                      {calcQty}
                      <span className="text-[9px] font-bold ml-1">
                        {productionConfigs.find(u => u.id === material?.metadata?.unitId)?.name || 'UN'}
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>

             {/* RESUMO TÉCNICO E FINANCEIRO (DIRETO) */}
             <div className="flex flex-col gap-2">
                {editing.ignoreQuantity && qtyMode === 'simple' && (
                  <p className={`text-[10px] font-black uppercase tracking-widest px-2 py-1.5 rounded-xl ${isDarkMode ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                    Consumo p/ Lote (12 Pr): {Math.round(Number(calcQty.replace(',', '.')) * 12)} {productionConfigs.find(u => u.id === material?.metadata?.unitId)?.name || 'UN'}
                  </p>
                )}
                {editing.ignoreQuantity && (
                  <button 
                    onClick={() => {
                      const val = evaluate(calcQty);
                      setEditing(prev => ({ ...prev, quantity: val, ignoreQuantity: true }));
                      setCalcQty(val.toString().replace('.', ','));
                    }}
                    className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all mb-2"
                  >
                    <CheckCircle2 size={16} /> Usar este Valor (Consumo Manual)
                  </button>
                )}
               <div className={`p-6 rounded-[2rem] border-2 border-dashed flex items-center justify-between ${isDarkMode ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Consumo {editing.consumptionBasis === 'grade' ? '/ grade' : '/ par'}
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-black text-slate-700 dark:text-slate-200">
                        {evaluate(calcQty).toFixed(4).replace('.', ',')}
                      </span>
                      <span className="text-[10px] font-black text-slate-400 uppercase">
                        {productionConfigs.find(u => u.id === material?.metadata?.unitId)?.name || 'UN'}
                      </span>
                    </div>
                  </div>

               <div className="flex flex-col text-right">
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Subtotal</span>
                 <div className="flex items-baseline justify-end gap-1">
                   <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">R$</span>
                   <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                     {(evaluate(calcQty) * evaluate(calcUnitVal)).toFixed(2).replace('.', ',')}
                   </span>
                 </div>
               </div>
            </div>
          </div>


             <CalculatorModal 
              isOpen={activeCalcField !== null}
              onClose={() => setActiveCalcField(null)}
              isDarkMode={isDarkMode}
              initialValue={evaluate(activeCalcField === 'qty' ? calcQty : calcUnitVal)}
              onResult={(val) => {
                const valStr = val.toString().replace('.', ',');
                if (activeCalcField === 'qty') {
                  setCalcQty(valStr);
                  updateQuantity(valStr, calcUnitVal);
                } else {
                  setCalcUnitVal(valStr);
                  setUnitValManualEdited(true);
                  updateQuantity(calcQty, valStr);
                }
                setActiveCalcField(null);
              }}
            />
          </div>
        )}

        {/* TABELA DE CONSUMO CALCULADO - SÓ PARA QUEM TEM FACA */}
        {needsTool && editing.toolId && editing.materialId && (() => {
          const tool = productionConfigs.find(t => t.id === editing.toolId);
          const material = productionConfigs.find(m => m.id === editing.materialId);
          const productGrid = grids.find(g => g.id === (productionGridId || defaultGridId));
          if (!needsTool || !tool || !material || !productGrid) return null;

          const unit = productionConfigs.find(c => c.id === material.metadata?.unitId);
          const unitName = unit?.name || '';
          // MTL = Metro Linear, MT = Metro, also check common variations
          const isLinear = ['MT', 'MTL', 'ML'].includes(unitName.toUpperCase()) ||
            unitName.toUpperCase().includes('METRO') ||
            unitName.toUpperCase().includes('LINEAR');
          const width = Number(material.metadata?.width) || 1.4;
          const conjugation = tool.metadata?.conjugation || 1;
          const piecesPerPair = editing.piecesPerPair || 2;
          const sizeAreas = tool.metadata?.sizeAreas || {};

          // Calcular consumo por tamanho
          // IMPORTANT: sizeAreas values are already stored in m² (e.g. 0.045)
          const sizeConsumptions: { size: string; area: number; cons: number; hasArea: boolean }[] = productGrid.sizes.map(size => {
            const mappedSize = editing.toolMapping?.[size] || toolMapping?.[size] || size;
            const areaVal = sizeAreas[mappedSize] 
              ?? sizeAreas[String(mappedSize).trim()]
              ?? sizeAreas[size]
              ?? sizeAreas[String(size).trim()];
            const hasArea = areaVal !== undefined && areaVal !== null && Number(areaVal) > 0;
            const area = hasArea ? Number(areaVal) : 0;
            // area already in m² — for linear: divide by material width to get MT
            const cons = hasArea
              ? (isLinear ? (area / width) : area) * piecesPerPair / conjugation
              : 0;
            return { size, area, cons, hasArea };
          });

          const totalSum = sizeConsumptions.reduce((sum, s) => sum + s.cons, 0);
          const average = productGrid.sizes.length > 0
            ? totalSum / productGrid.sizes.length
            : 0;

          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-[2.5rem] border-2 border-indigo-500 overflow-hidden shadow-2xl shadow-indigo-500/10 ${isDarkMode ? 'bg-indigo-950/20' : 'bg-white'}`}
            >
              {/* Header do card — acordeão: fechado por padrão, mostra só a média */}
              <button
                type="button"
                onClick={() => setShowConsumptionBreakdown(prev => !prev)}
                title={showConsumptionBreakdown ? "Recolher detalhamento por tamanho" : "Ver detalhamento por tamanho"}
                aria-label={showConsumptionBreakdown ? "Recolher detalhamento do consumo" : "Expandir detalhamento do consumo"}
                className={`w-full px-5 py-4 flex items-center justify-between gap-3 transition-colors ${isDarkMode ? 'bg-indigo-900/30 hover:bg-indigo-900/40' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0">
                    <Calculator size={18} />
                  </div>
                  <div className="text-left min-w-0">
                    <h4 className="text-sm font-black uppercase tracking-widest text-white">Consumo Real</h4>
                    <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest truncate">Por Peças / Par — {unitName || (isLinear ? 'MTL' : 'M²')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-black text-indigo-200 uppercase tracking-widest">Média</span>
                    <span className="text-xl font-black text-white leading-none">{average.toFixed(4).replace('.', ',')}</span>
                    <span className="text-xs font-black text-indigo-200 uppercase">{unitName || (isLinear ? 'MTL' : 'M²')}</span>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-amber-400 text-indigo-900 shadow-lg shadow-amber-400/30 transition-transform ${showConsumptionBreakdown ? 'rotate-180' : ''}`}>
                    <ChevronDown size={18} strokeWidth={3} />
                  </div>
                </div>
              </button>

              {showConsumptionBreakdown && (
                <>
                  {/* Lista de consumos por grade */}
                  <div className="flex flex-col divide-y divide-indigo-100 dark:divide-indigo-900/50">
                    {sizeConsumptions.map(({ size, cons, hasArea }) => (
                      <div key={size} className={`flex items-center justify-between px-5 py-3.5 ${isDarkMode ? 'hover:bg-indigo-950/30' : 'hover:bg-indigo-50/50'} transition-colors`}>
                        {/* Label da grade */}
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base ${isDarkMode ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
                            {size}
                          </div>
                          <span className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Tamanho</span>
                        </div>

                        {/* Valor do consumo */}
                        <div className="flex items-baseline gap-2">
                          <span className={`text-xl font-black leading-none ${hasArea ? (isDarkMode ? 'text-white' : 'text-slate-900') : 'text-slate-300'}`}>
                            {hasArea ? cons.toFixed(4).replace('.', ',') : '---'}
                          </span>
                          <span className={`text-xs font-black uppercase ${hasArea ? 'text-indigo-500' : 'text-slate-300'}`}>
                            {unitName || (isLinear ? 'MT' : 'M²')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Rodapé com a média destacada */}
                  <div className={`px-5 py-4 flex items-center justify-between border-t-2 border-indigo-200 dark:border-indigo-800 ${isDarkMode ? 'bg-indigo-900/20' : 'bg-indigo-50'}`}>
                    <span className="text-xs font-black uppercase tracking-widest text-indigo-500">Média do Consumo</span>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-indigo-700'}`}>{average.toFixed(4).replace('.', ',')}</span>
                      <span className="text-sm font-black text-indigo-400 uppercase">{unitName || (isLinear ? 'MT' : 'M²')}</span>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          );
        })()}


        {/* Seleção de Material e Cor */}
        <div className={`p-4 sm:p-8 rounded-[2.5rem] border-2 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} space-y-8`}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              {(needsTool || !material) ? (
                <label htmlFor="material-select" className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Material de Insumo</label>
              ) : <span />}
              <div className="flex items-center gap-4">
                {!material?.metadata?.noColor && (
                <label className="flex items-center gap-2 cursor-pointer group">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-500 transition-colors">Ignorar Cor</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={editing.ignoreColor || false}
                      onChange={(e) => setEditing({ ...editing, ignoreColor: e.target.checked })}
                    />
                    <div className={`w-8 h-4 rounded-full transition-colors ${editing.ignoreColor ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${editing.ignoreColor ? 'translate-x-4' : ''}`} />
                  </div>
                </label>
                )}
                {needsTool && (
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-500 transition-colors">Ignorar Qtd/Par</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={editing.ignoreQuantity || false}
                        onChange={(e) => {
                          const val = e.target.checked;
                          const tool = productionConfigs.find(t => t.id === editing.toolId);
                          const material = productionConfigs.find(m => m.id === editing.materialId);
                          const newQ = tool && material ? calculateConsumption(tool, material, editing.piecesPerPair || 2, editing.toolMapping, val) : editing.quantity;
                          setEditing({ ...editing, ignoreQuantity: val, quantity: newQ });
                          if (val) setCalcQty(newQ.toString());
                        }}
                      />
                      <div className={`w-8 h-4 rounded-full transition-colors ${editing.ignoreQuantity ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
                      <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${editing.ignoreQuantity ? 'translate-x-4' : ''}`} />
                    </div>
                  </label>
                )}
              </div>
            </div>
            {(needsTool || !material) && (
              <button
                id="material-select"
                type="button"
                onClick={() => setShowMaterialPicker(true)}
                className={`w-full flex items-center justify-between border-2 rounded-2xl px-6 py-4 text-sm font-black text-left transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white hover:border-indigo-500/50' : 'bg-slate-50 border-slate-100 text-slate-900 hover:border-indigo-300'}`}
              >
                <span className={materialSearch ? '' : 'text-slate-400 dark:text-slate-500 font-bold'}>
                  {materialSearch || 'Escolher Material...'}
                </span>
                <ChevronDown size={18} className="text-slate-400 shrink-0" />
              </button>
            )}

            <EngineeringPickerModal
              isOpen={showMaterialPicker}
              onClose={() => setShowMaterialPicker(false)}
              title="Material de Insumo"
              icon={<Box size={18} />}
              options={materials.map(m => ({ id: m.id, name: m.name }))}
              selectedId={editing.materialId}
              onSelect={(id) => {
                handleMaterialChange(id);
                const m = materials.find(x => x.id === id);
                setMaterialSearch(m?.name || '');
              }}
              isDarkMode={isDarkMode}
              searchPlaceholder="Pesquisar material..."
              emptyHint="Nenhum insumo cadastrado ainda"
              onCreateNew={onSaveConfigItem ? (term) => openQuickAddMaterial(term) : undefined}
              createLabel={(term) => `Cadastrar como novo insumo: "${term}"`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
             {!material?.metadata?.noColor && (
             <div className={`flex flex-col gap-3 transition-all ${editing.ignoreColor ? 'opacity-50 pointer-events-none' : ''}`}>
                <label htmlFor="color-select" className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 px-1">
                  Cor {editing.ignoreColor && <span className="text-[9px] text-indigo-500">(IGNORADO)</span>}
                </label>
                 <select
                  id="color-select"
                  disabled={editing.ignoreColor}
                  className={`w-full border-2 rounded-2xl px-6 py-4 text-sm font-black outline-none transition-all ${!editing.colorId && !editing.ignoreColor && materialRequiresColor ? 'border-rose-500/50 bg-rose-50/10' : ''} ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                  value={editing.ignoreColor ? '' : (editing.colorId || '')}
                  onChange={(e) => setEditing({ ...editing, colorId: e.target.value })}
                  title="Selecionar Cor"
                >
                  <option value="">{editing.ignoreColor ? 'N/A' : materialRequiresColor ? 'Cor Obrigatória...' : 'Selecionar Cor (opcional)...'}</option>
                  {(() => {
                    const selMat = productionConfigs.find(m => m.id === editing.materialId);
                    const matColorIds = selMat?.metadata?.colorIds;
                    const filtered = matColorIds?.length
                      ? colors.filter(c => matColorIds.includes(c.id))
                      : colors;
                    return filtered.map(c => <option key={c.id} value={c.id}>{c.name}</option>);
                  })()}
                </select>
                {!editing.colorId && !editing.ignoreColor && materialRequiresColor && (
                  <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest mt-1 ml-2">Campo Obrigatório</span>
                )}
                {(() => {
                  // Avisa se a cor da variação atual (cabedal) tem uma cor com o MESMO nome
                  // cadastrada no insumo, mas o item selecionado aponta para outra cor —
                  // sinal de cruzamento de cores incorreto na ficha técnica.
                  if (editing.ignoreColor || !editing.colorId || !activeVariationColor?.name) return null;
                  const selMat = productionConfigs.find(m => m.id === editing.materialId);
                  const matColorIds = selMat?.metadata?.colorIds;
                  if (!matColorIds?.length) return null;
                  const targetName = normalizeColorName(activeVariationColor.name);
                  const matchingColor = colors.find(c => matColorIds.includes(c.id) && normalizeColorName(c.name) === targetName);
                  if (!matchingColor || matchingColor.id === editing.colorId) return null;
                  return (
                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1 ml-2 leading-relaxed">
                      ⚠ A variação é "{activeVariationColor.name}" e o insumo tem uma cor com esse mesmo nome — confirme se não é um cruzamento de cor errado.
                    </span>
                  );
                })()}
             </div>
             )}
             {material?.metadata?.noColor && (
               <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
                 <Info size={14} className="text-slate-400 shrink-0" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Este material não usa cor</span>
               </div>
             )}
             {needsTool && (
               <div className={`flex flex-col gap-3 transition-all ${editing.ignoreQuantity ? 'opacity-50 pointer-events-none' : ''}`}>
                  <label htmlFor="pieces-per-pair-input" className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 px-1">
                    Peças / Par {editing.ignoreQuantity && <span className="text-[9px] text-indigo-500">(IGNORADO)</span>}
                  </label>
                  <input 
                    id="pieces-per-pair-input"
                    type="number" 
                    disabled={editing.ignoreQuantity}
                    className={`w-full border-2 rounded-2xl px-6 py-4 text-sm font-black outline-none transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                    value={editing.ignoreQuantity ? 1 : (editing.piecesPerPair || 2)}
                    title={`Quantidade de peças por par`}
                    onChange={(e) => {
                      const ppp = Number(e.target.value);
                      const tool = productionConfigs.find(t => t.id === editing.toolId);
                      const material = productionConfigs.find(m => m.id === editing.materialId);
                      if (tool && material) {
                        setEditing({ ...editing, piecesPerPair: ppp, quantity: calculateConsumption(tool, material, ppp, editing.toolMapping) });
                      } else {
                        setEditing({ ...editing, piecesPerPair: ppp });
                      }
                    }}
                  />
               </div>
             )}
          </div>
        </div>
        </>
        )}

        {/* Serviços Terceirizados — acordeão minimizado por padrão em todas as categorias */}
        <div className={`rounded-[2.5rem] border-2 shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-amber-50/30 border-amber-100'}`}>
           <button
             type="button"
             onClick={() => setShowServiceFlow(prev => !prev)}
             title={showServiceFlow ? "Recolher Fluxo de Setores/Serviços" : "Expandir Fluxo de Setores/Serviços"}
             aria-label={showServiceFlow ? "Recolher Fluxo de Setores/Serviços" : "Expandir Fluxo de Setores/Serviços"}
             className="w-full flex items-center justify-between gap-3 p-4 sm:p-8"
           >
              <div className="flex items-center gap-3 min-w-0">
                <Sparkles size={20} className="text-amber-500 shrink-0" />
                <div className="text-left min-w-0">
                  <h4 className="text-xs font-black uppercase tracking-widest text-amber-600">Fluxo de Setores / Serviços</h4>
                  <p className="text-[9px] font-bold text-amber-600/70 uppercase tracking-widest mt-0.5">{(editing.services || []).length} {(editing.services || []).length === 1 ? 'setor' : 'setores'}</p>
                </div>
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-amber-400 text-indigo-900 shadow-lg shadow-amber-400/30 transition-transform ${showServiceFlow ? 'rotate-180' : ''}`}>
                <ChevronDown size={16} strokeWidth={3} />
              </div>
           </button>

           {showServiceFlow && (
           <div className="px-4 pb-4 sm:px-8 sm:pb-8 space-y-6">
           <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-2xl border ${isDarkMode ? 'bg-amber-950/30 border-amber-900/50' : 'bg-amber-100/60 border-amber-200'}`}>
             <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
             <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-widest leading-relaxed">
               Use aqui quando este item passa por um setor/serviço terceirizado além do corte (ex: bordado, gravação, preparação) — escolha o setor e informe o custo cobrado por par. Esse valor se soma ao custo do material ("Serv. R$" no card do item) e entra no total de "Engenharia do Modelo" mostrado no resumo de custos do produto. Se você preencher Nome e Descrição, eles já aparecem prontos em "Instruções por Setor" desta cor.
             </p>
           </div>

           {modelSectors.length === 0 && (
             <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">
               Nenhum setor habilitado no "Roteiro de Produção" deste modelo — habilite um lá primeiro para poder escolhê-lo aqui.
             </p>
           )}

           <div className="grid grid-cols-12 gap-2">
              <div className="col-span-12 sm:col-span-7">
                <select
                  id="sector-select"
                  disabled={modelSectors.length === 0}
                  className={`w-full border-2 rounded-2xl px-4 py-4 text-sm font-black outline-none transition-all disabled:opacity-50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
                  value={newServiceId}
                  title="Selecionar Setor"
                  onChange={(e) => {
                    const sectorId = e.target.value;
                    setNewServiceId(sectorId);
                    const existingNote = (sectorNotes?.[sectorId] || [])[0];
                    setNewServiceNoteName(existingNote?.name || '');
                    setNewServiceNote(existingNote?.text || '');
                  }}
                >
                  <option value="">Setor...</option>
                  {modelSectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="col-span-8 sm:col-span-3 relative">
                <input
                  id="service-cost-input"
                  type="number"
                  placeholder="R$ 0.00"
                  className={`w-full border-2 rounded-2xl pl-4 pr-11 py-4 text-sm font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100'}`}
                  value={newServiceCost}
                  title="Custo do Serviço"
                  onChange={(e) => setNewServiceCost(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowServiceCostCalc(true)}
                  title="Abrir Calculadora do Custo do Serviço"
                  aria-label="Abrir calculadora para definir o custo do serviço"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  <Calculator size={16} />
                </button>
              </div>
              <div className="col-span-4 sm:col-span-2 flex items-center justify-center">
                <button
                  onClick={() => {
                    if (!newServiceId) return;
                    const services = [...(editing.services || [])];
                    services.push({ serviceId: newServiceId, cost: Number(newServiceCost) || 0, noteName: newServiceNoteName.trim() || undefined, note: newServiceNote.trim() || undefined });
                    setEditing({ ...editing, services });
                    setNewServiceId('');
                    setNewServiceCost(0);
                    setNewServiceNoteName('');
                    setNewServiceNote('');
                  }}
                  title="Adicionar Setor ao Fluxo"
                  className="w-full h-11 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                >
                  <Plus size={18} strokeWidth={3} />
                </button>
              </div>
              <div className="col-span-12 sm:col-span-4">
                <input
                  id="service-note-name-input"
                  type="text"
                  placeholder="Nome (opcional) — ex: BORDADO"
                  className={`w-full border-2 rounded-2xl px-4 py-3 text-xs font-bold outline-none transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600' : 'bg-white border-slate-100 text-slate-900 placeholder:text-slate-400'}`}
                  value={newServiceNoteName}
                  title="Nome do Serviço"
                  onChange={(e) => setNewServiceNoteName(e.target.value)}
                />
              </div>
              <div className="col-span-12 sm:col-span-8">
                <input
                  id="service-note-input"
                  type="text"
                  placeholder="Descrição (opcional) — ex: BORDADO NO PEITO, LOGO CENTRALIZADA"
                  className={`w-full border-2 rounded-2xl px-4 py-3 text-xs font-bold outline-none transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600' : 'bg-white border-slate-100 text-slate-900 placeholder:text-slate-400'}`}
                  value={newServiceNote}
                  title="Descrição do Serviço"
                  onChange={(e) => setNewServiceNote(e.target.value)}
                />
              </div>
           </div>

           <CalculatorModal
             isOpen={showServiceCostCalc}
             onClose={() => setShowServiceCostCalc(false)}
             isDarkMode={isDarkMode}
             initialValue={Number(newServiceCost) || 0}
             onResult={(val) => {
               setNewServiceCost(val);
               setShowServiceCostCalc(false);
             }}
           />

           <div className="space-y-2">
              {(editing.services || []).map((s, idx) => (
                <div key={idx} className="flex flex-col gap-2 p-4 rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sectors.find(sec => sec.id === s.serviceId)?.color }} />
                      <span className="text-xs font-black uppercase">{sectors.find(sec => sec.id === s.serviceId)?.name || 'Setor'}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-black text-amber-600">R$ {s.cost.toFixed(2)}</span>
                      <button
                        onClick={() => setEditing({ ...editing, services: editing.services?.filter((_, i) => i !== idx) })}
                        title="Remover Setor"
                        className="text-slate-300 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {(s.noteName || s.note) && (
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 pl-6 leading-relaxed">
                      {s.noteName && <span className="font-black text-slate-700 dark:text-slate-300">{s.noteName}: </span>}
                      "{s.note}" <span className="text-amber-600 dark:text-amber-400">— vai para Instruções por Setor</span>
                    </p>
                  )}
                </div>
              ))}
           </div>
           </div>
           )}
        </div>

        {/* Confirmar - ao final do formulário */}
        <button
          type="button"
          onClick={() => {
            // Peças com faca (needsTool) calculam a quantidade automaticamente via
            // calculateConsumption e mostram o resultado em "Consumo Médio" lendo direto de
            // editing.quantity — o campo/calculadora de Qtd (calcQty) nem aparece nesse modo,
            // então salvar com evaluate(calcQty) gravava um valor obsoleto (ex: "1" default)
            // em vez do consumo real calculado pela faca.
            const finalQuantity = (needsTool && !editing.ignoreQuantity) ? editing.quantity : evaluate(calcQty);
            onSave({ ...editing, quantity: finalQuantity, unitValue: evaluate(calcUnitVal) });
          }}
          disabled={
            SIMPLE_FORM_CATEGORIES.includes(editing.category) || editing.entryType === 'GENERIC'
              ? !editing.name?.trim()
              : (!editing.materialId || (materialRequiresColor && !editing.colorId && !editing.ignoreColor))
          }
          title={
            SIMPLE_FORM_CATEGORIES.includes(editing.category) ? `Informe o ${simpleFormLabel.replace(/^Nome (do|da) /i, '').toLowerCase()}`
              : editing.entryType === 'GENERIC' ? "Informe o nome do serviço/item"
              : (materialRequiresColor && !editing.colorId && !editing.ignoreColor) ? "Selecione uma cor para confirmar" : "Confirmar engenharia e salvar"
          }
          aria-label="Confirmar engenharia e salvar alterações"
          className={`w-full px-6 py-4 rounded-2xl flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:grayscale ${isDarkMode ? 'bg-indigo-600 shadow-indigo-900/40' : 'bg-slate-900 shadow-slate-900/20 text-white'}`}
        >
          <Save size={18} /> Confirmar
        </button>

      </div>

      {/* Modal de Cadastro Rápido de Insumo */}
      <Modal
        isOpen={showQuickAddMaterial}
        onClose={() => setShowQuickAddMaterial(false)}
        title="Cadastrar Novo Insumo"
        maxWidth="max-w-md"
        zIndex={100000}
      >
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Nome do Insumo *</label>
            <input
              type="text"
              value={quickAddMaterialName}
              onChange={(e) => setQuickAddMaterialName(e.target.value.toUpperCase())}
              placeholder="NOME DO MATERIAL"
              autoFocus
              className={`w-full px-4 py-3 rounded-2xl border-2 font-bold text-sm outline-none transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'}`}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Categoria</label>
            <select
              value={quickAddCategory}
              onChange={(e) => setQuickAddCategory(e.target.value)}
              title="Categoria do Insumo"
              className={`w-full px-4 py-3 rounded-2xl border-2 font-bold text-sm outline-none transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
            >
              <option value="">SELECIONAR...</option>
              {[...new Set([
                ...materials.map(m => m.metadata?.masterCategory).filter(Boolean) as string[],
                'SOLADOS', 'PALMILHAS', 'COURO/SINTÉTICO', 'FORROS', 'ADESIVOS', 'LINHAS', 'EMBALAGENS', 'OUTROS'
              ])].sort().map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Unidade</label>
              <select
                value={quickAddUnitId}
                onChange={(e) => setQuickAddUnitId(e.target.value)}
                title="Unidade de Medida"
                className={`w-full px-4 py-3 rounded-2xl border-2 font-bold text-sm outline-none transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
              >
                <option value="">UN</option>
                {productionConfigs.filter(c => c.type === 'UNIT').map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Custo Base</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={quickAddBaseCost}
                  onChange={(e) => setQuickAddBaseCost(e.target.value)}
                  placeholder="0,00"
                  className={`w-full pl-4 pr-11 py-3 rounded-2xl border-2 font-bold text-sm outline-none transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowQuickCostCalc(true)}
                  title="Abrir Calculadora"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  <Calculator size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Observação</label>
            <textarea
              value={quickAddObservacao}
              onChange={(e) => setQuickAddObservacao(e.target.value)}
              placeholder="Anotações para conferência posterior..."
              title="Observação sobre o insumo"
              rows={3}
              className={`w-full px-4 py-3 rounded-2xl border-2 font-medium text-sm outline-none transition-all resize-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500'}`}
            />
          </div>

          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            * Outros detalhes podem ser completados no Catálogo de Insumos
          </p>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowQuickAddMaterial(false)}
              className={`flex-1 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveQuickMaterial}
              disabled={!quickAddMaterialName.trim() || isSavingQuickMaterial}
              className="flex-1 py-3 rounded-2xl bg-emerald-600 text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:grayscale transition-all active:scale-[0.98]"
            >
              {isSavingQuickMaterial ? 'Salvando...' : 'Cadastrar'}
            </button>
          </div>
        </div>
      </Modal>

      <CalculatorModal
        isOpen={showQuickCostCalc}
        onClose={() => setShowQuickCostCalc(false)}
        isDarkMode={isDarkMode}
        initialValue={parseFloat(quickAddBaseCost.replace(',', '.')) || 0}
        zIndex={110000}
        onResult={(val) => {
          setQuickAddBaseCost(val.toString().replace('.', ','));
          setShowQuickCostCalc(false);
        }}
      />
    </motion.div>
  );
}
