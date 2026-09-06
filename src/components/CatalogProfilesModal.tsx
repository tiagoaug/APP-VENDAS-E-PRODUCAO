import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CatalogProfile, Product } from '../types';
import { X, Bookmark, Trash2, ChevronDown, Package } from 'lucide-react';

interface CatalogProfilesModalProps {
  onClose: () => void;
  profiles: CatalogProfile[];
  products: Product[];
  isDarkMode: boolean;
  onDeleteProfile: (profileId: string) => Promise<void>;
  // Opcional — quando presente, cada perfil vira clicável e aplica a seleção dele na hora
  // (ex.: chamado de dentro do "Enviar Catálogo"). Sem isso, a tela é só de gestão/consulta.
  onApplyProfile?: (profile: CatalogProfile) => void;
}

// Tela cheia (não a fileira de chips) pra listar TODOS os Perfis de Envio de Catálogo — a
// fileira horizontal em cima do popup "Enviar Catálogo" escondia perfis fora da tela sem
// nenhum indício de que dava pra rolar, parecendo que só existia 1 perfil salvo.
export default function CatalogProfilesModal({
  onClose,
  profiles,
  products,
  isDarkMode,
  onDeleteProfile,
  onApplyProfile,
}: CatalogProfilesModalProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sorted = [...profiles].sort((a, b) => b.createdAt - a.createdAt);

  return createPortal(
    <div className="fixed inset-0 z-[71000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md max-h-[85vh] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
      >
        <div className={`flex items-center justify-between px-6 py-5 border-b shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div>
            <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Perfis de Catálogo</h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{profiles.length} perfil{profiles.length !== 1 ? 'is' : ''} salvo{profiles.length !== 1 ? 's' : ''}</p>
          </div>
          <button type="button" onClick={onClose} className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`} aria-label="Fechar">
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4 overflow-y-auto">
          {sorted.length === 0 && (
            <p className="text-[10px] text-slate-400 font-bold text-center py-10 uppercase tracking-widest">
              Nenhum perfil salvo ainda — salve uma seleção de produtos como perfil na tela de escolher produtos.
            </p>
          )}
          {sorted.map(profile => {
            const isExpanded = expandedId === profile.id;
            return (
              <div key={profile.id} className={`rounded-2xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => onApplyProfile?.(profile)}
                    disabled={!onApplyProfile}
                    className={`flex-1 min-w-0 flex items-center gap-3 text-left ${onApplyProfile ? 'active:scale-[0.98]' : ''}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-violet-900/30 text-violet-400' : 'bg-violet-50 text-violet-600'}`}>
                      <Bookmark size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{profile.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{profile.productIds.length} produto{profile.productIds.length !== 1 ? 's' : ''}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : profile.id)}
                    className={`p-2 rounded-xl shrink-0 ${isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-50'}`}
                    title="Ver produtos deste perfil"
                    aria-label="Ver produtos deste perfil"
                  >
                    <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === profile.id}
                    onClick={async () => {
                      if (!confirm(`Excluir o perfil "${profile.name}"? Não afeta links já enviados.`)) return;
                      setDeletingId(profile.id);
                      try { await onDeleteProfile(profile.id); } finally { setDeletingId(null); }
                    }}
                    className={`p-2 rounded-xl shrink-0 disabled:opacity-50 ${isDarkMode ? 'text-rose-400 hover:bg-slate-800' : 'text-rose-500 hover:bg-slate-50'}`}
                    title="Excluir perfil"
                    aria-label="Excluir perfil"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {isExpanded && (
                  <div className={`px-4 pb-3 flex flex-col gap-1.5 border-t pt-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    {profile.productIds.map(pid => {
                      const product = products.find(p => p.id === pid);
                      return (
                        <div key={pid} className="flex items-center gap-2">
                          {product?.photoUrl ? (
                            <img src={product.photoUrl} alt={product.name} className="w-6 h-6 rounded-md object-cover shrink-0" />
                          ) : (
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                              <Package size={10} className="text-slate-400" />
                            </div>
                          )}
                          <p className={`text-[10px] font-bold truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                            {product ? `${product.reference} ${product.name}` : 'Produto removido'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
