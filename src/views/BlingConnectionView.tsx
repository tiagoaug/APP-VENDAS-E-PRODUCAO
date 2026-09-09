import { useEffect, useState } from 'react';
import { Building2, Link2, RefreshCw, CheckCircle2, Clock, ListOrdered, Tags as TagsIcon, ChevronRight, KeyRound, Eye, EyeOff, LogOut, PackageMinus, Boxes, FileText, ExternalLink, Timer, HeartPulse, PackageX, ChevronDown, ChevronUp, HelpCircle, Copy, Sparkles } from 'lucide-react';
import { BlingConnection, ViewType } from '../types';
import { subscribeToBlingConnection, saveBlingCredentials, getBlingAuthUrl, syncBlingOrdersNow, fetchBlingProducts, disconnectBling, setBlingAutoSyncInterval } from '../services/blingService';
import { toast } from '../utils/toast';

// URL pública da Cloud Function `blingOAuthCallback` — só existe depois do primeiro deploy de functions.
const BLING_OAUTH_CALLBACK_URL = 'https://us-central1-app-vendas-e-producao.cloudfunctions.net/blingOAuthCallback';

// null = só manual. O scheduler (blingAutoSyncScheduler) roda a cada 5min de qualquer forma, então
// esse é o menor intervalo que faz sentido oferecer.
const AUTO_SYNC_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Manual' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 h' },
  { value: 120, label: '2 h' },
  { value: 360, label: '6 h' },
];

interface BlingConnectionViewProps {
  isDarkMode: boolean;
  onNavigate: (view: ViewType) => void;
}

function formatDate(ts?: number) {
  if (!ts) return 'Nunca';
  return new Date(ts).toLocaleString('pt-BR');
}

/** Tela de conexão com o Bling — o usuário precisa colar o Client ID/Secret do PRÓPRIO app
 * cadastrado no portal de desenvolvedor do Bling antes de poder conectar, já que o Bling
 * não tem um app de parceiro compartilhado. As credenciais são enviadas direto pra uma Cloud Function (nunca
 * gravadas em Firestore lido pelo cliente) — depois disso, o fluxo de login é o mesmo (abre o
 * Bling pra autorizar, volta com o token trocado no backend). */
