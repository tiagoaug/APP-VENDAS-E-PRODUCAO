import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X, Send, Zap, Loader2, Info, Settings, Trash2, Check, Camera as CameraIcon, Images, Mic, Square, UserPlus, ShoppingCart, Copy, FileText, Image as ImageIcon, ClipboardList } from "lucide-react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import AIQuickPrompts from "./AIQuickPrompts";
import AIAssistantSettings from "./AIAssistantSettings";
import SoleNeedsFormModal from "./SoleNeedsFormModal";
import { sendAIChatMessage, AIChatMessage, AIChatResponse, AIFormProposal, AIPersonProposalData, AIPurchaseProposalData, AISolePurchaseProposalData } from "../services/aiService";
import { AIQuickPrompt, SoleStockEntry } from "../types";
import { subscribeToQuickPrompts, seedDefaultQuickPromptsIfEmpty } from "../services/aiSettingsService";
import { photoToCompressedImage, CompressedImage } from "../utils/aiImageUtils";
import { formatCurrency } from "../utils/numbers";
import { isVoiceInputSupported, ensureVoicePermission, startVoiceListening, stopVoiceListening } from "../services/voiceInputService";
import { toast } from "../utils/toast";
import { exportSoleStockReport, StockShareItem } from "../utils/soleStockExport";

type ChatMessage = AIChatMessage & { formProposal?: AIFormProposal };

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  onOpenPersonForm: (data: AIPersonProposalData) => void;
  onOpenPurchaseForm: (data: AIPurchaseProposalData) => void;
  onOpenSolePurchaseForm: (data: AISolePurchaseProposalData) => void;
  soleStockEntries: SoleStockEntry[];
}

