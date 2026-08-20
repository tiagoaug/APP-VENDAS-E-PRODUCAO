import { useEffect, useState } from 'react';
import { Bluetooth, Wifi, CheckCircle2, XCircle, RefreshCw, RotateCcw } from 'lucide-react';
import { AbleMarkPairedDevice, isAblemarkPlatform } from '../lib/ablemarkPrinter';
import {
  listAbleMarkPairedDevices2 as listAbleMarkPairedDevices,
  connectAbleMarkPrinter2 as connectAbleMarkPrinter,
  disconnectAbleMarkPrinter2 as disconnectAbleMarkPrinter,
  isAbleMarkPrinterConnected2 as isAbleMarkPrinterConnected,
  resetAbleMarkPrinter2 as resetAbleMarkPrinter,
} from '../lib/ablemarkPrinter2';
import { EpsonDiscoveredPrinter, discoverEpsonPrinters } from '../lib/epsonPrinter';

interface PrinterConnectionCardProps {
  isDarkMode: boolean;
  // Avisa o pai sempre que o estado de conexão muda (checagem inicial, conectar, desconectar,
  // resetar) — usado, por exemplo, pelo preview de impressão pra saber se pode liberar o botão
  // "Imprimir agora" ou se precisa manter esse card visível primeiro.
  onConnectedChange?: (connected: boolean) => void;
}

