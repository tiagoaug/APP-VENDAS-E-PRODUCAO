// Gera os 30 .wav de res/raw a partir da biblioteca de toques definida em
// src/data/reminderTones.ts (LIBRARY abaixo é uma cópia manual — puro JS pra
// rodar sem ts-node — mantenha as duas em sincronia ao editar um toque).
// Uso: node scripts/gen-reminder-tones.js android/app/src/main/res/raw
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const OUT_DIR = process.argv[2];
if (!OUT_DIR) {
  console.error('usage: node scripts/gen-reminder-tones.js android/app/src/main/res/raw');
  process.exit(1);
}
fs.mkdirSync(OUT_DIR, { recursive: true });

// Mantém em sincronia manual com src/data/reminderTones.ts — 30 toques.
const LIBRARY = [
  { id: "gentle", notes: [{ freq: 700, start: 0, dur: 0.35, vol: 0.16, wave: "sine" }] },
  { id: "standard", notes: [{ freq: 1000, start: 0, dur: 0.15, vol: 0.3, wave: "sine" }, { freq: 1000, start: 0.25, dur: 0.15, vol: 0.3, wave: "sine" }] },
  { id: "urgent", notes: [{ freq: 1500, start: 0, dur: 0.09, vol: 0.4, wave: "sine" }, { freq: 1500, start: 0.15, dur: 0.09, vol: 0.4, wave: "sine" }, { freq: 1500, start: 0.3, dur: 0.09, vol: 0.4, wave: "sine" }] },
  { id: "chime", notes: [{ freq: 1318, start: 0, dur: 0.22, vol: 0.26, wave: "sine" }, { freq: 988, start: 0.25, dur: 0.32, vol: 0.26, wave: "sine" }] },
  { id: "silent", notes: [{ freq: 200, start: 0, dur: 0.08, vol: 0.008, wave: "sine" }] },
  { id: "crystal", notes: [{ freq: 1568, start: 0, dur: 0.09, vol: 0.15, wave: "triangle" }, { freq: 1976, start: 0.12, dur: 0.09, vol: 0.15, wave: "triangle" }, { freq: 2349, start: 0.24, dur: 0.14, vol: 0.14, wave: "triangle" }] },
  { id: "marimba", notes: [{ freq: 523, start: 0, dur: 0.25, vol: 0.2, wave: "triangle" }, { freq: 659, start: 0.1, dur: 0.25, vol: 0.18, wave: "triangle" }, { freq: 784, start: 0.2, dur: 0.28, vol: 0.16, wave: "triangle" }] },
  { id: "pulse", notes: [{ freq: 880, start: 0, dur: 0.08, vol: 0.12, wave: "square" }, { freq: 880, start: 0.1, dur: 0.08, vol: 0.12, wave: "square" }] },
  { id: "wave", notes: [{ freq: 440, start: 0, dur: 0.15, vol: 0.15, wave: "sine" }, { freq: 554, start: 0.08, dur: 0.15, vol: 0.15, wave: "sine" }, { freq: 659, start: 0.16, dur: 0.18, vol: 0.14, wave: "sine" }] },
  { id: "pop", notes: [{ freq: 1200, start: 0, dur: 0.05, vol: 0.25, wave: "square" }] },
  { id: "radar", notes: [{ freq: 900, start: 0, dur: 0.12, vol: 0.2, wave: "sine" }, { freq: 900, start: 0.2, dur: 0.12, vol: 0.2, wave: "sine" }, { freq: 900, start: 0.4, dur: 0.12, vol: 0.2, wave: "sine" }] },
  { id: "droplet", notes: [{ freq: 1200, start: 0, dur: 0.08, vol: 0.18, wave: "sine" }, { freq: 700, start: 0.09, dur: 0.18, vol: 0.12, wave: "sine" }] },
  { id: "xylo", notes: [{ freq: 659, start: 0, dur: 0.12, vol: 0.2, wave: "triangle" }, { freq: 784, start: 0.1, dur: 0.12, vol: 0.2, wave: "triangle" }, { freq: 988, start: 0.2, dur: 0.16, vol: 0.18, wave: "triangle" }] },
  { id: "ping", notes: [{ freq: 1760, start: 0, dur: 0.12, vol: 0.22, wave: "sine" }] },
  { id: "ascend", notes: [{ freq: 440, start: 0, dur: 0.1, vol: 0.18, wave: "sine" }, { freq: 523, start: 0.09, dur: 0.1, vol: 0.18, wave: "sine" }, { freq: 659, start: 0.18, dur: 0.1, vol: 0.18, wave: "sine" }, { freq: 784, start: 0.27, dur: 0.14, vol: 0.16, wave: "sine" }] },
  { id: "descend", notes: [{ freq: 784, start: 0, dur: 0.1, vol: 0.18, wave: "sine" }, { freq: 659, start: 0.09, dur: 0.1, vol: 0.18, wave: "sine" }, { freq: 523, start: 0.18, dur: 0.1, vol: 0.18, wave: "sine" }, { freq: 440, start: 0.27, dur: 0.14, vol: 0.16, wave: "sine" }] },
  { id: "double_pop", notes: [{ freq: 1000, start: 0, dur: 0.05, vol: 0.22, wave: "square" }, { freq: 1000, start: 0.08, dur: 0.05, vol: 0.22, wave: "square" }] },
  { id: "soft_bell", notes: [{ freq: 987, start: 0, dur: 0.4, vol: 0.14, wave: "sine" }, { freq: 1975, start: 0, dur: 0.3, vol: 0.06, wave: "sine" }] },
  { id: "digital_beep", notes: [{ freq: 660, start: 0, dur: 0.1, vol: 0.2, wave: "square" }, { freq: 660, start: 0.15, dur: 0.1, vol: 0.2, wave: "square" }] },
  { id: "arpeggio_up", notes: [{ freq: 523, start: 0, dur: 0.09, vol: 0.16, wave: "triangle" }, { freq: 659, start: 0.07, dur: 0.09, vol: 0.16, wave: "triangle" }, { freq: 784, start: 0.14, dur: 0.09, vol: 0.16, wave: "triangle" }, { freq: 1047, start: 0.21, dur: 0.14, vol: 0.15, wave: "triangle" }] },
  { id: "arpeggio_down", notes: [{ freq: 1047, start: 0, dur: 0.09, vol: 0.16, wave: "triangle" }, { freq: 784, start: 0.07, dur: 0.09, vol: 0.16, wave: "triangle" }, { freq: 659, start: 0.14, dur: 0.09, vol: 0.16, wave: "triangle" }, { freq: 523, start: 0.21, dur: 0.14, vol: 0.15, wave: "triangle" }] },
  { id: "sweep", notes: [{ freq: 400, start: 0, dur: 0.06, vol: 0.18, wave: "sine" }, { freq: 600, start: 0.05, dur: 0.06, vol: 0.18, wave: "sine" }, { freq: 900, start: 0.1, dur: 0.06, vol: 0.18, wave: "sine" }, { freq: 1300, start: 0.15, dur: 0.08, vol: 0.16, wave: "sine" }] },
  { id: "buzz_soft", notes: [{ freq: 220, start: 0, dur: 0.15, vol: 0.1, wave: "square" }] },
  { id: "click_triple", notes: [{ freq: 1400, start: 0, dur: 0.04, vol: 0.2, wave: "square" }, { freq: 1400, start: 0.07, dur: 0.04, vol: 0.2, wave: "square" }, { freq: 1400, start: 0.14, dur: 0.04, vol: 0.2, wave: "square" }] },
  { id: "flute", notes: [{ freq: 784, start: 0, dur: 0.35, vol: 0.16, wave: "sine" }] },
  { id: "metal", notes: [{ freq: 1567, start: 0, dur: 0.3, vol: 0.14, wave: "triangle" }, { freq: 2349, start: 0, dur: 0.2, vol: 0.07, wave: "triangle" }] },
  { id: "echo", notes: [{ freq: 880, start: 0, dur: 0.12, vol: 0.2, wave: "sine" }, { freq: 880, start: 0.18, dur: 0.15, vol: 0.1, wave: "sine" }, { freq: 880, start: 0.38, dur: 0.18, vol: 0.05, wave: "sine" }] },
  { id: "shimmer", notes: [{ freq: 1976, start: 0, dur: 0.08, vol: 0.12, wave: "triangle" }, { freq: 2349, start: 0.09, dur: 0.08, vol: 0.12, wave: "triangle" }, { freq: 1976, start: 0.18, dur: 0.1, vol: 0.1, wave: "triangle" }] },
  { id: "tick_tock", notes: [{ freq: 900, start: 0, dur: 0.06, vol: 0.18, wave: "sine" }, { freq: 700, start: 0.3, dur: 0.06, vol: 0.18, wave: "sine" }] },
  { id: "classic_ring", notes: [{ freq: 659, start: 0, dur: 0.12, vol: 0.18, wave: "square" }, { freq: 659, start: 0.18, dur: 0.12, vol: 0.18, wave: "square" }, { freq: 659, start: 0.36, dur: 0.12, vol: 0.18, wave: "square" }, { freq: 659, start: 0.54, dur: 0.12, vol: 0.18, wave: "square" }] },
];

