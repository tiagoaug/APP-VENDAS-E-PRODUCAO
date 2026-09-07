import { useState } from 'react';
import { ShieldCheck, Mail, ArrowRightLeft, RotateCcw, Bookmark, ChevronRight } from 'lucide-react';
import { ViewType } from '../types';
import { TEMPLATE_ADMIN_EMAIL } from '../utils/templateAdmin';
import { toast } from '../utils/toast';

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
        </div>
        <p className="text-[10px] font-bold text-slate-400 leading-relaxed px-1">
          O botão "Salvar Como Padrão para Novas Contas" dentro de Vendas &gt; Filtros e Configurações também só aparece pra esta conta.
        </p>
      </div>
    </div>
  );
}
