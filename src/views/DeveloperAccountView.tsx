import { useState, useEffect } from 'react';
import { ShieldCheck, Mail, ArrowRightLeft, RotateCcw, Bookmark, ChevronRight, Terminal, X, Copy, Trash2, KeyRound, Check, Pencil, Search } from 'lucide-react';
import { Clipboard } from '@capacitor/clipboard';
import { ViewType } from '../types';
import { TEMPLATE_ADMIN_EMAIL } from '../utils/templateAdmin';
import { toast } from '../utils/toast';
import { isAuthDiagEnabled, setAuthDiagEnabled, readAuthDiagLog, clearAuthDiagLog } from '../lib/authDiagLog';

export interface LicenseEntry {
  uid: string;
  expiresAt: number;
  customerLabel: string | null;
}

interface DeveloperAccountViewProps {
  isDarkMode: boolean;
  currentUserEmail: string | null;
  developerAccountEmail: string | null;
  onSaveDeveloperAccount: (email: string | null) => Promise<void>;
  // Licenciamento comercial — grava/remove a data de expiração de OUTRA conta (a própria
  // firestore.rules exige ser conta de desenvolvimento pra escrever, isto aqui é só a UI).
  onSetUserLicense: (targetUid: string, expiresAt: number | null, customerLabel?: string) => Promise<void>;
  // Todos os clientes com licença configurada (collectionGroup, ver App.tsx) — null enquanto
  // ainda não chegou o primeiro snapshot.
  allLicenses: LicenseEntry[] | null;
  onNavigate: (view: ViewType) => void;
}

