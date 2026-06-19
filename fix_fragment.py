import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace:
# return (
#   <button type="button"
# with:
# return (
#   <>
#     <button type="button"

content = content.replace("                              return (\n                                <button type=\"button\"", "                              return (\n                                <>\n                                <button type=\"button\"")

# Replace:
#                                   Compartilhar Ficha
#                                 </button>
#                               );
#                             })()}
# with:
#                                   Compartilhar Ficha
#                                 </button>
#                                 </>
#                               );
#                             })()}

content = content.replace("Compartilhar Ficha\n                                </button>\n                              );\n                            })()}", "Compartilhar Ficha\n                                </button>\n                                </>\n                              );\n                            })()}")

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Wrapped in fragment!")
