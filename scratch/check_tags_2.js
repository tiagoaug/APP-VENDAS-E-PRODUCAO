import fs from 'fs';

const content = fs.readFileSync('c:\\Users\\SISTEMAS-PC\\Desktop\\PROJETOS ANTIGRAVIT\\APP VENDAS E PRODUCAO\\src\\views\\ProductFormView.tsx', 'utf8');
const lines = content.split('\n');

let level = 0;
let inJSX = false;
let startLine = 766;

for (let i = startLine - 1; i < lines.length; i++) {
  const line = lines[i];
  
  // Find tags
  const tags = line.match(/<[a-zA-Z0-9]+[^>]*>|<\/[a-zA-Z0-9]+>/g) || [];
  
  for (const tag of tags) {
    if (tag.startsWith('</')) {
      level--;
    } else if (!tag.endsWith('/>') && !tag.match(/<(img|br|hr|input|meta|link)[^>]*>/i)) {
      level++;
    }
    console.log(`L${i+1}: Level ${level} | ${tag}`);
  }
}
console.log("FINAL LEVEL:", level);
