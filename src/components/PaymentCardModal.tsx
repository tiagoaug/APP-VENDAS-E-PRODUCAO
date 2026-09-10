import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { Share } from '@capacitor/share';
import { X, Copy, Share2, Settings, ChevronDown } from 'lucide-react';
import { PaymentMethod } from '../types';
import PixIcon from './icons/PixIcon';
import { toast } from '../utils/toast';
import {
  subscribeToPaymentCardConfig,
  savePaymentCardConfig,
  DEFAULT_PAYMENT_CARD_CONFIG,
  PaymentCardConfig,
} from '../services/paymentCardConfigService';

interface PaymentCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Mais de um método = mostra uma escolha antes do cartão (ver uso em SalesView.tsx, "Enviar
  // Venda + Cartão de Pagamento"). Um só método = pula direto pro cartão (uso em
  // PaymentMethodsView.tsx, botão "Visualizar").
  methods: PaymentMethod[];
  isDarkMode: boolean;
  // Contexto opcional de uma Venda específica — quando presentes, aparecem no cartão além dos
  // 3 blocos configuráveis (Nome/Chave/QR), que só dizem respeito à identidade do Pix em si.
  amount?: number;
  amountLabel?: string;
}

export default function PaymentCardModal({ isOpen, onClose, methods, isDarkMode, amount, amountLabel }: PaymentCardModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(methods.length === 1 ? methods[0] : null);
  const [config, setConfig] = useState<PaymentCardConfig>(DEFAULT_PAYMENT_CARD_CONFIG);
  const [showConfig, setShowConfig] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToPaymentCardConfig(setConfig);
    return () => unsub();
  }, []);

  useEffect(() => {
    setSelectedMethod(methods.length === 1 ? methods[0] : null);
  }, [methods]);

  useEffect(() => {
    if (!selectedMethod?.value || !config.showQr) { setQrDataUrl(null); return; }
    let cancelled = false;
    QRCode.toDataURL(selectedMethod.value, { width: 220, margin: 1 })
      .then(url => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(null); });
    return () => { cancelled = true; };
  }, [selectedMethod?.value, config.showQr]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.show('Copiado!');
  };

  const handleShare = async () => {
    if (!selectedMethod) return;
    const lines: string[] = [];
    if (config.showName) lines.push(selectedMethod.name);
    if (amountLabel) lines.push(amountLabel);
    if (typeof amount === 'number') lines.push(`Valor a Pagar: R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    if (config.showKey && selectedMethod.value) lines.push(`Chave Pix: ${selectedMethod.value}`);
    try {
      await Share.share({ title: 'Pagamento via Pix', text: lines.join('\n') });
    } catch {
      // usuário cancelou o share nativo — nada a fazer
    }
  };

  const toggleConfig = (key: keyof PaymentCardConfig) => {
    const next = { ...config, [key]: !config[key] };
    setConfig(next);
    savePaymentCardConfig(next);
  };

  return createPortal(
    <div className="fixed inset-0 z-[97000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className={`relative w-full max-w-sm max-h-[85vh] overflow-y-auto custom-scrollbar rounded-[2rem] shadow-2xl border p-5 flex flex-col gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PixIcon size={22} />
            <span className="text-[12px] font-black uppercase tracking-widest">Cartão de Pagamento</span>
          </div>
          <div className="flex items-center gap-1">
            {selectedMethod && (
              <button type="button" title="Configurar o que aparece no cartão" onClick={() => setShowConfig(v => !v)}
                className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
                <Settings size={16} />
              </button>
            )}
            <button type="button" title="Fechar" onClick={onClose}
              className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
              <X size={16} />
            </button>
          </div>
        </div>

        {showConfig && selectedMethod && (
          <div className={`rounded-2xl border p-3 flex flex-col gap-2 ${isDarkMode ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50'}`}>
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">O que mostrar no cartão</span>
            {([
              { key: 'showName' as const, label: 'Nome do Método' },
              { key: 'showKey' as const, label: 'Chave Pix' },
              { key: 'showQr' as const, label: 'QR Code' },
            ]).map(f => (
              <button key={f.key} type="button" onClick={() => toggleConfig(f.key)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-colors ${config[f.key] ? (isDarkMode ? 'bg-teal-950/50 border-teal-500' : 'bg-teal-50 border-teal-300') : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}`}>
                <span className={`text-[10px] font-black uppercase tracking-widest ${config[f.key] ? 'text-teal-600' : isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{f.label}</span>
                <span className={`w-9 h-5 rounded-full relative shrink-0 transition-colors ${config[f.key] ? 'bg-teal-600' : isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${config[f.key] ? 'translate-x-4' : ''}`} />
                </span>
              </button>
            ))}
          </div>
        )}

        {!selectedMethod ? (
          <div className="flex flex-col gap-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-1">Escolha qual chave Pix usar</p>
            {methods.map(m => (
              <button key={m.id} type="button" onClick={() => setSelectedMethod(m)}
                className={`w-full flex items-center justify-between gap-2 p-3.5 rounded-2xl border-2 text-left transition-all ${isDarkMode ? 'border-slate-800 bg-slate-800/50 hover:border-teal-500' : 'border-slate-100 bg-slate-50 hover:border-teal-300'}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <PixIcon size={18} />
                  <div className="min-w-0">
                    <p className={`text-[11px] font-black uppercase tracking-widest truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{m.name}</p>
                    {m.value && <p className="text-[9px] font-bold text-slate-400 truncate">{m.value}</p>}
                  </div>
                </div>
                <ChevronDown size={14} className="shrink-0 -rotate-90" />
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className={`rounded-[1.75rem] border-2 p-5 flex flex-col items-center gap-3 text-center ${isDarkMode ? 'border-teal-900 bg-gradient-to-b from-teal-950/40 to-slate-900' : 'border-teal-100 bg-gradient-to-b from-teal-50 to-white'}`}>
              <PixIcon size={40} />
              {config.showName && (
                <p className={`text-sm font-black uppercase tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{selectedMethod.name}</p>
              )}
              {amountLabel && (
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{amountLabel}</p>
              )}
              {typeof amount === 'number' && (
                <p className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              )}
              {config.showQr && qrDataUrl && (
                <img src={qrDataUrl} alt="QR Code Pix" className="w-40 h-40 rounded-xl border border-slate-200 bg-white p-1" />
              )}
              {config.showKey && selectedMethod.value && (
                <button type="button" onClick={() => copyToClipboard(selectedMethod.value!)}
                  className={`w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900 border border-slate-200'}`}>
                  <span className="text-xs font-bold truncate">{selectedMethod.value}</span>
                  <Copy size={14} className="shrink-0 text-slate-400" />
                </button>
              )}
              <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Toque na chave pra copiar e colar no app do banco</p>
            </div>

            <div className="flex gap-2">
              {methods.length > 1 && (
                <button type="button" onClick={() => setSelectedMethod(null)}
                  className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                  Trocar
                </button>
              )}
              <button type="button" onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-teal-600 text-white text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all">
                <Share2 size={14} /> Compartilhar
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
