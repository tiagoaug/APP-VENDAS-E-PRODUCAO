import { Component, ReactNode } from 'react';

// Sem isso, qualquer exceção não tratada durante o render (ex.: acessar campo de um elemento
// que sumiu, divisão por zero virando NaN numa posição CSS, etc.) derruba a árvore React
// inteira e deixa uma tela branca travada — o usuário só consegue sair fechando o app. Com o
// boundary, só o pedaço envolvido quebra, mostrando a mensagem de erro real (ajuda a
// diagnosticar) e um botão pra tentar de novo sem perder o resto da navegação.
export class ErrorBoundary extends Component<{ children: ReactNode; label?: string }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode; label?: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('[ErrorBoundary]', this.props.label, error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-2xl bg-red-50 border-2 border-red-200 text-red-700 flex flex-col gap-2">
          <p className="font-black text-sm tracking-widest">Erro ao Renderizar {this.props.label}</p>
          <p className="text-xs font-mono break-all">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            data-guide-anchor="errorBoundary.tentarNovamente"
            title="Recarregar o componente"
            aria-label="Tentar novamente"
            className="mt-2 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black tracking-widest"
          >
            Tentar Novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