// Card de conexão de impressora (Ablemark BR-L100 via Bluetooth Classic / Epson Wi-Fi Direct,
// esta ainda só estrutura) — extraído de LabelPrintStudioView.tsx pra ser reaproveitado também
// dentro do fluxo de impressão (LabelPrintPreviewModal), quando a impressora ainda não está
// conectada na hora de imprimir, sem precisar sair pra uma tela separada só pra conectar.
export default function PrinterConnectionCard({ isDarkMode, onConnectedChange }: PrinterConnectionCardProps) {
  const [devices, setDevices] = useState<AbleMarkPairedDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [resetting, setResetting] = useState(false);
  // Marca da impressora — Ablemark já funciona de ponta a ponta (só Android — Bluetooth
  // Classic/SPP não roda no iOS sem certificação MFi do fabricante, fora do nosso controle);
  // Epson (linha TM-m, Wi-Fi Direct) ainda é só a estrutura (ver src/lib/epsonPrinter.ts),
  // esperando o SDK oficial, mas por ser rede em vez de Bluetooth deve funcionar nas duas
  // plataformas quando integrado. Fora do Android já começa em EPSON, já que Ablemark nem
  // aparece como opção lá.
  const [printerBrand, setPrinterBrand] = useState<'ABLEMARK' | 'EPSON'>(isAblemarkPlatform() ? 'ABLEMARK' : 'EPSON');
  const [epsonPrinters, setEpsonPrinters] = useState<EpsonDiscoveredPrinter[]>([]);
  const [epsonLoading, setEpsonLoading] = useState(false);

  const setConnectedAndNotify = (v: boolean) => {
    setConnected(v);
    onConnectedChange?.(v);
  };

  useEffect(() => {
    isAbleMarkPrinterConnected().then(setConnectedAndNotify);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDiscoverEpson = async () => {
    setEpsonLoading(true);
    try {
      const list = await discoverEpsonPrinters();
      setEpsonPrinters(list);
    } finally {
      setEpsonLoading(false);
    }
  };

  const handleListDevices = async () => {
    setLoadingDevices(true);
    try {
      const list = await listAbleMarkPairedDevices();
      setDevices(list);
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleConnect = async (address: string) => {
    setSelectedAddress(address);
    setConnecting(true);
    try {
      const { connected: ok } = await connectAbleMarkPrinter(address);
      setConnectedAndNotify(ok);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectAbleMarkPrinter();
    setConnectedAndNotify(false);
  };

  const handleResetConnection = async () => {
    setResetting(true);
    try {
      await resetAbleMarkPrinter();
      setConnectedAndNotify(false);
      setDevices([]);
    } finally {
      setResetting(false);
    }
  };

  // Efeito "3D" dos minicards: sombra elevada + borda inferior grossa simulando profundidade.
  const miniCardCls = `relative rounded-2xl p-4 border-b-[3px] transition-shadow ${
    isDarkMode
      ? 'bg-gradient-to-b from-slate-800 to-slate-800/80 border-slate-950 shadow-[0_6px_16px_-4px_rgba(0,0,0,0.5)]'
      : 'bg-gradient-to-b from-white to-slate-50 border-slate-200 shadow-[0_6px_16px_-6px_rgba(15,23,42,0.18)]'
  }`;
  const miniCardConnectedCls = `relative rounded-2xl p-4 border-b-[3px] transition-shadow ${
    isDarkMode
      ? 'bg-gradient-to-b from-emerald-900/40 to-emerald-900/20 border-emerald-600/60 shadow-[0_6px_16px_-4px_rgba(16,185,129,0.35)]'
      : 'bg-gradient-to-b from-emerald-50 to-white border-emerald-300 shadow-[0_6px_16px_-6px_rgba(16,185,129,0.3)]'
  }`;
  const sectionTitleCls = 'text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3';

  return (
    <div className={printerBrand === 'ABLEMARK' && connected ? miniCardConnectedCls : miniCardCls}>
      {isAblemarkPlatform() && (
        <div className="flex gap-1.5 mb-3">
          <button
            type="button"
            onClick={() => setPrinterBrand('ABLEMARK')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
              printerBrand === 'ABLEMARK' ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Bluetooth size={12} /> Ablemark BR-L100
          </button>
          <button
            type="button"
            onClick={() => setPrinterBrand('EPSON')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
              printerBrand === 'EPSON' ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Wifi size={12} /> Epson (Wi-Fi Direct)
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <span className={printerBrand === 'ABLEMARK' && connected ? 'text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3' : sectionTitleCls}>
          {printerBrand === 'ABLEMARK' ? 'Impressora (Ablemark BR-L100)' : 'Impressora (Epson TM-m)'}
        </span>
        {printerBrand === 'ABLEMARK' ? (
          connected ? (
            <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={14} /> Conectada
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[10px] font-black text-rose-500">
              <XCircle size={13} /> Desconectada
            </span>
          )
        ) : (
          <span className="flex items-center gap-1.5 text-[10px] font-black text-amber-500">
            <XCircle size={13} /> Em desenvolvimento
          </span>
        )}
      </div>

      {printerBrand === 'EPSON' ? (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
            Suporte a impressoras Epson (linha TM-m, Wi-Fi Direct) já tem a estrutura pronta —
            falta integrar o SDK oficial da Epson (aguardando conta de desenvolvedor + impressora pra validar).
          </p>
          <button
            type="button"
            onClick={handleDiscoverEpson}
            disabled={epsonLoading}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <RefreshCw size={13} className={epsonLoading ? 'animate-spin' : ''} /> Procurar impressoras
          </button>
          {epsonPrinters.map(p => (
            <div key={p.target} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
              <Wifi size={13} className="text-indigo-500 shrink-0" />
              <span className="text-xs font-black truncate">{p.name}</span>
            </div>
          ))}
        </div>
      ) : connected ? (
        <button
          type="button"
          onClick={handleDisconnect}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
        >
          <CheckCircle2 size={13} /> Desconectar
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleListDevices}
            disabled={loadingDevices}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <RefreshCw size={13} className={loadingDevices ? 'animate-spin' : ''} /> Listar dispositivos pareados
          </button>
          {devices.map(d => (
            <button
              key={d.address}
              type="button"
              onClick={() => handleConnect(d.address)}
              disabled={connecting}
              className={`flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border-2 transition-all ${
                selectedAddress === d.address
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Bluetooth size={13} className="text-indigo-500 shrink-0" />
                <span className="text-xs font-black truncate">{d.name}</span>
              </div>
              {connecting && selectedAddress === d.address && <RefreshCw size={13} className="animate-spin text-indigo-400" />}
            </button>
          ))}
        </div>
      )}

      {printerBrand === 'ABLEMARK' && (
        <button
          type="button"
          onClick={handleResetConnection}
          disabled={resetting}
          className="w-full flex items-center justify-center gap-1.5 mt-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-amber-400 hover:bg-amber-500 disabled:opacity-60 transition-colors"
        >
          <RotateCcw size={13} className={resetting ? 'animate-spin' : ''} /> {resetting ? 'Resetando...' : 'Resetar conexão e cache (se a impressão falhar)'}
        </button>
      )}
    </div>
  );
}
