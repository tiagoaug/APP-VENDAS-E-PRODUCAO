import { X, Calculator, Share2 } from "lucide-react";
import { ComponentConsumption, ProductionConfigItem, Sector } from "../types";
import { shareImage } from "../utils/pdfExport";

interface CategoryGroupLabel {
  cat: string;
  label: string;
  costType?: 'FIXED' | 'VARIABLE';
}

interface ProductCostSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  productLabel: string;
  consumptions: ComponentConsumption[];
  assemblyServices: { serviceId: string; cost: number; note?: string }[];
  productionConfigs: ProductionConfigItem[];
  sectors: Sector[];
  categoryGroups: CategoryGroupLabel[];
  soleName?: string;
  soleCost: number;
  totalCost: number;
  /** Produção estimada (pares/dia) e dias trabalhados/mês do produto — usados para diluir
   * itens de categoria Custo Fixo, mesmos valores configurados no card "Custo Total do
   * Produto". Sem estimatedPairsPerDay > 0, itens fixos não entram no total (mesma regra de lá). */
  estimatedPairsPerDay?: number;
  workDaysPerMonth?: number;
  /** Custo do produto antes de Impostos (engenharia + solado + outras categorias) — base de
   * cálculo dos itens de Impostos/Fretes/Comissões em %, mesmo valor usado no card "Custo Total
   * do Produto". */
  costBeforeTaxes?: number;
}

