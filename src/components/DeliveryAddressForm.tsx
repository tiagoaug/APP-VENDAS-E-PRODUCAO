import { useState } from 'react';
import { Search, Loader2, MapPin, AlertTriangle, Maximize2, ClipboardPaste, CheckCircle2 } from 'lucide-react';
import { DeliveryAddress, Sale } from '../types';
import { geocodeAddress, geocodeFreeText, parseLatLngFromText } from '../utils/deliveryGeocoding';
import { resolveMapsShortLink } from '../utils/deliveryMapsShortLink';
import DeliveryMap from './DeliveryMap';
import Modal from './Modal';

interface DeliveryAddressFormProps {
  isDarkMode: boolean;
  address: DeliveryAddress | undefined;
  onChange: (address: DeliveryAddress) => void;
  // Toggle Normal/Urgente — só faz sentido pra endereço de uma venda em rota, não pro
  // endereço padrão cadastrado no cliente (PersonModal). Omitindo as duas props, o botão
  // de prioridade some e só fica busca + campos + mapa.
  priority?: Sale['deliveryPriority'];
  onPriorityChange?: (priority: 'URGENT' | 'NORMAL') => void;
  // Controla só a visibilidade dos campos de endereço (Rua...CEP) — busca, prioridade e
  // mapa continuam sempre visíveis independente disso. Sem a prop, os campos ficam sempre
  // visíveis (comportamento de antes, usado por quem ainda não tem o acordeão externo).
  fieldsExpanded?: boolean;
}

const inputClass = (isDarkMode: boolean) =>
  `w-full h-11 ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'} border-2 border-transparent focus:border-teal-500 rounded-xl px-4 text-sm font-bold transition-all outline-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`;

const textareaClass = (isDarkMode: boolean) =>
  `w-full ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'} border-2 border-transparent focus:border-teal-500 rounded-xl px-4 py-3 text-sm font-bold transition-all outline-none resize-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`;

const labelClass = 'text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1';

type AddressInputMode = 'manual' | 'paste_address' | 'paste_location';
const MODE_LABELS: Record<AddressInputMode, string> = {
  manual: 'Digitação Manual',
  paste_address: 'Colar Endereço',
  paste_location: 'Colar Localização',
};

