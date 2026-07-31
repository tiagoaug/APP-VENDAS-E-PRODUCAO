import type { ReactNode } from 'react';
import { ArrowLeft, MapPin, Map, Compass, Navigation2, LocateFixed } from 'lucide-react';
import { NavConfig } from '../types';
import type { NavigationProvider } from '../utils/deliveryNavLink';

interface DeliveryNavPreferencesViewProps {
  isDarkMode: boolean;
  onBack: () => void;
  deliveryNavProviderPref?: string;
  onChangePref: (provider: NavigationProvider) => void;
  navConfig: NavConfig;
  onUpdateNavConfig: (patch: Partial<NavConfig>) => void;
}

const OPTIONS: { id: NavigationProvider; label: string; icon: ReactNode }[] = [
  { id: 'waze', label: 'Waze', icon: <Navigation2 size={18} /> },
  { id: 'google_maps', label: 'Google Maps', icon: <MapPin size={18} /> },
  { id: 'apple_maps', label: 'Apple Maps', icon: <Map size={18} /> },
  { id: 'embedded_sdk', label: 'Navegação Integrada', icon: <Compass size={18} /> },
];

// Preferência PRÉVIA de provedor de navegação (só pré-destaca a opção no popup de escolha
// da tela de rota, NavigationProviderModal — nunca dispara navegação sozinha) + a
// configuração de "Aproximação da Parada" da Navegação Integrada (100% web: Geolocation +
// OSRM, sem SDK nativo nem custo de API — ver DeliveryRouteDetailView.tsx).
export default function DeliveryNavPreferencesView({
  isDarkMode,
  onBack,
  deliveryNavProviderPref,
  onChangePref,
  navConfig,
  onUpdateNavConfig,
}: DeliveryNavPreferencesViewProps) {
  return (
    <div className="flex flex-col h-full pb-32">
      <div className="flex justify-between items-center px-2 pt-2 pb-4">
        <button onClick={onBack} title="Voltar" aria-label="Voltar"
          className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-500'} shadow-sm`}>
          <ArrowLeft size={20} />
        </button>
        <h1 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Preferências de Navegação</h1>
        <div className="w-9" />
      </div>

      <div className="flex flex-col gap-6 px-3">
        <div className="flex flex-col gap-2.5">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-1">
            Provedor Padrão
          </p>
          <p className="text-[10px] font-bold text-slate-400 px-1 -mt-1.5 leading-relaxed">
            Só decide qual opção vem destacada no popup "Escolher Provedor" da tela de rota — a escolha continua sempre explícita, nunca automática.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {OPTIONS.map(opt => {
              const active = deliveryNavProviderPref === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangePref(opt.id)}
                  className={`flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 transition-all active:scale-95 ${
                    active
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                      : isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  <span className={active ? 'text-teal-500' : 'text-slate-400'}>{opt.icon}</span>
                  <span className={`text-[11px] font-black uppercase tracking-wide ${active ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-1 flex items-center gap-1.5">
            <LocateFixed size={14} /> Aproximação da Parada
          </p>
          <p className="text-[10px] font-bold text-slate-400 px-1 -mt-1.5 leading-relaxed">
            Só vale pra Navegação Integrada: perto do endereço, o mapa passa a atualizar a localização mais rápido e centraliza na parada, pra facilitar achar o número certo.
          </p>
          <div className="flex flex-col gap-3 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex flex-col gap-1.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">Distância (metros)</p>
              <div className="grid grid-cols-4 gap-1.5">
                {[100, 150, 200, 300].map(m => {
                  const active = (navConfig.approachDistanceMeters ?? 150) === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onUpdateNavConfig({ approachDistanceMeters: m })}
                      className={`py-2.5 rounded-xl text-[11px] font-black transition-all active:scale-95 ${active ? 'bg-teal-500 text-white' : isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-500 border border-slate-200'}`}
                    >
                      {m}m
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">Intervalo perto da parada (segundos)</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={Math.round((navConfig.approachFastUpdateMs ?? 1000) / 1000)}
                  onChange={(e) => {
                    const seconds = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1));
                    onUpdateNavConfig({ approachFastUpdateMs: seconds * 1000 });
                  }}
                  className={`w-20 py-2.5 px-3 rounded-xl text-sm font-black text-center ${isDarkMode ? 'bg-slate-900 border border-slate-700 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                  aria-label="Intervalo perto da parada, em segundos"
                />
                <span className="text-[10px] font-bold text-slate-400">segundo{Math.round((navConfig.approachFastUpdateMs ?? 1000) / 1000) === 1 ? '' : 's'} — ex.: 1 = atualiza a cada 1s</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">Intervalo longe da parada (segundos)</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={Math.round((navConfig.approachFarUpdateMs ?? 5000) / 1000)}
                  onChange={(e) => {
                    const seconds = Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 1));
                    onUpdateNavConfig({ approachFarUpdateMs: seconds * 1000 });
                  }}
                  className={`w-20 py-2.5 px-3 rounded-xl text-sm font-black text-center ${isDarkMode ? 'bg-slate-900 border border-slate-700 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                  aria-label="Intervalo longe da parada, em segundos"
                />
                <span className="text-[10px] font-bold text-slate-400">segundo{Math.round((navConfig.approachFarUpdateMs ?? 5000) / 1000) === 1 ? '' : 's'} — enquanto nenhuma parada está por perto</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
