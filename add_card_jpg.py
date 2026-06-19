import re

with open('src/utils/pcpShareExport.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Sector Notes in generateJPG MEASURE PASS
pattern_measure = r"if \(showSectorNotes !== false && item\.sectorNotes && item\.sectorNotes\.length > 0\) \{\s*currentY \+= 30;\s*ctx\.font = '16px Inter';\s*for \(const sector of item\.sectorNotes\) \{\s*currentY \+= 30;\s*for \(const note of sector\.notes\) \{\s*const lines = wrapText\(ctx, `    \$\{note\}`, W - pad \* 2 - 20\);\s*currentY \+= lines\.length \* 24 \+ 5;\s*\}\s*\}\s*\}"

measure_replacement = """if (showSectorNotes !== false && item.sectorNotes && item.sectorNotes.length > 0) {
      currentY += 30;
      ctx.font = '16px Inter';
      for (const sector of item.sectorNotes) {
        currentY += 50; // card padding and sector title
        for (const note of sector.notes) {
          const lines = wrapText(ctx, `• ${note}`, W - pad * 2 - 40);
          currentY += lines.length * 24 + 5;
        }
        currentY += 25; // extra padding after card
      }
    }"""

match_m = re.search(pattern_measure, content)
if match_m:
    content = content[:match_m.start()] + measure_replacement + content[match_m.end():]
    print("SUCCESS JPG MEASURE REGEX")
else:
    print("FAIL JPG MEASURE REGEX")


# Replace Sector Notes in generateJPG RENDER PASS
# Looking for the sector notes drawing logic
pattern_render = r"if \(showSectorNotes !== false && item\.sectorNotes && item\.sectorNotes\.length > 0\) \{\s*ctx\.fillStyle = '#0f172a';\s*ctx\.font = '900 16px Inter';\s*ctx\.fillText\('INSTRU[^']*?S POR SETOR', pad, y\);\s*y \+= 26;\s*for \(const sector of item\.sectorNotes\) \{\s*ctx\.fillStyle = '#475569';\s*ctx\.font = '800 14px Inter';\s*ctx\.fillText\(sector\.sectorName, pad, y\);\s*y \+= 20;\s*ctx\.fillStyle = '#0f172a';\s*ctx\.font = '500 15px Inter';\s*for \(const note of sector\.notes\) \{\s*const lines = wrapText\(ctx, `    \$\{note\}`, W - pad \* 2 - 20\);\s*for \(const line of lines\) \{\s*ctx\.fillText\(line, pad \+ 15, y\);\s*y \+= 24;\s*\}\s*\}\s*y \+= 10;\s*\}\s*\}"

render_replacement = """if (showSectorNotes !== false && item.sectorNotes && item.sectorNotes.length > 0) {
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
        ctx.fillStyle = '#f8fafc'; // light slate (bg-slate-50)
        ctx.strokeStyle = '#e2e8f0'; // border-slate-200
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
    print("SUCCESS JPG RENDER REGEX")
else:
    print("FAIL JPG RENDER REGEX")


with open('src/utils/pcpShareExport.ts', 'w', encoding='utf-8') as f:
    f.write(content)
