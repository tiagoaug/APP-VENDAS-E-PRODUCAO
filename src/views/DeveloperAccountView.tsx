import { useState, useEffect } from 'react';
import { ShieldCheck, Mail, ArrowRightLeft, RotateCcw, Bookmark, ChevronRight, Terminal, X, Copy, Trash2 } from 'lucide-react';
import { Clipboard } from '@capacitor/clipboard';
import { ViewType } from '../types';
import { TEMPLATE_ADMIN_EMAIL } from '../utils/templateAdmin';
import { toast } from '../utils/toast';
import { isAuthDiagEnabled, setAuthDiagEnabled, readAuthDiagLog, clearAuthDiagLog } from '../lib/authDiagLog';

interface DeveloperAccountViewProps {
  isDarkMode: boolean;
  currentUserEmail: string | null;
  developerAccountEmail: string | null;
  onSaveDeveloperAccount: (email: string | null) => Promise<void>;
  onNavigate: (view: ViewType) => void;
}

// Tela só pra quem já é conta de desenvolvimento (ver isTemplateAdmin() — o e-mail fixo em
// templateAdmin.ts OU quem estiver delegado aqui). Reúne duas coisas: 1) QUAL conta tem os
// poderes de dev hoje, com a troca pra quando o Tiago mudar de e-mail/conta principal (sem
// editar código nem fazer deploy de firestore.rules — só quem já é dev pode reatribuir, então
// nunca vira uma brecha de autopromoção); 2) as AÇÕES que só essa conta pode fazer (hoje só
// "Configurações Padrão pra Novos Usuários", movida pra cá de dentro de Mais > Acessibilidade —
// futuras ações de dev entram aqui do mesmo jeito, sem espalhar pelo resto de Configurações).
export default function DeveloperAccountView({ isDarkMode, currentUserEmail, developerAccountEmail, onSaveDeveloperAccount, onNavigate }: DeveloperAccountViewProps) {
  const [isSaving, setIsSaving] = useState(false);
  // "Modo Diagnóstico" — painel de log em tela pra depurar bugs difíceis de reproduzir sem
  // Mac/Xcode (ver lib/authDiagLog.ts). Nasceu do bug de login iOS não persistindo, mas fica
  // aqui reaproveitável pra qualquer bug parecido no futuro — qualquer `logAuthDiag()` no app
  // só grava algo quando esse toggle está ligado.
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [diagEnabled, setDiagEnabled] = useState(false);
  const [diagLines, setDiagLines] = useState<string[]>([]);

  useEffect(() => {
    if (!showLogsModal) return;
    setDiagEnabled(isAuthDiagEnabled());
    setDiagLines(readAuthDiagLog());
    const id = setInterval(() => setDiagLines(readAuthDiagLog()), 1000);
    return () => clearInterval(id);
  }, [showLogsModal]);

  const handleCopyLogs = async () => {
    const text = diagLines.join('\n') || 'Nenhum log registrado ainda.';
    try {
      await Clipboard.write({ string: text });
      toast.show('Log copiado!');
    } catch (e: any) {
      toast.show('Erro ao copiar: ' + (e?.message || e));
    }
  };

  const effectiveEmail = developerAccountEmail || TEMPLATE_ADMIN_EMAIL;
  const isCurrentUserAlreadyIt = currentUserEmail === effectiveEmail;
  const isUsingCustomDelegate = !!developerAccountEmail && developerAccountEmail !== TEMPLATE_ADMIN_EMAIL;

  const handleSetCurrentAsDeveloper = async () => {
    if (!currentUserEmail || isSaving) return;
    setIsSaving(true);
    try {
      await onSaveDeveloperAccount(currentUserEmail);
      toast.show('Esta conta agora é a conta de desenvolvimento.');
    } catch (e: any) {
      toast.show('Erro ao salvar: ' + (e?.message || e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSaveDeveloperAccount(null);
      toast.show('Voltou pra conta de desenvolvimento padrão do sistema.');
    } catch (e: any) {
      toast.show('Erro ao salvar: ' + (e?.message || e));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-10 max-w-xl mx-auto">
      <header className="flex items-center gap-3">
        <div className="p-2 rounded-2xl bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Conta Desenvolvedora</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Só você vê isto. Define quem tem acesso a modelos compartilhados e configurações padrão pra contas novas.</p>
        </div>
      </header>

      {/* ── Qual conta é a desenvolvedora ── */}
      <div className="flex flex-col gap-3">
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none px-1">Conta Atual</h3>
        <div className={`p-5 rounded-3xl border shadow-sm flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <div className="flex items-start gap-3">
            <Mail size={16} className="text-slate-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Conta de desenvolvimento atual</p>
              <p className={`text-sm font-black tracking-tight break-all ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{effectiveEmail}</p>
              {!isUsingCustomDelegate && (
                <p className="text-[9px] font-bold text-slate-400 mt-0.5">Padrão do sistema — ninguém delegou outra conta ainda.</p>
              )}
            </div>
          </div>

          {isCurrentUserAlreadyIt ? (
            <p className="text-[10px] font-bold text-emerald-500 leading-relaxed">Você está logado com a conta de desenvolvimento — pode publicar modelos e configurar padrões pra contas novas.</p>
          ) : (
            <button
              type="button"
              onClick={handleSetCurrentAsDeveloper}
              disabled={isSaving}
              className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <ArrowRightLeft size={15} /> Definir esta conta ({currentUserEmail}) como Desenvolvedora
            </button>
          )}

          {isUsingCustomDelegate && (
            <button
              type="button"
              onClick={handleResetToDefault}
              disabled={isSaving}
              className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <RotateCcw size={13} /> Voltar pra conta de desenvolvimento padrão
            </button>
          )}
        </div>
        <p className="text-[10px] font-bold text-slate-400 leading-relaxed px-1">
          Trocar a conta de desenvolvimento aqui não muda seu login nem seus dados — só decide qual e-mail tem os poderes de dev daqui pra frente. Você pode trocar de novo a qualquer momento, sempre a partir de uma conta que já seja dev.
        </p>
      </div>

      {/* ── Ações restritas à conta de desenvolvimento ── */}
      <div className="flex flex-col gap-3">
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none px-1">Ações</h3>
        <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <button
            onClick={() => onNavigate(ViewType.NEW_USER_DEFAULTS)}
            title="Configurações Padrão para Novos Usuários"
            aria-label="Abrir configurações padrão para novos usuários"
            className="w-full flex items-center justify-between p-4 transition-colors active:bg-slate-100 dark:active:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center shrink-0 text-violet-600 dark:text-violet-400">
                <Bookmark size={20} />
              </div>
              <div className="text-left">
                <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Configurações Padrão (Novos Usuários)</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Layout do Dashboard e módulo de cada card</p>
              </div>
            </div>
            <ChevronRight size={18} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
          </button>
          <button
            onClick={() => setShowLogsModal(true)}
            title="Logs"
            aria-label="Abrir logs de diagnóstico"
            className={`w-full flex items-center justify-between p-4 transition-colors active:bg-slate-100 dark:active:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-50'}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                <Terminal size={20} />
              </div>
              <div className="text-left">
                <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Logs</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Modo diagnóstico pra bugs difíceis de reproduzir</p>
              </div>
            </div>
            <ChevronRight size={18} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
          </button>
        </div>
        <p className="text-[10px] font-bold text-slate-400 leading-relaxed px-1">
          O botão "Salvar Como Padrão para Novas Contas" dentro de Vendas &gt; Filtros e Configurações também só aparece pra esta conta.
        </p>
      </div>

      {showLogsModal && (
        <div className="fixed inset-0 z-[200000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowLogsModal(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md max-h-[85vh] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
          >
            <div className={`p-5 flex items-center justify-between gap-3 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                  <Terminal size={18} />
                </div>
                <h3 className={`text-sm font-black uppercase tracking-widest truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Logs</h3>
              </div>
              <button type="button" onClick={() => setShowLogsModal(false)} className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`} aria-label="Fechar">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  const next = !diagEnabled;
                  setAuthDiagEnabled(next);
                  setDiagEnabled(next);
                  setDiagLines(readAuthDiagLog());
                }}
                className={`w-full flex items-center justify-between gap-3 p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}
              >
                <div className="text-left">
                  <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Modo Diagnóstico</p>
                  <p className="text-[10px] text-blue-900 dark:text-blue-300 font-medium tracking-wide mt-0.5">
                    {diagEnabled ? 'Ligado — registrando eventos internos' : 'Desligado — nada é registrado'}
                  </p>
                </div>
                <div className={`w-11 h-6 rounded-full relative shrink-0 transition-colors ${diagEnabled ? 'bg-amber-500' : isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${diagEnabled ? 'left-5' : 'left-0.5'}`} />
                </div>
              </button>

              <div className={`flex-1 min-h-[160px] max-h-[40vh] overflow-y-auto rounded-2xl p-3 text-[10px] font-mono leading-relaxed ${isDarkMode ? 'bg-black text-slate-200' : 'bg-slate-950 text-slate-100'}`}>
                {diagLines.length > 0 ? (
                  diagLines.map((line, i) => <div key={i} className="break-words">{line}</div>)
                ) : (
                  <p className="text-slate-500 italic">Nenhum log registrado ainda.</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopyLogs}
                  className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Copy size={14} /> Copiar
                </button>
                <button
                  type="button"
                  onClick={() => { clearAuthDiagLog(); setDiagLines([]); }}
                  className={`flex-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                >
                  <Trash2 size={14} /> Limpar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
