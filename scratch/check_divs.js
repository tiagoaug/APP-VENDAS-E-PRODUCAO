
import fs from 'fs';

const content = fs.readFileSync('src/views/PCPView.tsx', 'utf8');
const lines = content.split('\n');

let stack = [];
let openCount = 0;
let closeCount = 0;

lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Find all <div and </div> on this line
    // Use regex to handle multiple on one line
    const divOpenRegex = /<div(?!\w)/g;
    const divCloseRegex = /<\/div>/g;
    const jsxOpenRegex = /\{(?![^{}]*\})/g; // Simple { match
    const jsxCloseRegex = /\}(?![^{}]*\{)/g; // Simple } match (very crude)

    let match;
    while ((match = divOpenRegex.exec(line)) !== null) {
        stack.push({ type: 'div', line: lineNum });
        openCount++;
    }
    while ((match = divCloseRegex.exec(line)) !== null) {
        if (stack.length > 0 && stack[stack.length - 1].type === 'div') {
            stack.pop();
        } else {
            console.log(`Extra </div> at line ${lineNum}`);
        }
        closeCount++;
    }
});

console.log(`Final stack size: ${stack.length}`);
stack.forEach(s => console.log(`Unclosed ${s.type} at line ${s.line}`));
console.log(`Total Open: ${openCount}, Total Close: ${closeCount}`);
