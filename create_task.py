import os

content = """# Tarefas: Central de Compartilhamento do PCP

- `[/]` Criar o arquivo `src/utils/pcpShareExport.ts`.
- `[ ]` Implementar a função `generatePCPShareExport` em `pcpShareExport.ts` para PDF e JPG.
- `[ ]` Adicionar botão "Compartilhar Ficha" na barra flutuante da aba "Setores" no arquivo `src/views/PCPView.tsx`.
- `[ ]` Integrar o estado do `ExportNoteModal` em `src/views/PCPView.tsx`.
- `[ ]` Ligar o modal à função `generatePCPShareExport` e testar a geração.
"""

file_path = r"C:\Users\SISTEMAS-PC\.gemini\antigravity-ide\brain\0917a8e7-9146-4cc8-b892-5250c5e35b4f\task.md"

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("task.md created")
