import re

with open('src/components/ExportNoteModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Icons and Types
import_pattern = r"import \{ (.*?) \} from 'lucide-react';"
match_import = re.search(import_pattern, content)
if match_import:
    icons = match_import.group(1)
    if "Save" not in icons:
        new_icons = icons + ", Save, ChevronDown, ListStart"
        content = content.replace(match_import.group(0), f"import {{ {new_icons} }} from 'lucide-react';")

types_block = """
export interface ExportProfile {
  id: string;
  name: string;
  format: 'pdf' | 'jpg';
  financialValues: boolean;
  groupMode: 'none' | 'ref_color' | 'ref';
  pcpTotalGrid: boolean;
  showMaterials: boolean;
  showItemGrid: boolean;
  showSectorNotes: boolean;
  showOrderList: boolean;
}

const DEFAULT_PROFILE: Omit<ExportProfile, 'id' | 'name'> = {
  format: 'pdf',
  financialValues: true,
  groupMode: 'none',
  pcpTotalGrid: true,
  showMaterials: true,
  showItemGrid: true,
  showSectorNotes: true,
  showOrderList: true,
};

const loadProfiles = (): ExportProfile[] => {
  const data = localStorage.getItem('@app:export_profiles');
  return data ? JSON.parse(data) : [];
};

const saveProfiles = (profiles: ExportProfile[]) => {
  localStorage.setItem('@app:export_profiles', JSON.stringify(profiles));
};

const loadLastState = (): Omit<ExportProfile, 'id' | 'name'> => {
  const data = localStorage.getItem('@app:export_last_state');
  return data ? JSON.parse(data) : DEFAULT_PROFILE;
};

"""
# insert types after imports
content = content.replace("interface ExportNoteModalProps", types_block + "interface ExportNoteModalProps")

# 2. Update state declarations
state_pattern = r"(const \[note, setNote\].*?setIsPreviewLoading\(false\);)"
match_state = re.search(state_pattern, content, re.DOTALL)

state_replacement = """const [note, setNote] = useState('');
  
  // Profile State
  const [profiles, setProfiles] = useState<ExportProfile[]>(() => loadProfiles());
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

  // Main config state
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'jpg'>('pdf');
  const [showFinancialValues, setShowFinancialValues] = useState(true);
  const [groupMode, setGroupMode] = useState<'none' | 'ref_color' | 'ref'>('none');
  const [pcpTotalGrid, setPcpTotalGrid] = useState(true);
  const [showMaterials, setShowMaterials] = useState(true);
  const [showItemGrid, setShowItemGrid] = useState(true);
  const [showSectorNotes, setShowSectorNotes] = useState(true);
  const [showOrderList, setShowOrderList] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      const state = loadLastState();
      setSelectedFormat(initialFormat || state.format);
      setShowFinancialValues(state.financialValues);
      setGroupMode(state.groupMode);
      setPcpTotalGrid(state.pcpTotalGrid);
      setShowMaterials(state.showMaterials);
      setShowItemGrid(state.showItemGrid);
      setShowSectorNotes(state.showSectorNotes);
      setShowOrderList(state.showOrderList);
      setActiveProfileId(localStorage.getItem('@app:export_active_profile') || null);
    }
  }, [isOpen, initialFormat]);

  React.useEffect(() => {
    if (!isOpen) return;
    const state = {
      format: selectedFormat,
      financialValues: showFinancialValues,
      groupMode: groupMode,
      pcpTotalGrid: pcpTotalGrid,
      showMaterials: showMaterials,
      showItemGrid: showItemGrid,
      showSectorNotes: showSectorNotes,
      showOrderList: showOrderList,
    };
    localStorage.setItem('@app:export_last_state', JSON.stringify(state));

    if (activeProfileId) {
      const p = profiles.find(x => x.id === activeProfileId);
      if (p) {
        const isSame = 
          p.format === selectedFormat &&
          p.financialValues === showFinancialValues &&
          p.groupMode === groupMode &&
          p.pcpTotalGrid === pcpTotalGrid &&
          p.showMaterials === showMaterials &&
          p.showItemGrid === showItemGrid &&
          p.showSectorNotes === showSectorNotes &&
          p.showOrderList === showOrderList;
        
        if (!isSame) {
          setActiveProfileId(null);
          localStorage.removeItem('@app:export_active_profile');
        }
      }
    }
  }, [isOpen, selectedFormat, showFinancialValues, groupMode, pcpTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList, activeProfileId, profiles]);"""

if match_state:
    content = content.replace(match_state.group(0), state_replacement)
else:
    print("FAILED TO FIND STATE BLOCK")

# 3. Inject Profile UI
# User said "pode colocar perto do rodape", so let's put the button right before {showGroupingToggle && ...}
# Actually right before {/* Footer Actions */} is better. Let's find: `        {/* Footer Actions */}`
footer_pattern = r"(\s*)\{\/\*\s*Footer Actions\s*\*\/\}"
match_footer = re.search(footer_pattern, content)

profile_ui = """        {/* Profile Button */}
        <div className={`px-6 pb-4 pt-2`}>
          <button 
            type="button" 
            onClick={() => setShowProfilePopup(true)}
            className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all active:scale-[0.99] ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                <Settings2 size={16} strokeWidth={2.5} />
              </div>
              <div className="text-left">
                <p className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Perfis de Exportação</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                  {activeProfileId 
                    ? `Ativo: ${profiles.find(p => p.id === activeProfileId)?.name || 'Desconhecido'}` 
                    : 'Últimas opções usadas'}
                </p>
              </div>
            </div>
            <ChevronDown size={18} className="text-slate-400" />
          </button>
        </div>
"""

if match_footer:
    content = content[:match_footer.start()] + "\n" + profile_ui + content[match_footer.start():]
else:
    print("FAILED TO FIND FOOTER")

# 4. Inject Profile Popup
# At the end of the return statement before the final closing div.
# Searching for: {showQuickNotes && ( ... )} -> wait, it's called manageChips in this file, but there's a popup
popup_pattern = r"(\s*)\{\/\*\s*Popup de gerenciamento dos Textos"
match_popup = re.search(popup_pattern, content)

profile_popup_ui = """
      {/* Profile Popup */}
      {showProfilePopup && (
        <div className="absolute inset-0 z-50 flex flex-col bg-slate-900/40 backdrop-blur-sm p-4">
          <div className={`flex-1 rounded-3xl shadow-2xl flex flex-col overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
            {/* Header */}
            <div className={`p-4 flex items-center justify-between border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-2">
                <Settings2 size={18} className="text-indigo-500" />
                <h3 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Perfis Salvos</h3>
              </div>
              <button onClick={() => setShowProfilePopup(false)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}>
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              <button
                onClick={() => {
                  const state = loadLastState();
                  setSelectedFormat(state.format);
                  setShowFinancialValues(state.financialValues);
                  setGroupMode(state.groupMode);
                  setPcpTotalGrid(state.pcpTotalGrid);
                  setShowMaterials(state.showMaterials);
                  setShowItemGrid(state.showItemGrid);
                  setShowSectorNotes(state.showSectorNotes);
                  setShowOrderList(state.showOrderList);
                  setActiveProfileId(null);
                  localStorage.removeItem('@app:export_active_profile');
                  setShowProfilePopup(false);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${
                  activeProfileId === null
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${activeProfileId === null ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                  <ListStart size={14} strokeWidth={2.5} />
                </div>
                <span className={`flex-1 text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Últimas Opções Usadas</span>
              </button>

              {profiles.map((p) => (
                <div key={p.id} className={`w-full flex items-center gap-2 pr-2 rounded-2xl border transition-all text-left ${
                  activeProfileId === p.id
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                }`}>
                  <button
                    onClick={() => {
                      setSelectedFormat(p.format);
                      setShowFinancialValues(p.financialValues);
                      setGroupMode(p.groupMode);
                      setPcpTotalGrid(p.pcpTotalGrid);
                      setShowMaterials(p.showMaterials);
                      setShowItemGrid(p.showItemGrid);
                      setShowSectorNotes(p.showSectorNotes);
                      setShowOrderList(p.showOrderList);
                      setActiveProfileId(p.id);
                      localStorage.setItem('@app:export_active_profile', p.id);
                      setShowProfilePopup(false);
                    }}
                    className="flex-1 flex items-center gap-3 p-3"
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${activeProfileId === p.id ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                      <Save size={14} strokeWidth={2.5} />
                    </div>
                    <span className={`flex-1 text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{p.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newP = profiles.filter(x => x.id !== p.id);
                      setProfiles(newP);
                      saveProfiles(newP);
                      if (activeProfileId === p.id) {
                        setActiveProfileId(null);
                        localStorage.removeItem('@app:export_active_profile');
                      }
                    }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-rose-500 hover:bg-rose-500/10"
                  >
                    <Trash2 size={14} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add New Profile */}
            <div className={`p-4 shrink-0 border-t ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'}`}>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newProfileName.trim()) {
                      e.preventDefault();
                      const p: ExportProfile = {
                        id: Date.now().toString(),
                        name: newProfileName.trim(),
                        format: selectedFormat,
                        financialValues: showFinancialValues,
                        groupMode: groupMode,
                        pcpTotalGrid: pcpTotalGrid,
                        showMaterials: showMaterials,
                        showItemGrid: showItemGrid,
                        showSectorNotes: showSectorNotes,
                        showOrderList: showOrderList
                      };
                      const newP = [...profiles, p];
                      setProfiles(newP);
                      saveProfiles(newP);
                      setActiveProfileId(p.id);
                      localStorage.setItem('@app:export_active_profile', p.id);
                      setNewProfileName('');
                    }
                  }}
                  placeholder="Nome para novo perfil..."
                  className={`flex-1 min-w-0 rounded-2xl px-4 py-3 text-[11px] font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                    isDarkMode ? 'bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border border-slate-200 text-slate-700 placeholder:text-slate-400'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newProfileName.trim()) {
                      const p: ExportProfile = {
                        id: Date.now().toString(),
                        name: newProfileName.trim(),
                        format: selectedFormat,
                        financialValues: showFinancialValues,
                        groupMode: groupMode,
                        pcpTotalGrid: pcpTotalGrid,
                        showMaterials: showMaterials,
                        showItemGrid: showItemGrid,
                        showSectorNotes: showSectorNotes,
                        showOrderList: showOrderList
                      };
                      const newP = [...profiles, p];
                      setProfiles(newP);
                      saveProfiles(newP);
                      setActiveProfileId(p.id);
                      localStorage.setItem('@app:export_active_profile', p.id);
                      setNewProfileName('');
                    }
                  }}
                  disabled={!newProfileName.trim()}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                    newProfileName.trim() ? 'bg-indigo-600 text-white active:scale-95' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Plus size={18} strokeWidth={3} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
"""

if match_popup:
    content = content[:match_popup.start()] + "\n" + profile_popup_ui + content[match_popup.start():]
else:
    print("FAILED TO FIND POPUP")

with open('src/components/ExportNoteModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Applied successfully.")
