
import { useState, useEffect } from 'react';
import { ColorValue } from '../types';

interface ColorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (color: Omit<ColorValue, 'id'>) => void;
  color?: ColorValue;
}

export default function ColorModal({ isOpen, onClose, onSave, color }: ColorModalProps) {
  const [name, setName] = useState(color?.name || '');

  useEffect(() => {
    if (color) {
      setName(color.name);
    }
  }, [color]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4">
        <h2 className="text-xl font-black text-slate-800 dark:text-white">
          {color ? 'Editar Cor' : 'Nova Cor'}
        </h2>
        <input
          type="text"
          placeholder="Nome da Cor"
          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">Cancelar</button>
          <button 
            onClick={() => {
              onSave({ name, hex: '#000000' });
              setName('');
              onClose();
            }}
            className="flex-1 py-3 rounded-xl bg-indigo-600 font-bold text-white shadow-lg"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
