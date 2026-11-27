/**
 * Procedural audio. Every sound is synthesised in the browser with the Web
 * Audio API, so there are zero licensing concerns and nothing to download.
 * The engine is intentionally tiny: oscillators, a little noise, envelopes.
 */

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicTimer: number | null = null;
let musicStep = 0;

export interface AudioSettings {
  muted: boolean;
  musicVolume: number;
  sfxVolume: number;
}

const settings: AudioSettings = { muted: false, musicVolume: 0.35, sfxVolume: 0.75 };

/** Set to true by the first user gesture; until then we never touch audio. */
let unlocked = false;

function getCtx(create = false): Ctx | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    // Browsers block AudioContext creation before a gesture. Stay silent
    // instead of spamming console errors on load.
    if (!create && !unlocked) return null;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = settings.sfxVolume;
      sfxGain.connect(master);

      musicGain = ctx.createGain();
      musicGain.gain.value = settings.musicVolume * 0.5;
      musicGain.connect(master);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function applyAudioSettings(next: Partial<AudioSettings>): void {
  Object.assign(settings, next);
  const c = getCtx();
  if (!c || !master || !sfxGain || !musicGain) return;
  const now = c.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setTargetAtTime(settings.muted ? 0 : 1, now, 0.08);
  sfxGain.gain.setTargetAtTime(settings.sfxVolume, now, 0.08);
  musicGain.gain.setTargetAtTime(settings.musicVolume * 0.5, now, 0.08);
}

/** Browsers require a gesture before audio can start. */
export function unlockAudio(): void {
  unlocked = true;
  getCtx(true);
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}

function env(
  c: Ctx,
  node: AudioNode,
  attack: number,
  decay: number,
  peak: number,
  start = c.currentTime,
): GainNode {
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  node.connect(gain);
  return gain;
}

function tone(
  freq: number,
  opts: {
    type?: OscillatorType;
    duration?: number;
    gain?: number;
    startFreq?: number;
    endFreq?: number;
    delay?: number;
    detune?: number;
  } = {},
): void {
  const c = getCtx();
  if (!c || !sfxGain) return;
  const {
    type = 'square',
    duration = 0.16,
    gain = 0.2,
    startFreq,
    endFreq,
    delay = 0,
    detune = 0,
  } = opts;
  const start = c.currentTime + delay;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq ?? freq, start);
  if (endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + duration);
  }
  osc.detune.value = detune;
  const g = env(c, osc, 0.008, duration, gain, start);
  g.connect(sfxGain);
  osc.start(start);
  osc.stop(start + duration + 0.08);
}

function noise(opts: { duration?: number; gain?: number; highpass?: number; delay?: number } = {}): void {
  const c = getCtx();
  if (!c || !sfxGain) return;
  const { duration = 0.2, gain = 0.16, highpass = 700, delay = 0 } = opts;
  const length = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    // Slightly shaped white noise reads as impact rather than hiss.
    const decay = 1 - i / length;
    data[i] = (Math.random() * 2 - 1) * decay * decay;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = highpass;
  src.connect(filter);
  const start = c.currentTime + delay;
  const g = env(c, filter, 0.004, duration, gain, start);
  g.connect(sfxGain);
  src.start(start);
}

// ── Public SFX API ─────────────────────────────────────────────────────────

