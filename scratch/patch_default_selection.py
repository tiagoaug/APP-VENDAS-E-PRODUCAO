import os

filepath = r"c:\Users\SISTEMAS-PC\Desktop\PROJETOS ANTIGRAVIT\APP VENDAS E PRODUCAO\src\views\PCPView.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Normalize newlines
content_normalized = content.replace('\r\n', '\n')

target_block = """      return {
        key, orderId, productId,
        productName: product?.name || fallbackProductName || '—',
        colorName: variation?.colorName || fallbackColorName || '',
        qty,
        suggestedSectorId, suggestedSectorName,
        skippedSectorNames: resolved.skippedSectorNames,
        chosenSectorId: '__PENDING_SELECTION__',
      };"""

replacement_block = """      return {
        key, orderId, productId,
        productName: product?.name || fallbackProductName || '—',
        colorName: variation?.colorName || fallbackColorName || '',
        qty,
        suggestedSectorId, suggestedSectorName,
        skippedSectorNames: resolved.skippedSectorNames,
        chosenSectorId: suggestedSectorId,
      };"""

target_normalized = target_block.replace('\r\n', '\n')
replacement_normalized = replacement_block.replace('\r\n', '\n')

if target_normalized in content_normalized:
    new_content = content_normalized.replace(target_normalized, replacement_normalized)
    with open(filepath, 'w', encoding='utf-8', newline='\r\n') as f:
        f.write(new_content)
    print("SUCCESS: Default choice preset to suggestedSectorId in buildLotAdvanceItems.")
else:
    print("ERROR: Target block not found in content!")
