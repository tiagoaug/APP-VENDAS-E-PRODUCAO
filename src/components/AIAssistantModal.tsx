import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X, Send, Zap, Loader2, Info, Settings, Trash2, Check, Camera, Mic, Square } from "lucide-react";
import AIQuickPrompts from "./AIQuickPrompts";
import AIAssistantSettings from "./AIAssistantSettings";
import { sendAIChatMessage, AIChatMessage } from "../services/aiService";
import { AIQuickPrompt } from "../types";
import { subscribeToQuickPrompts, seedDefaultQuickPromptsIfEmpty } from "../services/aiSettingsService";
import { compressImageFile, CompressedImage } from "../utils/aiImageUtils";
import { isVoiceInputSupported, ensureVoicePermission, startVoiceListening, stopVoiceListening } from "../services/voiceInputService";

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

export default function AIAssistantModal({ isOpen, onClose, isDarkMode }: AIAssistantModalProps) {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickPrompts, setShowQuickPrompts] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [quickPrompts, setQuickPrompts] = useState<AIQuickPrompt[]>([]);
  const [lastUsage, setLastUsage] = useState<{ input_tokens: number; output_tokens: number } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [attachedImage, setAttachedImage] = useState<CompressedImage | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      setMessages([...newMessages, { role: "assistant", content: response.text }]);
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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      setAttachedImage(compressed);
    } catch {
      setVoiceError(null);
    }
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
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-50 dark:border-slate-800/50 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Sparkles size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">
                    Assistente IA · Claude
                  </h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    Consulta de dados · fotos e voz
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 relative">
                <button
                  type="button"
                  onClick={handleClearChat}
                  title="Limpar conversa"
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 transition-all"
                >
                  <Trash2 size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  title="Configurações"
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                >
                  <Settings size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickPrompts((v) => !v)}
                  title="Perguntas rápidas"
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-500 transition-all"
                >
                  <Zap size={20} />
                </button>
                <AIQuickPrompts
                  isOpen={showQuickPrompts}
                  onClose={() => setShowQuickPrompts(false)}
                  onSelect={handleQuickPrompt}
                  isDarkMode={isDarkMode}
                  prompts={quickPrompts}
                />
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                  aria-label="Fechar"
                >
                  <X size={24} />
                </button>
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

              {messages.map((m, i) => (
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
                </div>
              ))}

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
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  title="Enviar foto"
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  title="Enviar foto"
                  className={`p-4 rounded-2xl transition-all active:scale-95 shrink-0 ${
                    isDarkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                  aria-label="Enviar foto"
                >
                  <Camera size={18} />
                </button>
                {voiceSupported && (
                  <button
                    type="button"
                    onClick={handleToggleVoice}
                    disabled={isLoading}
                    title={isListening ? "Parar gravação" : "Digitar por voz"}
                    className={`p-4 rounded-2xl transition-all active:scale-95 shrink-0 ${
                      isListening
                        ? "bg-rose-500 text-white animate-pulse"
                        : isDarkMode
                        ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                    aria-label={isListening ? "Parar gravação" : "Digitar por voz"}
                  >
                    {isListening ? <Square size={18} /> : <Mic size={18} />}
                  </button>
                )}
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
