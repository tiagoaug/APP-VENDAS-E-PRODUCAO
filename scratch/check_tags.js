
import fs from 'fs';

const content = fs.readFileSync('src/views/PCPView.tsx', 'utf8');
const lines = content.split('\n');

let stack = [];

lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Find all <div and </div> on this line
    const divOpenRegex = /<div(?!\w)/g;
    const divCloseRegex = /<\/div>/g;
    const jsxBlockOpenRegex = /\{/g;
    const jsxBlockCloseRegex = /\}/g;

    let match;
    let tokens = [];
    
    while ((match = divOpenRegex.exec(line)) !== null) tokens.push({ type: 'DIV_OPEN', pos: match.index });
    while ((match = divCloseRegex.exec(line)) !== null) tokens.push({ type: 'DIV_CLOSE', pos: match.index });
    while ((match = jsxBlockOpenRegex.exec(line)) !== null) tokens.push({ type: 'JSX_OPEN', pos: match.index });
    while ((match = jsxBlockCloseRegex.exec(line)) !== null) tokens.push({ type: 'JSX_CLOSE', pos: match.index });

    tokens.sort((a, b) => a.pos - b.pos).forEach(token => {
        if (token.type.endsWith('_OPEN')) {
            stack.push({ type: token.type, line: lineNum });
        } else {
            const expected = token.type === 'DIV_CLOSE' ? 'DIV_OPEN' : 'JSX_OPEN';
            if (stack.length > 0 && stack[stack.length - 1].type === expected) {
                stack.pop();
            } else {
                console.log(`Mismatch at line ${lineNum}: found ${token.type}, expected ${stack.length > 0 ? stack[stack.length - 1].type : 'NONE'}`);
            }
        }
    });
});

console.log(`Final stack size: ${stack.length}`);
stack.forEach(s => console.log(`Unclosed ${s.type} at line ${s.line}`));
