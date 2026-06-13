import { useState, useEffect } from 'react';
import { Person } from '../types';
import { X, Plus, Trash2, ChevronDown } from 'lucide-react';
import { toast } from '../utils/toast';

interface PersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (person: Omit<Person, 'id'>) => void;
  person?: Person;
  sellers: Person[];
  allPeople: Person[];
  initialData?: Partial<Person>;
}

export default function PersonModal({ isOpen, onClose, onSave, person, sellers, allPeople, initialData }: PersonModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [document, setDocument] = useState('');
  const [isCustomer, setIsCustomer] = useState(false);
  const [isSupplier, setIsSupplier] = useState(false);
  const [isSeller, setIsSeller] = useState(false);
  const [isBuyer, setIsBuyer] = useState(false);
  const [isServiceProvider, setIsServiceProvider] = useState(false);
  const [associatedSellerIds, setAssociatedSellerIds] = useState<string[]>([]);
  const [associatedContactIds, setAssociatedContactIds] = useState<string[]>([]);
  const [internalContacts, setInternalContacts] = useState<{ name: string; role: 'Vendedor' | 'Comprador' }[]>([]);
  const [observations, setObservations] = useState('');
  const [sellerSearch, setSellerSearch] = useState('');
  const [showSellerSuggestions, setShowSellerSuggestions] = useState(false);
  const [contactRole, setContactRole] = useState<'Vendedor' | 'Comprador'>('Vendedor');

  useEffect(() => {
    if (person) {
      setName(person.name || '');
      setPhone(person.phone || '');
      setEmail(person.email || '');
      setDocument(person.document || '');
      setIsCustomer(person.isCustomer || false);
      setIsSupplier(person.isSupplier || false);
      setIsSeller(person.isSeller || false);
      setIsBuyer(person.isBuyer || false);
      setIsServiceProvider(person.isServiceProvider || false);
      setAssociatedSellerIds(person.associatedSellerIds || []);
      setAssociatedContactIds(person.associatedContactIds || []);
      setInternalContacts(person.internalContacts || []);
      setObservations(person.observations || '');
    } else {
      setName(initialData?.name || '');
      setPhone(initialData?.phone || '');
      setEmail(initialData?.email || '');
      setDocument(initialData?.document || '');
      setIsCustomer(initialData?.isCustomer || false);
      setIsSupplier(initialData?.isSupplier || false);
      setIsSeller(false);
      setIsBuyer(false);
      setIsServiceProvider(initialData?.isServiceProvider || false);
      setAssociatedSellerIds([]);
      setAssociatedContactIds([]);
      setInternalContacts([]);
      setObservations(initialData?.observations || '');
    }
    setSellerSearch('');
  }, [person, isOpen, initialData]);

  if (!isOpen) return null;

  const handleAddSeller = (sellerId: string) => {
    if (contactRole === 'Vendedor') {
      if (associatedSellerIds.includes(sellerId)) {
        toast.show('Este vendedor já está associado.');
        return;
      }
      setAssociatedSellerIds([...associatedSellerIds, sellerId]);
    } else {
      if (associatedContactIds.includes(sellerId)) {
        toast.show('Este comprador já está associado.');
        return;
      }
      setAssociatedContactIds([...associatedContactIds, sellerId]);
    }
    setSellerSearch('');
    setShowSellerSuggestions(false);
  };

  const handleAddInternalContact = (name: string) => {
    if (!name.trim()) return;
    setInternalContacts([...internalContacts, { name: name.trim(), role: contactRole }]);
    setSellerSearch('');
    setShowSellerSuggestions(false);
  };

  const handleRemoveSeller = (id: string, isBuyerContact: boolean) => {
    if (isBuyerContact) {
      setAssociatedContactIds(associatedContactIds.filter(sId => sId !== id));
    } else {
      setAssociatedSellerIds(associatedSellerIds.filter(sId => sId !== id));
    }
  };

  const handleRemoveInternalContact = (index: number) => {
    setInternalContacts(internalContacts.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!name) {
      toast.show('O nome é obrigatório');
      return;
    }
    onSave({
      name,
      phone,
      email,
      document,
      isCustomer,
      isSupplier,
      isSeller,
      isBuyer,
      isServiceProvider,
      associatedSellerIds,
      associatedContactIds,
      internalContacts,
      observations
    });

    // Se for um novo cadastro, limpa para o próximo
    if (!person) {
      setName('');
      setPhone('');
      setEmail('');
      setDocument('');
      setIsCustomer(false);
      setIsSupplier(false);
      setIsSeller(false);
      setIsBuyer(false);
      setIsServiceProvider(false);
      setAssociatedSellerIds([]);
      setAssociatedContactIds([]);
      toast.show('Cadastro realizado com sucesso!');
    } else {
      onClose();
    }
  };

  const filteredSellers = allPeople.filter(s => 
    s.id !== person?.id &&
    s.name.toLowerCase().includes(sellerSearch.toLowerCase()) &&
    (contactRole === 'Vendedor' ? !associatedSellerIds.includes(s.id) : !associatedContactIds.includes(s.id))
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 w-full max-w-sm shadow-2xl border border-white/20 max-h-[90vh] overflow-y-auto force-scrollbar">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">
            {person ? 'Editar Cadastro' : 'Novo Registro'}
          </h3>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
            title="Fechar"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {!person && initialData && (
          <div className="mb-6 p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-100 dark:border-indigo-800 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 text-center">
            Dados preenchidos pela IA — revise antes de salvar
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nome Completo</label>
            <input
              type="text"
              placeholder="Ex: João Silva"
              className="w-full h-14 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-5 text-sm font-bold transition-all outline-none dark:text-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Telefone / WhatsApp</label>
            <input
              type="tel"
              placeholder="(00) 00000-0000"
              className="w-full h-14 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-5 text-sm font-bold transition-all outline-none dark:text-white"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">E-mail (Opcional)</label>
            <input
              type="email"
              placeholder="exemplo@email.com"
              className="w-full h-14 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-5 text-sm font-bold transition-all outline-none dark:text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">CPF ou CNPJ</label>
            <input
              type="text"
              placeholder="000.000.000-00"
              className="w-full h-14 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-5 text-sm font-bold transition-all outline-none dark:text-white"
              value={document}
              onChange={(e) => setDocument(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <label className="flex-1 min-w-[100px] flex items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors border-2 border-transparent has-[:checked]:border-indigo-500">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded-lg border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:border-slate-600"
                checked={isCustomer} 
                onChange={(e) => setIsCustomer(e.target.checked)} 
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Cliente</span>
            </label>
            <label className="flex-1 min-w-[100px] flex items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors border-2 border-transparent has-[:checked]:border-indigo-500">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded-lg border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:border-slate-600"
                checked={isSupplier} 
                onChange={(e) => setIsSupplier(e.target.checked)} 
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Fornecedor</span>
            </label>
            <label className="flex-1 min-w-[100px] flex items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors border-2 border-transparent has-[:checked]:border-indigo-500">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded-lg border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:border-slate-600"
                checked={isSeller} 
                onChange={(e) => setIsSeller(e.target.checked)} 
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Vendedor</span>
            </label>
            <label className="flex-1 min-w-[100px] flex items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors border-2 border-transparent has-[:checked]:border-indigo-500">
              <input
                type="checkbox"
                className="w-4 h-4 rounded-lg border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:border-slate-600"
                checked={isBuyer}
                onChange={(e) => setIsBuyer(e.target.checked)}
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Comprador</span>
            </label>
            <label className="flex-1 min-w-[100px] flex items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors border-2 border-transparent has-[:checked]:border-indigo-500">
              <input
                type="checkbox"
                className="w-4 h-4 rounded-lg border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:border-slate-600"
                checked={isServiceProvider}
                onChange={(e) => setIsServiceProvider(e.target.checked)}
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Prestador de Serviço</span>
            </label>
          </div>

          {(isCustomer || isSupplier) && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex justify-between items-end mb-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Vendedores / Compradores Internos</label>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
                  <button 
                    type="button"
                    onClick={() => setContactRole('Vendedor')}
                    className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter transition-all ${contactRole === 'Vendedor' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                  >
                    Vendedor
                  </button>
                  <button 
                    type="button"
                    onClick={() => setContactRole('Comprador')}
                    className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter transition-all ${contactRole === 'Comprador' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                  >
                    Comprador
                  </button>
                </div>
              </div>
              
              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder={`Nome do ${contactRole.toLowerCase()}...`}
                      className="w-full h-14 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-5 text-sm font-bold transition-all outline-none dark:text-white"
                      value={sellerSearch}
                      onChange={(e) => {
                        setSellerSearch(e.target.value);
                        setShowSellerSuggestions(true);
                      }}
                      onFocus={() => setShowSellerSuggestions(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && sellerSearch.trim()) {
                          e.preventDefault();
                          // Se houver uma sugestão exata, adiciona ela
                          const exactMatch = filteredSellers.find(s => s.name.toLowerCase() === sellerSearch.toLowerCase());
                          if (exactMatch) {
                            handleAddSeller(exactMatch.id);
                          } else {
                            handleAddInternalContact(sellerSearch);
                          }
                        }
                      }}
                    />
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  <button
                    type="button"
                    className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-all active:scale-90 shadow-lg shadow-indigo-500/20"
                    title="Adicionar contato"
                    onClick={() => {
                      if (sellerSearch.trim()) {
                        const exactMatch = filteredSellers.find(s => s.name.toLowerCase() === sellerSearch.toLowerCase());
                        if (exactMatch) {
                          handleAddSeller(exactMatch.id);
                        } else {
                          handleAddInternalContact(sellerSearch);
                        }
                      }
                    }}
                  >
                    <Plus size={24} strokeWidth={3} />
                  </button>
                </div>

                {showSellerSuggestions && sellerSearch && (
                  <div className="absolute z-[60] w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl max-h-48 overflow-y-auto force-scrollbar">
                    <div className="p-2 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[9px] font-black uppercase tracking-widest text-slate-400 px-4 flex justify-between items-center">
                      <span>Sugestões Encontradas</span>
                    </div>
                    {filteredSellers.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        className="w-full text-left px-5 py-4 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm font-bold dark:text-white border-b border-slate-50 dark:border-slate-800 last:border-0 transition-colors flex items-center justify-between group"
                        onClick={() => handleAddSeller(s.id)}
                      >
                        <div className="flex flex-col">
                          <span>{s.name}</span>
                          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{s.isSeller ? 'Vendedor' : s.isBuyer ? 'Comprador' : 'Contato'}</span>
                        </div>
                        <Plus size={14} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                      </button>
                    ))}
                    <button
                      type="button"
                      className="w-full text-left px-5 py-4 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-[11px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 transition-all flex items-center justify-between group"
                      onClick={() => handleAddInternalContact(sellerSearch)}
                    >
                      <div className="flex flex-col">
                        <span>Adicionar "{sellerSearch}"</span>
                        <span className="text-[8px] opacity-60">Como contato interno simples</span>
                      </div>
                      <Plus size={14} />
                    </button>
                  </div>
                )}

            </div>

            {/* List of associated and internal contacts */}
            <div className="flex flex-wrap gap-2 pt-2">
              {associatedSellerIds.map(sId => {
                const s = allPeople.find(p => p.id === sId);
                return (
                  <div key={sId} className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter">{s?.name || 'Vendedor'}</span>
                    <button onClick={() => handleRemoveSeller(sId, false)} title="Remover Vendedor" className="text-indigo-400 hover:text-rose-500"><X size={12} /></button>
                  </div>
                );
              })}
              {associatedContactIds.map(sId => {
                const s = allPeople.find(p => p.id === sId);
                return (
                  <div key={sId} className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-800">
                    <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">{s?.name || 'Comprador'}</span>
                    <button onClick={() => handleRemoveSeller(sId, true)} title="Remover Comprador" className="text-emerald-400 hover:text-rose-500"><X size={12} /></button>
                  </div>
                );
              })}
              {internalContacts.map((c, idx) => (
                <div key={idx} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${c.role === 'Vendedor' ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-50 dark:border-indigo-900/30' : 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-50 dark:border-emerald-900/30'}`}>
                  <span className={`text-[9px] font-black uppercase tracking-tighter ${c.role === 'Vendedor' ? 'text-indigo-500' : 'text-emerald-500'}`}>{c.name}</span>
                  <button onClick={() => handleRemoveInternalContact(idx)} title="Remover Contato" className="text-slate-300 hover:text-rose-500"><X size={12} /></button>
                </div>
              ))}
            </div>

            {/* Observations Field */}
            <div className="pt-4 space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Observações Internas</label>
              <textarea
                placeholder="Informações adicionais sobre o cliente/fornecedor..."
                className="w-full h-24 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-5 py-4 text-sm font-bold transition-all outline-none dark:text-white resize-none"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
              />
            </div>
          </div>
        )}

          <div className="flex gap-3 mt-8">
            <button 
              onClick={onClose}
              className="flex-1 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black uppercase text-[11px] tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              className="flex-1 h-14 rounded-2xl bg-indigo-600 text-white font-black uppercase text-[11px] tracking-widest shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