export default function DeliveryAddressForm({ isDarkMode, address, priority, onChange, onPriorityChange, fieldsExpanded = true }: DeliveryAddressFormProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [inputMode, setInputMode] = useState<AddressInputMode>('paste_location');

  const [pastedAddressText, setPastedAddressText] = useState('');
  const [isSearchingPastedAddress, setIsSearchingPastedAddress] = useState(false);
  const [pastedAddressError, setPastedAddressError] = useState<string | null>(null);
  const [pastedAddressFound, setPastedAddressFound] = useState<string | null>(null);

  const [pastedLocationText, setPastedLocationText] = useState('');
  const [isVerifyingLocation, setIsVerifyingLocation] = useState(false);
  const [pastedLocationError, setPastedLocationError] = useState<string | null>(null);
  const [pastedLocationFound, setPastedLocationFound] = useState(false);

  // Alvo de foco do mapa — computado do resultado da busca/colagem, NÃO do prop `address`
  // (que só reflete a mudança depois do Firestore confirmar a gravação e o snapshot
  // voltar; usar o prop fazia o mapa voar pro pin ANTIGO ou nem voar, ver DeliveryMap.tsx).
  const [mapFlyTo, setMapFlyTo] = useState<{ lat: number; lng: number; signal: number } | null>(null);
  const focusMapOn = (lat: number, lng: number) => setMapFlyTo(prev => ({ lat, lng, signal: (prev?.signal || 0) + 1 }));

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
      focusMapOn(result.lat, result.lng);
    } catch {
      setSearchError('Não foi possível buscar o endereço agora — arraste o pin no mapa abaixo pra marcar manualmente.');
    } finally {
      setIsSearching(false);
    }
  };

  // "Colar Endereço": texto livre (ex.: endereço copiado de uma conversa) geocodificado
  // igual à busca por campos — só que sem precisar quebrar em rua/número/bairro antes.
  const handleSearchPastedAddress = async () => {
    setPastedAddressError(null);
    setPastedAddressFound(null);
    if (!pastedAddressText.trim()) return;
    setIsSearchingPastedAddress(true);
    try {
      const result = await geocodeFreeText(pastedAddressText);
      if (!result) {
        setPastedAddressError('Endereço não encontrado — confira o texto colado ou use a Digitação Manual.');
        return;
      }
      onChange({ ...a, lat: result.lat, lng: result.lng, geocodedAt: Date.now(), geocodeSource: 'GEOCODED' });
      setPastedAddressFound(result.displayName);
      focusMapOn(result.lat, result.lng);
    } catch {
      setPastedAddressError('Não foi possível buscar agora — tente de novo em instantes.');
    } finally {
      setIsSearchingPastedAddress(false);
    }
  };

  // "Colar Localização": link/texto de localização compartilhada (WhatsApp, Google Maps) —
  // extrai lat/lng direto do texto, sem geocodificar (é a posição exata compartilhada).
  // Link curto (maps.app.goo.gl, comum quando compartilhado pelo app do Maps) não tem
  // coordenada nenhuma no texto — só resolvendo o redirecionamento (servidor, ver
  // resolveMapsShortLink) é que a URL de verdade com lat/lng aparece.
  const handleVerifyPastedLocation = async () => {
    setPastedLocationError(null);
    setPastedLocationFound(false);
    const text = pastedLocationText.trim();
    if (!text) return;

    const direct = parseLatLngFromText(text);
    if (direct) {
      onChange({ ...a, lat: direct.lat, lng: direct.lng, geocodedAt: Date.now(), geocodeSource: 'PASTED_LOCATION' });
      setPastedLocationFound(true);
      focusMapOn(direct.lat, direct.lng);
      return;
    }

    const looksLikeUrl = /https?:\/\//i.test(text);
    if (!looksLikeUrl) {
      setPastedLocationError('Não encontrei coordenadas nesse texto — confira se colou o link/localização completo.');
      return;
    }

    setIsVerifyingLocation(true);
    try {
      const resolvedUrl = await resolveMapsShortLink(text);
      const coords = resolvedUrl ? parseLatLngFromText(resolvedUrl) : null;
      if (!coords) {
        setPastedLocationError('Não encontrei coordenadas nesse link — confira se é um link de localização do Google Maps.');
        return;
      }
      onChange({ ...a, lat: coords.lat, lng: coords.lng, geocodedAt: Date.now(), geocodeSource: 'PASTED_LOCATION' });
      setPastedLocationFound(true);
      focusMapOn(coords.lat, coords.lng);
    } catch {
      setPastedLocationError('Não foi possível resolver esse link agora — tente de novo em instantes.');
    } finally {
      setIsVerifyingLocation(false);
    }
  };

  const handlePinChange = (lat: number, lng: number) => {
    onChange({ ...a, lat, lng, geocodeSource: 'MANUAL_PIN' });
  };

  return (
    <div className="flex flex-col gap-3">
      {fieldsExpanded && (
        <>
          <div className={`grid grid-cols-3 gap-1 p-1 rounded-xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
            {(Object.keys(MODE_LABELS) as AddressInputMode[]).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setInputMode(mode)}
                className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all ${
                  inputMode === mode
                    ? 'bg-teal-600 text-white shadow-sm'
                    : isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {MODE_LABELS[mode]}
              </button>
            ))}
          </div>

          {inputMode === 'manual' && (
            <>
              <div className="space-y-1">
                <label className={labelClass}>Rua</label>
                <input type="text" className={inputClass(isDarkMode)} value={a.street || ''} onChange={set('street')} placeholder="Ex: Rua das Flores" />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Número</label>
                <input type="text" className={inputClass(isDarkMode)} value={a.number || ''} onChange={set('number')} placeholder="123" />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Bairro</label>
                <input type="text" className={inputClass(isDarkMode)} value={a.neighborhood || ''} onChange={set('neighborhood')} />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Complemento</label>
                <input type="text" className={inputClass(isDarkMode)} value={a.complement || ''} onChange={set('complement')} />
              </div>
              <div className="space-y-1">
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
            </>
          )}

          {inputMode === 'paste_address' && (
            <div className="space-y-2">
              <div className="space-y-1">
                <label className={labelClass}>Colar Endereço Completo</label>
                <textarea
                  rows={3}
                  className={textareaClass(isDarkMode)}
                  value={pastedAddressText}
                  onChange={(e) => setPastedAddressText(e.target.value)}
                  placeholder="Cole aqui o endereço completo (ex: copiado de uma conversa)"
                />
              </div>
              <button
                type="button"
                onClick={handleSearchPastedAddress}
                disabled={isSearchingPastedAddress}
                className="w-full h-10 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {isSearchingPastedAddress ? <Loader2 size={14} className="animate-spin" /> : <ClipboardPaste size={14} />}
                Buscar Endereço Colado
              </button>
              {pastedAddressError && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-[11px] font-bold">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  {pastedAddressError}
                </div>
              )}
              {pastedAddressFound && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
                  <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                  Encontrado: {pastedAddressFound}
                </div>
              )}
            </div>
          )}

          {inputMode === 'paste_location' && (
            <div className="space-y-2">
              <div className="space-y-1">
                <label className={labelClass}>Colar Localização (WhatsApp / Google Maps)</label>
                <textarea
                  rows={3}
                  className={textareaClass(isDarkMode)}
                  value={pastedLocationText}
                  onChange={(e) => setPastedLocationText(e.target.value)}
                  placeholder="Cole aqui o link ou texto da localização compartilhada"
                />
              </div>
              <button
                type="button"
                onClick={handleVerifyPastedLocation}
                disabled={isVerifyingLocation}
                className="w-full h-10 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {isVerifyingLocation ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                Verificar Localização
              </button>
              {pastedLocationError && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-[11px] font-bold">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  {pastedLocationError}
                </div>
              )}
              {pastedLocationFound && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
                  <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                  Localização exata encontrada no texto colado.
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="flex items-center gap-2">
        {/* Só faz sentido na aba Digitação Manual — busca pelos campos Rua/Número/etc.
            Nas outras abas (Colar Endereço/Colar Localização) cada uma já tem seu próprio
            botão de busca; mostrar este aqui também sobrescrevia o pin certo com um
            resultado vazio/errado vindo dos campos manuais em branco. */}
        {(!fieldsExpanded || inputMode === 'manual') && (
          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching}
            className="flex-1 h-10 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Buscar Endereço
          </button>
        )}
        {onPriorityChange && (
          <div className="flex rounded-xl overflow-hidden border-2 border-transparent">
            <button
              type="button"
              onClick={() => onPriorityChange('NORMAL')}
              className={`h-10 px-3 text-[11px] font-black uppercase tracking-widest transition-all ${(priority || 'NORMAL') === 'NORMAL' ? 'bg-slate-600 text-white' : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')}`}
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => onPriorityChange('URGENT')}
              className={`h-10 px-3 text-[11px] font-black uppercase tracking-widest transition-all ${priority === 'URGENT' ? 'bg-rose-600 text-white' : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')}`}
            >
              Urgente
            </button>
          </div>
        )}
      </div>

      {searchError && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-[11px] font-bold">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          {searchError}
        </div>
      )}

      {a.lat !== undefined && a.lng !== undefined && (
        <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-slate-400">
          <MapPin size={12} />
          {a.geocodeSource === 'MANUAL_PIN'
            ? 'Localização definida manualmente no mapa'
            : a.geocodeSource === 'PASTED_LOCATION'
              ? 'Localização exata colada (WhatsApp/Maps) — arraste o pin pra ajustar'
              : 'Localização geocodificada — arraste o pin pra ajustar'}
        </div>
      )}

      <DeliveryMap
        isDarkMode={isDarkMode}
        height={220}
        marker={a.lat !== undefined && a.lng !== undefined ? { lat: a.lat, lng: a.lng } : null}
        onMarkerChange={handlePinChange}
        flyTo={mapFlyTo}
      />

      <button
        type="button"
        onClick={() => setShowMapModal(true)}
        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
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
          flyTo={mapFlyTo}
        />
      </Modal>
    </div>
  );
}
