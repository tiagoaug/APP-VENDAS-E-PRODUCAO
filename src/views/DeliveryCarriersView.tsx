import { useEffect, useState } from 'react';
import { ArrowLeft, Truck, Plus, Pencil, Trash2, Phone, MapPin } from 'lucide-react';
import { Carrier } from '../types';
import DeliveryAddressForm from '../components/DeliveryAddressForm';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { generateId } from '../utils/id';

interface DeliveryCarriersViewProps {
  carriers: Carrier[];
  isDarkMode: boolean;
  onBack: () => void;
  onSaveCarrier: (carrier: Carrier) => Promise<void>;
  onDeleteCarrier: (id: string) => Promise<void>;
}

export default function DeliveryCarriersView({ carriers, isDarkMode, onBack, onSaveCarrier, onDeleteCarrier }: DeliveryCarriersViewProps) {
  const [editing, setEditing] = useState<Carrier | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState<Carrier['address']>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Carrier | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setPhone(editing.phone || '');
      setAddress(editing.address);
    } else {
      setName('');
      setPhone('');
      setAddress(undefined);
    }
  }, [editing, isFormOpen]);

  const openNew = () => { setEditing(null); setIsFormOpen(true); };
  const openEdit = (c: Carrier) => { setEditing(c); setIsFormOpen(true); };

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await onSaveCarrier({ id: editing?.id || generateId(), name: name.trim(), phone: phone.trim() || undefined, address });
      setIsFormOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await onDeleteCarrier(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full pb-32">
      <div className="flex justify-between items-center px-2 pt-2 pb-4">
        <button onClick={onBack} title="Voltar" aria-label="Voltar"
          className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-500'} shadow-sm`}>
          <ArrowLeft size={20} />
        </button>
        <h1 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Transportadoras</h1>
        <div className="w-9" />
      </div>

      <div className="flex flex-col gap-3 px-1">
        <button
          type="button"
          onClick={openNew}
          data-guide-anchor="carrier.novo"
          className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-teal-600 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 active:scale-[0.98] transition-all"
        >
          <Plus size={14} />
          Nova Transportadora
        </button>

        {carriers.length === 0 ? (
          <div className={`flex flex-col items-center gap-2 p-8 rounded-3xl border-2 border-dashed text-center ${isDarkMode ? 'border-slate-800 text-slate-500' : 'border-slate-100 text-slate-400'}`}>
            <Truck size={28} strokeWidth={1.5} />
            <p className="text-xs font-bold uppercase tracking-widest">Nenhuma transportadora cadastrada</p>
          </div>
        ) : (
          carriers.map(c => (
            <div key={c.id} className={`flex items-start gap-3 p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className={`p-2.5 rounded-xl shrink-0 ${isDarkMode ? 'bg-teal-900/30 text-teal-400' : 'bg-teal-50 text-teal-600'}`}>
                <Truck size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{c.name}</p>
                {c.phone && (
                  <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 mt-1">
                    <Phone size={11} /> {c.phone}
                  </p>
                )}
                {(c.address?.street || c.address?.city) && (
                  <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 mt-1 truncate">
                    <MapPin size={11} className="shrink-0" />
                    {[c.address?.street, c.address?.number, c.address?.city].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => openEdit(c)} title="Editar" className="p-2 rounded-xl shrink-0 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all">
                <Pencil size={16} />
              </button>
              <button type="button" onClick={() => setDeleteTarget(c)} title="Excluir" className="p-2 rounded-xl shrink-0 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editing ? 'Editar Transportadora' : 'Nova Transportadora'}
        icon={<Truck size={20} />}
        maxWidth="max-w-lg"
        closeLabel="Cancelar"
      >
        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nome</label>
            <input
              type="text"
              placeholder="Ex: Transportadora Rápido Sul"
              className={`w-full h-12 ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'} border-2 border-transparent focus:border-teal-500 rounded-2xl px-4 text-sm font-bold transition-all outline-none dark:text-white`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Telefone</label>
            <input
              type="tel"
              placeholder="(00) 00000-0000"
              className={`w-full h-12 ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'} border-2 border-transparent focus:border-teal-500 rounded-2xl px-4 text-sm font-bold transition-all outline-none dark:text-white`}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Endereço</label>
            <DeliveryAddressForm
              isDarkMode={isDarkMode}
              address={address}
              onChange={setAddress}
            />
          </div>
          <button
            type="button"
            disabled={isSaving || !name.trim()}
            onClick={handleSave}
            data-guide-anchor="carrier.salvar"
            className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-teal-600 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 disabled:opacity-60 active:scale-[0.98] transition-all"
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Excluir Transportadora"
        message={isDeleting ? 'Excluindo...' : `"${deleteTarget?.name}" será excluída. Pedidos que já apontam pra ela continuam salvos, só não vão mais achar o cadastro.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isDanger
      />
    </div>
  );
}
