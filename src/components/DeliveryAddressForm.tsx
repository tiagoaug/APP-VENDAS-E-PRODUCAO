import { useState } from 'react';
import { Search, Loader2, MapPin, AlertTriangle, Maximize2 } from 'lucide-react';
import { Sale } from '../types';
import { geocodeAddress } from '../utils/deliveryGeocoding';
import DeliveryMap from './DeliveryMap';
import Modal from './Modal';

type DeliveryAddress = NonNullable<Sale['deliveryAddress']>;

interface DeliveryAddressFormProps {
  isDarkMode: boolean;
  address: DeliveryAddress | undefined;
  priority: Sale['deliveryPriority'];
  onChange: (address: DeliveryAddress) => void;
  onPriorityChange: (priority: 'URGENT' | 'NORMAL') => void;
}

const inputClass = (isDarkMode: boolean) =>
  `w-full h-11 ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'} border-2 border-transparent focus:border-teal-500 rounded-xl px-4 text-xs font-bold transition-all outline-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`;

const labelClass = 'text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1';

export default function DeliveryAddressForm({ isDarkMode, address, priority, onChange, onPriorityChange }: DeliveryAddressFormProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);

  const a = address || {};

  const set = (field: keyof DeliveryAddress) => (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...a, [field]: e.target.value });
  };

  const handleSearch = async () => {
    setSearchError(null);
    setIsSearching(true);
    try {
      const result = await geocodeAddress(a);
      if (!result) {
        setSearchError('Endereço não encontrado — arraste o pin no mapa abaixo pra marcar manualmente.');
        return;
      }
      onChange({ ...a, lat: result.lat, lng: result.lng, geocodedAt: Date.now(), geocodeSource: 'GEOCODED' });
    } catch {
      setSearchError('Não foi possível buscar o endereço agora — arraste o pin no mapa abaixo pra marcar manualmente.');
    } finally {
      setIsSearching(false);
    }
  };

  const handlePinChange = (lat: number, lng: number) => {
    onChange({ ...a, lat, lng, geocodeSource: 'MANUAL_PIN' });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2 space-y-1">
          <label className={labelClass}>Rua</label>
          <input type="text" className={inputClass(isDarkMode)} value={a.street || ''} onChange={set('street')} placeholder="Ex: Rua das Flores" />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Número</label>
          <input type="text" className={inputClass(isDarkMode)} value={a.number || ''} onChange={set('number')} placeholder="123" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className={labelClass}>Bairro</label>
          <input type="text" className={inputClass(isDarkMode)} value={a.neighborhood || ''} onChange={set('neighborhood')} />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Complemento</label>
          <input type="text" className={inputClass(isDarkMode)} value={a.complement || ''} onChange={set('complement')} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1 space-y-1">
          <label className={labelClass}>Cidade</label>
          <input type="text" className={inputClass(isDarkMode)} value={a.city || ''} onChange={set('city')} />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>UF</label>
          <input type="text" maxLength={2} className={`${inputClass(isDarkMode)} uppercase`} value={a.state || ''} onChange={set('state')} />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>CEP</label>
          <input type="text" className={inputClass(isDarkMode)} value={a.zip || ''} onChange={set('zip')} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSearch}
          disabled={isSearching}
          className="flex-1 h-10 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Buscar Endereço
        </button>
        <div className="flex rounded-xl overflow-hidden border-2 border-transparent">
          <button
            type="button"
            onClick={() => onPriorityChange('NORMAL')}
            className={`h-10 px-3 text-[10px] font-black uppercase tracking-widest transition-all ${(priority || 'NORMAL') === 'NORMAL' ? 'bg-slate-600 text-white' : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')}`}
          >
            Normal
          </button>
          <button
            type="button"
            onClick={() => onPriorityChange('URGENT')}
            className={`h-10 px-3 text-[10px] font-black uppercase tracking-widest transition-all ${priority === 'URGENT' ? 'bg-rose-600 text-white' : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')}`}
          >
            Urgente
          </button>
        </div>
      </div>

      {searchError && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          {searchError}
        </div>
      )}

      {a.lat !== undefined && a.lng !== undefined && (
        <div className="flex items-center gap-1.5 px-1 text-[10px] font-bold text-slate-400">
          <MapPin size={12} />
          {a.geocodeSource === 'MANUAL_PIN' ? 'Localização definida manualmente no mapa' : 'Localização geocodificada — arraste o pin pra ajustar'}
        </div>
      )}

      <DeliveryMap
        isDarkMode={isDarkMode}
        height={220}
        marker={a.lat !== undefined && a.lng !== undefined ? { lat: a.lat, lng: a.lng } : null}
        onMarkerChange={handlePinChange}
      />

      <button
        type="button"
        onClick={() => setShowMapModal(true)}
        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
      >
        <Maximize2 size={12} />
        Ver Mapa Ampliado
      </button>

      <Modal
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        title="Ajustar Localização"
        icon={<MapPin size={20} />}
        maxWidth="max-w-3xl"
        closeLabel="Concluir"
      >
        <DeliveryMap
          isDarkMode={isDarkMode}
          height={520}
          marker={a.lat !== undefined && a.lng !== undefined ? { lat: a.lat, lng: a.lng } : null}
          onMarkerChange={handlePinChange}
        />
      </Modal>
    </div>
  );
}
