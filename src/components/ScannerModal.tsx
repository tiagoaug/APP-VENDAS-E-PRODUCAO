import React, { useState } from 'react';
import { Camera, X, AlertCircle, Zap } from 'lucide-react';
import Modal from './Modal';
import { scannerService } from '../services/scannerService';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (result: any) => void;
  title?: string;
}

export default function ScannerModal({ isOpen, onClose, onScan, title = "Escanear Etiqueta" }: ScannerModalProps) {
  const [error, setError] = useState<string | null>(null);

  const handleStartScan = async () => {
    setError(null);
    const result = await scannerService.scan();
    
    if (result) {
      const parsed = scannerService.parseScanResult(result);
      if (parsed) {
        onScan(parsed);
        onClose();
      } else {
        setError(`Código não reconhecido: ${result}`);
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="flex flex-col items-center justify-center py-8 space-y-6">
        <div className="relative">
          <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
            <Camera size={48} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <button
            onClick={() => scannerService.toggleTorch()}
            className="absolute -bottom-2 -right-2 w-10 h-10 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full flex items-center justify-center text-amber-500 shadow-lg active:scale-90 transition-all"
            title="Alternar Lanterna"
          >
            <Zap size={20} fill="currentColor" />
          </button>
        </div>
        
        <div className="text-center space-y-2">
          <p className="text-slate-600 dark:text-slate-400">
            Clique no botão abaixo para abrir a câmera e escanear a etiqueta do produto ou lote.
          </p>
        </div>

        {error && (
          <div className="w-full p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl flex items-start gap-3">
            <AlertCircle size={20} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <button
          onClick={handleStartScan}
          className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-sm shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-3"
        >
          <Camera size={20} />
          Abrir Câmera
        </button>
      </div>
    </Modal>
  );
}