export default function AIAssistantModal({ isOpen, onClose, isDarkMode, onOpenPersonForm, onOpenPurchaseForm, onOpenSolePurchaseForm, soleStockEntries }: AIAssistantModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickPrompts, setShowQuickPrompts] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [quickPrompts, setQuickPrompts] = useState<AIQuickPrompt[]>([]);
  const [lastUsage, setLastUsage] = useState<AIChatResponse['usage'] | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [attachedImage, setAttachedImage] = useState<CompressedImage | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isSoleNeedsOpen, setIsSoleNeedsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const voiceSupported = isVoiceInputSupported();

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    seedDefaultQuickPromptsIfEmpty();
    const unsubscribe = subscribeToQuickPrompts(setQuickPrompts);
    return unsubscribe;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen && isListening) {
      stopVoiceListening();
      setIsListening(false);
    }
  }, [isOpen, isListening]);

  const handleClearChat = () => {
    if (messages.length === 0) return;
    setShowClearConfirm(true);
  };

  const confirmClearChat = () => {
    setMessages([]);
    setLastUsage(null);
    setShowClearConfirm(false);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if ((!content && !attachedImage) || isLoading) return;

    const userMessage: AIChatMessage = { role: "user", content };
    if (attachedImage) {
      userMessage.images = [{ mediaType: attachedImage.mediaType, data: attachedImage.data }];
    }

    const newMessages: AIChatMessage[] = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setAttachedImage(null);
    setIsLoading(true);

    try {
      const response = await sendAIChatMessage(newMessages);
      setMessages([...newMessages, { role: "assistant", content: response.text, formProposal: response.formProposal }]);
      setLastUsage(response.usage);
    } catch (err: any) {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content:
            "Não foi possível conectar ao assistente de IA. Verifique se o backend (Cloud Functions + chave da Anthropic) já foi configurado e implantado.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string, autoSend: boolean) => {
    if (autoSend) {
      handleSend(prompt);
    } else {
      setInput(prompt);
    }
  };

  const handleCapturePhoto = async (source: CameraSource) => {
    try {
      const photo = await Camera.getPhoto({
        source,
        resultType: CameraResultType.Base64,
        quality: 85,
        width: 1536,
      });
      const compressed = await photoToCompressedImage(photo);
      setAttachedImage(compressed);
    } catch (error: any) {
      const msg = error?.message || String(error);
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("dismiss")) {
        return;
      }
      toast.show(`Não foi possível obter a imagem: ${msg}`);
    }
  };

  const buildSoleProposalText = (data: AISolePurchaseProposalData) => {
    const lines: string[] = ["Pedido de Solados Sugerido"];
    data.items.forEach((item) => {
      const total = Object.values(item.grid).reduce((s, v) => s + (Number(v) || 0), 0);
      const supplier = item.supplierName ? ` — ${item.supplierName}` : "";
      lines.push(`${item.moldName} • ${item.colorName}${supplier}`);
      const sizesText = Object.entries(item.grid).map(([size, qty]) => `${size}: ${qty}`).join(", ");
      lines.push(`  ${sizesText} (Total: ${total} pares)`);
    });
    if (data.notes) lines.push(`Obs.: ${data.notes}`);
    return lines.join("\n");
  };

  const handleCopySoleProposal = async (data: AISolePurchaseProposalData) => {
    try {
      await navigator.clipboard.writeText(buildSoleProposalText(data));
      toast.show("Dados copiados.");
    } catch {
      toast.show("Não foi possível copiar os dados.");
    }
  };

  const handleExportSoleProposal = async (data: AISolePurchaseProposalData, formatType: "pdf" | "jpg") => {
    const items: StockShareItem[] = data.items.map((item) => ({
      moldName: item.moldName,
      colorName: item.colorName,
      sizes: Object.entries(item.grid).map(([size, qty]) => ({ size, qty: Number(qty) || 0 })),
      total: Object.values(item.grid).reduce((s, v) => s + (Number(v) || 0), 0),
    }));
    const today = new Date();
    const stamp = `${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, "0")}${today.getDate().toString().padStart(2, "0")}`;
    await exportSoleStockReport(
      { items, observations: data.notes, title: "Pedido de Solados Sugerido", subtitle: "Sugestão do Assistente IA" },
      formatType,
      `Pedido_Solados_${stamp}`
    );
  };

  const handleToggleVoice = async () => {
    setVoiceError(null);
    if (isListening) {
      await stopVoiceListening();
      setIsListening(false);
      return;
    }

    const granted = await ensureVoicePermission();
    if (!granted) {
      setVoiceError("Permissão de microfone negada. Habilite o microfone nas configurações do app.");
      return;
    }

    try {
      setIsListening(true);
      await startVoiceListening(
        (text) => setInput(text),
        () => setIsListening(false)
      );
    } catch {
      setIsListening(false);
      setVoiceError("Não foi possível iniciar o reconhecimento de voz.");
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4 no-print" data-no-print="true" style={{ zIndex: 50000 }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`relative w-full max-w-2xl h-[85vh] bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800`}
          >
            {/* Header */}
            <div className="flex flex-col gap-2 px-6 py-5 border-b border-slate-50 dark:border-slate-800/50 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Sparkles size={13} />
                </div>
                <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">
                  Assistente IA · Claude
                </h2>
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">
                Consulta de dados · fotos e voz
              </p>
              <div className="flex items-center justify-center relative">
                <div className="flex flex-col items-center rounded-[1.75rem] bg-slate-100 dark:bg-slate-800/60 divide-y divide-slate-200 dark:divide-slate-700 overflow-hidden">
                  <div className="flex items-stretch justify-center divide-x divide-slate-200 dark:divide-slate-700">
                    <button
                      type="button"
                      onClick={handleClearChat}
                      title="Limpar conversa"
                      className="flex flex-col items-center gap-0.5 w-16 py-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-all"
                    >
                      <Trash2 size={16} />
                      <span className="text-[8px] font-bold uppercase tracking-wide">Limpar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen(true)}
                      title="Configurações"
                      className="flex flex-col items-center gap-0.5 w-16 py-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-all"
                    >
                      <Settings size={16} />
                      <span className="text-[8px] font-bold uppercase tracking-wide">Ajustes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowQuickPrompts((v) => !v)}
                      title="Perguntas rápidas"
                      className="flex flex-col items-center gap-0.5 w-16 py-1.5 text-indigo-500 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-all"
                    >
                      <Zap size={16} />
                      <span className="text-[8px] font-bold uppercase tracking-wide">Perguntas</span>
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="Fechar"
                      className="flex flex-col items-center gap-0.5 w-16 py-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-all"
                    >
                      <X size={16} />
                      <span className="text-[8px] font-bold uppercase tracking-wide">Fechar</span>
                    </button>
                  </div>
                  <div className="flex items-stretch justify-center divide-x divide-slate-200 dark:divide-slate-700">
                    <button
                      type="button"
                      onClick={() => setIsSoleNeedsOpen(true)}
                      disabled={isLoading}
                      title="Planejamento de solados"
                      className="flex flex-col items-center gap-0.5 w-16 py-1.5 text-slate-400 hover:text-indigo-500 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-all disabled:opacity-40"
                    >
                      <ClipboardList size={16} />
                      <span className="text-[8px] font-bold uppercase tracking-wide">Planejar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCapturePhoto(CameraSource.Camera)}
                      disabled={isLoading}
                      title="Tirar foto"
                      className="flex flex-col items-center gap-0.5 w-16 py-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-all disabled:opacity-40"
                    >
                      <CameraIcon size={16} />
                      <span className="text-[8px] font-bold uppercase tracking-wide">Foto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCapturePhoto(CameraSource.Photos)}
                      disabled={isLoading}
                      title="Escolher da galeria"
                      className="flex flex-col items-center gap-0.5 w-16 py-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-all disabled:opacity-40"
                    >
                      <Images size={16} />
                      <span className="text-[8px] font-bold uppercase tracking-wide">Galeria</span>
                    </button>
                    {voiceSupported && (
                      <button
                        type="button"
                        onClick={handleToggleVoice}
                        disabled={isLoading}
                        title={isListening ? "Parar gravação" : "Digitar por voz"}
                        className={`flex flex-col items-center gap-0.5 w-16 py-1.5 transition-all disabled:opacity-40 ${
                          isListening
                            ? "text-rose-500 bg-rose-500/10 animate-pulse"
                            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
                        }`}
                      >
                        {isListening ? <Square size={16} /> : <Mic size={16} />}
                        <span className="text-[8px] font-bold uppercase tracking-wide">Voz</span>
                      </button>
                    )}
                  </div>
                </div>
                <AIQuickPrompts
                  isOpen={showQuickPrompts}
                  onClose={() => setShowQuickPrompts(false)}
                  onSelect={handleQuickPrompt}
                  isDarkMode={isDarkMode}
                  prompts={quickPrompts}
                />
              </div>
            </div>

            {/* Body */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 flex flex-col gap-3">
              <div className={`flex items-start gap-2 p-3 rounded-2xl text-[10px] font-bold leading-relaxed ${isDarkMode ? "bg-indigo-900/20 text-indigo-300" : "bg-indigo-50 text-indigo-600"}`}>
                <Info size={14} className="shrink-0 mt-0.5" />
                <span>
                  Envie fotos (ex: etiquetas, fichas, notas) para a IA ler dados de cadastro, ou use o microfone para digitar por voz. Use o ícone de engrenagem para configurar perguntas rápidas e acompanhar o uso de tokens.
                </span>
              </div>

              <div className={`max-w-[85%] p-4 rounded-2xl text-xs font-semibold leading-relaxed ${isDarkMode ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-700"}`}>
                Olá! Sou o assistente de IA do Gestão Pro. Posso consultar seus produtos, pedidos, financeiro e estoque de solados para responder perguntas e gerar análises. Use o ícone de raio acima para ver perguntas prontas.
              </div>

              {messages.map((m, i) => {
                const personProposal = m.formProposal?.type === 'person' ? m.formProposal.data : null;
                const purchaseProposal = m.formProposal?.type === 'purchase' ? m.formProposal.data : null;
                const soleProposal = m.formProposal?.type === 'sole_purchase' ? m.formProposal.data : null;
                return (
                <div
                  key={i}
                  className={`max-w-[85%] p-4 rounded-2xl text-xs font-semibold leading-relaxed whitespace-pre-wrap flex flex-col gap-2 ${
                    m.role === "user"
                      ? "self-end bg-indigo-600 text-white"
                      : isDarkMode
                      ? "bg-slate-800 text-slate-200"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {m.images?.map((img, imgIdx) => (
                    <img
                      key={imgIdx}
                      src={`data:${img.mediaType};base64,${img.data}`}
                      alt="Imagem enviada"
                      className="max-w-full max-h-48 rounded-xl object-contain"
                    />
                  ))}
                  {m.content && <span>{m.content}</span>}

                  {personProposal && (
                    <div className={`p-3 rounded-xl border-2 flex flex-col gap-2 ${isDarkMode ? "bg-slate-900 border-indigo-500/40" : "bg-white border-indigo-200"}`}>
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Dados extraídos pela IA</span>
                      <div className="flex flex-col gap-0.5 text-[11px] normal-case font-medium">
                        <span><strong>Nome:</strong> {personProposal.name}</span>
                        {personProposal.phone && <span><strong>Telefone:</strong> {personProposal.phone}</span>}
                        {personProposal.email && <span><strong>E-mail:</strong> {personProposal.email}</span>}
                        {personProposal.document && <span><strong>Documento:</strong> {personProposal.document}</span>}
                        {(personProposal.isCustomer || personProposal.isSupplier) && (
                          <span>
                            <strong>Tipo:</strong>{" "}
                            {[personProposal.isCustomer && "Cliente", personProposal.isSupplier && "Fornecedor"].filter(Boolean).join(" / ")}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenPersonForm(personProposal);
                          onClose();
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase tracking-widest transition-colors"
                      >
                        <UserPlus size={14} />
                        Abrir cadastro preenchido
                      </button>
                    </div>
                  )}

                  {purchaseProposal && (
                    <div className={`p-3 rounded-xl border-2 flex flex-col gap-2 ${isDarkMode ? "bg-slate-900 border-indigo-500/40" : "bg-white border-indigo-200"}`}>
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Itens extraídos pela IA</span>
                      <div className="flex flex-col gap-0.5 text-[11px] normal-case font-medium">
                        <span>
                          <strong>Fornecedor:</strong> {purchaseProposal.supplierName || "não identificado"}
                        </span>
                        {purchaseProposal.items.map((item, itemIdx) => (
                          <span key={itemIdx}>
                            • {item.description}
                            {item.quantity ? ` — ${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : ""}
                            {item.value ? ` — ${formatCurrency(item.value)}` : ""}
                          </span>
                        ))}
                        {purchaseProposal.notes && <span><strong>Obs.:</strong> {purchaseProposal.notes}</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenPurchaseForm(purchaseProposal);
                          onClose();
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase tracking-widest transition-colors"
                      >
                        <ShoppingCart size={14} />
                        Abrir compra preenchida
                      </button>
                    </div>
                  )}

                  {soleProposal && (
                    <div className={`p-3 rounded-xl border-2 flex flex-col gap-2 ${isDarkMode ? "bg-slate-900 border-indigo-500/40" : "bg-white border-indigo-200"}`}>
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Pedido de Solados Sugerido</span>
                      <div className="flex flex-col gap-2 text-[11px] normal-case font-medium">
                        {soleProposal.items.map((item, itemIdx) => {
                          const total = Object.values(item.grid).reduce((s, v) => s + (Number(v) || 0), 0);
                          return (
                            <div key={itemIdx} className="flex flex-col gap-1">
                              <span>
                                <strong>{item.moldName}</strong> • {item.colorName}
                                {item.supplierName ? ` — ${item.supplierName}` : ""}
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(item.grid).map(([size, qty]) => (
                                  <span
                                    key={size}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}
                                  >
                                    {size}: {qty}
                                  </span>
                                ))}
                              </div>
                              <span className="text-[10px] text-slate-400 font-bold">{total} pares</span>
                            </div>
                          );
                        })}
                        {soleProposal.notes && <span><strong>Obs.:</strong> {soleProposal.notes}</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenSolePurchaseForm(soleProposal);
                          onClose();
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase tracking-widest transition-colors"
                      >
                        <ShoppingCart size={14} />
                        Abrir pedido preenchido
                      </button>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopySoleProposal(soleProposal)}
                          className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${isDarkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                        >
                          <Copy size={14} />
                          Copiar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportSoleProposal(soleProposal, "pdf")}
                          className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${isDarkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                        >
                          <FileText size={14} />
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportSoleProposal(soleProposal, "jpg")}
                          className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${isDarkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                        >
                          <ImageIcon size={14} />
                          Imagem
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}

              {isLoading && (
                <div className={`flex items-center gap-2 max-w-[85%] p-4 rounded-2xl text-xs font-semibold ${isDarkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-400"}`}>
                  <Loader2 size={14} className="animate-spin" /> Consultando dados e pensando...
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-4 border-t border-slate-50 dark:border-slate-800/50 shrink-0 bg-slate-50/30 dark:bg-slate-900/50">
              {lastUsage && (
                <p className="text-[9px] font-bold text-slate-400 tracking-widest mb-2">
                  Última resposta: {lastUsage.input_tokens + lastUsage.output_tokens} tokens
                  {!!lastUsage.cache_read_input_tokens && ` (${lastUsage.cache_read_input_tokens} via cache)`}
                </p>
              )}
              {voiceError && (
                <p className="text-[9px] font-bold text-red-500 tracking-wide mb-2">{voiceError}</p>
              )}
              {attachedImage && (
                <div className="relative inline-flex mb-2">
                  <img src={attachedImage.dataUrl} alt="Pré-visualização" className="h-16 w-16 object-cover rounded-xl border border-slate-200 dark:border-slate-700" />
                  <button
                    type="button"
                    onClick={() => setAttachedImage(null)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-md"
                    aria-label="Remover imagem"
                  >
                    <X size={11} strokeWidth={3} />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={isListening ? "Ouvindo..." : "Pergunte algo sobre seu negócio..."}
                  className={`flex-1 px-5 py-4 rounded-2xl border text-xs font-semibold outline-none transition-all focus:ring-4 ${
                    isDarkMode
                      ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-indigo-500/10"
                      : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-slate-900/5"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={isLoading || (!input.trim() && !attachedImage)}
                  className="p-4 rounded-2xl bg-indigo-600 text-white disabled:opacity-40 active:scale-95 transition-all shrink-0"
                  aria-label="Enviar"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </motion.div>

          <AIAssistantSettings
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            isDarkMode={isDarkMode}
          />

          <SoleNeedsFormModal
            isOpen={isSoleNeedsOpen}
            onClose={() => setIsSoleNeedsOpen(false)}
            isDarkMode={isDarkMode}
            soleStockEntries={soleStockEntries}
            onSubmit={(text) => handleSend(text)}
          />

          {showClearConfirm && (
            <div className="fixed inset-0 flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ zIndex: 50002 }}>
              <div className={`w-full max-w-sm rounded-[2rem] p-6 shadow-2xl flex flex-col items-center gap-4 ${isDarkMode ? "bg-slate-900" : "bg-white"}`}>
                <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center">
                  <Trash2 size={32} className="text-rose-500" strokeWidth={2} />
                </div>

                <div className="text-center">
                  <h3 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                    Limpar conversa?
                  </h3>
                  <p className="text-xs text-slate-400 font-bold mt-2 leading-relaxed">
                    Todas as mensagens desta conversa serão removidas. Essa ação não pode ser desfeita.
                  </p>
                </div>

                <div className="flex gap-3 w-full mt-1">
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    title="Cancelar"
                    className={`flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 ${
                      isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmClearChat}
                    title="Confirmar limpeza"
                    className="flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-rose-500 text-white shadow-lg shadow-rose-500/20 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Check size={14} /> Limpar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
