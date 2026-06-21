import os

filepath = r"c:\Users\SISTEMAS-PC\Desktop\PROJETOS ANTIGRAVIT\APP VENDAS E PRODUCAO\src\views\PCPView.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Normalize newlines for robust string matching
content_normalized = content.replace('\r\n', '\n')

# 1. First Replacement: handleConfirmSectorChange isCycleEndSector
target1 = "    const isCycleEndSector = !!currentSectorObj?.isProductionCycleEnd;"
replacement1 = """    const isCycleEndSector = !!currentSectorObj?.isProductionCycleEnd || 
      !!currentSectorObj?.name?.toUpperCase().includes('EXPEDIÇÃO') || 
      !!currentSectorObj?.name?.toUpperCase().includes('EXPEDICAO') ||
      (lot.route && lot.route[lot.route.length - 1] === currentSectorId);"""

# 2. Second Replacement: canFinalizeSelected
target2 = "                const canFinalizeSelected = selectedEffectiveSectorIds.length > 0 && selectedEffectiveSectorIds.every(sid => sectors.find(s => s.id === sid)?.isProductionCycleEnd);"
replacement2 = """                const canFinalizeSelected = selectedEffectiveSectorIds.length > 0 && selectedEffectiveSectorIds.every(sid => {
                  const s = sectors.find(x => x.id === sid);
                  if (!s) return false;
                  const isLastInRoute = selectedLot.route && selectedLot.route[selectedLot.route.length - 1] === sid;
                  return !!s.isProductionCycleEnd || 
                    s.name.toUpperCase().includes('EXPEDIÇÃO') || 
                    s.name.toUpperCase().includes('EXPEDICAO') ||
                    isLastInRoute;
                });"""

# 3. Third Replacement: isEndCycle in details drawer
target3 = "                          const isEndCycle = !!sectorObj?.isProductionCycleEnd;"
replacement3 = """                          const isEndCycle = !!sectorObj?.isProductionCycleEnd || 
                            sectorObj?.name?.toUpperCase().includes('EXPEDIÇÃO') || 
                            sectorObj?.name?.toUpperCase().includes('EXPEDICAO') ||
                            (selectedLot.route && selectedLot.currentSectorIndex === selectedLot.route.length - 1);"""

# Check targets
targets_found = True
if target1 not in content_normalized:
    print("ERROR: target1 not found in content!")
    targets_found = False
if target2 not in content_normalized:
    print("ERROR: target2 not found in content!")
    targets_found = False
if target3 not in content_normalized:
    print("ERROR: target3 not found in content!")
    targets_found = False

if targets_found:
    content_normalized = content_normalized.replace(target1, replacement1)
    content_normalized = content_normalized.replace(target2, replacement2)
    content_normalized = content_normalized.replace(target3, replacement3)
    
    # Write back with original CRLF line endings
    with open(filepath, 'w', encoding='utf-8', newline='\r\n') as f:
        f.write(content_normalized)
    print("SUCCESS: Finalization buttons successfully protected and restored in PCPView.tsx.")
else:
    print("ABORTED: One or more targets were missing. No changes applied.")
