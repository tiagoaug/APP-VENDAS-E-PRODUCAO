import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, MapPin, Map, Navigation2, Compass, Star, Share2, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { openNavigation, type NavPoint, type NavigationProvider } from '../utils/deliveryNavLink';

interface NavigationProviderModalProps {
  isDarkMode: boolean;
  stops: NavPoint[];
  preferredProvider?: string;
  // Avisa o pai qual provedor foi escolhido (ex.: pra oferecer "ir pra próxima parada"
  // depois de marcar uma entrega, já que Waze/Apple Maps só navegam pra 1 destino por
  // vez — ver DeliveryRouteDetailView.tsx). Chamado antes de onClose.
  onSelect?: (provider: NavigationProvider) => void;
  // Compartilha a rota inteira (todas as paradas, em ordem) por qualquer app via o menu
  // de compartilhamento do celular — útil pra apps fora da lista fixa acima, ou pra
  // mandar a lista de endereços pra alguém. O texto/link é montado pelo pai (que tem
  // acesso aos nomes de cliente/endereço), este componente só dispara a ação.
  onExportRoute?: () => void;
  // Abre o seletor nativo do Android ("abrir com...") pra PRÓXIMA parada pendente, usando o
  // esquema geo: — diferente das opções fixas acima (que só cobrem 3 apps específicos), isso
  // garante que QUALQUER app de navegação instalado no aparelho apareça como opção (Waze,
  // Google Maps, ou qualquer outro), não só os 3 já mapeados. Limitação: só 1 parada por vez
  // (o esquema geo: não suporta múltiplos destinos).
  onOpenAnyApp?: () => void;
  onClose: () => void;
}

const OPTIONS: { id: NavigationProvider; label: string; description: string; icon: ReactNode }[] = [
  { id: 'waze', label: 'Waze', description: 'Abre o Waze pra navegar', icon: <Navigation2 size={20} /> },
  { id: 'google_maps', label: 'Google Maps', description: 'Abre o Google Maps pra navegar', icon: <MapPin size={20} /> },
  { id: 'apple_maps', label: 'Apple Maps', description: 'Abre o Apple Maps pra navegar', icon: <Map size={20} /> },
  { id: 'embedded_sdk', label: 'Navegação Integrada', description: 'Fica aqui na rota — mapa e recálculo automático do próprio app', icon: <Compass size={20} /> },
];

// Popup de escolha explícita do provedor de navegação — sempre mostra todas as opções,
// nunca dispara direto sem esse passo. `preferredProvider` (Collaborator.deliveryNavProviderPref,
// configurado em Configurações de Entrega → Preferências de Navegação) só pré-destaca uma
// opção, não pula o popup. Renderizado via portal direto em document.body — evita que um
// ancestor com CSS transform (comum em transições de tela) quebre o `position: fixed` e
// descentralize o popup.
export default function NavigationProviderModal({
  isDarkMode,
  stops,
  preferredProvider,
  onSelect,
  onExportRoute,
  onOpenAnyApp,
  onClose,
}: NavigationProviderModalProps) {
  const handleSelect = (provider: NavigationProvider) => {
    // 'embedded_sdk' não abre nada externo — só fecha o popup, o mapa e o foco/recálculo
    // automático já rodam direto na tela de rota (ver DeliveryRouteDetailView.tsx).
    if (provider !== 'embedded_sdk') {
      openNavigation(provider, stops);
    }
    onSelect?.(provider);
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[90000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-sm max-h-[85vh] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
        >
          <div className={`flex items-center justify-between px-6 py-5 border-b shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <h3 className={`text-sm font-black uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Escolher Provedor</h3>
            <button type="button" onClick={onClose} aria-label="Fechar" title="Fechar"
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100'}`}>
              <X size={18} />
            </button>
          </div>

          <div className="p-4 flex flex-col gap-2 overflow-y-auto">
            {OPTIONS.map(opt => {
              const isPreferred = preferredProvider === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect(opt.id)}
                  className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
                    isPreferred
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                      : isDarkMode ? 'border-slate-700 bg-slate-800 hover:border-teal-700' : 'border-slate-100 bg-slate-50 hover:border-teal-200'
                  }`}
                >
                  <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${isPreferred ? 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400' : isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-500'}`}>
                    {opt.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{opt.label}</p>
                      {isPreferred && <Star size={12} className="text-teal-500 shrink-0" fill="currentColor" />}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400">{opt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {(onExportRoute || onOpenAnyApp) && (
            <div className={`p-4 border-t shrink-0 flex gap-2 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              {onOpenAnyApp && (
                <button
                  type="button"
                  onClick={() => { onOpenAnyApp(); onClose(); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  <MoreHorizontal size={15} />
                  Outro App
                </button>
              )}
              {onExportRoute && (
                <button
                  type="button"
                  onClick={() => { onExportRoute(); onClose(); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  <Share2 size={15} />
                  Exportar Rota
                </button>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
