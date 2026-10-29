import {
  DEFS,
  type ModuleKind,
  type Rarity,
  type TechKey,
  type PassiveKey,
  TECHS,
  PASSIVES,
  CELL,
} from "./data";
export interface Block {
  id: string;
  kind: ModuleKind;
  x: number;
  y: number;
  hp: number;
  level: number;
  rarity: Rarity;
  cooldown: number;
  flash: number;
}
export interface Layout {
  kind: ModuleKind;
  x: number;
  y: number;
}
export interface Meta {
  version: 1;
  points: number;
  blueprints: ModuleKind[];
  tech: Record<TechKey, number>;
  passives: Record<PassiveKey, number>;
  equipped: PassiveKey[];
  layout: Layout[];
  runs: number;
  wins: number;
  settings: { sound: boolean; shake: boolean };
}
export interface Stats {
  count: number;
  capacity: number;
  size: number;
  hp: number;
  attack: number;
  speed: number;
  luck: number;
  passive: Record<PassiveKey, number>;
}
export const SAVE_KEY = "block-bastion.v1";
export const DEFAULT_LAYOUT: Layout[] = [
  { kind: "gun", x: 0, y: -1 },
  { kind: "gun", x: -1, y: 0 },
  { kind: "armor", x: 1, y: 0 },
  { kind: "armor", x: 0, y: 1 },
  { kind: "armor", x: 1, y: -1 },
  { kind: "armor", x: -1, y: 1 },
];
const zeroRecord = <T extends string>(keys: T[]) =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<T, number>;
export function freshMeta(): Meta {
  return {
    version: 1,
    points: 0,
    blueprints: ["armor", "gun"],
    tech: zeroRecord(Object.keys(TECHS) as TechKey[]),
    passives: zeroRecord(Object.keys(PASSIVES) as PassiveKey[]),
    equipped: [],
    layout: structuredClone(DEFAULT_LAYOUT),
    runs: 0,
    wins: 0,
    settings: { sound: true, shake: true },
  };
}
export function decodeSave(raw: string | null): Meta {
  const base = freshMeta();
  if (!raw) return base;
  try {
    const m = JSON.parse(raw);
    if (m.version !== 1) return base;
    const n = (v: unknown, max = 1e9) =>
      typeof v === "number" && Number.isFinite(v)
        ? Math.min(max, Math.max(0, Math.floor(v)))
        : 0;
    base.points = n(m.points);
    base.runs = n(m.runs);
    base.wins = n(m.wins);
    base.blueprints = [
      ...new Set<ModuleKind>([
        "armor",
        "gun",
        ...(Array.isArray(m.blueprints)
          ? m.blueprints.filter(
              (k: string) => Object.hasOwn(DEFS, k) && k !== "core",
            )
          : []),
      ]),
    ];
    for (const k of Object.keys(TECHS) as TechKey[])
      base.tech[k] = n(m.tech?.[k], TECHS[k].max);
    for (const k of Object.keys(PASSIVES) as PassiveKey[])
      base.passives[k] = n(m.passives?.[k], 3);
    base.equipped = Array.isArray(m.equipped)
      ? [
          ...new Set<PassiveKey>(
            m.equipped.filter(
              (k: PassiveKey) =>
                Object.hasOwn(PASSIVES, k) && base.passives[k] > 0,
            ),
          ),
        ].slice(0, 2)
      : [];
    base.settings = {
      sound: m.settings?.sound !== false,
      shake: m.settings?.shake !== false,
    };
    if (Array.isArray(m.layout)) {
      const layout = m.layout
        .filter(
          (b: Layout) =>
            b &&
            base.blueprints.includes(b.kind) &&
            Number.isInteger(b.x) &&
            Number.isInteger(b.y) &&
            Math.abs(b.x) <= 4 &&
            Math.abs(b.y) <= 4,
        )
        .slice(0, 20);
      const blocks = fromLayout(layout, statsFor(base));
      if (!validate(blocks, statsFor(base))) base.layout = layout;
    }
    return base;
  } catch {
    return base;
  }
}
export function statsFor(m: Meta): Stats {
  return {
    count: 8 + 2 * m.tech.count,
    capacity: 12 + 4 * m.tech.capacity,
    size: m.tech.size ? 2 : 1,
    hp: 1 + 0.15 * m.tech.hp,
    attack: 1 + 0.12 * m.tech.attack,
    speed: 1 + 0.08 * m.tech.speed,
    luck: m.tech.luck,
    passive: Object.fromEntries(
      Object.keys(PASSIVES).map((k) => [
        k,
        m.equipped.includes(k as PassiveKey) ? m.passives[k as PassiveKey] : 0,
      ]),
    ) as Record<PassiveKey, number>,
  };
}
let seq = 0;
export function makeBlock(
  kind: ModuleKind,
  x = 0,
  y = 0,
  rarity: Rarity = 0,
  level = 1,
  stats?: Stats,
): Block {
  const b: Block = {
    id: `b-${Date.now().toString(36)}-${seq++}`,
    kind,
    x,
    y,
    rarity,
    level,
    hp: 1,
    cooldown: 0,
    flash: 0,
  };
  b.hp = maxHp(b, stats);
  return b;
}
export function maxHp(b: Block, s?: Stats) {
  return Math.round(
    DEFS[b.kind].hp *
      (s?.hp ?? 1) *
      (1 + 0.3 * b.rarity) *
      (DEFS[b.kind].damage ? 1 : 1 + 0.3 * (b.level - 1)),
  );
}
export function damage(b: Block, s: Stats, low = false) {
  return (
    DEFS[b.kind].damage *
    s.attack *
    (1 + 0.3 * b.rarity) *
    (1 + 0.3 * (b.level - 1)) *
    (low ? 1 + 0.2 * s.passive.rage : 1)
  );
}
export function fromLayout(layout: Layout[], s: Stats) {
  return [
    makeBlock("core", 0, 0, 0, 1, s),
    ...layout.map((b) => makeBlock(b.kind, b.x, b.y, 0, 1, s)),
  ];
}
export function cells(b: Pick<Block, "kind" | "x" | "y">): string[] {
  const a: string[] = [];
  for (let x = 0; x < DEFS[b.kind].size; x++)
    for (let y = 0; y < DEFS[b.kind].size; y++) a.push(`${b.x + x},${b.y + y}`);
  return a;
}
export function connected(blocks: Block[]): Set<string> {
  const occupancy = new Map<string, Block>();
  for (const b of blocks) for (const c of cells(b)) occupancy.set(c, b);
  const core = blocks.find((b) => b.kind === "core");
  const visited = new Set<string>();
  if (!core) return visited;
  const queue = [core];
  visited.add(core.id);
  for (let i = 0; i < queue.length; i++)
    for (const c of cells(queue[i])) {
      const [x, y] = c.split(",").map(Number);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const next = occupancy.get(`${x + dx},${y + dy}`);
        if (next && !visited.has(next.id)) {
          visited.add(next.id);
          queue.push(next);
        }
      }
    }
  return visited;
}
export function placementError(
  blocks: Block[],
  b: Block,
  s: Stats,
): string | null {
  const d = DEFS[b.kind];
  if (d.size > s.size && b.kind !== "core")
    return "先研究大型接口，才能安装大型模块";
  if (b.x < -4 || b.y < -4 || b.x + d.size - 1 > 4 || b.y + d.size - 1 > 4)
    return "模块超出 9×9 建造边界";
  const occ = new Set(blocks.flatMap(cells));
  if (cells(b).some((c) => occ.has(c))) return "这个位置已被占用";
  if (blocks.filter((b) => b.kind !== "core").length >= s.count)
    return "模块数量已达上限";
  if (capacity(blocks) + d.size ** 2 > s.capacity) return "载具容量不足";
  return null;
}
export function capacity(blocks: Block[]) {
  return blocks
    .filter((b) => b.kind !== "core")
    .reduce((n, b) => n + DEFS[b.kind].size ** 2, 0);
}
export function validate(blocks: Block[], s: Stats): string | null {
  if (
    blocks.filter((b) => b.kind === "core").length !== 1 ||
    !blocks.some((b) => b.kind === "core" && b.x === 0 && b.y === 0)
  )
    return "核心必须位于中央";
  const check: Block[] = [];
  for (const b of blocks) {
    const error = placementError(check, b, s);
    if (error) return error;
    check.push(b);
  }
  if (connected(blocks).size !== blocks.length)
    return "所有模块必须通过边相邻连接核心";
  if (!blocks.some((b) => DEFS[b.kind].damage > 0))
    return "至少安装一个炮塔才能出发";
  return null;
}
export function repairAll(
  blocks: Block[],
  inventory: Block[],
  destroyed: Block[],
  s: Stats,
) {
  for (const b of [...blocks, ...inventory]) b.hp = maxHp(b, s);
  const remaining: Block[] = [];
  for (const b of destroyed) {
    if ([...blocks, ...inventory].some((a) => a.id === b.id)) continue;
    b.hp = maxHp(b, s);
    if (!placementError(blocks, b, s)) {
      blocks.push(b);
    } else remaining.push(b);
  }
  // A restored island must remain an inventory item until a valid connection is built.
  const links = connected(blocks);
  for (let i = blocks.length - 1; i >= 0; i--)
    if (!links.has(blocks[i].id)) remaining.push(...blocks.splice(i, 1));
  inventory.push(...remaining);
  destroyed.length = 0;
}
export function upgrade(b: Block, s: Stats): boolean {
  if (b.level >= 3 || b.kind === "core") return false;
  const ratio = b.hp / maxHp(b, s);
  b.level++;
  b.hp = Math.max(1, Math.round(maxHp(b, s) * ratio));
  return true;
}
export function turnToward(angle: number, target: number, step: number) {
  const d = Math.atan2(Math.sin(target - angle), Math.cos(target - angle));
  return angle + Math.max(-step, Math.min(step, d));
}
export function blockLocal(b: Block) {
  const size = DEFS[b.kind].size;
  return { x: (b.x + (size - 1) / 2) * CELL, y: (b.y + (size - 1) / 2) * CELL };
}
export function rotate(x: number, y: number, a: number) {
  return {
    x: x * Math.cos(a) - y * Math.sin(a),
    y: x * Math.sin(a) + y * Math.cos(a),
  };
}
// Segment against an expanded local square: returns the first impact, including fast bullets.
export function segmentBlock(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  b: Block,
  px: number,
  py: number,
  angle: number,
  r = 2,
): number | null {
  const p = rotate(x0 - px, y0 - py, -angle),
    q = rotate(x1 - px, y1 - py, -angle),
    c = blockLocal(b);
  const half = (DEFS[b.kind].size * CELL) / 2 + r;
  let lo = 0,
    hi = 1;
  for (const axis of ["x", "y"] as const) {
    const delta = q[axis] - p[axis],
      min = c[axis] - half,
      max = c[axis] + half;
    if (Math.abs(delta) < 1e-8) {
      if (p[axis] < min || p[axis] > max) return null;
    } else {
      let a = (min - p[axis]) / delta,
        z = (max - p[axis]) / delta;
      if (a > z) [a, z] = [z, a];
      lo = Math.max(lo, a);
      hi = Math.min(hi, z);
      if (lo > hi) return null;
    }
  }
  return lo;
}
export function techCost(level: number) {
  return 18 * (level + 1);
}
export function repairPrice(s: Stats, base = 30) {
  return Math.ceil(base * (1 - 0.15 * s.passive.repair));
}
