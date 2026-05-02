import { useState } from 'react';
import { Person, Sale, Purchase, Transaction } from '../types';
import { Search, Plus, User, Mail, Phone, Trash2, Edit, Truck, ShieldCheck, ChevronRight, History } from 'lucide-react';
import PersonModal from '../components/PersonModal';
import FinancialHistoryModal from '../components/FinancialHistoryModal';
import ConfirmDialog from '../components/ConfirmDialog';

interface PeopleViewProps {
  people: Person[];
  sales: Sale[];
  purchases: Purchase[];
  transactions: Transaction[];
  onAdd: (person: Omit<Person, 'id'>) => void;
  onEdit: (id: string, person: Omit<Person, 'id'>) => void;
  onDelete: (id: string) => void;
  onShowDetail: (id: string) => void;
  isDarkMode: boolean;
}

export default function PeopleView({ people, sales, purchases, transactions, onAdd, onEdit, onDelete, onShowDetail, isDarkMode }: PeopleViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'CUSTOMER' | 'SUPPLIER'>('ALL');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const [historyPerson, setHistoryPerson] = useState<Person | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const filtered = people.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filter === 'CUSTOMER') return matchesSearch && p.isCustomer;
    if (filter === 'SUPPLIER') return matchesSearch && p.isSupplier;
    return matchesSearch;
  });

  const handleDeleteClick = (id: string) => {
    setIdToDelete(id);
    setIsConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (idToDelete) {
      onDelete(idToDelete);
      setIdToDelete(null);
      setIsConfirmOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-32 h-full overflow-y-auto force-scrollbar">
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Excluir Cadastro?"
        message="Deseja realmente excluir este cadastro? Todas as transações, vendas e compras vinculadas permanecerão no histórico."
        confirmLabel="Sim, Excluir"
        cancelLabel="Agora não"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setIsConfirmOpen(false);
          setIdToDelete(null);
        }}
        isDanger={true}
      />
      <PersonModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingPerson(null); }}
        onSave={(p) => {
          if (editingPerson) onEdit(editingPerson.id, p);
          else onAdd(p);
        }}
        person={editingPerson || undefined}
      />
      {isHistoryModalOpen && historyPerson && (
        <FinancialHistoryModal
          person={historyPerson}
          sales={sales}
          purchases={purchases}
          transactions={transactions}
          onClose={() => setIsHistoryModalOpen(false)}
          isDarkMode={isDarkMode}
        />
      )}
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar nome ou email..."
            className={`w-full border rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 dark:focus:ring-indigo-500/10 placeholder:text-slate-400 text-slate-800 dark:text-slate-100 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className={`border p-1 rounded-2xl shadow-sm self-start ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <button 
            onClick={() => setFilter('ALL')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'ALL' ? (isDarkMode ? 'bg-indigo-600' : 'bg-slate-900') + ' text-white' : 'text-slate-400'}`}
          >
            Todos
          </button>
          <button 
            onClick={() => setFilter('CUSTOMER')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'CUSTOMER' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
          >
            Clientes
          </button>
          <button 
            onClick={() => setFilter('SUPPLIER')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'SUPPLIER' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}
          >
            Fornecedores
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 pb-32">
        {filtered.map((person) => (
          <div key={person.id} className={`p-4 rounded-3xl border shadow-sm dark:shadow-none flex items-center justify-between group cursor-pointer active:scale-[0.99] transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-100 hover:border-indigo-100'}`}>
            <div className="flex items-center gap-4 flex-1" onClick={() => onShowDetail(person.id)}>
              <div className={`w-12 h-12 flex items-center justify-center font-black text-xl transition-colors ${
                person.isCustomer && person.isSupplier ? 'text-indigo-600 dark:text-indigo-400' :
                person.isCustomer ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
              }`}>
                {person.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={`font-bold text-sm tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{person.name}</h3>
                  <div className="flex gap-1">
                    {person.isCustomer && <ShieldCheck size={14} className="text-emerald-500" />}
                    {person.isSupplier && <Truck size={14} className="text-amber-500" />}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1.5 overflow-x-auto no-scrollbar">
                  {person.email && (
                    <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-widest whitespace-nowrap">
                      <Mail size={12} /> {person.email}
                    </div>
                  )}
                  {person.phone && (
                    <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-widest whitespace-nowrap">
                      <Phone size={12} /> {person.phone}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-1 items-center">
              <button 
                onClick={(e) => { e.stopPropagation(); setHistoryPerson(person); setIsHistoryModalOpen(true); }} 
                className="p-2 text-rose-500 hover:text-rose-600 transition-colors"
                title="Histórico de Pagamentos"
                aria-label="Histórico de Pagamentos"
              >
                <History size={18} strokeWidth={2.5} />
              </button>
               <button 
                onClick={(e) => { e.stopPropagation(); setEditingPerson(person); setIsModalOpen(true); }} 
                className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                title="Editar Cadastro"
                aria-label="Editar Cadastro"
              >
                <Edit size={18} strokeWidth={2.5} />
              </button>
               <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteClick(person.id); }} 
                className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-colors"
                title="Excluir Cadastro"
                aria-label="Excluir Cadastro"
              >
                <Trash2 size={18} strokeWidth={2.5} />
              </button>
              <ChevronRight size={20} className="text-slate-200 dark:text-slate-800 group-hover:text-slate-400 transition-colors" />
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2.5rem]">
            <User size={64} className="mx-auto mb-4 text-slate-200 dark:text-slate-800" strokeWidth={1} />
            <p className="text-[10px] font-black uppercase text-slate-300 dark:text-slate-700 tracking-widest italic">Nenhum registro encontrado</p>
          </div>
        )}
      </div>

      <button 
        onClick={() => { setEditingPerson(null); setIsModalOpen(true); }}
        className={`fixed bottom-32 right-6 w-14 h-14 bg-slate-900 dark:bg-indigo-600 text-white rounded-[2rem] shadow-2xl flex items-center justify-center active:scale-95 transition-all z-20 border-4 border-white dark:border-slate-800 ${isDarkMode ? 'shadow-none' : 'shadow-slate-300'}`}
        title="Novo Cadastro"
        aria-label="Novo Cadastro"
      >
        <Plus size={32} strokeWidth={3} />
      </button>
    </div>
  );
}

