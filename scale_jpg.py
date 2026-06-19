import re

with open('src/utils/pcpShareExport.ts', 'r', encoding='utf-8') as f:
    content = f.read()

target = """  const H = Math.max(900, currentY);

  canvas.width = W;
  canvas.height = H;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);"""

replacement = """  const H = Math.max(900, currentY);

  // Define escala para alta resolução (3x melhora muito a qualidade em celulares/zoom)
  const SCALE = 3;
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  
  // Applica escala no contexto
  ctx.scale(SCALE, SCALE);

  // Desativa image smoothing para melhor nitidez em fontes (opcional)
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);"""

if target in content:
    content = content.replace(target, replacement)
    with open('src/utils/pcpShareExport.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS: Scaled JPG canvas to 3x resolution!")
else:
    print("FAILED to find target block")
