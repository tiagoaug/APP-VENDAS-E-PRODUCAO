import { useEffect, useState } from 'react';
import { Store, Link2, Unlink, RefreshCw, CheckCircle2, Clock, ListOrdered, Tags as TagsIcon, ChevronRight } from 'lucide-react';
import { MarketplaceConnection, ViewType } from '../types';
import { subscribeToMarketplaceConnection, getShopeeAuthUrl, syncShopeeStockNow } from '../services/marketplaceService';
import { toast } from '../utils/toast';

// URL pública da Cloud Function `shopeeOAuthCallback` — só existe depois do primeiro deploy de functions.
const SHOPEE_OAUTH_CALLBACK_URL = 'https://us-central1-app-vendas-e-producao.cloudfunctions.net/shopeeOAuthCallback';

interface MarketplaceConnectionViewProps {
  isDarkMode: boolean;
  onNavigate: (view: ViewType) => void;
}

function formatDate(ts?: number) {
  if (!ts) return 'Nunca';
  return new Date(ts).toLocaleString('pt-BR');
}

export default function MarketplaceConnectionView({ isDarkMode, onNavigate }: MarketplaceConnectionViewProps) {
  const [connection, setConnection] = useState<MarketplaceConnection | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => subscribeToMarketplaceConnection(setConnection), []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const url = await getShopeeAuthUrl(SHOPEE_OAUTH_CALLBACK_URL);
      window.location.href = url;
    } catch (e: any) {
      toast.show('Erro ao iniciar conexão com a Shopee: ' + (e.message || e));
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncShopeeStockNow();
      toast.show(res.message || `Estoque sincronizado (${res.itemsUpdated} itens).`);
    } catch (e: any) {
      toast.show('Erro ao sincronizar estoque: ' + (e.message || e));
    } finally {
      setSyncing(false);
    }
  };

  const isConnected = !!connection?.connected;

  return (
    <div className="flex flex-col gap-6 pb-32">
      <div className={`p-6 rounded-[2.5rem] border shadow-sm flex flex-col gap-5 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isConnected ? 'bg-orange-500' : 'bg-slate-200 dark:bg-slate-800'} text-white shadow-lg`}>
            <Store size={26} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-base font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Shopee</h3>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
              {isConnected ? `Loja conectada · ${connection?.shopId}` : 'Não conectado'}
            </p>
          </div>
          {isConnected && <CheckCircle2 className="text-emerald-500 shrink-0" size={22} />}
        </div>

        {!isConnected ? (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full h-12 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 transition-all"
          >
            <Link2 size={16} />
            {connecting ? 'Redirecionando...' : 'Conectar com a Shopee'}
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className={`grid grid-cols-2 gap-3`}>
              <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><Clock size={10} /> Últ. Sync Pedidos</p>
                <p className={`text-xs font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{formatDate(connection?.lastOrderSyncAt)}</p>
              </div>
              <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><Clock size={10} /> Últ. Envio Estoque</p>
                <p className={`text-xs font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{formatDate(connection?.lastStockPushAt)}</p>
              </div>
            </div>

            <button
              onClick={handleSync}
              disabled={syncing}
              className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
            >
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Sincronizando...' : 'Sincronizar Estoque Agora'}
            </button>
            <p className="text-[10px] text-slate-400 font-medium italic text-center px-4">
              Envia o estoque atual dos produtos mapeados para a Shopee. Não é automático — use este botão sempre que quiser atualizar.
            </p>
          </div>
        )}
      </div>

      <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        {[
          { id: ViewType.MARKETPLACE_ORDERS, label: 'Pedidos Marketplace', icon: <ListOrdered size={22} />, color: 'text-orange-500' },
          { id: ViewType.MARKETPLACE_SKU_MAPPING, label: 'Mapeamento de SKU', icon: <TagsIcon size={22} />, color: 'text-indigo-500' },
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

      {isConnected && (
        <button
          onClick={() => toast.show('Para desconectar, revogue o acesso do app diretamente no painel da Shopee Open Platform.')}
          className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-colors"
        >
          <Unlink size={12} /> Desconectar Loja
        </button>
      )}
    </div>
  );
}
