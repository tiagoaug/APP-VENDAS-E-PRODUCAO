with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re
match = re.search(r"Emitir OS", content)
print(match)

matches = re.finditer(r"<Hammer size=\{13\} /> Emitir OS", content)
for m in matches:
    start = m.start()
    print(repr(content[start:start+100]))
