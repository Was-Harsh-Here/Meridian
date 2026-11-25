import { AnimeSfxId } from '../types';

export interface AnimeSfxOption {
  id: AnimeSfxId;
  name: string;
  vibe: string;
  description: string;
}

export const ANIME_SFX_OPTIONS: AnimeSfxOption[] = [
  {
    id: 'system_arise',
    name: 'System Arise',
    vibe: 'Solo Leveling',
    description: 'Crystalline azure fifths + soft sub-resonance',
  },
  {
    id: 'gate_clear',
    name: 'Dungeon Gate Clear',
    vibe: 'Quest Fanfare',
    description: 'Clean ascending four-note victory chime',
  },
  {
    id: 'monarch_chime',
    name: 'Shadow Monarch',
    vibe: 'Dark Resonance',
    description: 'Deep harmonic bell over low obsidian pulse',
  },
  {
    id: 'shonen_levelup',
    name: 'Rank Up Surge',
    vibe: 'Anime RPG',
    description: 'Bright rapid heroic arpeggio chime',
  },
  {
    id: 'silent',
    name: 'Silent Mode',
    vibe: 'Visual Only',
    description: 'Mute habit & focus completion cues',
  },
];

let sharedSfxCtx: AudioContext | null = null;

export function getSharedSfxContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedSfxCtx || sharedSfxCtx.state === 'closed') {
    sharedSfxCtx = new AudioCtx();
  }
  if (sharedSfxCtx.state === 'suspended') {
    void sharedSfxCtx.resume();
  }
  return sharedSfxCtx;
}

export function playAnimeNotificationSfx(
  sfxId: AnimeSfxId = 'system_arise',
  volume = 0.65
) {
  if (sfxId === 'silent') return;
  try {
    const ctx = getSharedSfxContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gainScale = Math.max(0.05, Math.min(1, volume)) * 0.22;

    if (sfxId === 'system_arise') {
      // Shimmering holographic chord sweep: E5 -> B5 -> E6 + soft sub A2
      const tones = [
        { freq: 659.25, delay: 0, dur: 0.36, type: 'sine' as OscillatorType },
        { freq: 987.77, delay: 0.08, dur: 0.38, type: 'triangle' as OscillatorType },
        { freq: 1318.51, delay: 0.16, dur: 0.52, type: 'sine' as OscillatorType },
      ];
      tones.forEach((t) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = t.type;
        osc.frequency.setValueAtTime(t.freq, now + t.delay);
        g.gain.setValueAtTime(0.0001, now + t.delay);
        g.gain.exponentialRampToValueAtTime(gainScale, now + t.delay + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + t.delay + t.dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + t.delay);
        osc.stop(now + t.delay + t.dur + 0.02);
      });
    } else if (sfxId === 'gate_clear') {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const start = now + idx * 0.09;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(gainScale * 0.95, start + 0.018);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.35);
      });
    } else if (sfxId === 'monarch_chime') {
      // Deep obsidian sub + crisp A5/E6 chime
      const sub = ctx.createOscillator();
      const subG = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(110, now);
      subG.gain.setValueAtTime(0.0001, now);
      subG.gain.exponentialRampToValueAtTime(gainScale * 0.8, now + 0.03);
      subG.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      sub.connect(subG);
      subG.connect(ctx.destination);
      sub.start(now);
      sub.stop(now + 0.62);

      [880, 1318.51].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const start = now + 0.04 + i * 0.12;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(gainScale * 0.9, start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.48);
      });
    } else {
      // shonen_levelup: brisk heroic D5 -> F#5 -> A5 -> D6
      const notes = [587.33, 739.99, 880, 1174.66];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const start = now + idx * 0.065;
        osc.type = idx === notes.length - 1 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(gainScale, start + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.3);
      });
    }
  } catch {
    // Ignore audio context block prior to gesture
  }
}