export const sfx = {
  tap(): void {
    tone(520, { type: 'triangle', duration: 0.06, gain: 0.1 });
    tone(780, { type: 'triangle', duration: 0.05, gain: 0.05, delay: 0.02 });
  },

  select(): void {
    tone(330, { type: 'square', duration: 0.07, gain: 0.12 });
    tone(660, { type: 'square', duration: 0.1, gain: 0.1, delay: 0.06 });
    tone(990, { type: 'triangle', duration: 0.14, gain: 0.07, delay: 0.11 });
  },

  lock(): void {
    tone(180, { type: 'sawtooth', duration: 0.12, gain: 0.12 });
    tone(880, { type: 'square', duration: 0.09, gain: 0.1, delay: 0.05 });
  },

  reveal(): void {
    noise({ duration: 0.34, gain: 0.12, highpass: 300 });
    tone(220, { type: 'sawtooth', duration: 0.3, gain: 0.09, startFreq: 220, endFreq: 620 });
  },

  impact(): void {
    noise({ duration: 0.18, gain: 0.26, highpass: 140 });
    tone(90, { type: 'sine', duration: 0.22, gain: 0.32, startFreq: 120, endFreq: 40 });
    tone(200, { type: 'square', duration: 0.08, gain: 0.12 });
  },

  heavy(): void {
    noise({ duration: 0.34, gain: 0.3, highpass: 90 });
    tone(60, { type: 'sine', duration: 0.42, gain: 0.4, startFreq: 90, endFreq: 28 });
    tone(140, { type: 'sawtooth', duration: 0.2, gain: 0.14 });
  },

  block(): void {
    noise({ duration: 0.12, gain: 0.14, highpass: 1800 });
    tone(1400, { type: 'square', duration: 0.07, gain: 0.1 });
    tone(700, { type: 'triangle', duration: 0.1, gain: 0.08, delay: 0.02 });
  },

  ability(): void {
    tone(440, { type: 'triangle', duration: 0.18, gain: 0.12, startFreq: 440, endFreq: 1200 });
    tone(660, { type: 'sine', duration: 0.24, gain: 0.1, delay: 0.05, startFreq: 660, endFreq: 1600 });
  },

  burn(): void {
    noise({ duration: 0.4, gain: 0.12, highpass: 400 });
    tone(180, { type: 'sawtooth', duration: 0.3, gain: 0.07, startFreq: 240, endFreq: 120 });
  },

  heal(): void {
    [523, 659, 784, 1047].forEach((freq, i) => {
      tone(freq, { type: 'sine', duration: 0.22, gain: 0.1, delay: i * 0.06 });
    });
  },

  victory(): void {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((freq, i) => {
      tone(freq, { type: 'square', duration: 0.3, gain: 0.13, delay: i * 0.11 });
      tone(freq / 2, { type: 'triangle', duration: 0.34, gain: 0.07, delay: i * 0.11 });
    });
  },

  defeat(): void {
    const notes = [392, 349, 294, 196];
    notes.forEach((freq, i) => {
      tone(freq, { type: 'sawtooth', duration: 0.42, gain: 0.11, delay: i * 0.17, endFreq: freq * 0.92 });
    });
  },

  roundWin(): void {
    tone(660, { type: 'square', duration: 0.12, gain: 0.11 });
    tone(880, { type: 'square', duration: 0.16, gain: 0.1, delay: 0.09 });
  },

  error(): void {
    tone(150, { type: 'square', duration: 0.12, gain: 0.12 });
    tone(120, { type: 'square', duration: 0.14, gain: 0.1, delay: 0.09 });
  },
};

// ── Procedural music ───────────────────────────────────────────────────────

/**
 * A slow, dark synth loop. Two oscillators per step so it never sounds like a
 * bare test tone, and a filtered noise pulse for a "comic panel" heartbeat.
 */
const BASS_LINE = [55, 55, 73.42, 55, 65.41, 65.41, 49, 49];
const LEAD_LINE = [220, 0, 329.63, 0, 261.63, 0, 196, 246.94];

function musicStepPlay(): void {
  const c = getCtx();
  if (!c || !musicGain) return;
  const step = musicStep % BASS_LINE.length;
  const start = c.currentTime;

  const bass = c.createOscillator();
  bass.type = 'sawtooth';
  bass.frequency.value = BASS_LINE[step];
  const bassFilter = c.createBiquadFilter();
  bassFilter.type = 'lowpass';
  bassFilter.frequency.value = 320;
  bass.connect(bassFilter);
  const bassGain = c.createGain();
  bassGain.gain.setValueAtTime(0.0001, start);
  bassGain.gain.exponentialRampToValueAtTime(0.16, start + 0.06);
  bassGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
  bassFilter.connect(bassGain);
  bassGain.connect(musicGain);
  bass.start(start);
  bass.stop(start + 0.68);

  const leadFreq = LEAD_LINE[step];
  if (leadFreq > 0) {
    const lead = c.createOscillator();
    lead.type = 'triangle';
    lead.frequency.value = leadFreq;
    lead.detune.value = step % 2 === 0 ? 6 : -6;
    const leadGain = c.createGain();
    leadGain.gain.setValueAtTime(0.0001, start);
    leadGain.gain.exponentialRampToValueAtTime(0.05, start + 0.12);
    leadGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.62);
    lead.connect(leadGain);
    leadGain.connect(musicGain);
    lead.start(start);
    lead.stop(start + 0.7);
  }

  if (step % 4 === 0) {
    const hat = c.createOscillator();
    hat.type = 'square';
    hat.frequency.value = 3200;
    const hatGain = c.createGain();
    hatGain.gain.setValueAtTime(0.0001, start);
    hatGain.gain.exponentialRampToValueAtTime(0.02, start + 0.01);
    hatGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
    hat.connect(hatGain);
    hatGain.connect(musicGain);
    hat.start(start);
    hat.stop(start + 0.12);
  }

  musicStep += 1;
}

export function startMusic(): void {
  if (!unlocked) return;
  const c = getCtx();
  if (!c || musicTimer !== null) return;
  musicTimer = window.setInterval(musicStepPlay, 620);
  musicStepPlay();
}

export function stopMusic(): void {
  if (musicTimer !== null) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
}

export function isMusicPlaying(): boolean {
  return musicTimer !== null;
}
