import re

with open('src/components/ExportNoteModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add state for editingProfile
state_pattern = r"  const \[newProfileName, setNewProfileName\] = useState\(''\);"
state_replacement = """  const [newProfileName, setNewProfileName] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState('');"""
content = content.replace("  const [newProfileName, setNewProfileName] = useState('');", state_replacement)

# 2. Replace profiles.map logic
list_pattern = r"\{profiles\.map\(\(p\) => \(\s*<div key=\{p\.id\} className=\{`w-full.*?<Trash2 size=\{14\} strokeWidth=\{2\.5\} \/>\s*</button>\s*</div>\s*\)\)\}"
match_list = re.search(list_pattern, content, re.DOTALL)

list_replacement = """{profiles.map((p) => (
                <div key={p.id} className={`w-full flex items-center gap-2 pr-2 rounded-2xl border transition-all text-left ${
                  activeProfileId === p.id
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                }`}>
                  {editingProfileId === p.id ? (
                    <div className="flex-1 flex items-center gap-2 p-2">
                      <input
                        type="text"
                        value={editingProfileName}
                        onChange={(e) => setEditingProfileName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && editingProfileName.trim()) {
                            e.preventDefault();
                            const newP = profiles.map(x => x.id === p.id ? { ...x, name: editingProfileName.trim() } : x);
                            setProfiles(newP);
                            saveProfiles(newP);
                            setEditingProfileId(null);
                          }
                        }}
                        autoFocus
                        className={`flex-1 min-w-0 rounded-xl px-3 py-2 text-[11px] font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                          isDarkMode ? 'bg-slate-800 border border-slate-600 text-white' : 'bg-white border border-slate-300 text-slate-700'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (editingProfileName.trim()) {
                            const newP = profiles.map(x => x.id === p.id ? { ...x, name: editingProfileName.trim() } : x);
                            setProfiles(newP);
                            saveProfiles(newP);
                            setEditingProfileId(null);
                          }
                        }}
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-emerald-500 hover:bg-emerald-500/10"
                      >
                        <Check size={14} strokeWidth={3} />
                      </button>
                    </div>
                  ) : (
                    <>
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
                          setEditingProfileId(p.id);
                          setEditingProfileName(p.name);
                        }}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 hover:bg-indigo-500/10 ${isDarkMode ? 'text-slate-400 hover:text-indigo-400' : 'text-slate-500 hover:text-indigo-600'}`}
                      >
                        <Pencil size={14} strokeWidth={2.5} />
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
                    </>
                  )}
                </div>
              ))}"""

if match_list:
    content = content[:match_list.start()] + list_replacement + content[match_list.end():]
    print("SUCCESS LIST")
else:
    print("FAILED LIST")

with open('src/components/ExportNoteModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