export function playPenaltySfx(
  sfxId: AnimeSfxId = 'system_arise',
  volume = 0.55
) {
  if (sfxId === 'silent') return;
  try {
    const ctx = getSharedSfxContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gainScale = Math.max(0.05, Math.min(1, volume)) * 0.18;
    const tones = [
      { freq: 311.13, delay: 0, dur: 0.22 },
      { freq: 220.0, delay: 0.16, dur: 0.35 },
    ];
    tones.forEach((t) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(750, now + t.delay);
      osc.frequency.setValueAtTime(t.freq, now + t.delay);
      g.gain.setValueAtTime(0.0001, now + t.delay);
      g.gain.exponentialRampToValueAtTime(gainScale, now + t.delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t.delay + t.dur);
      osc.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);
      osc.start(now + t.delay);
      osc.stop(now + t.delay + t.dur + 0.02);
    });
  } catch {
    // Ignore
  }
}

export type SoundscapePresetId =
  | 'binaural_gamma'
  | 'binaural_alpha'
  | 'brown_noise'
  | 'pink_noise'
  | 'rain_ambience';

export interface SoundscapePreset {
  id: SoundscapePresetId;
  name: string;
  subtitle: string;
  specLabel: string;
  recommendedFor: string;
}

export const SOUNDSCAPE_PRESETS: SoundscapePreset[] = [
  {
    id: 'binaural_gamma',
    name: '40 Hz Gamma Lock',
    subtitle: '200 Hz L · 240 Hz R binaural',
    specLabel: '40 Hz',
    recommendedFor: 'C/DSA coding & problem solving',
  },
  {
    id: 'binaural_alpha',
    name: '10 Hz Alpha Flow',
    subtitle: '180 Hz L · 190 Hz R binaural',
    specLabel: '10 Hz',
    recommendedFor: 'Textbook study & speech prep',
  },
  {
    id: 'brown_noise',
    name: 'Brown Noise',
    subtitle: 'Warm low-frequency mask',
    specLabel: 'Deep 1/f²',
    recommendedFor: 'Blocking hostel & campus noise',
  },
  {
    id: 'pink_noise',
    name: 'Pink Noise',
    subtitle: 'Balanced natural spectrum',
    specLabel: '1/f',
    recommendedFor: 'Long reading & note synthesis',
  },
  {
    id: 'rain_ambience',
    name: 'Monsoon Study Rain',
    subtitle: 'Modulated filtered rain texture',
    specLabel: 'Ambient',
    recommendedFor: 'Calm deep-focus immersion',
  },
];

