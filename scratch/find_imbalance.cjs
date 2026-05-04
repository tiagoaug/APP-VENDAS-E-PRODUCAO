
const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\SISTEMAS-PC\\Desktop\\PROJETOS ANTIGRAVIT\\APP VENDAS E PRODUCAO\\src\\views\\ProductFormView.tsx', 'utf8');
const lines = content.split('\n');

let balance = 0;
for (let i = 764; i < lines.length; i++) {
  const line = lines[i];
  const opens = (line.match(/<div/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  balance += opens - closes;
  if (balance < 0) {
    console.log(`Balance negative at line ${i + 1}: ${balance}`);
  }
}
console.log(`Final balance: ${balance}`);
