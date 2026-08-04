import type { ReactNode } from 'react';
import { ArrowLeft, Package, User, Boxes, FileText, Image as ImageIcon, PenLine, CheckSquare, Layers } from 'lucide-react';
import { DeliveryPrintPrefs } from '../types';

interface DeliveryPrintConfigViewProps {
  isDarkMode: boolean;
  onBack: () => void;
  prefs: DeliveryPrintPrefs;
  onUpdatePrefs: (patch: Partial<DeliveryPrintPrefs>) => void;
}

// Central de Impressão de Entregas — só define as preferências PADRÃO (o que vem
// pré-marcado ao abrir o modal de impressão de dentro de uma rota) — o motorista/gestor
// ainda ajusta livremente naquele momento, sem alterar o que está salvo aqui.
export default function DeliveryPrintConfigView({
  isDarkMode,
  onBack,
  prefs,
  onUpdatePrefs,
}: DeliveryPrintConfigViewProps) {
  const toggles: { key: keyof Pick<DeliveryPrintPrefs, 'showOrders' | 'showCustomers' | 'showSignatureField' | 'showCheckbox'>; label: string; description: string; icon: ReactNode }[] = [
    { key: 'showOrders', label: 'Mostrar Pedidos', description: 'Número(s) do(s) pedido(s) de cada parada', icon: <FileText size={18} /> },
    { key: 'showCustomers', label: 'Mostrar Clientes', description: 'Nome do cliente de cada parada', icon: <User size={18} /> },
    { key: 'showCheckbox', label: 'Caixa de Checagem', description: 'Quadrado vazio ao lado do número de cada parada, pra marcar à caneta', icon: <CheckSquare size={18} /> },
    { key: 'showSignatureField', label: 'Assinatura do Recebedor', description: 'Linha de assinatura e data ao final de cada parada', icon: <PenLine size={18} /> },
  ];

  // Resumido e Completo são mutuamente exclusivos — marcar um desmarca o outro
  // automaticamente (boxesMode só guarda um valor: 'none' | 'summary' | 'full').
  const boxesOptions: { mode: 'summary' | 'full'; label: string; description: string }[] = [
    { mode: 'summary', label: 'Mostrar Produtos Resumido', description: 'Uma linha por produto/cor — ex.: "300 Preto — 2 CX"' },
    { mode: 'full', label: 'Mostrar Produtos Completo', description: 'Tabela detalhada: produto, cor, pares e caixas' },
  ];

  return (
    <div className="flex flex-col h-full pb-32">
      <div className="flex justify-between items-center px-2 pt-2 pb-4">
        <button onClick={onBack} title="Voltar" aria-label="Voltar"
          className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-500'} shadow-sm`}>
          <ArrowLeft size={20} />
        </button>
        <h1 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Central de Impressão</h1>
        <div className="w-9" />
      </div>

      <div className="flex flex-col gap-6 px-3">
        <div className="flex flex-col gap-2.5">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-1">
            Conteúdo Padrão
          </p>
          <p className="text-[10px] font-bold text-slate-400 px-1 -mt-1.5 leading-relaxed">
            Define o que vem marcado por padrão ao gerar o PDF/JPG de uma rota — ainda dá pra ajustar na hora, dentro da rota.
          </p>
          <div className="flex flex-col gap-2">
            {toggles.map(t => {
              const active = prefs[t.key];
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onUpdatePrefs({ [t.key]: !active })}
                  className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
                    active
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                      : isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  <span className={active ? 'text-teal-500' : 'text-slate-400'}>{t.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.label}</p>
                    <p className="text-[10px] font-bold text-slate-400">{t.description}</p>
                  </div>
                  <div className={`w-10 h-6 rounded-full shrink-0 relative transition-colors ${active ? 'bg-teal-500' : isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              );
            })}
            {boxesOptions.map(opt => {
              const active = prefs.boxesMode === opt.mode;
              return (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => onUpdatePrefs({ boxesMode: active ? 'none' : opt.mode })}
                  className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
                    active
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                      : isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  <span className={active ? 'text-teal-500' : 'text-slate-400'}><Boxes size={18} /></span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{opt.label}</p>
                    <p className="text-[10px] font-bold text-slate-400">{opt.description}</p>
                  </div>
                  <div className={`w-10 h-6 rounded-full shrink-0 relative transition-colors ${active ? 'bg-teal-500' : isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-1 flex items-center gap-1.5">
            <Layers size={14} /> Entregas por Folha
          </p>
          <p className="text-[10px] font-bold text-slate-400 px-1 -mt-1.5 leading-relaxed">
            Automático encaixa o máximo que couber sem nunca cortar os dados de uma entrega entre duas folhas.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {([0, 3, 5, 8, 10, 15] as const).map(n => {
              const active = prefs.stopsPerPage === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onUpdatePrefs({ stopsPerPage: n })}
                  className={`py-3 rounded-2xl border-2 text-[11px] font-black uppercase tracking-wide transition-all active:scale-95 ${
                    active
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'
                      : isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-400' : 'border-slate-100 bg-slate-50 text-slate-400'
                  }`}
                >
                  {n === 0 ? 'Automático' : n}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Outra quantidade:</span>
            <input
              type="number"
              min={1}
              placeholder="Ex: 7"
              value={prefs.stopsPerPage > 0 && ![3, 5, 8, 10, 15].includes(prefs.stopsPerPage) ? prefs.stopsPerPage : ''}
              onChange={(e) => {
                const n = Math.max(1, parseInt(e.target.value, 10) || 0);
                if (n > 0) onUpdatePrefs({ stopsPerPage: n });
              }}
              className={`w-20 py-2 px-3 rounded-xl text-sm font-black text-center ${isDarkMode ? 'bg-slate-800 border border-slate-700 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
              aria-label="Quantidade personalizada de entregas por folha"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-1 flex items-center gap-1.5">
            <Package size={14} /> Tamanho do Papel
          </p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { id: '100x150', label: '100 x 150mm' },
              { id: 'a4', label: 'A4' },
            ] as const).map(opt => {
              const active = prefs.pageSize === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdatePrefs({ pageSize: opt.id })}
                  className={`py-4 rounded-2xl border-2 text-[11px] font-black uppercase tracking-wide transition-all active:scale-95 ${
                    active
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'
                      : isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-400' : 'border-slate-100 bg-slate-50 text-slate-400'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-1">
            Formato de Saída
          </p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { id: 'jpg', label: 'JPG', icon: <ImageIcon size={16} /> },
              { id: 'pdf', label: 'PDF', icon: <FileText size={16} /> },
            ] as const).map(opt => {
              const active = prefs.format === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdatePrefs({ format: opt.id })}
                  className={`flex items-center justify-center gap-2 py-4 rounded-2xl border-2 text-[11px] font-black uppercase tracking-wide transition-all active:scale-95 ${
                    active
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'
                      : isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-400' : 'border-slate-100 bg-slate-50 text-slate-400'
                  }`}
                >
                  {opt.icon} {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
