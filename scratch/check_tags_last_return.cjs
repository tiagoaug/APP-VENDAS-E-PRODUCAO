
const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\SISTEMAS-PC\\Desktop\\PROJETOS ANTIGRAVIT\\APP VENDAS E PRODUCAO\\src\\views\\ProductFormView.tsx', 'utf8');
const lines = content.split('\n');
const range = lines.slice(764).join('\n');

const openDivs = (range.match(/<div/g) || []).length;
const closeDivs = (range.match(/<\/div>/g) || []).length;

console.log(`Open divs (last return): ${openDivs}`);
console.log(`Close divs (last return): ${closeDivs}`);
