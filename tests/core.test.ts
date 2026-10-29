import { beforeEach, describe, it, expect, vi } from "vitest";
import { Game } from "../src/game";
import { DEFS } from "../src/data";
import {
  freshMeta,
  statsFor,
  makeBlock,
  maxHp,
  fromLayout,
  DEFAULT_LAYOUT,
  capacity,
  placementError,
  validate,
  connected,
  repairAll,
  segmentBlock,
  turnToward,
  upgrade,
  decodeSave,
  SAVE_KEY,
} from "../src/core";
let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
  });
});
describe("structure and module lifetime", () => {
  it("provides a legal, free starting fortress", () => {
    const s = statsFor(freshMeta()),
      b = fromLayout(DEFAULT_LAYOUT, s);
    expect(validate(b, s)).toBeNull();
    expect(capacity(b)).toBe(6);
  });
  it("rejects overlapping, oversized and out-of-grid placement", () => {
    const s = statsFor(freshMeta()),
      b = [makeBlock("core")];
    expect(placementError(b, makeBlock("gun"), s)).toContain("占用");
    expect(placementError(b, makeBlock("plate", 1, 1), s)).toContain("大型");
    s.size = 2;
    expect(placementError(b, makeBlock("plate", 4, 4), s)).toContain("边界");
  });
  it("counts a large module as four capacity but one module", () => {
    const s = statsFor(freshMeta());
    s.size = 2;
    const b = [
      makeBlock("core"),
      makeBlock("plate", 1, 0),
      makeBlock("gun", 0, -1),
    ];
    expect(capacity(b)).toBe(5);
    expect(validate(b, s)).toBeNull();
  });
  it("rejects corner-only connections and missing weapons", () => {
    const s = statsFor(freshMeta());
    expect(validate([makeBlock("core"), makeBlock("gun", 1, 1)], s)).toContain(
      "相邻",
    );
    expect(
      validate([makeBlock("core"), makeBlock("armor", 0, 1)], s),
    ).toContain("炮塔");
  });
  it("applies both quantity and capacity caps", () => {
    const s = statsFor(freshMeta());
    s.count = 1;
    expect(
      placementError(
        [makeBlock("core"), makeBlock("gun", 1, 0)],
        makeBlock("armor", 0, 1),
        s,
      ),
    ).toContain("数量");
    s.count = 8;
    s.capacity = 1;
    expect(
      placementError(
        [makeBlock("core"), makeBlock("gun", 1, 0)],
        makeBlock("armor", 0, 1),
        s,
      ),
    ).toContain("容量");
  });
  it("connects all cells of a large footprint", () => {
    const b = [
      makeBlock("core"),
      makeBlock("plate", 1, 0),
      makeBlock("gun", 3, 1),
    ];
    expect(connected(b).size).toBe(3);
  });
  it("detaches, recovers and repairs without duplicating instances", () => {
    const g = new Game();
    g.start();
    const core = makeBlock("core", 0, 0, 0, 1, g.stats),
      bridge = makeBlock("armor", 1, 0),
      gun = makeBlock("gun", 2, 0, 1, 2, g.stats);
    gun.hp = 33;
    g.blocks = [core, bridge, gun];
    g.hitBlock(bridge, 999);
    expect(g.blocks).toHaveLength(1);
    expect(g.destroyed).toHaveLength(1);
    expect(g.drops).toHaveLength(1);
    expect(g.drops[0].block?.hp).toBe(33);
    expect(g.drops[0].block?.id).toBe(gun.id);
    g.collect(g.drops.pop()!);
    expect(g.inventory[0].hp).toBe(33);
    g.room = 3;
    g.clear = true;
    g.freeRepair = true;
    g.repair();
    expect(g.freeRepair).toBe(false);
    expect(g.scrap).toBe(0);
    expect(g.destroyed).toHaveLength(0);
    expect(g.inventory[0].hp).toBe(maxHp(gun, g.stats));
    const ids = [...g.blocks, ...g.inventory].map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(g.blocks.some((b) => b.id === bridge.id)).toBe(true);
    g.repair();
    expect(g.scrap).toBe(0);
    expect(g.message).toContain("不足");
  });
  it("restores blocked positions to inventory and consumes the wreck record", () => {
    const s = statsFor(freshMeta()),
      blocks = [makeBlock("core"), makeBlock("gun", 1, 0)],
      inv: ReturnType<typeof makeBlock>[] = [],
      wreck = [makeBlock("armor", 1, 0)];
    const id = wreck[0].id;
    repairAll(blocks, inv, wreck, s);
    expect(inv[0].id).toBe(id);
    expect(wreck).toHaveLength(0);
    repairAll(blocks, inv, wreck, s);
    expect(inv).toHaveLength(1);
  });
  it("preserves damage percentage when upgrading", () => {
    const s = statsFor(freshMeta()),
      b = makeBlock("armor", 1, 0);
    b.hp = maxHp(b, s) / 2;
    upgrade(b, s);
    expect(b.hp / maxHp(b, s)).toBeCloseTo(0.5, 1);
    expect(b.level).toBe(2);
  });
  it("requires a safe functional room for repair and upgrade", () => {
    const g = new Game();
    g.start();
    g.scrap = 100;
    g.freeRepair = true;
    const b = g.blocks[1];
    b.hp = 1;
    g.repair();
    g.improve(b.id);
    expect(b.hp).toBe(1);
    expect(b.level).toBe(1);
    expect(g.scrap).toBe(100);
  });
});
describe("aiming and collision", () => {
  it("crosses the -π / π boundary by the shortest turn", () => {
    const a = Math.PI - 0.01,
      t = -Math.PI + 0.01;
    expect(turnToward(a, t, 0.03)).toBeCloseTo(Math.PI + 0.01);
  });
  it("limits hull rotation to 360 degrees per second and ignores the dead zone", () => {
    const g = new Game();
    g.angle = 0;
    g.aim = { x: g.x + 500, y: g.y };
    g.update(1 / 60);
    expect(g.angle).toBeCloseTo((Math.PI * 2) / 60);
    g.aim = { x: g.x, y: g.y };
    const a = g.angle;
    g.update(1 / 60);
    expect(g.angle).toBe(a);
  });
  it("keeps movement in screen axes regardless of heading", () => {
    const g = new Game();
    g.angle = 2;
    g.aim = { x: g.x, y: g.y };
    const x = g.x,
      y = g.y;
    g.keys.add("d");
    g.keys.add("w");
    g.update(1 / 60);
    expect(g.x).toBeGreaterThan(x);
    expect(g.y).toBeLessThan(y);
  });
  it("finds the earliest outer armor impact, including a high-speed segment", () => {
    const armor = makeBlock("armor", 1, 0),
      core = makeBlock("core");
    const a = segmentBlock(200, 0, -200, 0, armor, 0, 0, 0)!,
      b = segmentBlock(200, 0, -200, 0, core, 0, 0, 0)!;
    expect(a).toBeLessThan(b);
    expect(segmentBlock(200, 100, -200, 100, core, 0, 0, 0)).toBeNull();
  });
  it("rotates collision geometry with the hull", () => {
    const armor = makeBlock("armor", 1, 0);
    expect(
      segmentBlock(0, 100, 0, 20, armor, 0, 0, Math.PI / 2),
    ).not.toBeNull();
    expect(segmentBlock(0, 100, 0, 20, armor, 0, 0, 0)).toBeNull();
  });
  it("damages armor first with an actual enemy projectile", () => {
    const g = new Game();
    g.start();
    g.waveTimer = 999;
    g.blocks = [
      makeBlock("core"),
      makeBlock("armor", 1, 0),
      makeBlock("gun", -1, 0),
    ];
    g.x = 700;
    g.y = 500;
    g.angle = 0;
    g.aim = { x: 700, y: 500 };
    g.bullets = [
      {
        x: 790,
        y: 500,
        vx: -600,
        vy: 0,
        damage: 15,
        life: 1,
        enemy: true,
        r: 2,
        color: "#fff",
      },
    ];
    for (let i = 0; i < 10; i++) g.update(1 / 60);
    expect(g.blocks[0].hp).toBe(DEFS.core.hp);
    expect(g.blocks[1].hp).toBe(DEFS.armor.hp - 15);
  });
});
describe("permanent progression", () => {
  it("traverses all eight rooms, collecting rewards and reaching the boss", () => {
    const g = new Game();
    g.start();
    const order: number[] = [];
    for (let room = 0; room < 8; room++) {
      order.push(g.room);
      if ([3, 6].includes(room)) {
        expect(g.clear).toBe(true);
        expect(g.freeRepair).toBe(true);
        g.repair();
      } else if (room === 7) {
        expect(g.enemies[0].type).toBe("boss");
        g.enemies[0].hp = 0;
        g.killEnemy(g.enemies[0]);
      } else {
        g.waveTimer = 999;
        for (let wave = 0; wave < 4; wave++) {
          g.spawnWave();
          for (const enemy of [...g.enemies]) {
            enemy.hp = 0;
            g.killEnemy(enemy);
          }
          g.enemies = [];
        }
        g.update(1 / 60);
        expect(g.clear).toBe(true);
        for (const drop of g.drops) g.collect(drop);
        g.drops = [];
      }
      if (room < 7) g.next(room % 2 ? "arms" : "research");
    }
    expect(order).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(g.victory).toBe(true);
    expect(g.panel).toBe("result");
    expect(g.meta.points).toBeGreaterThan(40);
    expect(g.meta.blueprints.length).toBeGreaterThan(2);
  });
  it("keeps research and blueprints across death and permits free redeployment", () => {
    const g = new Game();
    g.start();
    g.collect({ type: "point", value: 22, x: 0, y: 0, age: 0 });
    g.collect({
      type: "blueprint",
      kind: "cannon",
      value: 1,
      x: 0,
      y: 0,
      age: 0,
    });
    g.scrap = 50;
    g.hitBlock(g.blocks[0], 9999);
    expect(g.panel).toBe("result");
    g.resetHub();
    expect(g.meta.points).toBe(22);
    expect(g.meta.blueprints).toContain("cannon");
    g.start();
    expect(g.scrap).toBe(0);
    expect(g.inventory).toHaveLength(0);
    expect(g.blocks[0].hp).toBe(maxHp(g.blocks[0], g.stats));
    expect(g.meta.points).toBe(22);
    expect(g.panel).toBeNull();
  });
  it("snapshots permanent upgrades for the current run", () => {
    const g = new Game();
    g.start();
    g.meta.points = 100;
    g.purchase("attack");
    expect(g.stats.attack).toBe(1);
    expect(g.meta.tech.attack).toBe(1);
    g.resetHub();
    expect(g.stats.attack).toBe(1.12);
  });
  it("enforces two unlocked passive slots and persists them", () => {
    const g = new Game();
    g.meta.passives = { siphon: 1, rage: 1, salvage: 1, repair: 0 };
    g.equip("siphon");
    g.equip("rage");
    g.equip("salvage");
    expect(g.meta.equipped).toEqual(["siphon", "rage"]);
    g.equip("repair");
    expect(g.meta.equipped).toHaveLength(2);
    expect(decodeSave(storage.get(SAVE_KEY)!).equipped).toHaveLength(2);
  });
  it("does not mutate permanent layout when the run loses modules", () => {
    const g = new Game();
    g.start();
    const before = JSON.stringify(g.meta.layout);
    g.hitBlock(g.blocks[1], 9999);
    expect(JSON.stringify(g.meta.layout)).toBe(before);
  });
  it("handles corrupt and incompatible saves", () => {
    expect(decodeSave("{broken")).toEqual(freshMeta());
    expect(decodeSave('{"version":99}')).toEqual(freshMeta());
    const m = freshMeta();
    m.points = -8;
    m.tech.capacity = 999;
    m.layout = [{ kind: "gun", x: 4, y: 4 }];
    const decoded = decodeSave(JSON.stringify(m));
    expect(decoded.points).toBe(0);
    expect(decoded.tech.capacity).toBe(3);
    expect(
      validate(
        fromLayout(decoded.layout, statsFor(decoded)),
        statsFor(decoded),
      ),
    ).toBeNull();
  });
  it("guarantees a gun reward in the first combat room", () => {
    const g = new Game();
    g.start();
    g.roomCleared();
    expect(g.drops.some((d) => d.block?.kind === "gun")).toBe(true);
    expect(g.clear).toBe(true);
  });
});
