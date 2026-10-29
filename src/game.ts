import {
  CELL,
  DEFS,
  KINDS,
  ROOMS,
  TUNING,
  TECHS,
  PASSIVES,
  type ModuleKind,
  type PassiveKey,
  type TechKey,
  type Rarity,
} from "./data";
import {
  type Block,
  type Meta,
  type Stats,
  SAVE_KEY,
  decodeSave,
  statsFor,
  fromLayout,
  DEFAULT_LAYOUT,
  makeBlock,
  maxHp,
  damage,
  connected,
  blockLocal,
  rotate,
  segmentBlock,
  turnToward,
  repairAll,
  repairPrice,
  techCost,
  upgrade,
  validate,
} from "./core";
export interface Enemy {
  id: number;
  type: "rush" | "shooter" | "heavy" | "boss";
  x: number;
  y: number;
  hp: number;
  max: number;
  r: number;
  timer: number;
  warn: number;
  charge: number;
  angle: number;
  flash: number;
  phase: number;
}
export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  life: number;
  enemy: boolean;
  r: number;
  color: string;
}
export interface Drop {
  x: number;
  y: number;
  type: "module" | "scrap" | "point" | "blueprint";
  block?: Block;
  kind?: ModuleKind;
  value: number;
  age: number;
}
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  r: number;
}
export type Panel =
  | "build"
  | "tech"
  | "passives"
  | "pause"
  | "result"
  | "leave"
  | null;
