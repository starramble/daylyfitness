// Local voice clips and an original 120 BPM synth pattern share the workout clock.
// Nothing is streamed and no microphone permission is requested.
export class FollowAudio {
  private context: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private voiceSource: AudioBufferSourceNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private beat = -1;
  private disposed = false;
  music = true;
  coach = true;
  volume = .25;
  async unlock(keys: string[]) {
    if (!this.context) {
      this.context = new AudioContext();
      this.musicGain = this.context.createGain(); this.musicGain.connect(this.context.destination);
      this.voiceGain = this.context.createGain(); this.voiceGain.gain.value = .9; this.voiceGain.connect(this.context.destination);
    }
    await this.context.resume();
    await Promise.all([...new Set(keys)].map(async key => {
      if (this.buffers.has(key)) return;
      const response = await fetch(`/audio/coach/${encodeURIComponent(key)}.mp3`);
      if (!response.ok) throw new Error(`口令加载失败：${key}`);
      const data = await response.arrayBuffer();
      if (this.disposed) return;
      this.buffers.set(key, await this.context!.decodeAudioData(data));
    }));
  }
  private note(frequency: number, duration: number, level: number, type: OscillatorType = 'sine', slide?: number) {
    const c = this.context!;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(frequency, c.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, c.currentTime + duration);
    g.gain.setValueAtTime(0, c.currentTime); g.gain.linearRampToValueAtTime(level, c.currentTime + .008);
    g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + duration);
    o.connect(g); g.connect(this.musicGain!); o.start(); o.stop(c.currentTime + duration);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }
  tick(elapsed: number) {
    const beat = Math.floor(elapsed * 2);
    if (beat === this.beat) return;
    this.beat = beat;
    if (!this.context || !this.music || this.disposed) return;
    this.musicGain!.gain.setTargetAtTime(this.volume * (this.voiceSource ? .24 : 1), this.context.currentTime, .03);
    this.note(120, .15, .6, 'sine', 42); // kick
    const bass = [65.41, 65.41, 77.78, 87.31][Math.floor(beat / 8) % 4];
    if (beat % 2 === 0) this.note(bass, .36, .14, 'triangle');
    const melody = [1, 1.5, 2, 1.5, 1.25, 1.5, 2, 1.5][beat % 8];
    this.note(bass * 4 * melody, .20, .07, 'sine');
    if (beat % 2) this.note(180, .07, .16, 'triangle');
  }
  speak(key: string) {
    if (!this.coach || !this.context || this.disposed) return;
    this.stopVoice();
    const buffer = this.buffers.get(key); if (!buffer) return;
    const source = this.context.createBufferSource(); source.buffer = buffer; source.connect(this.voiceGain!);
    this.voiceSource = source;
    this.musicGain!.gain.setTargetAtTime(this.music ? this.volume * .24 : 0, this.context.currentTime, .02);
    source.onended = () => {
      source.disconnect();
      if (this.voiceSource !== source) return;
      this.voiceSource = null;
      if (!this.disposed) this.musicGain?.gain.setTargetAtTime(this.music ? this.volume : 0, this.context!.currentTime, .1);
    };
    source.start();
  }
  stopVoice() { const s = this.voiceSource; this.voiceSource = null; if (s) { s.onended = null; try { s.stop(); } catch { /* Already ended. */ } s.disconnect(); } }
  pause() { this.stopVoice(); if (this.context) this.musicGain?.gain.setValueAtTime(0, this.context.currentTime); }
  setMusic(on: boolean) { this.music = on; if (!on && this.context) this.musicGain?.gain.setValueAtTime(0, this.context.currentTime); }
  setCoach(on: boolean) { this.coach = on; if (!on) this.stopVoice(); }
  dispose() { if (this.disposed) return; this.disposed = true; this.pause(); void this.context?.close(); this.buffers.clear(); }
}


export interface SessionAudio {
  player: FollowAudio;
  unlocked: Promise<boolean>;
}
// Call synchronously from the plan button's click to retain browser audio permission.
export function createSessionAudio(): SessionAudio {
  const player = new FollowAudio();
  return { player, unlocked: player.unlock([]).then(() => true, () => false) };
}
