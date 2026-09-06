// Conjunto FIXO de caracteres do teclado numérico personalizado (CustomPinKeypad.tsx) — dígitos
// sempre disponíveis, 5 letras e 5 caracteres especiais escolhidos por serem visualmente
// distintos entre si (sem I/1, O/0 etc.) e fáceis de tocar numa tela pequena de chão de fábrica.
// O gerador de senha (generateUniquePin) usa exatamente esse mesmo conjunto, pra garantir que
// toda senha sugerida pro diretor sempre caiba neste teclado — nunca gera um caractere que o
// colaborador não consiga digitar depois.
export const PIN_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
export const PIN_LETTERS = ['A', 'B', 'C', 'D', 'E'];
export const PIN_SPECIALS = ['*', '#', '@', '!', '?'];
export const PIN_LENGTH = 6;

const ALL_PIN_CHARS = new Set([...PIN_DIGITS, ...PIN_LETTERS, ...PIN_SPECIALS]);

export function isValidPinChar(ch: string): boolean {
  return ALL_PIN_CHARS.has(ch);
}

// true = toda a string é composta só de caracteres do teclado personalizado (qualquer
// combinação de dígito/letra/especial) — usado na validação do formulário de Colaboradores.
export function isValidPinFormat(pin: string): boolean {
  return pin.length === PIN_LENGTH && pin.split('').every(isValidPinChar);
}

export function generatePin(opts: { includeLetters: boolean; includeSpecials: boolean }): string {
  const pool = [...PIN_DIGITS, ...(opts.includeLetters ? PIN_LETTERS : []), ...(opts.includeSpecials ? PIN_SPECIALS : [])];
  let result = '';
  for (let i = 0; i < PIN_LENGTH; i++) {
    result += pool[Math.floor(Math.random() * pool.length)];
  }
  return result;
}

// "Sugestor de senhas" do diretor — tenta algumas vezes até achar uma senha que nenhum outro
// colaborador já esteja usando (ver CollaboratorsConfigView.tsx). Nas raras vezes que não achar
// em 50 tentativas (conjunto de senhas quase esgotado), devolve mesmo assim a última gerada.
export function generateUniquePin(opts: { includeLetters: boolean; includeSpecials: boolean }, existingPins: string[]): string {
  let candidate = generatePin(opts);
  for (let attempt = 0; attempt < 50 && existingPins.includes(candidate); attempt++) {
    candidate = generatePin(opts);
  }
  return candidate;
}
