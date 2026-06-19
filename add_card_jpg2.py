import re

with open('src/utils/pcpShareExport.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace Measure Pass
measure_start_marker = "    if (showSectorNotes !== false && item.sectorNotes && item.sectorNotes.length > 0) {\n      currentY += 30;\n      ctx.font = '16px Inter';\n      for (const sector of item.sectorNotes) {\n        currentY += 30;"
measure_end_marker = "    currentY += 30;\n  }\n  \n  if (showTotalGrid) {"

idx1 = content.find("    if (showSectorNotes !== false && item.sectorNotes && item.sectorNotes.length > 0) {\n      currentY += 30;\n      ctx.font = '16px Inter';\n      for (const sector of item.sectorNotes) {")
if idx1 != -1:
    idx2 = content.find("    currentY += 30;\n  }\n  \n  if (showTotalGrid) {", idx1)
    if idx2 != -1:
        measure_replacement = """    if (showSectorNotes !== false && item.sectorNotes && item.sectorNotes.length > 0) {
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
    }
"""
        content = content[:idx1] + measure_replacement + content[idx2:]
        print("SUCCESS MEASURE")

# 2. Replace Render Pass
idx3 = content.find("    // Sector Notes\n    if (showSectorNotes !== false && item.sectorNotes && item.sectorNotes.length > 0) {\n      ctx.fillStyle = '#0f172a';\n      ctx.font = '900 16px Inter';")
if idx3 != -1:
    idx4 = content.find("    currentY += 30;\n  }\n  \n  if (showTotalGrid) {", idx3) # Not right, wait... Render pass doesn't have currentY
    # Render pass end marker is around showTotalGrid
    idx4 = content.find("  if (showTotalGrid) {\n    let y = currentY;", idx3)
    if idx4 != -1:
        # Wait, the render pass ends exactly before showTotalGrid block.
        # Let's search for "  if (showTotalGrid) {" after idx3
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
    }
  }

"""
        # Find where the `for (const item of items)` loop ends.
        # Right before `  if (showTotalGrid) {`
        content = content[:idx3] + render_replacement + content[idx4:]
        print("SUCCESS RENDER")


with open('src/utils/pcpShareExport.ts', 'w', encoding='utf-8') as f:
    f.write(content)