export type Effect = (
  type: "shot" | "hit" | "collect" | "explode" | "click",
) => void;
export class Game {
  meta: Meta;
  stats: Stats;
  scene: "hub" | "run" = "hub";
  panel: Panel = null;
  blocks: Block[] = [];
  inventory: Block[] = [];
  destroyed: Block[] = [];
  x = 750;
  y = 650;
  angle = -Math.PI / 2;
  aim = { x: 750, y: 300 };
  keys = new Set<string>();
  firing = false;
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  drops: Drop[] = [];
  particles: Particle[] = [];
  room = 0;
  wave = 0;
  waveTimer = 0;
  elapsed = 0;
  roomElapsed = 0;
  scrap = 0;
  kills = 0;
  earned = 0;
  found = 0;
  clear = false;
  freeRepair = false;
  victory = false;
  shake = 0;
  contactCooldown = 0;
  roomSerial = 0;
  route: "arms" | "research" = "arms";
  message = "";
  messageTime = 0;
  saveError = false;
  seed = 0;
  revision = 0;
  onChange = () => {};
  effect: Effect = () => {};
  private enemyId = 0;
  constructor() {
    let raw: null | string = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch {
      this.saveError = true;
    }
    this.meta = decodeSave(raw);
    this.stats = statsFor(this.meta);
    this.resetHub();
  }
  changed() {
    this.revision++;
    this.onChange();
  }
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.meta));
      this.saveError = false;
    } catch {
      this.saveError = true;
    }
  }
  toast(text: string) {
    this.message = text;
    this.messageTime = 4;
    this.changed();
  }
  resetHub() {
    this.scene = "hub";
    this.panel = null;
    this.stats = statsFor(this.meta);
    this.blocks = fromLayout(this.meta.layout, this.stats);
    if (validate(this.blocks, this.stats))
      this.blocks = fromLayout(DEFAULT_LAYOUT, this.stats);
    this.inventory = [];
    this.destroyed = [];
    this.enemies = [];
    this.bullets = [];
    this.drops = [];
    this.x = 750;
    this.y = 650;
    this.angle = -Math.PI / 2;
    this.clear = false;
    this.particles = [];
    this.firing = false;
    this.changed();
  }
  start() {
    const err = validate(this.blocks, this.stats);
    if (err) {
      this.toast(err);
      return;
    }
    this.meta.layout = this.blocks
      .filter((b) => b.kind !== "core")
      .map(({ kind, x, y }) => ({ kind, x, y }));
    this.meta.runs++;
    this.save();
    this.scene = "run";
    this.panel = null;
    this.stats = statsFor(this.meta);
    this.blocks = fromLayout(this.meta.layout, this.stats);
    this.inventory = [];
    this.destroyed = [];
    this.room = 0;
    this.scrap = 0;
    this.kills = 0;
    this.earned = 0;
    this.found = 0;
    this.elapsed = 0;
    this.victory = false;
    this.seed = Date.now();
    this.enterRoom();
    this.toast("远征开始 · 保护核心，带回新的发现");
  }
  enterRoom() {
    this.roomSerial++;
    this.x = 750;
    this.y = 800;
    this.angle = -Math.PI / 2;
    this.enemies = [];
    this.bullets = [];
    this.drops = [];
    this.wave = 0;
    this.waveTimer = 1.4;
    this.roomElapsed = 0;
    this.contactCooldown = 1.5;
    this.particles = [];
    const kind = ROOMS[this.room].kind;
    this.clear = kind === "workshop" || kind === "research";
    this.freeRepair = this.clear;
    if (kind === "boss") {
      this.spawn("boss", 750, 240);
      this.wave = 1;
    }
    this.changed();
  }
  next(route: "arms" | "research") {
    if (!this.clear) return;
    this.route = route;
    if (this.room >= 7) return;
    this.room++;
    this.panel = null;
    this.enterRoom();
  }
  finish(win: boolean) {
    if (this.panel === "result") return;
    this.victory = win;
    if (win) {
      this.meta.wins++;
      this.meta.points += 40;
      this.earned += 40;
      this.save();
    }
    this.panel = "result";
    this.firing = false;
    this.bullets = [];
    this.changed();
  }
  open(panel: Panel) {
    this.panel = panel;
    this.firing = false;
    this.keys.clear();
    this.changed();
  }
  interact() {
    if (this.panel) return;
    const stations = this.stations();
    const s = stations.find(
      (s) => Math.hypot(this.x - s.x, this.y - s.y) < 125,
    );
    if (!s) {
      this.toast("靠近设施或出口，按 F 交互");
      return;
    }
    this.use(s.action);
  }
  use(action: string) {
    if (action === "start") {
      this.start();
      return;
    }
    if (action === "exit") {
      if (
        this.drops.some((d) => d.type === "module" || d.type === "blueprint")
      ) {
        this.open("leave");
        return;
      }
      this.open("leave");
      return;
    }
    this.open(action as Panel);
  }
  stations() {
    if (this.scene === "hub")
      return [
        {
          x: 430,
          y: 390,
          name: "组装工作台",
          sub: "ASSEMBLY",
          action: "build",
          color: "#b5f58b",
        },
        {
          x: 1050,
          y: 390,
          name: "载具科技",
          sub: "RESEARCH",
          action: "tech",
          color: "#8ebcf2",
        },
        {
          x: 430,
          y: 740,
          name: "被动终端",
          sub: "PASSIVES",
          action: "passives",
          color: "#c8a3ec",
        },
        {
          x: 1050,
          y: 740,
          name: "开始远征",
          sub: "DEPLOY",
          action: "start",
          color: "#edc78a",
        },
      ];
    if (!this.clear) return [];
    const kind = ROOMS[this.room].kind;
    const out = [
      {
        x: 750,
        y: 125,
        name: "下一间",
        sub: "CONTINUE",
        action: "exit",
        color: "#b5f58b",
      },
    ];
    if (kind === "workshop" || kind === "research") {
      out.push({
        x: 540,
        y: 500,
        name: "组装与维修",
        sub: this.freeRepair ? "FREE REPAIR" : "WORKSHOP",
        action: "build",
        color: "#b5f58b",
      });
      if (kind === "research")
        out.push({
          x: 960,
          y: 500,
          name: "永久研究",
          sub: "NEXT EXPEDITION",
          action: "tech",
          color: "#8ebcf2",
        });
    }
    return out;
  }
  purchase(key: TechKey) {
    const level = this.meta.tech[key],
      price = techCost(level);
    if (level >= TECHS[key].max || this.meta.points < price) return;
    this.meta.points -= price;
    this.meta.tech[key]++;
    this.save();
    if (this.scene === "hub") {
      this.stats = statsFor(this.meta);
      for (const b of this.blocks) b.hp = maxHp(b, this.stats);
    }
    this.effect("click");
    this.changed();
  }
  buyPassive(key: PassiveKey) {
    const level = this.meta.passives[key],
      price = techCost(level);
    if (level >= 3 || this.meta.points < price) return;
    this.meta.points -= price;
    this.meta.passives[key]++;
    this.save();
    this.changed();
  }
  equip(key: PassiveKey) {
    if (this.scene !== "hub" || !this.meta.passives[key]) return;
    const i = this.meta.equipped.indexOf(key);
    if (i >= 0) this.meta.equipped.splice(i, 1);
    else if (this.meta.equipped.length < 2) this.meta.equipped.push(key);
    else {
      this.toast("最多装配两个被动，请先卸下一个");
      return;
    }
    this.stats = statsFor(this.meta);
    this.save();
    this.changed();
  }
  repair() {
    if (
      this.scene !== "run" ||
      !this.clear ||
      !["workshop", "research"].includes(ROOMS[this.room].kind)
    )
      return;
    const cost = this.freeRepair
      ? 0
      : repairPrice(this.stats, TUNING.repairCost);
    if (this.scrap < cost) {
      this.toast("废料不足");
      return;
    }
    this.scrap -= cost;
    this.freeRepair = false;
    repairAll(this.blocks, this.inventory, this.destroyed, this.stats);
    this.effect("collect");
    this.toast(cost ? "整修完成" : "本站免费整修已完成");
  }
  improve(id: string) {
    if (
      this.scene !== "run" ||
      !this.clear ||
      !["workshop", "research"].includes(ROOMS[this.room].kind)
    )
      return;
    const b = [...this.blocks, ...this.inventory].find((b) => b.id === id);
    if (!b || b.kind === "core" || b.level >= 3) return;
    const cost = 16 * b.level;
    if (this.scrap < cost) {
      this.toast("废料不足");
      return;
    }
    this.scrap -= cost;
    upgrade(b, this.stats);
    this.effect("click");
    this.changed();
  }
  spawn(type: Enemy["type"], x: number, y: number) {
    const base =
      { rush: 58, shooter: 75, heavy: 230, boss: 2800 }[type] *
      (1 + this.room * 0.13);
    this.enemies.push({
      id: this.enemyId++,
      type,
      x,
      y,
      hp: base,
      max: base,
      r: type === "boss" ? 65 : type === "heavy" ? 28 : 19,
      timer: 1 + Math.random(),
      warn: 0,
      charge: 0,
      angle: 0,
      flash: 0,
      phase: 0,
    });
  }
  spawnWave() {
    this.wave++;
    const count = 4 + Math.floor(this.room * 0.7) + this.wave;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      this.spawn(
        this.room > 1 && i % 4 === 0
          ? "heavy"
          : i % 3 === 0
            ? "shooter"
            : "rush",
        750 + Math.cos(a) * 600,
        500 + Math.sin(a) * 350,
      );
    }
    this.waveTimer = TUNING.waveDelay;
    this.toast(`警戒波次 ${this.wave} / ${TUNING.waves}`);
  }
  addParticles(x: number, y: number, color: string, count = 10) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2,
        s = 30 + Math.random() * 180,
        life = 0.2 + Math.random() * 0.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        max: life,
        color,
        r: 1 + Math.random() * 3,
      });
    }
    if (this.particles.length > 450)
      this.particles.splice(0, this.particles.length - 450);
  }
  worldBlock(b: Block) {
    const p = blockLocal(b),
      r = rotate(p.x, p.y, this.angle);
    return { x: this.x + r.x, y: this.y + r.y };
  }
  hitBlock(b: Block, amount: number) {
    b.hp -= amount;
    b.flash = 0.12;
    this.shake = Math.max(this.shake, 3);
    this.effect("hit");
    const p = this.worldBlock(b);
    this.addParticles(p.x, p.y, DEFS[b.kind].color, 4);
    if (b.hp > 0) return;
    if (b.kind === "core") {
      this.addParticles(this.x, this.y, "#b5f58b", 55);
      this.finish(false);
      return;
    }
    this.blocks = this.blocks.filter((a) => a.id !== b.id);
    this.destroyed.push({ ...b, hp: 0 });
    this.addParticles(p.x, p.y, DEFS[b.kind].color, 20);
    this.effect("explode");
    const links = connected(this.blocks);
    for (const lost of this.blocks.filter((a) => !links.has(a.id))) {
      const pos = this.worldBlock(lost);
      this.drops.push({
        x: pos.x,
        y: pos.y,
        type: "module",
        block: lost,
        value: 1,
        age: 0,
      });
    }
    this.blocks = this.blocks.filter((a) => links.has(a.id));
    this.changed();
  }
  shootEnemy(e: Enemy) {
    const aim = e.angle;
    const boss = e.type === "boss",
      heavy = e.type === "heavy";
    const count = boss ? (e.hp < e.max / 2 ? 13 : 9) : heavy ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const a = aim + (i - (count - 1) / 2) * (boss ? 0.2 : 0.16);
      const speed = boss ? 200 : heavy ? 240 : 290;
      this.bullets.push({
        x: e.x + Math.cos(a) * (e.r + 4),
        y: e.y + Math.sin(a) * (e.r + 4),
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        damage: boss ? 17 : heavy ? 14 : 10,
        life: 7,
        enemy: true,
        r: heavy ? 5 : 4,
        color: boss ? "#ef9b79" : "#f4bb86",
      });
    }
    this.addParticles(e.x, e.y, "#e68b6c", 3);
  }
  killEnemy(e: Enemy) {
    this.kills++;
    this.shake = e.type === "boss" ? 14 : 5;
    this.effect("explode");
    this.addParticles(
      e.x,
      e.y,
      e.type === "boss" ? "#f4bc82" : "#eea18d",
      e.type === "boss" ? 60 : 20,
    );
    this.drops.push({
      x: e.x,
      y: e.y,
      type: "scrap",
      value: e.type === "heavy" ? 9 : 4,
      age: 0,
    });
    if (Math.random() < 0.45)
      this.drops.push({ x: e.x + 15, y: e.y, type: "point", value: 2, age: 0 });
    if (Math.random() < 0.1) this.dropModule(e.x - 20, e.y);
    const core = this.blocks.find((b) => b.kind === "core");
    if (core && this.stats.passive.siphon)
      core.hp = Math.min(
        maxHp(core, this.stats),
        core.hp + this.stats.passive.siphon * 2,
      );
    if (e.type === "boss") {
      for (const d of this.drops) this.collect(d);
      this.drops = [];
      this.finish(true);
    }
    this.changed();
  }
  randomRarity(): Rarity {
    const r = Math.random();
    return r < 0.05 + 0.015 * this.stats.luck
      ? 2
      : r < 0.3 + 0.06 * this.stats.luck
        ? 1
        : 0;
  }
  dropModule(x: number, y: number, forceGun = false) {
    const pool = KINDS.filter((k) => DEFS[k].size <= this.stats.size);
    const kind = forceGun
      ? "gun"
      : pool[Math.floor(Math.random() * pool.length)];
    this.drops.push({
      x,
      y,
      type: "module",
      block: makeBlock(kind, 0, 0, this.randomRarity(), 1, this.stats),
      value: 1,
      age: 0,
    });
  }
  roomCleared() {
    this.clear = true;
    this.bullets = [];
    this.dropModule(700, 450, this.room === 0);
    if (this.route === "arms") this.dropModule(800, 450);
    this.drops.push(
      { x: 750, y: 500, type: "scrap", value: 20 + this.room * 4, age: 0 },
      {
        x: 750,
        y: 420,
        type: "point",
        value: this.route === "research" ? 14 : 8,
        age: 0,
      },
    );
    const locked = KINDS.filter((k) => !this.meta.blueprints.includes(k));
    if (locked.length && (this.room === 2 || Math.random() < 0.3))
      this.drops.push({
        x: 850,
        y: 480,
        type: "blueprint",
        kind: locked[Math.floor(Math.random() * locked.length)],
        value: 1,
        age: 0,
      });
    this.toast("区域肃清 · 收集战利品，前往出口");
  }
  collect(d: Drop) {
    if (d.type === "module" && d.block) {
      this.inventory.push(d.block);
      this.found++;
    }
    if (d.type === "scrap")
      this.scrap += Math.round(
        d.value * (1 + 0.15 * this.stats.passive.salvage),
      );
    if (d.type === "point") {
      this.meta.points += d.value;
      this.earned += d.value;
      this.save();
    }
    if (d.type === "blueprint" && d.kind) {
      if (!this.meta.blueprints.includes(d.kind)) {
        this.meta.blueprints.push(d.kind);
        this.toast(`蓝图已永久解锁：${DEFS[d.kind].name}`);
      } else {
        this.meta.points += 10;
        this.earned += 10;
      }
      this.save();
    }
    this.effect("collect");
    this.addParticles(d.x, d.y, d.type === "point" ? "#8ebcf2" : "#b5f58b", 5);
    this.changed();
  }
  update(dt: number) {
    this.messageTime = Math.max(0, this.messageTime - dt);
    this.shake = Math.max(0, this.shake - dt * 30);
    if (this.panel) return;
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    let mx = Number(this.keys.has("d")) - Number(this.keys.has("a")),
      my = Number(this.keys.has("s")) - Number(this.keys.has("w"));
    const norm = Math.hypot(mx, my) || 1;
    const speed = TUNING.moveSpeed * this.stats.speed;
    this.x += (mx / norm) * speed * dt;
    this.y += (my / norm) * speed * dt;
    if (Math.hypot(this.aim.x - this.x, this.aim.y - this.y) > 12)
      this.angle = turnToward(
        this.angle,
        Math.atan2(this.aim.y - this.y, this.aim.x - this.x) + Math.PI / 2,
        TUNING.turnSpeed * dt,
      );
    let extent = 25;
    for (const b of this.blocks) {
      const p = blockLocal(b);
      extent = Math.max(
        extent,
        Math.hypot(p.x, p.y) + DEFS[b.kind].size * CELL * 0.71,
      );
    }
    this.x = Math.max(extent + 35, Math.min(1465 - extent, this.x));
    this.y = Math.max(extent + 35, Math.min(965 - extent, this.y));
    for (const b of this.blocks) b.flash = Math.max(0, b.flash - dt);
    if (this.scene !== "run") return;
    this.elapsed += dt;
    this.roomElapsed += dt;
    this.contactCooldown -= dt;
    const core = this.blocks.find((b) => b.kind === "core")!;
    const low = core.hp < maxHp(core, this.stats) * 0.35;
    for (const b of this.blocks) {
      b.cooldown -= dt;
      const def = DEFS[b.kind];
      if (!this.firing || !def.damage || b.cooldown > 0) continue;
      b.cooldown = def.interval;
      const p = this.worldBlock(b);
      const a = Math.atan2(this.aim.y - p.y, this.aim.x - p.x);
      for (let i = 0; i < def.pellets; i++) {
        const spread =
          b.kind === "shotgun"
            ? (i - 2) * 0.13
            : b.kind === "twin"
              ? (i - 0.5) * 0.028
              : (Math.random() - 0.5) * 0.025;
        this.bullets.push({
          x: p.x + Math.cos(a) * 22,
          y: p.y + Math.sin(a) * 22,
          vx: Math.cos(a + spread) * def.speed,
          vy: Math.sin(a + spread) * def.speed,
          damage: damage(b, this.stats, low),
          life: b.kind === "shotgun" ? 0.7 : 1.6,
          enemy: false,
          r: b.kind === "cannon" ? 5 : 2.5,
          color: def.color,
        });
      }
      this.effect("shot");
    }
    if (!this.clear && ROOMS[this.room].kind === "battle") {
      this.waveTimer -= dt;
      if (this.wave < TUNING.waves && this.waveTimer <= 0) this.spawnWave();
      if (this.wave >= TUNING.waves && !this.enemies.length) this.roomCleared();
    }
    for (const e of this.enemies) {
      e.flash = Math.max(0, e.flash - dt);
      const dx = this.x - e.x,
        dy = this.y - e.y,
        dist = Math.hypot(dx, dy) || 1;
      const boss = e.type === "boss";
      let move = e.type === "rush" ? 78 : e.type === "heavy" ? 38 : 60;
      if (boss) move = 28;
      if (e.charge > 0) {
        e.charge -= dt;
        e.x += Math.cos(e.angle) * 420 * dt;
        e.y += Math.sin(e.angle) * 420 * dt;
      } else if (e.warn > 0) {
        e.warn -= dt;
        if (e.warn <= 0) {
          if (e.type === "rush" || (boss && e.phase % 3 === 2)) {
            e.charge = boss ? 0.85 : 0.45;
          } else this.shootEnemy(e);
          e.timer = boss ? 1.45 : 2.6;
        }
      } else {
        e.timer -= dt;
        if (dist > (e.type === "rush" ? 45 : boss ? 340 : 310)) {
          e.x += (dx / dist) * move * dt;
          e.y += (dy / dist) * move * dt;
        }
        if (e.timer <= 0) {
          e.warn = boss ? 1 : 0.7;
          e.phase++;
          e.angle = Math.atan2(dy, dx);
        }
      }
      e.x = Math.max(e.r + 38, Math.min(1462 - e.r, e.x));
      e.y = Math.max(e.r + 38, Math.min(962 - e.r, e.y));
      if (dist < extent + e.r + 10 && this.contactCooldown <= 0) {
        let nearest: Block | undefined,
          best = Infinity;
        for (const b of this.blocks) {
          const p = this.worldBlock(b),
            d = Math.hypot(p.x - e.x, p.y - e.y);
          if (d < best && d < e.r + DEFS[b.kind].size * CELL * 0.7) {
            nearest = b;
            best = d;
          }
        }
        if (nearest) {
          this.hitBlock(nearest, boss ? 28 : e.type === "heavy" ? 19 : 12);
          this.contactCooldown = 0.6;
          const push = Math.max(8, e.r + 25 - best);
          e.x -= (dx / dist) * push;
          e.y -= (dy / dist) * push;
          if (this.panel) return;
        }
      }
    }
    for (const bullet of this.bullets) {
      const ox = bullet.x,
        oy = bullet.y;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.enemy) {
        let first: Block | undefined,
          t = Infinity;
        for (const b of this.blocks) {
          const hit = segmentBlock(
            ox,
            oy,
            bullet.x,
            bullet.y,
            b,
            this.x,
            this.y,
            this.angle,
            bullet.r,
          );
          if (hit !== null && hit < t) {
            t = hit;
            first = b;
          }
        }
        if (first) {
          bullet.life = 0;
          this.hitBlock(first, bullet.damage);
          if (this.panel) return;
        }
      } else {
        let hit: Enemy | undefined,
          near = Infinity;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const vx = bullet.x - ox,
            vy = bullet.y - oy,
            den = vx * vx + vy * vy;
          const t = Math.max(
            0,
            Math.min(1, ((e.x - ox) * vx + (e.y - oy) * vy) / (den || 1)),
          );
          if (
            Math.hypot(ox + vx * t - e.x, oy + vy * t - e.y) < e.r + bullet.r &&
            t < near
          ) {
            hit = e;
            near = t;
          }
        }
        if (hit) {
          hit.hp -= bullet.damage;
          hit.flash = 0.09;
          bullet.life = 0;
          this.addParticles(bullet.x, bullet.y, "#e7e6bc", 2);
          if (hit.hp <= 0) {
            this.killEnemy(hit);
            if (this.panel) return;
          }
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    this.bullets = this.bullets
      .filter(
        (b) => b.life > 0 && b.x > 20 && b.x < 1480 && b.y > 20 && b.y < 980,
      )
      .slice(-700);
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      if (
        d.age > 0.35 &&
        Math.hypot(this.x - d.x, this.y - d.y) < TUNING.pickupRadius
      ) {
        this.drops.splice(i, 1);
        this.collect(d);
      }
    }
  }
}
