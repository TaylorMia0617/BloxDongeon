export type ModuleKind =
  | "core"
  | "armor"
  | "plate"
  | "gun"
  | "shotgun"
  | "cannon"
  | "twin";
export type Rarity = 0 | 1 | 2;
export interface ModuleDef {
  name: string;
  label: string;
  size: number;
  hp: number;
  color: string;
  damage: number;
  interval: number;
  speed: number;
  pellets: number;
  description: string;
}
export const CELL = 30;
export const WORLD = { w: 1500, h: 1000 };
export const DEFS: Record<ModuleKind, ModuleDef> = {
  core: {
    name: "反应核心",
    label: "核",
    size: 1,
    hp: 160,
    color: "#b5f58b",
    damage: 0,
    interval: 0,
    speed: 0,
    pellets: 0,
    description: "整个堡垒的心脏。保护它，活着回来。",
  },
  armor: {
    name: "轻型装甲",
    label: "甲",
    size: 1,
    hp: 110,
    color: "#8eaaa0",
    damage: 0,
    interval: 0,
    speed: 0,
    pellets: 0,
    description: "可靠的 1×1 装甲，拦截迎面而来的攻击。",
  },
  plate: {
    name: "复合重甲",
    label: "重",
    size: 2,
    hp: 480,
    color: "#b1bcb0",
    damage: 0,
    interval: 0,
    speed: 0,
    pellets: 0,
    description: "2×2 的厚重护盾，适合保护一整侧结构。",
  },
  gun: {
    name: "速射机枪",
    label: "机",
    size: 1,
    hp: 75,
    color: "#b5f58b",
    damage: 13,
    interval: 0.19,
    speed: 720,
    pellets: 1,
    description: "稳定、精准的持续火力。",
  },
  shotgun: {
    name: "散射炮塔",
    label: "散",
    size: 1,
    hp: 85,
    color: "#efca83",
    damage: 11,
    interval: 0.8,
    speed: 560,
    pellets: 5,
    description: "五发扇形弹丸，近距离撕碎敌人。",
  },
  cannon: {
    name: "重型加农",
    label: "炮",
    size: 1,
    hp: 100,
    color: "#ed987c",
    damage: 62,
    interval: 1.05,
    speed: 600,
    pellets: 1,
    description: "缓慢而有力，适合应对重装目标。",
  },
  twin: {
    name: "双联炮台",
    label: "双",
    size: 2,
    hp: 240,
    color: "#a9b8ff",
    damage: 21,
    interval: 0.24,
    speed: 740,
    pellets: 2,
    description: "2×2 双联炮管，密集火力覆盖。",
  },
};
export const KINDS = Object.keys(DEFS).filter(
  (k) => k !== "core",
) as ModuleKind[];
export const RARITY_NAMES = ["普通", "稀有", "史诗"];
export const RARITY_COLORS = ["#99aba0", "#8cbffd", "#d7a0ff"];
export const TECHS = {
  count: { name: "结构扩展", description: "模块上限 +2", max: 3 },
  capacity: { name: "承载系统", description: "容量上限 +4", max: 3 },
  size: { name: "大型接口", description: "允许安装 2×2 模块", max: 1 },
  hp: { name: "复合材料", description: "所有模块生命 +15%", max: 3 },
  attack: { name: "武器校准", description: "炮塔伤害 +12%", max: 3 },
  speed: { name: "矢量推进", description: "移动速度 +8%", max: 3 },
  luck: { name: "寻宝雷达", description: "稀有与史诗掉率提高", max: 3 },
};
export type TechKey = keyof typeof TECHS;
export const PASSIVES = {
  siphon: {
    name: "余烬回流",
    description: "每次击杀恢复核心 2 / 4 / 6 点生命",
    icon: "✚",
  },
  rage: {
    name: "绝境过载",
    description: "核心低于 35% 时，伤害 +20 / 40 / 60%",
    icon: "↗",
  },
  salvage: {
    name: "精密拆解",
    description: "废料收益 +15 / 30 / 45%",
    icon: "◇",
  },
  repair: {
    name: "维修专家",
    description: "付费维修价格降低 15 / 30 / 45%",
    icon: "⌁",
  },
};
export type PassiveKey = keyof typeof PASSIVES;
export type RoomKind = "battle" | "workshop" | "research" | "boss";
export const ROOMS: { name: string; kind: RoomKind; description: string }[] = [
  { name: "边缘哨站", kind: "battle", description: "废弃防线仍有巡逻者。" },
  { name: "输送走廊", kind: "battle", description: "选择你的补给路线。" },
  { name: "熔渣庭院", kind: "battle", description: "穿过旧世界的残骸。" },
  { name: "流浪工坊", kind: "workshop", description: "停下引擎，重新组装。" },
  { name: "铸铁阵地", kind: "battle", description: "重装守卫正在集结。" },
  { name: "反应大厅", kind: "battle", description: "堡垒深处传来轰鸣。" },
  {
    name: "档案维修站",
    kind: "research",
    description: "把这次发现，留给下一次远征。",
  },
  { name: "守门者", kind: "boss", description: "摧毁这台失控的战争机器。" },
];
export const TUNING = {
  moveSpeed: 205,
  turnSpeed: Math.PI * 2,
  pickupRadius: 68,
  repairCost: 30,
  enemyDamage: 10,
  waveDelay: 18,
  waves: 4,
};