const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ProductCostSummaryModal({
  isOpen,
  onClose,
  isDarkMode,
  productLabel,
  consumptions,
  assemblyServices,
  productionConfigs,
  sectors,
  categoryGroups,
  soleName,
  soleCost,
  totalCost,
  estimatedPairsPerDay = 0,
  workDaysPerMonth = 26,
  costBeforeTaxes = 0,
}: ProductCostSummaryModalProps) {
  if (!isOpen) return null;

  // Itens de categoria Custo Fixo representam um valor MENSAL — diluído em custo por par
  // (valor ÷ dias trabalhados/mês ÷ produção estimada), igual ao card de Custo Total do
  // Produto. Sem produção estimada preenchida lá, o item não entra no total (mesma regra).
  const itemCost = (item: ComponentConsumption, isFixed = false) => {
    const mat = productionConfigs.find((m) => m.id === item.materialId);
    const unitVal = item.unitValue && item.unitValue > 0 ? item.unitValue : mat?.metadata?.baseCost || 0;
    const rawValue = item.quantity * unitVal;
    const matCost = isFixed
      ? (estimatedPairsPerDay > 0 ? (rawValue / (workDaysPerMonth || 26)) / estimatedPairsPerDay : 0)
      : rawValue;
    const serviceCost = (item.services || []).reduce((acc, s) => acc + s.cost, 0);
    return { mat, matCost, serviceCost, total: matCost + serviceCost };
  };

  // Impostos, Fretes e Comissões/Assessoria: % sobre o Custo (pré-impostos) ou R$ fixo — igual
  // ao card de Custo Total do Produto. Nunca usa itemCost (que é quantity × unitValue). Impostos
  // assume % por padrão quando valueType não foi definido; as demais assumem R$ fixo por padrão
  // (mesma regra do EngineeringEditor).
  const PERCENT_CAPABLE_CATEGORIES = ["TAXES", "SHIPPING", "COMMISSIONS"];
  const isPercentItem = (item: ComponentConsumption) => (item.valueType ? item.valueType === "percentage" : item.category === "TAXES");
  const taxItemCost = (item: ComponentConsumption) => {
    const rate = item.unitValue || 0;
    if (!isPercentItem(item)) return rate;
    return costBeforeTaxes * (rate / 100);
  };

  const cuttingPieces = consumptions.filter((c) => c.category === "CUTTING_PIECE");
  const otherGroups = categoryGroups
    .filter((g) => g.cat !== "CUTTING_PIECE")
    .map((g) => ({ ...g, items: consumptions.filter((c) => c.category === g.cat) }))
    .filter((g) => g.items.length > 0);

  const handleExportJpg = async () => {
    const W = 640;
    const S = 2;
    const pad = 24;

    const mc = document.createElement("canvas");
    mc.width = W * S;
    mc.height = 10;
    const mx = mc.getContext("2d")!;
    mx.scale(S, S);

    const rows: { text: string; sub?: string; value?: string; bold?: boolean; section?: boolean }[] = [];

    rows.push({ text: "PEÇAS DE CORTE (CABEDAL)", section: true });
    if (cuttingPieces.length === 0) rows.push({ text: "Nenhuma peça cadastrada" });
    cuttingPieces.forEach((item) => {
      const { mat, matCost, serviceCost, total } = itemCost(item);
      const sectorNames = (item.services || []).map((s) => sectors.find((sec) => sec.id === s.serviceId)?.name).filter(Boolean).join(", ");
      rows.push({
        text: item.name || mat?.name || "Peça",
        sub: `${mat?.name || "---"} · Mat. ${fmt(matCost)}${serviceCost > 0 ? ` · Serv. ${fmt(serviceCost)} (${sectorNames})` : ""}`,
        value: fmt(total),
      });
    });

    if (assemblyServices.length > 0) {
      rows.push({ text: "SERVIÇOS DO CONJUNTO (CABEDAL INTEIRO)", section: true });
      assemblyServices.forEach((s) => {
        rows.push({
          text: sectors.find((sec) => sec.id === s.serviceId)?.name || "Setor",
          sub: s.note,
          value: fmt(s.cost),
        });
      });
    }

    otherGroups.forEach((g) => {
      rows.push({ text: g.label.toUpperCase(), section: true });
      g.items.forEach((item) => {
        if (PERCENT_CAPABLE_CATEGORIES.includes(g.cat)) {
          const isPct = isPercentItem(item);
          rows.push({
            text: item.name || g.label,
            sub: isPct ? `${item.unitValue || 0}% sobre o Custo` : "Valor fixo",
            value: fmt(taxItemCost(item)),
          });
          return;
        }
        const { mat, total } = itemCost(item, g.costType === "FIXED");
        rows.push({ text: item.name || mat?.name || "Item", value: fmt(total) });
      });
    });

    if (soleCost > 0) {
      rows.push({ text: "SOLADO", section: true });
      rows.push({ text: soleName || "Matriz de Solado", value: fmt(soleCost) });
    }

    const HEADER_H = 90;
    const rowH = (r: (typeof rows)[number]) => (r.section ? 32 : r.sub ? 46 : 32);
    const listH = rows.reduce((acc, r) => acc + rowH(r), 0);
    const TOTAL_H = 66;
    const totalH = HEADER_H + listH + TOTAL_H + pad;

    const canvas = document.createElement("canvas");
    canvas.width = W * S;
    canvas.height = totalH * S;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(S, S);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, totalH);

    let y = 0;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, y, W, HEADER_H);
    ctx.textAlign = "center";
    ctx.font = "bold 20px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("Resumo de Custos do Produto", W / 2, y + 32);
    ctx.font = "600 12px Arial";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(productLabel, W / 2, y + 54);
    ctx.font = "500 9px Arial";
    ctx.fillStyle = "#475569";
    ctx.fillText("Custo estimado por par — uso interno", W / 2, y + 72);
    y += HEADER_H;

    ctx.textAlign = "left";
    rows.forEach((r) => {
      const h = rowH(r);
      if (r.section) {
        ctx.fillStyle = "#f1f5f9";
        ctx.fillRect(pad, y + 4, W - pad * 2, h - 10);
        ctx.font = "bold 10px Arial";
        ctx.fillStyle = "#64748b";
        ctx.fillText(r.text, pad + 10, y + h / 2 + 3);
      } else {
        ctx.font = "700 12px Arial";
        ctx.fillStyle = "#334155";
        ctx.fillText(r.text, pad + 4, y + (r.sub ? 18 : h / 2 + 4));
        if (r.sub) {
          ctx.font = "500 10px Arial";
          ctx.fillStyle = "#94a3b8";
          ctx.fillText(r.sub, pad + 4, y + 33);
        }
        if (r.value) {
          ctx.textAlign = "right";
          ctx.font = "bold 12px Arial";
          ctx.fillStyle = "#0f172a";
          ctx.fillText(r.value, W - pad - 4, y + (r.sub ? 18 : h / 2 + 4));
          ctx.textAlign = "left";
        }
        ctx.strokeStyle = "#f1f5f9";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad, y + h);
        ctx.lineTo(W - pad, y + h);
        ctx.stroke();
      }
      y += h;
    });

    y += 16;
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(W - pad, y);
    ctx.stroke();
    ctx.font = "bold 18px Arial";
    ctx.fillStyle = "#0f172a";
    ctx.fillText("Custo Total do Produto", pad, y + 30);
    ctx.textAlign = "right";
    ctx.font = "bold 22px Arial";
    ctx.fillStyle = "#4f46e5";
    ctx.fillText(fmt(totalCost), W - pad, y + 32);

    const filename = `Custo_${productLabel.replace(/[^a-zA-Z0-9]+/g, "_")}`;
    await shareImage(canvas.toDataURL("image/jpeg", 0.95), filename);
  };

  return (
    <div className="fixed inset-0 z-[300000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div
        className={`w-full max-w-md max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300 ${isDarkMode ? "bg-slate-900 border border-slate-800" : "bg-white"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 flex justify-between items-start shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}>
              <Calculator size={24} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h3 className={`text-lg font-black uppercase tracking-tight leading-none ${isDarkMode ? "text-white" : "text-slate-900"}`}>Resumo de Custos</h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 font-bold uppercase tracking-widest mt-1 truncate">{productLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-all ${isDarkMode ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-slate-50 text-slate-400 hover:text-slate-600"}`}
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
          {/* Peças de Corte */}
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Peças de Corte (Cabedal)</span>
            {cuttingPieces.length === 0 && <p className="text-[10px] text-slate-400 italic px-1">Nenhuma peça cadastrada</p>}
            {cuttingPieces.map((item) => {
              const { mat, matCost, serviceCost, total } = itemCost(item);
              const sectorNames = (item.services || []).map((s) => sectors.find((sec) => sec.id === s.serviceId)?.name).filter(Boolean).join(", ");
              return (
                <div key={item.id} className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border ${isDarkMode ? "bg-slate-800/40 border-slate-700" : "bg-slate-50 border-slate-100"}`}>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.name || mat?.name}</p>
                    <p className="text-[10px] font-bold text-slate-500 truncate">
                      {mat?.name || "---"} · Mat. {fmt(matCost)}
                      {serviceCost > 0 ? ` · Serv. ${fmt(serviceCost)}${sectorNames ? ` (${sectorNames})` : ""}` : ""}
                    </p>
                  </div>
                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 shrink-0">{fmt(total)}</span>
                </div>
              );
            })}
          </div>

          {/* Serviços do Conjunto */}
          {assemblyServices.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Serviços do Conjunto</span>
              {assemblyServices.map((s, idx) => (
                <div key={idx} className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border ${isDarkMode ? "bg-slate-800/40 border-slate-700" : "bg-slate-50 border-slate-100"}`}>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{sectors.find((sec) => sec.id === s.serviceId)?.name || "Setor"}</p>
                    {s.note && <p className="text-[10px] font-bold text-slate-500 truncate">{s.note}</p>}
                  </div>
                  <span className="text-xs font-black text-amber-600 shrink-0">{fmt(s.cost)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Outras Categorias */}
          {otherGroups.map((g) => (
            <div key={g.cat} className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">{g.label}</span>
              {g.items.map((item) => {
                if (PERCENT_CAPABLE_CATEGORIES.includes(g.cat)) {
                  const isPct = isPercentItem(item);
                  return (
                    <div key={item.id} className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border ${isDarkMode ? "bg-slate-800/40 border-slate-700" : "bg-slate-50 border-slate-100"}`}>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.name || g.label}</p>
                        <p className="text-[10px] font-bold text-slate-500 truncate">
                          {isPct ? `${item.unitValue || 0}% sobre o Custo` : "Valor fixo"}
                        </p>
                      </div>
                      <span className="text-xs font-black text-slate-600 dark:text-slate-300 shrink-0">{fmt(taxItemCost(item))}</span>
                    </div>
                  );
                }
                const { mat, total } = itemCost(item, g.costType === "FIXED");
                return (
                  <div key={item.id} className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border ${isDarkMode ? "bg-slate-800/40 border-slate-700" : "bg-slate-50 border-slate-100"}`}>
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate min-w-0">{item.name || mat?.name}</p>
                    <span className="text-xs font-black text-slate-600 dark:text-slate-300 shrink-0">{fmt(total)}</span>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Solado */}
          {soleCost > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Solado</span>
              <div className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border ${isDarkMode ? "bg-slate-800/40 border-slate-700" : "bg-slate-50 border-slate-100"}`}>
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate min-w-0">{soleName || "Matriz de Solado"}</p>
                <span className="text-xs font-black text-emerald-600 shrink-0">{fmt(soleCost)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 flex flex-col gap-3 shrink-0 ${isDarkMode ? "bg-slate-800/30" : "bg-slate-50/50"}`}>
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Custo Total do Produto</span>
            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{fmt(totalCost)}</span>
          </div>
          <button
            type="button"
            onClick={handleExportJpg}
            className="w-full py-3 text-white rounded-xl text-[12px] font-black uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 bg-indigo-600"
          >
            <Share2 size={16} /> Exportar JPG
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`w-full py-3 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all ${isDarkMode ? "bg-slate-700 text-slate-200" : "bg-slate-100 text-slate-700"}`}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
