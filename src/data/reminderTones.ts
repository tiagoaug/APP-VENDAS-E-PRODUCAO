// Biblioteca de toques do sistema de lembretes — fonte única usada tanto pela
// prévia (Web Audio, tocada no navegador/WebView) quanto pelos nomes/descrições
// mostrados no seletor. Os arquivos .wav reais (Android, res/raw/) foram gerados
// a partir desta mesma definição por scripts/gen-reminder-tones.js — se adicionar
// ou mudar um tom aqui, rode o script de novo e faça `npx cap sync android`.
export type ReminderToneWave = "sine" | "triangle" | "square";

export interface ReminderToneNote {
  freq: number; // Hz
  start: number; // segundos, relativo ao início do toque
  dur: number; // segundos
  vol: number; // 0–1
  wave: ReminderToneWave;
}

export interface ReminderToneDef {
  id: string;
  label: string;
  description: string;
  notes: ReminderToneNote[];
}

export const REMINDER_TONE_LIBRARY: ReminderToneDef[] = [
  { id: "gentle", label: "Suave", description: "Um beep curto e discreto", notes: [
    { freq: 700, start: 0, dur: 0.35, vol: 0.16, wave: "sine" },
  ]},
  { id: "standard", label: "Padrão", description: "Dois beeps, tom médio", notes: [
    { freq: 1000, start: 0, dur: 0.15, vol: 0.3, wave: "sine" },
    { freq: 1000, start: 0.25, dur: 0.15, vol: 0.3, wave: "sine" },
  ]},
  { id: "urgent", label: "Urgente", description: "Três beeps rápidos e agudos", notes: [
    { freq: 1500, start: 0, dur: 0.09, vol: 0.4, wave: "sine" },
    { freq: 1500, start: 0.15, dur: 0.09, vol: 0.4, wave: "sine" },
    { freq: 1500, start: 0.3, dur: 0.09, vol: 0.4, wave: "sine" },
  ]},
  { id: "chime", label: "Sino", description: "Ding-dong de dois tons", notes: [
    { freq: 1318, start: 0, dur: 0.22, vol: 0.26, wave: "sine" },
    { freq: 988, start: 0.25, dur: 0.32, vol: 0.26, wave: "sine" },
  ]},
  { id: "silent", label: "Silencioso", description: "Sem som — só vibração", notes: [
    { freq: 200, start: 0, dur: 0.08, vol: 0.008, wave: "sine" },
  ]},
  { id: "crystal", label: "Cristal", description: "Toque de vidro cristalino", notes: [
    { freq: 1568, start: 0, dur: 0.09, vol: 0.15, wave: "triangle" },
    { freq: 1976, start: 0.12, dur: 0.09, vol: 0.15, wave: "triangle" },
    { freq: 2349, start: 0.24, dur: 0.14, vol: 0.14, wave: "triangle" },
  ]},
  { id: "marimba", label: "Marimba", description: "Toque de percussão suave", notes: [
    { freq: 523, start: 0, dur: 0.25, vol: 0.2, wave: "triangle" },
    { freq: 659, start: 0.1, dur: 0.25, vol: 0.18, wave: "triangle" },
    { freq: 784, start: 0.2, dur: 0.28, vol: 0.16, wave: "triangle" },
  ]},
  { id: "pulse", label: "Pulso Digital", description: "Bipe eletrônico curto", notes: [
    { freq: 880, start: 0, dur: 0.08, vol: 0.12, wave: "square" },
    { freq: 880, start: 0.1, dur: 0.08, vol: 0.12, wave: "square" },
  ]},
  { id: "wave", label: "Onda", description: "Toque suave e fluido", notes: [
    { freq: 440, start: 0, dur: 0.15, vol: 0.15, wave: "sine" },
    { freq: 554, start: 0.08, dur: 0.15, vol: 0.15, wave: "sine" },
    { freq: 659, start: 0.16, dur: 0.18, vol: 0.14, wave: "sine" },
  ]},
  { id: "pop", label: "Pop", description: "Estalo curto e moderno", notes: [
    { freq: 1200, start: 0, dur: 0.05, vol: 0.25, wave: "square" },
  ]},
  { id: "radar", label: "Radar", description: "Bipe característico de radar", notes: [
    { freq: 900, start: 0, dur: 0.12, vol: 0.2, wave: "sine" },
    { freq: 900, start: 0.2, dur: 0.12, vol: 0.2, wave: "sine" },
    { freq: 900, start: 0.4, dur: 0.12, vol: 0.2, wave: "sine" },
  ]},
  { id: "droplet", label: "Gota", description: "Som de gota d'água", notes: [
    { freq: 1200, start: 0, dur: 0.08, vol: 0.18, wave: "sine" },
    { freq: 700, start: 0.09, dur: 0.18, vol: 0.12, wave: "sine" },
  ]},
  { id: "xylo", label: "Xilofone", description: "Toque de xilofone", notes: [
    { freq: 659, start: 0, dur: 0.12, vol: 0.2, wave: "triangle" },
    { freq: 784, start: 0.1, dur: 0.12, vol: 0.2, wave: "triangle" },
    { freq: 988, start: 0.2, dur: 0.16, vol: 0.18, wave: "triangle" },
  ]},
  { id: "ping", label: "Ping", description: "Bipe único e limpo", notes: [
    { freq: 1760, start: 0, dur: 0.12, vol: 0.22, wave: "sine" },
  ]},
  { id: "ascend", label: "Escalada", description: "Sequência ascendente de notas", notes: [
    { freq: 440, start: 0, dur: 0.1, vol: 0.18, wave: "sine" },
    { freq: 523, start: 0.09, dur: 0.1, vol: 0.18, wave: "sine" },
    { freq: 659, start: 0.18, dur: 0.1, vol: 0.18, wave: "sine" },
    { freq: 784, start: 0.27, dur: 0.14, vol: 0.16, wave: "sine" },
  ]},
  { id: "descend", label: "Descida", description: "Sequência descendente de notas", notes: [
    { freq: 784, start: 0, dur: 0.1, vol: 0.18, wave: "sine" },
    { freq: 659, start: 0.09, dur: 0.1, vol: 0.18, wave: "sine" },
    { freq: 523, start: 0.18, dur: 0.1, vol: 0.18, wave: "sine" },
    { freq: 440, start: 0.27, dur: 0.14, vol: 0.16, wave: "sine" },
  ]},
  { id: "double_pop", label: "Estalo Duplo", description: "Dois estalos rápidos", notes: [
    { freq: 1000, start: 0, dur: 0.05, vol: 0.22, wave: "square" },
    { freq: 1000, start: 0.08, dur: 0.05, vol: 0.22, wave: "square" },
  ]},
  { id: "soft_bell", label: "Sino Delicado", description: "Sino com harmônico suave", notes: [
    { freq: 987, start: 0, dur: 0.4, vol: 0.14, wave: "sine" },
    { freq: 1975, start: 0, dur: 0.3, vol: 0.06, wave: "sine" },
  ]},
  { id: "digital_beep", label: "Bipe Digital", description: "Bipe eletrônico moderno", notes: [
    { freq: 660, start: 0, dur: 0.1, vol: 0.2, wave: "square" },
    { freq: 660, start: 0.15, dur: 0.1, vol: 0.2, wave: "square" },
  ]},
  { id: "arpeggio_up", label: "Arpejo Ascendente", description: "Acorde arpejado subindo", notes: [
    { freq: 523, start: 0, dur: 0.09, vol: 0.16, wave: "triangle" },
    { freq: 659, start: 0.07, dur: 0.09, vol: 0.16, wave: "triangle" },
    { freq: 784, start: 0.14, dur: 0.09, vol: 0.16, wave: "triangle" },
    { freq: 1047, start: 0.21, dur: 0.14, vol: 0.15, wave: "triangle" },
  ]},
  { id: "arpeggio_down", label: "Arpejo Descendente", description: "Acorde arpejado descendo", notes: [
    { freq: 1047, start: 0, dur: 0.09, vol: 0.16, wave: "triangle" },
    { freq: 784, start: 0.07, dur: 0.09, vol: 0.16, wave: "triangle" },
    { freq: 659, start: 0.14, dur: 0.09, vol: 0.16, wave: "triangle" },
    { freq: 523, start: 0.21, dur: 0.14, vol: 0.15, wave: "triangle" },
  ]},
  { id: "sweep", label: "Varredura", description: "Efeito de varredura tonal", notes: [
    { freq: 400, start: 0, dur: 0.06, vol: 0.18, wave: "sine" },
    { freq: 600, start: 0.05, dur: 0.06, vol: 0.18, wave: "sine" },
    { freq: 900, start: 0.1, dur: 0.06, vol: 0.18, wave: "sine" },
    { freq: 1300, start: 0.15, dur: 0.08, vol: 0.16, wave: "sine" },
  ]},
  { id: "buzz_soft", label: "Zumbido Suave", description: "Vibração sonora curta", notes: [
    { freq: 220, start: 0, dur: 0.15, vol: 0.1, wave: "square" },
  ]},
  { id: "click_triple", label: "Clique Triplo", description: "Três cliques rápidos", notes: [
    { freq: 1400, start: 0, dur: 0.04, vol: 0.2, wave: "square" },
    { freq: 1400, start: 0.07, dur: 0.04, vol: 0.2, wave: "square" },
    { freq: 1400, start: 0.14, dur: 0.04, vol: 0.2, wave: "square" },
  ]},
  { id: "flute", label: "Flauta", description: "Toque suave tipo flauta", notes: [
    { freq: 784, start: 0, dur: 0.35, vol: 0.16, wave: "sine" },
  ]},
  { id: "metal", label: "Metálico", description: "Toque metálico brilhante", notes: [
    { freq: 1567, start: 0, dur: 0.3, vol: 0.14, wave: "triangle" },
    { freq: 2349, start: 0, dur: 0.2, vol: 0.07, wave: "triangle" },
  ]},
  { id: "echo", label: "Eco", description: "Toque com efeito de eco", notes: [
    { freq: 880, start: 0, dur: 0.12, vol: 0.2, wave: "sine" },
    { freq: 880, start: 0.18, dur: 0.15, vol: 0.1, wave: "sine" },
    { freq: 880, start: 0.38, dur: 0.18, vol: 0.05, wave: "sine" },
  ]},
  { id: "shimmer", label: "Brilho", description: "Textura brilhante e leve", notes: [
    { freq: 1976, start: 0, dur: 0.08, vol: 0.12, wave: "triangle" },
    { freq: 2349, start: 0.09, dur: 0.08, vol: 0.12, wave: "triangle" },
    { freq: 1976, start: 0.18, dur: 0.1, vol: 0.1, wave: "triangle" },
  ]},
  { id: "tick_tock", label: "Tique-taque", description: "Dois toques alternados", notes: [
    { freq: 900, start: 0, dur: 0.06, vol: 0.18, wave: "sine" },
    { freq: 700, start: 0.3, dur: 0.06, vol: 0.18, wave: "sine" },
  ]},
  { id: "classic_ring", label: "Toque Clássico", description: "Toque tradicional de campainha", notes: [
    { freq: 659, start: 0, dur: 0.12, vol: 0.18, wave: "square" },
    { freq: 659, start: 0.18, dur: 0.12, vol: 0.18, wave: "square" },
    { freq: 659, start: 0.36, dur: 0.12, vol: 0.18, wave: "square" },
    { freq: 659, start: 0.54, dur: 0.12, vol: 0.18, wave: "square" },
  ]},
];
