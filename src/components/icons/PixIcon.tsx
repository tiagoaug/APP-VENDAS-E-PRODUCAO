// Símbolo do Pix (recriação simbólica, não o logo oficial pixel-a-pixel) — losango teal com um
// recorte em cruz curva no meio, formando 4 pétalas arredondadas nas pontas. Usado em qualquer
// lugar do app que precise identificar visualmente "isto é uma chave/pagamento Pix" (ícone no
// Dashboard, Meios de Recebimento, Cartão de Pagamento).
export default function PixIcon({ size = 24, color = '#2DB89A', className = '' }: { size?: number; color?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="15" y="15" width="70" height="70" rx="22" transform="rotate(45 50 50)" fill={color} />
      <path d="M50 8 C36 8 33 30 33 50 C33 70 36 92 50 92 C64 92 67 70 67 50 C67 30 64 8 50 8 Z" fill="white" />
      <path d="M8 50 C8 36 30 33 50 33 C70 33 92 36 92 50 C92 64 70 67 50 67 C30 67 8 64 8 50 Z" fill="white" />
    </svg>
  );
}
