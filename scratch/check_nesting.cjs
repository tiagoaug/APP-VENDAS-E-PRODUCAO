const fs = require('fs');
const content = fs.readFileSync('src/views/PurchasesView.tsx', 'utf8');

function checkBrackets(str) {
    let stack = [];
    let lines = str.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        for (let j = 0; j < line.length; j++) {
            let char = line[j];
            if (char === '{' || char === '(' || char === '[') {
                stack.push({ char, line: i + 1, col: j + 1 });
            } else if (char === '}' || char === ')' || char === ']') {
                if (stack.length === 0) {
                    console.log(`Unmatched closing ${char} at line ${i + 1}, col ${j + 1}`);
                    continue;
                }
                let top = stack.pop();
                if ((char === '}' && top.char !== '{') ||
                    (char === ')' && top.char !== '(') ||
                    (char === ']' && top.char !== '[')) {
                    console.log(`Mismatch: ${top.char} at line ${top.line} closed by ${char} at line ${i + 1}`);
                }
            }
        }
    }
    
    while (stack.length > 0) {
        let top = stack.pop();
        console.log(`Unclosed ${top.char} at line ${top.line}, col ${top.col}`);
    }
}

checkBrackets(content);
