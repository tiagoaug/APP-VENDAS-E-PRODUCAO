import QRCode from 'qrcode';

// Módulos quadrados sólidos (padrão da biblioteca `qrcode`) — trocado do estilo "bolinhas"
// (ver histórico de dottedQRCode.ts) porque a impressora térmica (Ablemark BR-L100) tem
// dificuldade em reproduzir pontos tão pequenos com nitidez em etiquetas pequenas; o quadrado
// cheio maximiza a área de tinta por módulo, ficando mais fácil de ler tanto a olho nu quanto
// por leitor de QR.
export interface QRCodeOptions {
  width?: number;
  margin?: number;
  color?: string;
  bgColor?: string;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

export async function toQRDataURL(text: string, options: QRCodeOptions = {}): Promise<string> {
  const {
    width = 200,
    margin = 2,
    color = '#000000',
    bgColor = '#FFFFFF',
    errorCorrectionLevel = 'H',
  } = options;
  return QRCode.toDataURL(text, { width, margin, errorCorrectionLevel, color: { dark: color, light: bgColor } });
}
