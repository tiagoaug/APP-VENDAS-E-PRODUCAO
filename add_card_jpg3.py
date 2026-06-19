import re

with open('src/utils/pcpShareExport.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Sector Notes in generateJPG RENDER PASS
pattern_render = r"    // Sector Notes\n    if \(showSectorNotes !== false && item\.sectorNotes && item\.sectorNotes\.length > 0\) \{\n      ctx\.fillStyle = '#0f172a';\n      ctx\.font = '900 16px Inter';\n      ctx\.fillText\('INSTRU[^']*?S POR SETOR', pad, y\);\n      y \+= 26;\n\n      for \(const sector of item\.sectorNotes\) \{\n        ctx\.fillStyle = '#475569';\n        ctx\.font = '800 14px Inter';\n        ctx\.fillText\(sector\.sectorName, pad, y\);\n        y \+= 20;\n\n        ctx\.fillStyle = '#0f172a';\n        ctx\.font = '500 15px Inter';\n        for \(const note of sector\.notes\) \{\n          const lines = wrapText\(ctx, `    \$\{note\}`, W - pad \* 2 - 20\);\n          for \(const line of lines\) \{\n            ctx\.fillText\(line, pad \+ 15, y\);\n            y \+= 24;\n          \}\n        \}\n        y \+= 10;\n      \}\n    \}"

render_replacement = """    // Sector Notes
    if (showSectorNotes !== false && item.sectorNotes && item.sectorNotes.length > 0) {
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 16px Inter';
      ctx.fillText('INSTRUÇÕES POR SETOR', pad, y);
      y += 26;

      for (const sector of item.sectorNotes) {
        // Measure height for this sector's card
        let sectorHeight = 40; // Sector name height + padding
        ctx.font = '500 15px Inter';
        for (const note of sector.notes) {
          const lines = wrapText(ctx, `• ${note}`, W - pad * 2 - 40);
          sectorHeight += lines.length * 24 + 5;
        }
        
        // Draw card background
        ctx.fillStyle = '#f8fafc'; // light slate
        ctx.strokeStyle = '#e2e8f0'; // border
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(pad, y, W - pad * 2, sectorHeight, 12);
        ctx.fill();
        ctx.stroke();

        y += 25; // Move down for sector name
        ctx.fillStyle = '#475569';
        ctx.font = '900 14px Inter';
        ctx.fillText(sector.sectorName.toUpperCase(), pad + 20, y);
        y += 20;

        ctx.fillStyle = '#0f172a';
        ctx.font = '600 15px Inter';
        for (const note of sector.notes) {
          const lines = wrapText(ctx, `• ${note}`, W - pad * 2 - 40);
          for (const line of lines) {
            ctx.fillText(line, pad + 20, y);
            y += 24;
          }
          y += 5;
        }
        y += 15; // Space after card text
      }
    }"""

match_r = re.search(pattern_render, content)
if match_r:
    content = content[:match_r.start()] + render_replacement + content[match_r.end():]
    print("SUCCESS RENDER")
else:
    print("FAIL RENDER")

with open('src/utils/pcpShareExport.ts', 'w', encoding='utf-8') as f:
    f.write(content)
