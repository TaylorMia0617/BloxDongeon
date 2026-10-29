import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  await page.goto("http://127.0.0.1:5173/?test=1");
  const result = await page.evaluate(async () => {
    const { game: g, renderer: r } = window.__bastion;
    const core = await import("/src/core.ts");
    g.start();
    g.meta.settings.shake = false;
    g.waveTimer = 999;
    g.stats.hp = 10000;
    g.stats.count = 20;
    g.stats.capacity = 40;
    g.blocks = [core.makeBlock("core", 0, 0, 0, 1, g.stats)];
    for (let y = -2; y <= 2; y++)
      for (let x = -2; x <= 2; x++)
        if ((x || y) && g.blocks.length < 21)
          g.blocks.push(
            core.makeBlock((x + y) % 2 ? "gun" : "armor", x, y, 0, 1, g.stats),
          );
    g.enemies = [];
    for (let i = 0; i < 60; i++)
      g.spawn(
        i % 3 === 0 ? "heavy" : i % 3 === 1 ? "shooter" : "rush",
        100 + (i % 10) * 140,
        120 + Math.floor(i / 10) * 115,
      );
    for (const e of g.enemies) {
      e.hp = e.max = 100000;
      e.timer = 999;
    }
    g.bullets = [];
    for (let i = 0; i < 500; i++)
      g.bullets.push({
        x: 80 + ((i * 79) % 1340),
        y: 80 + ((i * 137) % 840),
        vx: i % 2 ? 100 : -100,
        vy: 20,
        damage: 0,
        life: 100,
        enemy: i % 3 === 0,
        r: 3,
        color: i % 3 === 0 ? "#f4bb86" : "#b5f58b",
      });
    const samples = [];
    for (let i = 0; i < 180; i++) {
      const start = performance.now();
      g.update(1 / 60);
      r.draw(1 / 60);
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    const cpu = {
      meanMs: samples.reduce((a, b) => a + b, 0) / samples.length,
      p95Ms: samples[Math.floor(samples.length * 0.95)],
      modules: g.blocks.length,
      enemies: g.enemies.length,
      bullets: g.bullets.length,
    };
    g.resetHub();
    g.start();
    // A normal, unmodified battle scene, used for visual review rather than fixtures.
    for (let i = 0; i < 4 * 60; i++) g.update(1 / 60);
    g.aim = { x: 320, y: 250 };
    g.firing = true;
    for (let i = 0; i < 60; i++) g.update(1 / 60);
    r.draw(1 / 60);
    const frames = [];
    let previous = performance.now();
    for (let i = 0; i < 90; i++) {
      const t = await new Promise(requestAnimationFrame);
      frames.push(t - previous);
      previous = t;
    }
    const stable = frames.slice(5).sort((a, b) => a - b);
    return {
      stress: cpu,
      normalAnimation: {
        medianMs: stable[Math.floor(stable.length / 2)],
        p95Ms: stable[Math.floor(stable.length * 0.95)],
      },
      browser: navigator.userAgent,
    };
  });
  mkdirSync("artifacts", { recursive: true });
  writeFileSync("artifacts/performance.json", JSON.stringify(result, null, 2));
  await page.screenshot({
    path: "artifacts/09-live-battle.png",
    fullPage: true,
  });
  await page.evaluate(async () => {
    const { game: g } = window.__bastion;
    g.room = 7;
    g.enterRoom();
    g.meta.settings.shake = false;
    g.firing = true;
    g.aim = { x: 750, y: 240 };
    for (let i = 0; i < 120; i++) g.update(1 / 60);
    g.changed();
  });
  await page.screenshot({ path: "artifacts/10-boss.png", fullPage: true });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