function waveSample(wave, phase) {
  // phase: fração do ciclo [0,1)
  switch (wave) {
    case 'square':
      return Math.sin(2 * Math.PI * phase) >= 0 ? 1 : -1;
    case 'triangle':
      return 2 * Math.abs(2 * (phase - Math.floor(phase + 0.5))) - 1;
    default:
      return Math.sin(2 * Math.PI * phase);
  }
}

function renderNotesToBuffer(notes) {
  const totalDur = Math.max(...notes.map(n => n.start + n.dur)) + 0.05;
  const n = Math.round(totalDur * SAMPLE_RATE);
  const samples = new Float64Array(n);
  for (const note of notes) {
    const startSample = Math.round(note.start * SAMPLE_RATE);
    const durSamples = Math.round(note.dur * SAMPLE_RATE);
    const fadeSamples = Math.min(Math.round(0.015 * SAMPLE_RATE), Math.floor(durSamples / 3));
    for (let i = 0; i < durSamples; i++) {
      const idx = startSample + i;
      if (idx < 0 || idx >= n) continue;
      let env = 1;
      if (i < fadeSamples) env = i / fadeSamples;
      else if (i > durSamples - fadeSamples) env = (durSamples - i) / fadeSamples;
      const phase = (note.freq * (idx / SAMPLE_RATE)) % 1;
      samples[idx] += waveSample(note.wave, phase) * note.vol * env;
    }
  }
  return samples;
}

function writeWav(filePath, samples) {
  const numSamples = samples.length;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buffer);
}

for (const tone of LIBRARY) {
  const samples = renderNotesToBuffer(tone.notes);
  const filePath = path.join(OUT_DIR, `reminder_tone_${tone.id}.wav`);
  writeWav(filePath, samples);
  console.log('wrote', filePath);
}
console.log(`\nTotal: ${LIBRARY.length} tones`);
