/**
 * Pure Web Audio API Sound Synthesizer for LINE Let's Get Rich Peak Era
 * Zero external MP3/WAV dependencies — 100% synthesized in-memory, instant response, works offline.
 */
class SoundManager {
  private ctx: AudioContext | null = null;
  private muted = false;

  constructor() {
    try {
      const saved = localStorage.getItem('lgr_sfx_muted');
      if (saved !== null) {
        this.muted = saved === 'true';
      }
    } catch {
      // Ignore if localStorage unavailable
    }
  }

  private getContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem('lgr_sfx_muted', String(this.muted));
    } catch {
      // Ignore
    }
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem('lgr_sfx_muted', String(this.muted));
    } catch {
      // Ignore
    }
  }

  /**
   * Tactile button click (12ms)
   */
  public playClick(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, t);
    osc.frequency.exponentialRampToValueAtTime(240, t + 0.035);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.linearRampToValueAtTime(0.001, t + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  /**
   * Roll Gauge Charge Tick (pitch scales with gauge value 2..12)
   */
  public playRollGaugeTick(progress01: number): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;

    const baseFreq = 380 + Math.min(1, Math.max(0, progress01)) * 420;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.linearRampToValueAtTime(baseFreq + 60, t + 0.025);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.032);
  }

  /**
   * Dice release & stop landing clack
   */
  public playDiceStop(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    // Woody click
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.06);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.065);
  }

  /**
   * Cheerful Double fanfare (2-tone chime)
   */
  public playDoubleFanfare(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    [
      { freq: 659.25, delay: 0.0, dur: 0.12 }, // E5
      { freq: 880.0, delay: 0.09, dur: 0.22 },  // A5
      { freq: 1318.5, delay: 0.18, dur: 0.35 }, // E6
    ].forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const noteT = t + note.delay;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, noteT);

      gain.gain.setValueAtTime(0.18, noteT);
      gain.gain.exponentialRampToValueAtTime(0.001, noteT + note.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(noteT);
      osc.stop(noteT + note.dur + 0.01);
    });
  }

  /**
   * Coins Ka-Ching on receiving money / passing START
   */
  public playCoinGain(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    const notes = [987.77, 1318.51, 1567.98]; // B5, E6, G6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const noteT = t + idx * 0.045;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteT);

      gain.gain.setValueAtTime(0.15, noteT);
      gain.gain.exponentialRampToValueAtTime(0.001, noteT + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(noteT);
      osc.stop(noteT + 0.2);
    });
  }

  /**
   * Coin loss / toll payment thud
   */
  public playCoinLoss(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.12);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  /**
   * Majestic Golden Landmark Fanfare chord
   */
  public playLandmarkFanfare(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    const chord = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const noteT = t + idx * 0.06;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteT);

      gain.gain.setValueAtTime(0.2, noteT);
      gain.gain.exponentialRampToValueAtTime(0.001, noteT + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(noteT);
      osc.stop(noteT + 0.48);
    });
  }

  /**
   * Futuristic Skill Cut-In Whoosh / Activation Sweep
   */
  public playSkillCutin(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(1100, t + 0.28);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(2400, t + 0.28);
    filter.Q.setValueAtTime(3, t);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.34);
  }

  /**
   * Dramatic Bankruptcy Gong
   */
  public playBankruptGong(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.85);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.95);
  }
}

export const soundManager = new SoundManager();
