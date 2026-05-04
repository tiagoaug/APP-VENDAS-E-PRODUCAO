
const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\SISTEMAS-PC\\Desktop\\PROJETOS ANTIGRAVIT\\APP VENDAS E PRODUCAO\\src\\views\\ProductFormView.tsx', 'utf8');
const lines = content.split('\n');
const range = lines.slice(764, 1322).join('\n');

const openDivs = (range.match(/<div/g) || []).length;
const closeDivs = (range.match(/<\/div>/g) || []).length;

console.log(`Open divs: ${openDivs}`);
console.log(`Close divs: ${closeDivs}`);

const openFragments = (range.match(/<>/g) || []).length;
const closeFragments = (range.match(/<\/>/g) || []).length;

console.log(`Open fragments: ${openFragments}`);
console.log(`Close fragments: ${closeFragments}`);
