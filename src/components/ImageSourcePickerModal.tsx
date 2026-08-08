import { Camera as CameraIcon, Images } from 'lucide-react';
import Modal from './Modal';

interface ImageSourcePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  onPickCamera: () => void;
  onPickGallery: () => void;
}

// Substitui o seletor nativo do Android (CameraSource.Prompt), que aparece em inglês
// ("Photo / From Photos / Take Picture") — esse popup fica em português e centralizado,
// consistente com o resto do app.
export default function ImageSourcePickerModal({
  isOpen, onClose, isDarkMode, onPickCamera, onPickGallery,
}: ImageSourcePickerModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Escolher Imagem" maxWidth="max-w-xs" zIndex={98000}>
      <div className="flex flex-col gap-4">
        <p className="text-xs font-bold text-center text-slate-500 dark:text-slate-400">
          Escolher arquivo de onde?
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => { onClose(); onPickCamera(); }}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-indigo-600 text-white"
          >
            <CameraIcon size={16} /> Câmera
          </button>
          <button
            type="button"
            onClick={() => { onClose(); onPickGallery(); }}
            className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
          >
            <Images size={16} /> Galeria
          </button>
        </div>
      </div>
    </Modal>
  );
}
