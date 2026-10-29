import type { Effect } from "./game";
export class AudioSystem {
  ctx: AudioContext | null = null;
  lastShot = 0;
  unlock() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }
  play: Effect = (type) => {
    if (!this.ctx || this.ctx.state !== "running") return;
    const time = this.ctx.currentTime;
    if (type === "shot" && time - this.lastShot < 0.06) return;
    if (type === "shot") this.lastShot = time;
    const o = this.ctx.createOscillator(),
      v = this.ctx.createGain();
    const spec = {
      shot: [160, 70, 0.055, 0.025],
      hit: [85, 38, 0.08, 0.05],
      collect: [550, 1100, 0.11, 0.035],
      explode: [95, 22, 0.23, 0.08],
      click: [360, 600, 0.06, 0.025],
    }[type];
    o.type = type === "collect" ? "sine" : "triangle";
    o.frequency.setValueAtTime(spec[0], time);
    o.frequency.exponentialRampToValueAtTime(spec[1], time + spec[2]);
    v.gain.setValueAtTime(spec[3], time);
    v.gain.exponentialRampToValueAtTime(0.001, time + spec[2]);
    o.connect(v);
    v.connect(this.ctx.destination);
    o.start(time);
    o.stop(time + spec[2]);
  };
}