// Tela só pra quem já é conta de desenvolvimento (ver isTemplateAdmin() — o e-mail fixo em
// templateAdmin.ts OU quem estiver delegado aqui). Reúne duas coisas: 1) QUAL conta tem os
// poderes de dev hoje, com a troca pra quando o Tiago mudar de e-mail/conta principal (sem
// editar código nem fazer deploy de firestore.rules — só quem já é dev pode reatribuir, então
// nunca vira uma brecha de autopromoção); 2) as AÇÕES que só essa conta pode fazer (hoje só
// "Configurações Padrão pra Novos Usuários", movida pra cá de dentro de Mais > Acessibilidade —
// futuras ações de dev entram aqui do mesmo jeito, sem espalhar pelo resto de Configurações).
export default function DeveloperAccountView({ isDarkMode, currentUserEmail, developerAccountEmail, onSaveDeveloperAccount, onSetUserLicense, allLicenses, onNavigate }: DeveloperAccountViewProps) {
  const [isSaving, setIsSaving] = useState(false);
  // Licenciamento comercial — painel (lista de todos os clientes com licença) + formulário
  // de adicionar/editar um cliente por vez, dentro do mesmo popup. UID + data de vencimento
  // digitados manualmente por enquanto (ainda não existe integração automática com
  // pagamento). O UID se pega em Firebase Console > Authentication, buscando pelo e-mail do
  // cliente. `editingUid` != null quando o formulário abriu a partir de "Editar" na lista —
  // trava o campo de UID (só dá pra mudar data/nome de quem já está cadastrado).
  const [showLicensePanel, setShowLicensePanel] = useState(false);
  const [showLicenseForm, setShowLicenseForm] = useState(false);
  const [licenseUid, setLicenseUid] = useState('');
  const [licenseLabel, setLicenseLabel] = useState('');
  const [licenseDate, setLicenseDate] = useState('');
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [isSavingLicense, setIsSavingLicense] = useState(false);

  const openNewLicense = () => {
    setEditingUid(null);
    setLicenseUid('');
    setLicenseLabel('');
    setLicenseDate('');
    setShowLicenseForm(true);
  };
  const openEditLicense = (entry: LicenseEntry) => {
    setEditingUid(entry.uid);
    setLicenseUid(entry.uid);
    setLicenseLabel(entry.customerLabel || '');
    setLicenseDate(new Date(entry.expiresAt).toISOString().slice(0, 10));
    setShowLicenseForm(true);
  };
  // Busca por chave (UID) ou nome do cliente — útil assim que a lista crescer com clientes
  // de verdade, pra não precisar rolar tudo pra achar um.
  const [licenseSearch, setLicenseSearch] = useState('');
  const closeLicensePanel = () => {
    setShowLicensePanel(false);
    setLicenseSearch('');
  };
  const sortedLicenses = (allLicenses || [])
    .filter(e => {
      const q = licenseSearch.trim().toLowerCase();
      if (!q) return true;
      return e.uid.toLowerCase().includes(q) || (e.customerLabel || '').toLowerCase().includes(q);
    })
    .sort((a, b) => a.expiresAt - b.expiresAt);
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

  const handleSaveLicense = async () => {
    if (!licenseUid.trim() || !licenseDate) {
      toast.show('Preencha o UID do cliente e a data de vencimento.');
      return;
    }
    setIsSavingLicense(true);
    try {
      const expiresAt = new Date(licenseDate + 'T23:59:59').getTime();
      await onSetUserLicense(licenseUid, expiresAt, licenseLabel);
      toast.show(`Licença definida até ${new Date(expiresAt).toLocaleDateString('pt-BR')}.`);
      setShowLicenseForm(false);
    } catch (e: any) {
      toast.show('Erro ao salvar licença: ' + (e?.message || e));
    } finally {
      setIsSavingLicense(false);
    }
  };

  const handleRemoveLicense = async () => {
    if (!licenseUid.trim()) {
      toast.show('Preencha o UID do cliente.');
      return;
    }
    setIsSavingLicense(true);
    try {
      await onSetUserLicense(licenseUid, null);
      toast.show('Licença removida — conta liberada sem data de vencimento.');
      setShowLicenseForm(false);
    } catch (e: any) {
      toast.show('Erro ao remover licença: ' + (e?.message || e));
    } finally {
      setIsSavingLicense(false);
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
          <button
            onClick={() => setShowLicensePanel(true)}
            title="Licenças de Clientes"
            aria-label="Gerenciar licenças de clientes"
            className={`w-full flex items-center justify-between p-4 transition-colors active:bg-slate-100 dark:active:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-50'}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                <KeyRound size={20} />
              </div>
              <div className="text-left">
                <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Licenças de Clientes</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Definir ou remover data de vencimento por conta</p>
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

      {showLicensePanel && (
        <div className="fixed inset-0 z-[200000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={closeLicensePanel}>
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md max-h-[85vh] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
          >
            <div className={`p-5 flex items-center justify-between gap-3 border-b shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                  <KeyRound size={18} />
                </div>
                <h3 className={`text-sm font-black uppercase tracking-widest truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Licenças de Clientes</h3>
              </div>
              <button type="button" onClick={closeLicensePanel} className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`} aria-label="Fechar">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-5 flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
              <button
                type="button"
                onClick={openNewLicense}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <KeyRound size={15} /> Nova Licença
              </button>

              {allLicenses !== null && allLicenses.length > 0 && (
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={licenseSearch}
                    onChange={(e) => setLicenseSearch(e.target.value)}
                    placeholder="Buscar por nome ou UID..."
                    className={`w-full pl-9 pr-3 py-2.5 rounded-xl border-2 text-xs font-bold outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
                  />
                </div>
              )}

              {allLicenses === null ? (
                <p className="text-[10px] font-bold text-slate-400 text-center py-6">Carregando...</p>
              ) : allLicenses.length === 0 ? (
                <p className="text-[10px] font-bold text-slate-400 text-center py-6">Nenhum cliente com licença configurada ainda — todas as contas continuam liberadas sem restrição.</p>
              ) : sortedLicenses.length === 0 ? (
                <p className="text-[10px] font-bold text-slate-400 text-center py-6">Nenhum cliente encontrado pra "{licenseSearch}".</p>
              ) : (
                sortedLicenses.map(entry => {
                  const expired = entry.expiresAt < Date.now();
                  const daysLeft = Math.ceil((entry.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <button
                      key={entry.uid}
                      type="button"
                      onClick={() => openEditLicense(entry)}
                      className={`w-full text-left flex items-center gap-3 p-3 rounded-2xl border transition-all active:scale-[0.99] ${isDarkMode ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${expired ? (isDarkMode ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-50 text-rose-500') : (isDarkMode ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600')}`}>
                        <KeyRound size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-black tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{entry.customerLabel || entry.uid}</p>
                        {entry.customerLabel && <p className="text-[9px] font-bold text-slate-400 truncate">{entry.uid}</p>}
                        <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${expired ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {expired ? `Vencida em ${new Date(entry.expiresAt).toLocaleDateString('pt-BR')}` : `Ativa até ${new Date(entry.expiresAt).toLocaleDateString('pt-BR')} (${daysLeft}d)`}
                        </p>
                      </div>
                      <Pencil size={14} className="text-slate-400 shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {showLicenseForm && (
        <div className="fixed inset-0 z-[200001] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowLicenseForm(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md flex flex-col rounded-[2rem] shadow-2xl overflow-hidden border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
          >
            <div className={`p-5 flex items-center justify-between gap-3 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                  <KeyRound size={18} />
                </div>
                <h3 className={`text-sm font-black uppercase tracking-widest truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{editingUid ? 'Editar Licença' : 'Nova Licença'}</h3>
              </div>
              <button type="button" onClick={() => setShowLicenseForm(false)} className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`} aria-label="Fechar">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {!editingUid && (
                <p className="text-[10px] font-medium tracking-wide text-blue-950 dark:text-blue-300 leading-relaxed">
                  O UID do cliente se pega no Firebase Console → Authentication, buscando pelo
                  e-mail da conta dele. Sem licença cadastrada, a conta nunca fica bloqueada.
                </p>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">UID do Cliente</label>
                <input
                  type="text"
                  value={licenseUid}
                  onChange={(e) => setLicenseUid(e.target.value)}
                  disabled={!!editingUid}
                  placeholder="Ex: aZ1bC2dE3fG4hI5jK6lM7nO8pQ9"
                  className={`w-full px-4 py-3 rounded-2xl border-2 text-sm font-bold outline-none disabled:opacity-60 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Nome do Cliente (opcional)</label>
                <input
                  type="text"
                  value={licenseLabel}
                  onChange={(e) => setLicenseLabel(e.target.value)}
                  placeholder="Ex: Calçados Musgo LTDA"
                  className={`w-full px-4 py-3 rounded-2xl border-2 text-sm font-bold outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Vencimento da Licença</label>
                <input
                  type="date"
                  value={licenseDate}
                  onChange={(e) => setLicenseDate(e.target.value)}
                  className={`w-full px-4 py-3 rounded-2xl border-2 text-sm font-bold outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                />
              </div>

              <button
                type="button"
                onClick={handleSaveLicense}
                disabled={isSavingLicense}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Check size={15} /> {isSavingLicense ? 'Salvando...' : 'Definir Vencimento'}
              </button>
              {editingUid && (
                <button
                  type="button"
                  onClick={handleRemoveLicense}
                  disabled={isSavingLicense}
                  title="Remove a data de vencimento — a conta passa a não ter mais restrição de licença"
                  className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-40 ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Remover Licença (Liberar Sem Vencimento)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
