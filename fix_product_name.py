import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('{productRef ? `${productRef} ${productName}` : productName}', '{productRef || productName}')

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
