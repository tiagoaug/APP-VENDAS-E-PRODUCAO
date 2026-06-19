import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Delete lines from 3974 to 4351
del lines[3973:4351]

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Mapas cards removed successfully")