export default function BlingConnectionView({ isDarkMode, onNavigate }: BlingConnectionViewProps) {
  const [connection, setConnection] = useState<BlingConnection | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncingOrders, setSyncingOrders] = useState(false);
  const [syncingProducts, setSyncingProducts] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [savingInterval, setSavingInterval] = useState(false);
  const [autoSyncOpen, setAutoSyncOpen] = useState(false);
  const [syncSectionOpen, setSyncSectionOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => subscribeToBlingConnection(setConnection), []);

  const handleSetAutoSyncInterval = async (minutes: number | null) => {
    setSavingInterval(true);
    try {
      await setBlingAutoSyncInterval(minutes);
      toast.show(minutes ? `Sincronização automática a cada ${AUTO_SYNC_OPTIONS.find((o) => o.value === minutes)?.label}.` : 'Sincronização automática desligada — só manual.');
    } catch (e: any) {
      toast.show('Erro ao configurar sincronização automática: ' + (e.message || e));
    } finally {
      setSavingInterval(false);
    }
  };

  const isConnected = !!connection?.connected;
  const hasCredentials = !!connection?.hasCredentials;

  const handleSaveCredentials = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.show('Preencha o Client ID e o Client Secret do seu app Bling.');
      return;
    }
    setSavingCredentials(true);
    try {
      await saveBlingCredentials(clientId.trim(), clientSecret.trim());
      toast.show('Credenciais salvas! Agora conecte sua conta Bling.');
      setClientSecret(''); // não mantém o secret em memória depois de salvo
    } catch (e: any) {
      toast.show('Erro ao salvar credenciais: ' + (e.message || e));
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const url = await getBlingAuthUrl(BLING_OAUTH_CALLBACK_URL);
      window.location.href = url;
    } catch (e: any) {
      toast.show('Erro ao iniciar conexão com o Bling: ' + (e.message || e));
      setConnecting(false);
    }
  };

  // Produtos e pedidos sincronizam separado de propósito — produto novo só nasce em ciclos de
  // meses (coleção nova, por exemplo), enquanto pedido precisa ser puxado com frequência (várias
  // vezes ao dia). Juntar os dois deixava a sincronização de pedidos mais lenta à toa.
  const handleSyncOrders = async () => {
    setSyncingOrders(true);
    try {
      const res = await syncBlingOrdersNow();
      toast.show(res.message || `Pedidos sincronizados (${res.ordersImported}).`);
    } catch (e: any) {
      toast.show('Erro ao sincronizar pedidos: ' + (e.message || e));
    } finally {
      setSyncingOrders(false);
    }
  };

  const handleSyncProducts = async () => {
    setSyncingProducts(true);
    try {
      const produtos = await fetchBlingProducts();
      toast.show(`${produtos.length} produto(s) sincronizado(s).`);
    } catch (e: any) {
      toast.show('Erro ao sincronizar produtos: ' + (e.message || e));
    } finally {
      setSyncingProducts(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectBling();
      toast.show('Desconectado do Bling. Conecte de novo quando quiser.');
    } catch (e: any) {
      toast.show('Erro ao desconectar: ' + (e.message || e));
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-32">
      <div className={`rounded-[2rem] border overflow-hidden ${isDarkMode ? 'bg-indigo-950/20 border-indigo-900/40' : 'bg-indigo-50 border-indigo-100'}`}>
        <button
          type="button"
          onClick={() => setHelpOpen((v) => !v)}
          data-guide-anchor="bling.ajudaExpandir"
          className="w-full p-5 flex items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-3">
            <HelpCircle size={20} className="text-indigo-500 shrink-0" />
            <p className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Como conectar o Bling</p>
          </div>
          {helpOpen ? <ChevronUp size={16} className="text-indigo-400 shrink-0" /> : <ChevronDown size={16} className="text-indigo-400 shrink-0" />}
        </button>

        {helpOpen && (
          <div className="px-5 pb-5 flex flex-col gap-4">
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>Pra que serve</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Conecta esse app diretamente ao seu Bling, pra sincronizar pedidos de venda, produtos e estoque, e emitir notas fiscais — sem precisar cadastrar tudo duas vezes.
              </p>
            </div>

            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>Passo a passo (feito no site do Bling)</p>
              <ol className="flex flex-col gap-2.5">
                {[
                  <>Acesse <span className="font-bold">developer.bling.com.br</span> e faça login com a mesma conta que você usa no Bling.</>,
                  <>Clique em <span className="font-bold">"Novo Aplicativo"</span>.</>,
                  <>Dê um nome qualquer pro app (ex: "Vendas e Produção") e escolha uma categoria como <span className="font-bold">Integração/ERP</span>.</>,
                  <>No campo <span className="font-bold">"Link de redirecionamento" (Redirect URI)</span>, cole exatamente a URL abaixo — precisa ser idêntica, sem espaço a mais.</>,
                  <>Em <span className="font-bold">Escopos/Permissões</span>, marque leitura E edição de: <span className="font-bold">Pedidos de Vendas, Produtos, Estoques, Notas Fiscais e Contatos</span>. Sem isso, a sincronização falha depois.</>,
                  <>Salve o app — o Bling vai mostrar um <span className="font-bold">Client ID</span> e um <span className="font-bold">Client Secret</span>. Copie os dois.</>,
                  <>Cole os dois nos campos abaixo, clique em <span className="font-bold">"Salvar credenciais"</span> e depois em <span className="font-bold">"Conectar com o Bling"</span>.</>,
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black mt-0.5 ${isDarkMode ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>{i + 1}</span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">{text}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className={`p-3 rounded-2xl flex items-center justify-between gap-2 ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
              <p className={`text-[10px] font-mono break-all ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{BLING_OAUTH_CALLBACK_URL}</p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(BLING_OAUTH_CALLBACK_URL);
                  toast.show('Link de redirecionamento copiado!');
                }}
                data-guide-anchor="bling.ajudaCopiarRedirect"
                title="Copiar link de redirecionamento"
                aria-label="Copiar link de redirecionamento"
                className="shrink-0 p-2 rounded-xl bg-indigo-600 text-white"
              >
                <Copy size={14} />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 font-medium italic leading-relaxed -mt-2">
              Não abra esse link direto no navegador pra "testar" — ele não é uma página, é só colar no campo "Link de redirecionamento" do cadastro do app no Bling. Quem chama ele é o próprio Bling, automaticamente, no final da autorização.
            </p>

            <div className={`p-3 rounded-2xl flex items-start gap-2.5 ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
              <Sparkles size={16} className="text-violet-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                O Bling muda o próprio painel de vez em quando, então a tela real pode não bater 100% com esse passo a passo. Se travar em algum ponto, pesquise no Google por <span className="font-bold">"criar aplicativo developer bling client id"</span> ou pergunte pra uma IA (ChatGPT, Gemini etc.): <span className="italic">"como criar um app OAuth no Bling ERP e pegar o Client ID e Client Secret"</span> — costuma trazer o passo atualizado com print.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className={`p-6 rounded-[2.5rem] border shadow-sm flex flex-col gap-5 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isConnected ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-800'} text-white shadow-lg`}>
            <Building2 size={26} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-base font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Bling</h3>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
              {isConnected ? `Conectado${connection?.companyName ? ' · ' + connection.companyName : ''}` : hasCredentials ? 'Credenciais salvas · falta conectar' : 'Não configurado'}
            </p>
          </div>
          {isConnected && <CheckCircle2 className="text-emerald-500 shrink-0" size={22} />}
        </div>

        {!hasCredentials ? (
          <div className="flex flex-col gap-3">
            <p className="text-[10px] text-slate-400 font-medium italic leading-relaxed">
              Cadastre um app em <span className="font-bold">developer.bling.com.br</span> (Client ID e Client Secret do SEU app — cada empresa tem o seu, diferente de outras integrações) e cole abaixo.
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><KeyRound size={11} /> Client ID</label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Client ID do app Bling"
                className={`w-full px-4 py-3 rounded-2xl text-xs font-bold outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-100 text-slate-900 placeholder:text-slate-400'}`}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><KeyRound size={11} /> Client Secret</label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="Client Secret do app Bling"
                  className={`w-full px-4 py-3 pr-11 rounded-2xl text-xs font-bold outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-100 text-slate-900 placeholder:text-slate-400'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(v => !v)}
                  data-guide-anchor="bling.secretMostrarToggle"
                  title={showSecret ? 'Ocultar' : 'Mostrar'}
                  aria-label={showSecret ? 'Ocultar Client Secret' : 'Mostrar Client Secret'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              onClick={handleSaveCredentials}
              disabled={savingCredentials}
              data-guide-anchor="bling.salvarCredenciais"
              className="w-full h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <KeyRound size={16} />
              {savingCredentials ? 'Salvando...' : 'Salvar credenciais'}
            </button>
          </div>
        ) : !isConnected ? (
          <button
            onClick={handleConnect}
            disabled={connecting}
            data-guide-anchor="bling.conectar"
            className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
          >
            <Link2 size={16} />
            {connecting ? 'Redirecionando...' : 'Conectar com o Bling'}
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className={`rounded-2xl overflow-hidden ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
              <button onClick={() => setSyncSectionOpen((v) => !v)} data-guide-anchor="bling.syncExpandir" className="w-full p-3 flex items-center justify-between gap-2 text-left">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <RefreshCw size={11} /> Sincronização · Pedidos {formatDate(connection?.lastOrderSyncAt)}
                </p>
                {syncSectionOpen ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
              </button>

              {syncSectionOpen && (
                <div className="px-3 pb-3 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><Clock size={10} /> Últ. Sync Produtos</p>
                      <p className={`text-xs font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{formatDate(connection?.lastProductSyncAt)}</p>
                    </div>
                    <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><Clock size={10} /> Últ. Sync Pedidos</p>
                      <p className={`text-xs font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{formatDate(connection?.lastOrderSyncAt)}</p>
                    </div>
                  </div>

                  <button
                    onClick={handleSyncOrders}
                    disabled={syncingOrders}
                    data-guide-anchor="bling.sincronizarPedidos"
                    className={`w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all ${syncingOrders ? 'animate-pulse' : ''}`}
                  >
                    <RefreshCw size={16} className={syncingOrders ? 'animate-spin' : ''} />
                    {syncingOrders ? 'Sincronizando...' : 'Sincronizar Pedidos'}
                  </button>

                  <button
                    onClick={handleSyncProducts}
                    disabled={syncingProducts}
                    data-guide-anchor="bling.sincronizarProdutos"
                    className={`w-full h-10 rounded-2xl disabled:opacity-60 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-600'} ${syncingProducts ? 'animate-pulse' : ''}`}
                  >
                    <RefreshCw size={13} className={syncingProducts ? 'animate-spin' : ''} />
                    {syncingProducts ? 'Sincronizando produtos...' : 'Sincronizar Produtos'}
                  </button>

                  <div className={`rounded-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                    <button onClick={() => setAutoSyncOpen((v) => !v)} data-guide-anchor="bling.autoSyncExpandir" className="w-full p-3 flex items-center justify-between gap-2 text-left">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                        <Timer size={11} /> Sincronização automática · {AUTO_SYNC_OPTIONS.find((o) => o.value === (connection?.autoSyncIntervalMinutes ?? null))?.label || 'Manual'}
                      </p>
                      {autoSyncOpen ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
                    </button>
                    {autoSyncOpen && (
                      <div className="px-3 pb-3">
                        <div className={`grid grid-cols-3 gap-1 p-1 rounded-2xl ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
                          {AUTO_SYNC_OPTIONS.map((opt) => {
                            const isActive = (connection?.autoSyncIntervalMinutes ?? null) === opt.value;
                            return (
                              <button
                                key={String(opt.value)}
                                onClick={() => handleSetAutoSyncInterval(opt.value)}
                                disabled={savingInterval}
                                data-guide-anchor="bling.autoSyncIntervalo"
                                className={`h-9 rounded-xl text-[10px] font-black uppercase tracking-wide transition-colors disabled:opacity-50 ${
                                  isActive ? 'bg-indigo-600 text-white' : (isDarkMode ? 'text-slate-400' : 'text-slate-500')
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <a
              href="https://www.bling.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-12 rounded-2xl bg-[#00e28a] hover:bg-[#00c97a] text-black font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-[#00e28a]/30 transition-all"
            >
              <ExternalLink size={16} />
              Abrir Bling
            </a>

            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              data-guide-anchor="bling.desconectar"
              className="w-full h-10 rounded-2xl text-rose-500 hover:text-rose-600 disabled:opacity-60 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
            >
              <LogOut size={14} />
              {disconnecting ? 'Desconectando...' : 'Desconectar do Bling'}
            </button>
          </div>
        )}
      </div>

      {isConnected && (
        <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          {[
            { id: ViewType.BLING_HEALTH, label: 'Saúde do Negócio', icon: <HeartPulse size={22} />, color: 'text-rose-500' },
            { id: ViewType.BLING_PRODUCT_MAPPING, label: 'Vincular Produtos', icon: <TagsIcon size={22} />, color: 'text-indigo-500' },
            { id: ViewType.BLING_PICKING_LIST, label: 'Lista de Separação', icon: <PackageMinus size={22} />, color: 'text-amber-500' },
            { id: ViewType.BLING_INVOICE_EMISSION, label: 'Emitir Notas Fiscais', icon: <ListOrdered size={22} />, color: 'text-emerald-500' },
            { id: ViewType.BLING_INVOICES, label: 'Notas Fiscais', icon: <FileText size={22} />, color: 'text-violet-500' },
            { id: ViewType.BLING_STOCK, label: 'Estoque Bling', icon: <Boxes size={22} />, color: 'text-sky-500' },
            { id: ViewType.BLING_DEVOLUCOES, label: 'Devoluções', icon: <PackageX size={22} />, color: 'text-orange-500' },
          ].map((item, index, array) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              data-guide-anchor="bling.menuItem"
              className={`w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${index !== array.length - 1 ? (isDarkMode ? 'border-b border-slate-800' : 'border-b border-slate-50') : ''}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 flex items-center justify-center shrink-0 ${item.color}`}>
                  {item.icon}
                </div>
                <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.label}</p>
              </div>
              <ChevronRight size={20} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