export class SoundscapeEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: AudioNode[] = [];
  private lfoInterval: number | null = null;
  private isPlayingState = false;
  private currentPreset: SoundscapePresetId = 'binaural_gamma';
  private volume = 0.45;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private clearActiveNodes() {
    if (this.lfoInterval !== null) {
      window.clearInterval(this.lfoInterval);
      this.lfoInterval = null;
    }

    for (const node of this.activeNodes) {
      try {
        if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
          (node as AudioScheduledSourceNode).stop();
        }
      } catch {
        // Node may already be stopped
      }
      try {
        node.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }
    this.activeNodes = [];

    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch {
        // Ignore
      }
      this.masterGain = null;
    }
  }

  private createNoiseBuffer(
    ctx: AudioContext,
    type: 'white' | 'pink' | 'brown'
  ): AudioBuffer {
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const output = buffer.getChannelData(channel);

      if (type === 'white') {
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
      } else if (type === 'pink') {
        let b0 = 0;
        let b1 = 0;
        let b2 = 0;
        let b3 = 0;
        let b4 = 0;
        let b5 = 0;
        let b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.09;
          b6 = white * 0.115926;
        }
      } else {
        // Brown noise (warm 1/f^2 spectrum)
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + 0.02 * white) / 1.02;
          output[i] = lastOut * 2.8;
        }
      }
    }

    return buffer;
  }

  public start(presetId: SoundscapePresetId = this.currentPreset, vol = this.volume) {
    this.currentPreset = presetId;
    this.volume = Math.max(0, Math.min(1, vol));
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.clearActiveNodes();

    const master = ctx.createGain();
    const now = ctx.currentTime;
    const targetGain = this.volume * 0.38;
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(Math.max(0.001, targetGain), now + 0.5);
    master.connect(ctx.destination);
    this.masterGain = master;

    if (presetId === 'binaural_gamma' || presetId === 'binaural_alpha') {
      const leftFreq = presetId === 'binaural_gamma' ? 200 : 180;
      const rightFreq = presetId === 'binaural_gamma' ? 240 : 190;

      const oscL = ctx.createOscillator();
      const oscR = ctx.createOscillator();
      const panL = ctx.createStereoPanner();
      const panR = ctx.createStereoPanner();
      const toneGain = ctx.createGain();

      oscL.type = 'sine';
      oscR.type = 'sine';
      oscL.frequency.setValueAtTime(leftFreq, now);
      oscR.frequency.setValueAtTime(rightFreq, now);

      panL.pan.setValueAtTime(-0.85, now);
      panR.pan.setValueAtTime(0.85, now);
      toneGain.gain.setValueAtTime(0.45, now);

      oscL.connect(panL);
      oscR.connect(panR);
      panL.connect(toneGain);
      panR.connect(toneGain);
      toneGain.connect(master);

      // Subtle warm pink-noise floor underneath the pure tones for ear comfort
      const bed = ctx.createBufferSource();
      bed.buffer = this.createNoiseBuffer(ctx, 'pink');
      bed.loop = true;
      const bedFilter = ctx.createBiquadFilter();
      bedFilter.type = 'lowpass';
      bedFilter.frequency.setValueAtTime(650, now);
      const bedGain = ctx.createGain();
      bedGain.gain.setValueAtTime(0.18, now);
      bed.connect(bedFilter);
      bedFilter.connect(bedGain);
      bedGain.connect(master);

      oscL.start(now);
      oscR.start(now);
      bed.start(now);
      this.activeNodes.push(oscL, oscR, panL, panR, toneGain, bed, bedFilter, bedGain);
    } else if (presetId === 'brown_noise' || presetId === 'pink_noise') {
      const src = ctx.createBufferSource();
      src.buffer = this.createNoiseBuffer(
        ctx,
        presetId === 'brown_noise' ? 'brown' : 'pink'
      );
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(presetId === 'brown_noise' ? 520 : 1800, now);

      src.connect(filter);
      filter.connect(master);
      src.start(now);
      this.activeNodes.push(src, filter);
    } else {
      // Monsoon rain ambience: dual filtered layers + slow breathing swell LFO
      const rainBed = ctx.createBufferSource();
      rainBed.buffer = this.createNoiseBuffer(ctx, 'pink');
      rainBed.loop = true;

      const lowFilter = ctx.createBiquadFilter();
      lowFilter.type = 'lowpass';
      lowFilter.frequency.setValueAtTime(950, now);

      const rainDroplets = ctx.createBufferSource();
      rainDroplets.buffer = this.createNoiseBuffer(ctx, 'white');
      rainDroplets.loop = true;

      const bandFilter = ctx.createBiquadFilter();
      bandFilter.type = 'bandpass';
      bandFilter.frequency.setValueAtTime(2200, now);
      bandFilter.Q.setValueAtTime(0.9, now);

      const dropletGain = ctx.createGain();
      dropletGain.gain.setValueAtTime(0.12, now);

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.12, now);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.05, now);

      lfo.connect(lfoGain);
      lfoGain.connect(dropletGain.gain);

      rainBed.connect(lowFilter);
      lowFilter.connect(master);

      rainDroplets.connect(bandFilter);
      bandFilter.connect(dropletGain);
      dropletGain.connect(master);

      rainBed.start(now);
      rainDroplets.start(now);
      lfo.start(now);
      this.activeNodes.push(
        rainBed,
        lowFilter,
        rainDroplets,
        bandFilter,
        dropletGain,
        lfo,
        lfoGain
      );
    }

    this.isPlayingState = true;
  }

  public stop() {
    if (!this.isPlayingState && this.activeNodes.length === 0) return;
    this.isPlayingState = false;

    if (this.ctx && this.masterGain && this.ctx.state === 'running') {
      const now = this.ctx.currentTime;
      try {
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(
          Math.max(0.001, this.masterGain.gain.value),
          now
        );
        this.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
        window.setTimeout(() => {
          if (!this.isPlayingState) {
            this.clearActiveNodes();
          }
        }, 280);
        return;
      } catch {
        // Fall back to immediate clear
      }
    }
    this.clearActiveNodes();
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(this.volume * 0.38, now, 0.08);
    }
  }

  public isPlaying(): boolean {
    return this.isPlayingState;
  }

  public dispose() {
    this.isPlayingState = false;
    this.clearActiveNodes();
    if (this.ctx && this.ctx.state !== 'closed') {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
