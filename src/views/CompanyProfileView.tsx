import { useState } from 'react';
import { CompanyProfile } from '../types';
import { Building2, Camera, X, Phone, MapPin, FileDigit, Image as ImageIcon, Save } from 'lucide-react';
import { toast } from '../utils/toast';

interface CompanyProfileViewProps {
  profile: CompanyProfile;
  onSave: (profile: CompanyProfile) => Promise<void>;
  isDarkMode: boolean;
}

const EXPORT_POSITION_OPTIONS: { value: CompanyProfile['exportPosition']; label: string; desc: string }[] = [
  { value: 'none', label: 'Não incluir', desc: 'PDFs e JPGs seguem sem identidade da empresa' },
  { value: 'header', label: 'Cabeçalho', desc: 'Faixa no topo do documento' },
  { value: 'footer', label: 'Rodapé', desc: 'Faixa no final do documento' },
];

function readImageResized(file: File, maxSide: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxSide / img.width, maxSide / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Não foi possível carregar a imagem'));
      img.src = result;
    };
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo'));
    reader.readAsDataURL(file);
  });
}

export default function CompanyProfileView({ profile, onSave, isDarkMode }: CompanyProfileViewProps) {
  const [draft, setDraft] = useState<CompanyProfile>(profile);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSave(draft);
      toast.show('Dados da empresa salvos com sucesso!');
    } catch (e: any) {
      toast.show('Erro ao salvar: ' + (e?.message || e));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRowCls = `flex items-center justify-between p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50 border border-slate-100'}`;

  return (
    <div className="flex flex-col gap-6 pb-32 max-w-2xl mx-auto">
      <header className="flex items-center gap-3">
        <div className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          <Building2 size={24} />
        </div>
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Personalizar Empresa</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Nome, logo e dados exibidos em PDFs/JPGs compartilhados</p>
        </div>
      </header>

      {/* Logo */}
      <div className="flex justify-center">
        <label className="relative cursor-pointer group" title="Toque para adicionar a logomarca">
          <div className={`w-24 h-24 rounded-3xl overflow-hidden border-2 flex items-center justify-center transition-all ${draft.logoUrl ? 'border-indigo-300 dark:border-indigo-600' : 'border-dashed border-slate-200 dark:border-slate-700'} ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
            {draft.logoUrl ? (
              <img src={draft.logoUrl} alt="Logomarca" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1">
                <ImageIcon size={26} className="text-slate-300 dark:text-slate-600" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Logo</span>
              </div>
            )}
          </div>
          {draft.logoUrl && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setDraft({ ...draft, logoUrl: undefined }); }}
              className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-rose-600 transition-all"
              title="Remover logo"
            >
              <X size={12} strokeWidth={3} />
            </button>
          )}
          <div className="absolute inset-0 rounded-3xl bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera size={22} className="text-white" />
          </div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                const dataUrl = await readImageResized(file, 400);
                setDraft((d) => ({ ...d, logoUrl: dataUrl }));
              } catch (err: any) {
                toast.show(err?.message || 'Erro ao carregar imagem');
              }
            }}
          />
        </label>
      </div>

      {/* Dados */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Nome da Empresa</label>
          <input
            type="text"
            value={draft.name || ''}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Ex: Nome da sua empresa"
            className={`px-4 py-3 rounded-2xl border-2 text-sm font-bold outline-none focus:border-indigo-500 transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 flex items-center gap-1.5"><Phone size={11} /> Telefone</label>
          <input
            type="text"
            value={draft.phone || ''}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            placeholder="(00) 00000-0000"
            className={`px-4 py-3 rounded-2xl border-2 text-sm font-bold outline-none focus:border-indigo-500 transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 flex items-center gap-1.5"><MapPin size={11} /> Endereço</label>
          <input
            type="text"
            value={draft.address || ''}
            onChange={(e) => setDraft({ ...draft, address: e.target.value })}
            placeholder="Rua, número, cidade — UF"
            className={`px-4 py-3 rounded-2xl border-2 text-sm font-bold outline-none focus:border-indigo-500 transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 flex items-center gap-1.5"><FileDigit size={11} /> CNPJ/CPF (opcional)</label>
          <input
            type="text"
            value={draft.document || ''}
            onChange={(e) => setDraft({ ...draft, document: e.target.value })}
            placeholder="00.000.000/0000-00"
            className={`px-4 py-3 rounded-2xl border-2 text-sm font-bold outline-none focus:border-indigo-500 transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
          />
        </div>
      </div>

      {/* Onde exibir nos exports */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Nos PDFs e JPGs compartilhados</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {EXPORT_POSITION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDraft({ ...draft, exportPosition: opt.value })}
              className={`p-4 rounded-2xl border-2 text-left transition-all ${draft.exportPosition === opt.value ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-slate-50'}`}
            >
              <p className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{opt.label}</p>
              <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider mt-0.5 leading-tight">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* O que mostrar */}
      {draft.exportPosition !== 'none' && (
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">O que incluir</label>
          {([
            ['showLogo', 'Logomarca'],
            ['showName', 'Nome da empresa'],
            ['showPhone', 'Telefone'],
            ['showAddress', 'Endereço'],
          ] as [keyof CompanyProfile, string][]).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setDraft({ ...draft, [key]: !draft[key] })} className={toggleRowCls}>
              <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{label}</p>
              <div className={`w-11 h-6 rounded-full relative transition-colors duration-300 ${draft[key] ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${draft[key] ? 'left-6' : 'left-1'}`} />
              </div>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <Save size={15} /> {isSaving ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  );
}
