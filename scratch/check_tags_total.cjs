
const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\SISTEMAS-PC\\Desktop\\PROJETOS ANTIGRAVIT\\APP VENDAS E PRODUCAO\\src\\views\\ProductFormView.tsx', 'utf8');

const openDivs = (content.match(/<div/g) || []).length;
const closeDivs = (content.match(/<\/div>/g) || []).length;

console.log(`Total Open divs: ${openDivs}`);
console.log(`Total Close divs: ${closeDivs}`);

const openFragments = (content.match(/<>/g) || []).length;
const closeFragments = (content.match(/<\/>/g) || []).length;

console.log(`Total Open fragments: ${openFragments}`);
console.log(`Total Close fragments: ${closeFragments}`);
