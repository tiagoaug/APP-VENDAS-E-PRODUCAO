import { useState, useEffect } from 'react';
import { DeliveryAddress, Person } from '../types';
import { X, MapPin, Contact as ContactIcon } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';
import { toast } from '../utils/toast';
import DeliveryAddressForm from './DeliveryAddressForm';
import GuidePulseDot from './GuidePulseDot';

interface PersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (person: Omit<Person, 'id'>) => void;
  person?: Person;
  sellers: Person[];
  allPeople: Person[];
  initialData?: Partial<Person>;
  isDarkMode: boolean;
  // Bolinha pulsante em Nome, Telefone e Categoria de Cadastro, ver Etapa 8 do Assistente de
  // Configuração (mesmo mecanismo de CollaboratorsConfigView/CategoriesView/etc.).
  guideActive?: boolean;
}

export default function PersonModal({ isOpen, onClose, onSave, person, sellers, allPeople, initialData, isDarkMode, guideActive }: PersonModalProps) {
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
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress | undefined>(undefined);

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
      setDeliveryAddress(person.defaultDeliveryAddress);
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
      setDeliveryAddress(initialData?.defaultDeliveryAddress);
    }
  }, [person, isOpen, initialData]);

  if (!isOpen) return null;

  // Trava contra toque duplo — sem isso, dois toques rápidos disparam duas chamadas de
  // requestPermissions() concorrentes; o iOS só mostra UM diálogo nativo por vez, então a
  // segunda chamada acaba resolvendo como "negada" sem nunca ter perguntado nada, duplicando o
  // toast de erro mesmo numa única tentativa real do usuário.
  const [importingContact, setImportingContact] = useState(false);

  // Importa nome/telefone/e-mail direto da agenda nativa do aparelho (Android/iOS) — evita
  // digitar de novo um contato que a pessoa já tem salvo no celular.
  const handleImportFromContacts = async () => {
    if (importingContact) return;
    setImportingContact(true);
    try {
      const perm = await Contacts.checkPermissions();
      if (perm.contacts !== 'granted') {
        // No iOS, depois da primeira negativa o sistema NUNCA mais mostra o popup de
        // permissão de novo — requestPermissions() simplesmente devolve "denied" direto, sem
        // perguntar nada. Por isso a mensagem já manda pra Ajustes em vez de insistir/repetir
        // "negada" sem dar um jeito de resolver.
        if (perm.contacts === 'denied') {
          const settingsPath = Capacitor.getPlatform() === 'ios' ? 'Ajustes do iPhone → LIM.O APP → Contatos' : 'Configurações do Android → Apps → LIM.O APP → Permissões → Contatos';
          toast.show(`Acesso aos contatos bloqueado. Ative em ${settingsPath}.`);
          return;
        }
        const req = await Contacts.requestPermissions();
        if (req.contacts !== 'granted') {
          // Diagnóstico temporário — mostra o status exato que o iOS devolveu (ex.: "prompt",
          // "restricted") em vez de só "negada", pra descobrir se é uma negativa real do
          // usuário no diálogo nativo ou algo bloqueando o diálogo de aparecer.
          toast.show(`Permissão de acesso aos contatos negada. (${perm.contacts} → ${req.contacts})`);
          return;
        }
      }
      const { contact } = await Contacts.pickContact({ projection: { name: true, phones: true, emails: true } });
      if (!contact) return;

      if (contact.name?.display) setName(contact.name.display);
      const primaryPhone = contact.phones?.find(p => p.isPrimary) || contact.phones?.[0];
      if (primaryPhone?.number) setPhone(primaryPhone.number);
      const primaryEmail = contact.emails?.find(e => e.isPrimary) || contact.emails?.[0];
      if (primaryEmail?.address) setEmail(primaryEmail.address);
    } catch (e) {
      toast.show('Não foi possível importar o contato: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setImportingContact(false);
    }
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
      observations,
      defaultDeliveryAddress: deliveryAddress,
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
      setDeliveryAddress(undefined);
      toast.show('Cadastro realizado com sucesso!');
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 w-full max-w-2xl shadow-2xl border border-white/20 max-h-[90vh] overflow-y-auto force-scrollbar">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-2xl font-black uppercase tracking-tight text-slate-800 dark:text-white">
            {person ? 'Editar Cadastro' : 'Novo Registro'}
          </h3>
          <button
            onClick={onClose}
            data-guide-anchor="person.fechar"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
            title="Fechar"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {!person && initialData && (
          <div className="mb-6 p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-100 dark:border-indigo-800 text-[11px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 text-center">
            Dados preenchidos pela IA — revise antes de salvar
          </div>
        )}

        {Capacitor.isNativePlatform() && (
          <button
            type="button"
            onClick={handleImportFromContacts}
            disabled={importingContact}
            data-guide-anchor="person.importarAgenda"
            className="w-full mb-6 flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-[11px] font-black uppercase tracking-widest hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors active:scale-[0.98] disabled:opacity-50"
          >
            <ContactIcon size={16} />
            {importingContact ? 'Abrindo...' : 'Importar da Agenda'}
          </button>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Nome Completo {guideActive && <GuidePulseDot show />}</label>
            <input
              type="text"
              placeholder="Ex: João Silva"
              className="w-full h-14 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-5 text-base font-bold transition-all outline-none dark:text-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Telefone / WhatsApp {guideActive && <GuidePulseDot show />}</label>
            <input
              type="tel"
              placeholder="(00) 00000-0000"
              className="w-full h-14 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-5 text-base font-bold transition-all outline-none dark:text-white"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">E-mail (Opcional)</label>
            <input
              type="email"
              placeholder="exemplo@email.com"
              className="w-full h-14 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-5 text-base font-bold transition-all outline-none dark:text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">CPF ou CNPJ</label>
            <input
              type="text"
              placeholder="000.000.000-00"
              className="w-full h-14 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-5 text-base font-bold transition-all outline-none dark:text-white"
              value={document}
              onChange={(e) => setDocument(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Categoria de Cadastro {guideActive && <GuidePulseDot show />}</label>
            <label className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors border-2 border-transparent has-[:checked]:border-indigo-500">
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 rounded-lg border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:border-slate-600 shrink-0"
                checked={isCustomer}
                onChange={(e) => setIsCustomer(e.target.checked)}
              />
              <div className="min-w-0">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 block">Cliente</span>
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 block mt-0.5">Marque quando essa pessoa/empresa compra de você. Ela passa a aparecer como opção de cliente na tela de Venda.</span>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors border-2 border-transparent has-[:checked]:border-indigo-500">
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 rounded-lg border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:border-slate-600 shrink-0"
                checked={isSupplier}
                onChange={(e) => setIsSupplier(e.target.checked)}
              />
              <div className="min-w-0">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 block">Fornecedor</span>
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 block mt-0.5">Marque quando essa pessoa/empresa vende matéria-prima, produtos ou serviços para você. Ela aparece como opção nas Compras e Ordens de Serviço.</span>
              </div>
            </label>
            {/* "Representante Externo" (isSeller) e "Comprador" (isBuyer) saíram daqui — agora
                são cadastrados como cargo dentro de Equipe (RH), ver CollaboratorsConfigView.tsx.
                isSeller/isBuyer continuam existindo no tipo Person só pra não apagar valor de
                registros antigos ao salvar por outro motivo; não há mais UI pra ligá-los aqui. */}
            <label className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors border-2 border-transparent has-[:checked]:border-indigo-500">
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 rounded-lg border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:border-slate-600 shrink-0"
                checked={isServiceProvider}
                onChange={(e) => setIsServiceProvider(e.target.checked)}
              />
              <div className="min-w-0">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 block">Terceirizado</span>
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 block mt-0.5">Marque quando essa pessoa presta um serviço (ex.: terceirização, conserto). Ela aparece como opção na Ordem de Serviço.</span>
              </div>
            </label>
          </div>

          {(isCustomer || isSupplier) && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
              {/* Observations Field */}
            <div className="pt-4 space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Observações Internas</label>
              <textarea
                placeholder="Informações adicionais sobre o cliente/fornecedor..."
                className="w-full h-24 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-5 py-4 text-base font-bold transition-all outline-none dark:text-white resize-none"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
              />
            </div>

            {/* Endereço de entrega padrão — pré-preenche o de uma venda nova (ver "Usar
                Endereço Cadastrado" em SalesView), sem precisar digitar tudo de novo. */}
            {isCustomer && (
              <div className="pt-4 space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <MapPin size={14} className="text-teal-600 shrink-0" />
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Endereço de Entrega Padrão</label>
                </div>
                <DeliveryAddressForm
                  isDarkMode={isDarkMode}
                  address={deliveryAddress}
                  onChange={setDeliveryAddress}
                />
              </div>
            )}
          </div>
        )}

          <div className="flex gap-3 mt-8">
            <button
              onClick={onClose}
              data-guide-anchor="person.cancelar"
              className="flex-1 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black uppercase text-xs tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              data-guide-anchor="person.salvar"
              className="flex-1 h-14 rounded-2xl bg-indigo-600 text-white font-black uppercase text-xs tracking-widest shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
