
const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\SISTEMAS-PC\\Desktop\\PROJETOS ANTIGRAVIT\\APP VENDAS E PRODUCAO\\src\\views\\ProductFormView.tsx', 'utf8');
const lines = content.split('\n');

let balance = 0;
for (let i = 313; i < 762; i++) {
  const line = lines[i];
  const opens = (line.match(/<div/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  if (opens > 0 || closes > 0) {
    balance += opens - closes;
    console.log(`${i + 1}: ${line.trim()} | Balance: ${balance}`);
  }
}
