import { Game, type Enemy } from "./game";
import { CELL, DEFS, ROOMS, RARITY_COLORS } from "./data";
import { blockLocal, maxHp, type Block } from "./core";
const TAU = Math.PI * 2;
export class Renderer {
  ctx: CanvasRenderingContext2D;
  scale = 1;
  ox = 0;
  oy = 0;
  width = 0;
  height = 0;
  time = 0;
  constructor(
    public canvas: HTMLCanvasElement,
    public game: Game,
  ) {
    this.ctx = canvas.getContext("2d")!;
  }
  resize() {
    const r = this.canvas.getBoundingClientRect(),
      dpr = Math.min(devicePixelRatio, 2);
    if (this.width !== r.width || this.height !== r.height) {
      this.width = r.width;
      this.height = r.height;
      this.canvas.width = Math.round(r.width * dpr);
      this.canvas.height = Math.round(r.height * dpr);
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scale = Math.min(r.width / 1500, r.height / 1000);
    this.ox = (r.width - 1500 * this.scale) / 2;
    this.oy = (r.height - 1000 * this.scale) / 2;
  }
  pointer(x: number, y: number) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (x - r.left - this.ox) / this.scale,
      y: (y - r.top - this.oy) / this.scale,
    };
  }
  rect(x: number, y: number, w: number, h: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }
  line(x: number, y: number, x1: number, y1: number, color: string, width = 1) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x1, y1);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.stroke();
  }
  text(
    text: string,
    x: number,
    y: number,
    size: number,
    color: string,
    align: CanvasTextAlign = "left",
  ) {
    const c = this.ctx;
    c.font = `${size < 15 ? "500" : "600"} ${size}px "Microsoft YaHei", sans-serif`;
    c.textAlign = align;
    c.fillStyle = color;
    c.fillText(text, x, y);
  }
  ring(x: number, y: number, r: number, color: string, width = 1) {
    const c = this.ctx;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.stroke();
  }
  draw(dt: number) {
    this.time += dt;
    this.resize();
    const c = this.ctx,
      g = this.game;
    c.fillStyle = "#0d1512";
    c.fillRect(0, 0, this.width, this.height);
    c.save();
    c.translate(this.ox, this.oy);
    c.scale(this.scale, this.scale);
    if (g.meta.settings.shake && g.shake)
      c.translate(
        (Math.random() - 0.5) * g.shake,
        (Math.random() - 0.5) * g.shake,
      );
    this.floor();
    if (g.scene === "hub") this.hub();
    else this.arena();
    for (const s of g.stations()) {
      const near = Math.hypot(g.x - s.x, g.y - s.y) < 125;
      this.station(s.x, s.y, s.name, s.sub, s.color, near);
    }
    for (const d of g.drops) {
      const bob = Math.sin(this.time * 3 + d.x) * 4;
      c.save();
      c.translate(d.x, d.y + bob);
      this.ring(
        0,
        0,
        d.type === "module" ? 25 : 13,
        d.type === "point" ? "#5682a1" : "#526044",
      );
      if (d.type === "module" && d.block) {
        c.scale(0.65, 0.65);
        this.module(d.block, 0, 0, 0, 1);
      } else if (d.type === "scrap") {
        this.rect(-7, -6, 14, 12, "#cfb17c");
        this.line(-3, -7, 3, 7, "#5a5037", 2);
      } else if (d.type === "point") {
        c.rotate(Math.PI / 4);
        this.rect(-6, -6, 12, 12, "#9cccf4");
      } else {
        this.rect(-11, -13, 22, 26, "#c8a3ec");
        this.line(-6, -5, 6, -5, "#483d5a", 2);
        this.line(-6, 1, 4, 1, "#483d5a", 2);
      }
      c.restore();
      if (
        d.type === "module" &&
        d.block &&
        Math.hypot(g.x - d.x, g.y - d.y) < 145
      )
        this.text(
          DEFS[d.block.kind].name,
          d.x,
          d.y - 30,
          14,
          RARITY_COLORS[d.block.rarity],
          "center",
        );
    }
    for (const e of g.enemies) this.enemy(e);
    this.player();
    for (const b of g.bullets) {
      this.line(
        b.x - b.vx * 0.013,
        b.y - b.vy * 0.013,
        b.x,
        b.y,
        b.color,
        b.r * 1.6,
      );
    }
    for (const p of g.particles) {
      c.globalAlpha = Math.max(0, p.life / p.max);
      this.rect(p.x, p.y, p.r, p.r, p.color);
    }
    c.globalAlpha = 1;
    if (g.scene === "run") {
      const core = g.blocks.find((b) => b.kind === "core");
      if (core && core.hp < maxHp(core, g.stats) * 0.35) {
        const grd = c.createRadialGradient(750, 500, 200, 750, 500, 900);
        grd.addColorStop(0, "#ff4e3b00");
        grd.addColorStop(1, "#b936244a");
        c.fillStyle = grd;
        c.fillRect(0, 0, 1500, 1000);
      }
    }
    // World-space aiming reticle remains independent of the hull's smooth turning.
    if (g.scene === "run" && !g.panel) {
      const a = g.aim;
      this.ring(a.x, a.y, 10, "#c4e9ab", 1);
      this.line(a.x - 17, a.y, a.x - 7, a.y, "#c4e9ab");
      this.line(a.x + 7, a.y, a.x + 17, a.y, "#c4e9ab");
      this.line(a.x, a.y - 17, a.x, a.y - 7, "#c4e9ab");
      this.line(a.x, a.y + 7, a.x, a.y + 17, "#c4e9ab");
    }
    c.restore();
  }
  floor() {
    const c = this.ctx;
    this.rect(0, 0, 1500, 1000, "#17211c");
    for (let x = 40; x < 1500; x += 50) this.line(x, 35, x, 965, "#ffffff04");
    for (let y = 40; y < 1000; y += 50) this.line(35, y, 1465, y, "#ffffff04");
    for (let i = 0; i < 65; i++) {
      const x = 60 + ((i * 271) % 1380),
        y = 50 + ((i * 163) % 900);
      this.rect(x, y, 2, 2, "#56605230");
    }
    c.strokeStyle = "#4b584140";
    c.lineWidth = 2;
    c.strokeRect(34, 34, 1432, 932);
    c.strokeStyle = "#7b845a40";
    c.strokeRect(44, 44, 1412, 912);
    for (let i = 0; i < 18; i++) {
      this.rect(55 + i * 79, 35, 36, 7, i % 2 ? "#a28f4e35" : "#8e9e8530");
      this.rect(55 + i * 79, 958, 36, 7, i % 2 ? "#a28f4e35" : "#8e9e8530");
    }
    for (const [x, y] of [
      [55, 55],
      [1370, 55],
      [55, 870],
      [1370, 870],
    ]) {
      this.line(x, y, x + 75, y, "#78856570", 3);
      this.line(x, y, x, y + 75, "#78856570", 3);
    }
  }
  hub() {
    const c = this.ctx;
    this.rect(650, 80, 200, 210, "#1e2b21");
    for (let x = 665; x < 840; x += 22)
      this.line(x, 100, x, 270, "#52614750", 6);
    this.text("B A S T I O N   /   0 1", 750, 138, 21, "#6f8069", "center");
    this.text("远 征 准 备 区", 750, 225, 28, "#c0c8ae", "center");
    this.line(750, 310, 750, 910, "#85907125", 3);
    for (let y = 330; y < 910; y += 28) this.line(742, y, 758, y, "#8c997d30");
    this.ring(750, 610, 190, "#6f865128", 2);
    this.ring(750, 610, 180, "#6f865115", 1);
    this.text(
      "FREE ASSEMBLY  /  NO REPAIR FEES",
      750,
      932,
      15,
      "#78876e",
      "center",
    );
    for (const x of [130, 1330]) {
      this.rect(x, 180, 40, 640, "#101913");
      for (let y = 210; y < 790; y += 80) {
        this.rect(x + 8, y, 24, 38, "#29382a");
        this.rect(x + 10, y + 4, 4, 7, "#a8cd7540");
      }
    }
    c.globalAlpha = 0.22;
    this.text("01", 190, 560, 100, "#8c9b73");
    this.text("HANGAR", 1110, 560, 45, "#8c9b73");
    c.globalAlpha = 1;
  }
  arena() {
    const g = this.game,
      c = this.ctx;
    this.text(`SECTOR 0${g.room + 1}`, 85, 98, 18, "#768269");
    this.text(ROOMS[g.room].name, 85, 132, 28, "#bac4a9");
    for (const [x, y] of [
      [170, 240],
      [1300, 240],
      [170, 740],
      [1300, 740],
    ]) {
      c.save();
      c.translate(x, y);
      this.rect(-35, -20, 70, 40, "#283026");
      c.strokeStyle = "#58634550";
      c.strokeRect(-35, -20, 70, 40);
      this.line(-27, -12, 27, 12, "#6c735235", 2);
      this.line(-27, 12, 27, -12, "#6c735235", 2);
      c.restore();
    }
    if (!g.clear && ROOMS[g.room].kind === "battle") {
      this.text(
        `WAVE ${g.wave} / ${TUNING_WAVES}`,
        1390,
        96,
        17,
        "#a4ae94",
        "right",
      );
      if (g.wave < 4)
        this.text(
          `增援 ${Math.ceil(Math.max(0, g.waveTimer))}s`,
          1390,
          124,
          16,
          "#77846b",
          "right",
        );
    }
    if (g.clear && ROOMS[g.room].kind === "battle") {
      this.text("区域肃清", 750, 550, 28, "#b5f58b", "center");
      this.text("拾取战利品 · 前往北侧出口", 750, 581, 16, "#8e9c80", "center");
    }
  }
  station(
    x: number,
    y: number,
    name: string,
    sub: string,
    color: string,
    near: boolean,
  ) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    this.rect(-80, -45, 160, 90, "#0c1410");
    c.strokeStyle = near ? color : "#65735a60";
    c.lineWidth = near ? 2 : 1;
    c.strokeRect(-80, -45, 160, 90);
    this.rect(-73, -38, 146, 5, color + "70");
    for (let i = 0; i < 4; i++)
      this.rect(-66 + i * 12, 25, 6, 6, i === 0 ? color : "#354332");
    this.rect(52, -23, 14, 37, "#273825");
    this.rect(56, -19, 6, 8, color);
    this.text(sub, -64, -9, 12, color);
    this.text(name, -64, 14, 19, "#dbe4cb");
    this.text(near ? "[ F ] 交互" : "", 0, -62, 16, color, "center");
    if (near) {
      c.globalAlpha = 0.3;
      this.ring(0, 0, 110, color);
      c.globalAlpha = 1;
    }
    c.restore();
  }
  module(b: Block, x: number, y: number, angle: number, hpRatio: number) {
    const c = this.ctx,
      d = DEFS[b.kind],
      s = d.size * CELL - 3;
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    this.rect(-s / 2 + 3, -s / 2 + 5, s, s, "#00000050");
    this.rect(
      -s / 2,
      -s / 2,
      s,
      s,
      b.flash > 0
        ? "#e8f3d0"
        : b.kind === "core"
          ? "#8ebd65"
          : d.damage
            ? "#293c2d"
            : "#4a5c4e",
    );
    c.strokeStyle = b.rarity ? RARITY_COLORS[b.rarity] : d.color;
    c.lineWidth = b.rarity ? 2 : 1;
    c.strokeRect(-s / 2 + 0.5, -s / 2 + 0.5, s - 1, s - 1);
    this.line(-s / 2 + 4, -s / 2 + 4, s / 2 - 4, -s / 2 + 4, "#dae6c435", 2);
    if (b.kind === "core") {
      this.rect(-7, -7, 14, 14, "#172715");
      this.rect(-4, -4, 8, 8, "#c9ff97");
      this.line(-10, 0, 10, 0, "#c9ff9750");
    } else if (!d.damage) {
      for (let i = -1; i <= 1; i++)
        this.line(-s / 2 + 5, i * 6, s / 2 - 5, i * 6, "#c2ceb02c", 2);
      for (const [a, z] of [
        [-1, -1],
        [1, 1],
      ])
        this.rect(a * (s / 2 - 5) - 1, z * (s / 2 - 5) - 1, 2, 2, "#c6d1bc");
    }
    if (hpRatio < 0.65) {
      this.line(-s / 3, -s / 2 + 2, 1, 3, "#0e1711", 2);
      this.line(1, 3, -5, s / 2 - 2, "#0e1711", 2);
    }
    c.restore();
    if (d.damage) {
      c.save();
      c.translate(x, y);
      c.rotate(angle);
      this.rect(-6, -6, 12, 12, d.color);
      c.rotate(-Math.PI / 2);
      this.rect(-3, -19, 6, 22, d.color);
      if (b.kind === "twin") {
        this.rect(-10, -26, 5, 30, d.color);
        this.rect(5, -26, 5, 30, d.color);
      }
      c.restore();
    }
  }
  player() {
    const g = this.game,
      c = this.ctx;
    if (g.scene === "hub") {
      this.ring(g.x, g.y, 55, "#b5f58b12");
    }
    if (g.scene === "run" && !g.panel && g.firing) {
      const rear = rotateLocal(0, 32, g.angle);
      this.line(
        g.x + rear.x,
        g.y + rear.y,
        g.x + rear.x * 1.5,
        g.y + rear.y * 1.5,
        "#a6dd7b50",
        7,
      );
    }
    for (const b of [...g.blocks].sort(
      (a, b) => (a.kind === "core" ? 1 : 0) - (b.kind === "core" ? 1 : 0),
    )) {
      const p = g.worldBlock(b);
      const ratio = b.hp / maxHp(b, g.stats);
      const d = DEFS[b.kind];
      if (d.damage) {
        const temp = {
          ...b,
          kind: (d.size === 2 ? "plate" : "armor") as "plate" | "armor",
        };
        this.module(temp, p.x, p.y, g.angle, ratio);
        c.save();
        c.translate(p.x, p.y);
        c.rotate(Math.atan2(g.aim.y - p.y, g.aim.x - p.x));
        this.rect(-8, -8, 16, 16, d.color);
        this.ring(0, 0, 10, "#17251d", 2);
        this.rect(0, -3, d.size === 2 ? 32 : 22, 6, d.color);
        if (b.kind === "twin") {
          this.rect(0, -10, 30, 5, d.color);
          this.rect(0, 5, 30, 5, d.color);
        }
        c.restore();
        if (b.rarity) this.ring(p.x, p.y, 14, RARITY_COLORS[b.rarity]);
      } else this.module(b, p.x, p.y, g.angle, ratio);
      if (ratio < 0.98) {
        this.rect(p.x - 12, p.y - 24, 24, 3, "#080e0a");
        this.rect(
          p.x - 12,
          p.y - 24,
          24 * Math.max(0, ratio),
          3,
          ratio < 0.3 ? "#ee927a" : "#b5f58b",
        );
      }
    }
    this.text("▼", g.x, g.y - 60, 14, "#b5f58b", "center");
  }
  enemy(e: Enemy) {
    const c = this.ctx;
    const boss = e.type === "boss";
    if (e.warn > 0) {
      const charge = e.type === "rush" || (boss && e.phase % 3 === 2);
      c.save();
      c.translate(e.x, e.y);
      c.rotate(e.angle);
      c.fillStyle = "#ee9b7120";
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(400, charge ? -35 : -180);
      c.lineTo(400, charge ? 35 : 180);
      c.closePath();
      c.fill();
      c.restore();
      this.ring(e.x, e.y, e.r + 10 + (1 - e.warn) * 10, "#e9a17880", 2);
    }
    c.save();
    c.translate(e.x, e.y);
    c.rotate(Math.atan2(this.game.y - e.y, this.game.x - e.x));
    const col =
      e.flash > 0
        ? "#ffecd7"
        : boss
          ? "#b07352"
          : e.type === "heavy"
            ? "#8e8165"
            : "#a76f60";
    this.rect(-e.r, -e.r + 5, e.r * 2, e.r * 2, "#00000035");
    this.rect(-e.r, -e.r, e.r * 2, e.r * 2, col);
    c.strokeStyle = "#e9b58e80";
    c.lineWidth = 2;
    c.strokeRect(-e.r + 3, -e.r + 3, e.r * 2 - 6, e.r * 2 - 6);
    this.rect(-e.r * 0.4, -e.r * 0.4, e.r * 0.8, e.r * 0.8, "#3a3026");
    this.rect(0, -3, e.r + 12, 6, "#ddae7b");
    if (boss) {
      this.rect(-35, -48, 70, 12, "#362d21");
      this.rect(-35, 36, 70, 12, "#362d21");
      this.ring(0, 0, 26, "#e6b775", 4);
      this.rect(-7, -7, 14, 14, "#f2b26e");
    }
    c.restore();
    if (e.hp < e.max) {
      this.rect(e.x - e.r, e.y - e.r - 12, e.r * 2, 4, "#0a110d");
      this.rect(
        e.x - e.r,
        e.y - e.r - 12,
        (e.r * 2 * e.hp) / e.max,
        4,
        "#dc9c80",
      );
    }
  }
}
const TUNING_WAVES = 4;
function rotateLocal(x: number, y: number, a: number) {
  return {
    x: x * Math.cos(a) - y * Math.sin(a),
    y: x * Math.sin(a) + y * Math.cos(a),
  };
}
