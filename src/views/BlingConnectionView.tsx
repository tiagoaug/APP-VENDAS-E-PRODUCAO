import { useEffect, useState } from 'react';
import { Building2, Link2, RefreshCw, CheckCircle2, Clock, ListOrdered, Tags as TagsIcon, ChevronRight, KeyRound, Eye, EyeOff, LogOut, PackageMinus, Boxes, FileText, ExternalLink } from 'lucide-react';
import { BlingConnection, ViewType } from '../types';
import { subscribeToBlingConnection, saveBlingCredentials, getBlingAuthUrl, syncBlingOrdersNow, fetchBlingProducts, disconnectBling } from '../services/blingService';
import { toast } from '../utils/toast';

// URL pública da Cloud Function `blingOAuthCallback` — só existe depois do primeiro deploy de
// functions (mesmo padrão de SHOPEE_OAUTH_CALLBACK_URL em MarketplaceConnectionView.tsx).
const BLING_OAUTH_CALLBACK_URL = 'https://us-central1-app-vendas-e-producao.cloudfunctions.net/blingOAuthCallback';

interface BlingConnectionViewProps {
  isDarkMode: boolean;
  onNavigate: (view: ViewType) => void;
}

function formatDate(ts?: number) {
  if (!ts) return 'Nunca';
  return new Date(ts).toLocaleString('pt-BR');
}

/** Tela de conexão com o Bling — diferente da Shopee (MarketplaceConnectionView), aqui o
 * usuário precisa colar o Client ID/Secret do PRÓPRIO app cadastrado no portal de
 * desenvolvedor do Bling antes de poder conectar, já que o Bling não tem um app de parceiro
 * compartilhado como a Shopee. As credenciais são enviadas direto pra uma Cloud Function (nunca
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

  useEffect(() => subscribeToBlingConnection(setConnection), []);

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
            className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
          >
            <Link2 size={16} />
            {connecting ? 'Redirecionando...' : 'Conectar com o Bling'}
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><Clock size={10} /> Últ. Sync Produtos</p>
                <p className={`text-xs font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{formatDate(connection?.lastProductSyncAt)}</p>
              </div>
              <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><Clock size={10} /> Últ. Sync Pedidos</p>
                <p className={`text-xs font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{formatDate(connection?.lastOrderSyncAt)}</p>
              </div>
            </div>

            <button
              onClick={handleSyncOrders}
              disabled={syncingOrders}
              className={`w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all ${syncingOrders ? 'animate-pulse' : ''}`}
            >
              <RefreshCw size={16} className={syncingOrders ? 'animate-spin' : ''} />
              {syncingOrders ? 'Sincronizando...' : 'Sincronizar Pedidos'}
            </button>

            <button
              onClick={handleSyncProducts}
              disabled={syncingProducts}
              className={`w-full h-10 rounded-2xl disabled:opacity-60 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'} ${syncingProducts ? 'animate-pulse' : ''}`}
            >
              <RefreshCw size={13} className={syncingProducts ? 'animate-spin' : ''} />
              {syncingProducts ? 'Sincronizando produtos...' : 'Sincronizar Produtos'}
            </button>

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
            { id: ViewType.BLING_PRODUCT_MAPPING, label: 'Vincular Produtos', icon: <TagsIcon size={22} />, color: 'text-indigo-500' },
            { id: ViewType.BLING_PICKING_LIST, label: 'Lista de Separação', icon: <PackageMinus size={22} />, color: 'text-amber-500' },
            { id: ViewType.BLING_INVOICE_EMISSION, label: 'Emitir Notas Fiscais', icon: <ListOrdered size={22} />, color: 'text-emerald-500' },
            { id: ViewType.BLING_INVOICES, label: 'Notas Fiscais', icon: <FileText size={22} />, color: 'text-violet-500' },
            { id: ViewType.BLING_STOCK, label: 'Estoque Bling', icon: <Boxes size={22} />, color: 'text-sky-500' },
          ].map((item, index, array) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
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
