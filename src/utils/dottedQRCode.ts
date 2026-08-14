import QRCode from 'qrcode';

// Gera QR code no estilo "bolinhas" (módulos redondos + olhos em anel concêntrico), como os
// gerados por ferramentas de QR estilizado. Usa QRCode.create() pra pegar a matriz de módulos
// crua da própria lib `qrcode` já usada no projeto, em vez de depender de outra biblioteca só
// pra estilização — assim o pipeline de impressão (jsPDF, Ablemark) continua recebendo o mesmo
// tipo de retorno (data URL PNG) que QRCode.toDataURL já entregava.
//
// Os 3 marcadores de canto (olhos) ficam como círculos concêntricos sólidos — não viram
// bolinha também — porque é neles que o detector do scanner mede a proporção 1:1:3:1:1 pra
// achar o QR code na imagem; um círculo inscrito no bloco 7x7 ainda preserva essa proporção
// exatamente na linha/coluna central (onde o scanner varre), então continua lendo normalmente.
// Nível de correção de erro sobe pra 'H' (30%) pra compensar a área de tinta menor das bolinhas
// em relação ao quadrado cheio — importante em impressão térmica pequena.
export interface DottedQRCodeOptions {
  width?: number;
  margin?: number;
  dotColor?: string;
  bgColor?: string;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  /** Diâmetro de cada bolinha como fração do módulo (0–1). Padrão 0.92 — próximo de 1 pra
   * maximizar a área de tinta preta e manter contraste em etiqueta térmica pequena, sem virar
   * quadrado (perderia a proporção 1:1:3:1:1 nos olhos, mas nos módulos de dado é só estética). */
  dotScale?: number;
}

export async function toDottedQRDataURL(text: string, options: DottedQRCodeOptions = {}): Promise<string> {
  const {
    width = 200,
    margin = 2,
    dotColor = '#000000',
    bgColor = '#FFFFFF',
    errorCorrectionLevel = 'H',
    dotScale = 0.92,
  } = options;

  const qr = QRCode.create(text, { errorCorrectionLevel });
  const modules = qr.modules;
  const size = modules.size;
  const totalModules = size + margin * 2;
  const moduleSize = width / totalModules;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = width;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível criar o contexto de canvas para o QR code.');

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, width);

  const isFinderModule = (row: number, col: number) =>
    (row < 7 && col < 7) || (row < 7 && col >= size - 7) || (row >= size - 7 && col < 7);

  const dotRadius = (moduleSize * dotScale) / 2;
  ctx.fillStyle = dotColor;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!modules.get(row, col) || isFinderModule(row, col)) continue;
      const cx = (margin + col + 0.5) * moduleSize;
      const cy = (margin + row + 0.5) * moduleSize;
      ctx.beginPath();
      ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const drawEye = (topRow: number, topCol: number) => {
    const cx = (margin + topCol + 3.5) * moduleSize;
    const cy = (margin + topRow + 3.5) * moduleSize;
    ctx.fillStyle = dotColor;
    ctx.beginPath(); ctx.arc(cx, cy, moduleSize * 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = bgColor;
    ctx.beginPath(); ctx.arc(cx, cy, moduleSize * 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = dotColor;
    ctx.beginPath(); ctx.arc(cx, cy, moduleSize * 1.5, 0, Math.PI * 2); ctx.fill();
  };
  drawEye(0, 0);
  drawEye(0, size - 7);
  drawEye(size - 7, 0);

  return canvas.toDataURL('image/png');
}
