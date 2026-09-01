import { useMemo, useState } from "react";
import { X, Plus, Trash2, PackagePlus, Calculator } from "lucide-react";
import { GeneralPurchaseItem, Person, ProductionConfigItem } from "../types";
import { generateId } from "../utils/id";
import ComboBox from "./ComboBox";
import CalculatorModal from "./CalculatorModal";

type ItemKind = "material" | "person" | "general";

interface DraftEntry {
  id: string;
  kind: ItemKind;
  description: string;
  quantity: number;
  value: number;
  materialId?: string;
  personId?: string;
  unit?: string;
}

interface AddPurchaseEntriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (items: GeneralPurchaseItem[]) => void;
  isDarkMode: boolean;
  people: Person[];
  productionConfigs: ProductionConfigItem[];
}

const MODAL_Z_INDEX = 300000;
const POPUP_Z_INDEX = MODAL_Z_INDEX + 10000;

export default function AddPurchaseEntriesModal({
  isOpen,
  onClose,
  onConfirm,
  isDarkMode,
  people,
  productionConfigs,
}: AddPurchaseEntriesModalProps) {
  const [kind, setKind] = useState<ItemKind>("general");
  const [materialId, setMaterialId] = useState("");
  const [personId, setPersonId] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [value, setValue] = useState("");
  const [entries, setEntries] = useState<DraftEntry[]>([]);
  const [calcField, setCalcField] = useState<"quantity" | "value" | null>(null);

  const availableMaterials = useMemo(
    () => productionConfigs.filter((c) => c.type === "MATERIAL" || c.type === "PACKAGING"),
    [productionConfigs]
  );
  const unitConfigs = useMemo(() => productionConfigs.filter((c) => c.type === "UNIT"), [productionConfigs]);
  const availableThirdParties = useMemo(
    () => people.filter((p) => p.isSupplier || p.isServiceProvider),
    [people]
  );

  const getMaterialUnit = (mat: ProductionConfigItem) => {
    const unitItem = unitConfigs.find((u) => u.id === mat.metadata?.unitId);
    return unitItem?.name || mat.metadata?.unit || "";
  };

  if (!isOpen) return null;

  const qtyNum = parseFloat(quantity.replace(",", ".")) || 0;
  const valueNum = parseFloat(value.replace(",", ".")) || 0;
  const draftTotal = qtyNum * valueNum;
  const entriesTotal = entries.reduce((acc, e) => acc + e.quantity * e.value, 0);

  const resetDraft = () => {
    setKind("general");
    setMaterialId("");
    setPersonId("");
    setDescription("");
    setQuantity("1");
    setValue("");
  };

  const handleClose = () => {
    resetDraft();
    setEntries([]);
    onClose();
  };

  const handleAddEntry = () => {
    if (!description.trim() || qtyNum <= 0 || valueNum <= 0) return;
    const selectedMat = kind === "material" ? availableMaterials.find((m) => m.id === materialId) : undefined;
    setEntries((prev) => [
      ...prev,
      {
        id: generateId(),
        kind,
        description: description.trim(),
        quantity: qtyNum,
        value: valueNum,
        materialId: kind === "material" ? materialId || undefined : undefined,
        personId: kind === "person" ? personId || undefined : undefined,
        unit: selectedMat ? getMaterialUnit(selectedMat) : undefined,
      },
    ]);
    resetDraft();
  };

  const handleRemoveEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleConfirm = () => {
    if (entries.length === 0) return;
    const items: GeneralPurchaseItem[] = entries.map((e) => ({
      id: generateId(),
      description: e.description,
      quantity: e.quantity,
      value: e.value,
      kind: e.kind,
      materialId: e.materialId,
      personId: e.personId,
      unit: e.unit,
    }));
    onConfirm(items);
    resetDraft();
    setEntries([]);
  };

  const inputClass = `w-full rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
    isDarkMode
      ? "bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500"
      : "bg-slate-50 border border-slate-100 text-slate-700 placeholder:text-slate-400"
  }`;

  const kindLabel: Record<ItemKind, string> = {
    material: "Material",
    person: "Fornecedor / Terceirizado",
    general: "Gerais",
  };

  return (
    <div className="fixed inset-0 z-[300000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div
        className={`w-full max-w-md max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300 ${
          isDarkMode ? "bg-slate-900 border border-slate-800" : "bg-white"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 flex justify-between items-start shrink-0">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDarkMode ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
              <PackagePlus size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className={`text-lg font-black uppercase tracking-tight leading-none ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                Novo Lançamento
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 font-bold uppercase tracking-widest mt-1">
                Adiciona itens e soma ao total da compra
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            data-guide-anchor="addPurchaseEntries.fechar"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isDarkMode ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-slate-50 text-slate-400 hover:text-slate-600"}`}
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
          {/* Tipo do item: Material x Fornecedor/Terceirizado x Geral */}
          <div className="flex rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 overflow-hidden">
            {(["material", "person", "general"] as ItemKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => { setKind(k); setMaterialId(""); setPersonId(""); setDescription(""); }}
                data-guide-anchor="addPurchaseEntries.selecionarTipo"
                className={`flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all border-r last:border-r-0 ${isDarkMode ? "border-slate-700" : "border-slate-200"} ${kind === k ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 dark:text-slate-400"}`}
              >
                {kindLabel[k]}
              </button>
            ))}
          </div>

          {/* Campo principal: Material, Fornecedor/Terceirizado ou Descrição */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">
              {kind === "person" ? "Fornecedor / Terceirizado" : kind === "material" ? "Material" : "Descrição"}
            </label>

            {kind === "material" && (
              <>
                <ComboBox
                  options={availableMaterials.map((m) => ({ id: m.id, name: m.name }))}
                  value={materialId}
                  onChange={(val) => {
                    setMaterialId(val);
                    const mat = availableMaterials.find((m) => m.id === val);
                    setDescription(mat?.name || description);
                  }}
                  placeholder="Pesquisar material..."
                  isDarkMode={isDarkMode}
                  usePopupModal
                  popupZIndex={POPUP_Z_INDEX}
                />
                {!materialId && (
                  <input
                    type="text"
                    placeholder="Ou descreva manualmente..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={`${inputClass} mt-1`}
                  />
                )}
              </>
            )}

            {kind === "person" && (
              <>
                <ComboBox
                  options={availableThirdParties.map((p) => ({ id: p.id, name: p.name }))}
                  value={personId}
                  onChange={(val) => {
                    setPersonId(val);
                    const person = availableThirdParties.find((p) => p.id === val);
                    setDescription(person?.name || description);
                  }}
                  placeholder="Pesquisar fornecedor ou terceirizado..."
                  isDarkMode={isDarkMode}
                  usePopupModal
                  popupZIndex={POPUP_Z_INDEX}
                />
                <input
                  type="text"
                  placeholder="Descreva o serviço ou motivo..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={`${inputClass} mt-1`}
                />
              </>
            )}

            {kind === "general" && (
              <input
                type="text"
                placeholder="Ex: Couros"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">Qtd</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setCalcField("quantity")}
                  data-guide-anchor="addPurchaseEntries.calculadoraQtd"
                  className="w-11 shrink-0 flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 transition-colors"
                  aria-label="Calculadora da quantidade"
                  title="Calculadora da quantidade"
                >
                  <Calculator size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">Valor Unit. (R$)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0,00"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setCalcField("value")}
                  data-guide-anchor="addPurchaseEntries.calculadoraValor"
                  className="w-11 shrink-0 flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 transition-colors"
                  aria-label="Calculadora do valor"
                  title="Calculadora do valor"
                >
                  <Calculator size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>

          <div className={`flex items-center justify-between px-4 py-3 rounded-2xl ${isDarkMode ? "bg-slate-800/40" : "bg-slate-50"}`}>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total do Item</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">
              R$ {draftTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <button
            type="button"
            onClick={handleAddEntry}
            disabled={!description.trim() || qtyNum <= 0 || valueNum <= 0}
            data-guide-anchor="addPurchaseEntries.adicionar"
            className="w-full py-3 rounded-xl text-[12px] font-black uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 disabled:opacity-40 disabled:active:scale-100"
          >
            <Plus size={16} strokeWidth={3} /> Adicionar
          </button>

          {entries.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">
                Itens a lançar ({entries.length})
              </span>
              {entries.map((e) => (
                <div
                  key={e.id}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border ${isDarkMode ? "bg-slate-800/40 border-slate-700" : "bg-slate-50 border-slate-100"}`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{e.description}</p>
                    <p className="text-[10px] font-bold text-slate-500">
                      {kindLabel[e.kind]} · {e.quantity} × R$ {e.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                      R$ {(e.quantity * e.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveEntry(e.id)}
                      data-guide-anchor="addPurchaseEntries.removerItem"
                      className="w-7 h-7 flex items-center justify-center rounded-full text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                      aria-label="Remover item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 flex flex-col gap-3 shrink-0 ${isDarkMode ? "bg-slate-800/30" : "bg-slate-50/50"}`}>
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Soma a adicionar</span>
            <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
              R$ {entriesTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={entries.length === 0}
            data-guide-anchor="addPurchaseEntries.lancar"
            className="w-full py-3 text-white rounded-xl text-[12px] font-black uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 bg-emerald-600 disabled:opacity-40 disabled:active:scale-100"
          >
            <PackagePlus size={16} /> Lançar na Compra
          </button>
          <button
            type="button"
            onClick={handleClose}
            data-guide-anchor="addPurchaseEntries.cancelar"
            className={`w-full py-3 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all ${isDarkMode ? "bg-slate-700 text-slate-200" : "bg-slate-100 text-slate-700"}`}
          >
            Cancelar
          </button>
        </div>
      </div>

      <CalculatorModal
        isOpen={!!calcField}
        onClose={() => setCalcField(null)}
        onResult={(res) => {
          if (calcField === "quantity") setQuantity(String(res));
          if (calcField === "value") setValue(String(res));
        }}
        isDarkMode={isDarkMode}
        initialValue={calcField === "quantity" ? qtyNum : calcField === "value" ? valueNum : 0}
        zIndex={POPUP_Z_INDEX}
      />
    </div>
  );
}
