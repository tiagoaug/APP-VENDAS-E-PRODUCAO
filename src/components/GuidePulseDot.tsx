// Bolinha vermelha pulsante — indicador leve pra apontar campos relevantes de uma etapa do
// Assistente de Configuração, substituindo o spotlight de tela cheia do GuidedTourOverlay pros
// passos já convertidos pro novo formato de popup (ver OnboardingStepIntroPopup.tsx). Qualquer
// campo em qualquer tela pode ganhar essa bolinha: só chamar <GuidePulseDot show={...} /> ao
// lado do label, sem precisar de nenhum registro central de anchors.
export default function GuidePulseDot({ show }: { show?: boolean }) {
  if (!show) return null;
  return (
    <span className="relative inline-flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
    </span>
  );
}
