import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";
const candidates = [
  process.env.BROWSER_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  chromium.executablePath(),
].filter(Boolean);
const executablePath = candidates.find(existsSync);
if (!executablePath)
  throw new Error(
    "Install a browser with npx playwright install chromium, or set BROWSER_PATH.",
  );
mkdirSync("artifacts", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = async (name, fn) => {
  await fn();
  console.log("PASS", name);
};
const state = (fn) =>
  page.evaluate(async (fnString) => {
    const { game, renderer, ui } = window.__bastion;
    const core = await import("/src/core.ts");
    return Function(
      "g",
      "r",
      "ui",
      "core",
      `return (${fnString})(g,r,ui,core)`,
    )(game, renderer, ui, core);
  }, fn.toString());
try {
  const gameUrl = new URL(process.env.GAME_URL || "http://127.0.0.1:5173");
  gameUrl.searchParams.set("test", "1");
  await page.goto(gameUrl.href);
  await page.locator("#game").waitFor();
  await check("clean hub renders and fits desktop", async () => {
    await page.getByRole("button", { name: "组装堡垒" }).waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({ path: "artifacts/01-hangar.png", fullPage: true });
  });
  await check(
    "assembly uses blueprint palette and applies a legal layout",
    async () => {
      await page.getByRole("button", { name: "组装堡垒" }).click();
      await page
        .locator(".palette-item")
        .filter({ hasText: "轻型装甲" })
        .click();
      await page
        .locator('[data-action="cell"][data-x="0"][data-y="2"]')
        .click();
      await page.getByRole("button", { name: "应用配置" }).click();
      assert.equal(await state((g) => g.blocks.length), 8);
      await page.screenshot({
        path: "artifacts/02-assembly.png",
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "关闭", exact: true })
        .first()
        .click();
    },
  );
  await check(
    "WASD is screen relative, mouse turns hull, Q/E does nothing",
    async () => {
      const pos = await state((g) => ({ x: g.x, y: g.y }));
      await page.locator("#game").focus();
      await page.keyboard.down("d");
      await page.waitForTimeout(250);
      await page.keyboard.up("d");
      assert((await state((g) => g.x)) > pos.x + 20);
      await state((g) => {
        g.aim = { x: g.x, y: g.y };
        g.angle = 0.4;
      });
      await page.keyboard.press("q");
      await page.keyboard.press("e");
      assert(Math.abs((await state((g) => g.angle)) - 0.4) < 0.001);
      const box = await page.locator("#game").boundingBox();
      await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.4);
      await page.waitForTimeout(350);
      assert(Math.abs((await state((g) => g.angle)) - 0.4) > 0.05);
    },
  );
  await check(
    "free deployment and actual left-click projectile combat",
    async () => {
      await page.getByRole("button", { name: "开始远征" }).click();
      await state((g) => {
        g.waveTimer = 999;
        g.spawn("shooter", 1050, 800);
        g.enemies[0].hp = 26;
        g.enemies[0].max = 26;
        g.enemies[0].timer = 999;
      });
      const p = await state((g, r) => ({
        x: r.ox + 1050 * r.scale,
        y: r.oy + 800 * r.scale,
      }));
      const box = await page.locator("#game").boundingBox();
      await page.mouse.move(box.x + p.x, box.y + p.y);
      await page.mouse.down();
      await page.waitForTimeout(1200);
      await page.mouse.up();
      assert((await state((g) => g.kills)) >= 1);
      await page.screenshot({
        path: "artifacts/03-combat.png",
        fullPage: true,
      });
    },
  );
  await check("pause stops simulation and settings persist", async () => {
    await page.keyboard.press("Escape");
    const t = await state((g) => g.elapsed);
    await page.waitForTimeout(250);
    assert.equal(await state((g) => g.elapsed), t);
    await page.getByRole("button", { name: /屏幕震动/ }).click();
    assert.equal(await state((g) => g.meta.settings.shake), false);
    await page.getByRole("button", { name: /继续远征/ }).click();
  });
  await check("room clearance, rewards and route exit work", async () => {
    await state((g) => {
      g.enemies = [];
      g.wave = 4;
      g.update(1 / 60);
    });
    await page.getByRole("button", { name: "选择下一间" }).waitFor();
    assert(
      (await state((g) => g.drops.filter((d) => d.type === "module").length)) >=
        1,
    );
    await page.getByRole("button", { name: "选择下一间" }).click();
    await page.getByRole("button", { name: /研究档案/ }).click();
    assert.equal(await state((g) => g.room), 1);
  });
  await check(
    "functional-room inventory build and once-only free repair",
    async () => {
      await state((g, r, ui, core) => {
        g.room = 3;
        g.enterRoom();
        g.inventory.push(core.makeBlock("gun", 0, 0, 1, 2, g.stats));
        g.blocks[0].hp = 20;
        g.changed();
      });
      await page
        .getByRole("button", { name: "组装与维修", exact: true })
        .click();
      await page.getByRole("button", { name: "免费整修", exact: true }).click();
      assert.equal(await state((g) => g.freeRepair), false);
      assert((await state((g) => g.blocks[0].hp)) > 20);
      await page
        .locator(".palette-item")
        .filter({ hasText: "速射机枪" })
        .click();
      await page
        .locator('[data-action="cell"][data-x="0"][data-y="-2"]')
        .click();
      await page.getByRole("button", { name: "应用配置" }).click();
      assert.equal(await state((g) => g.inventory.length), 0);
      await page.screenshot({
        path: "artifacts/04-workshop.png",
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "关闭", exact: true })
        .first()
        .click();
    },
  );
  await check(
    "permanent research applies next run and two passive slots are enforced",
    async () => {
      await state((g) => {
        g.room = 6;
        g.enterRoom();
        g.meta.points = 250;
        g.changed();
      });
      await page.getByRole("button", { name: "永久研究", exact: true }).click();
      const attack = await state((g) => g.stats.attack);
      await page
        .locator(".tech-card")
        .filter({ hasText: "武器校准" })
        .getByRole("button")
        .click();
      assert.equal(await state((g) => g.stats.attack), attack);
      assert.equal(await state((g) => g.meta.tech.attack), 1);
      await page.screenshot({
        path: "artifacts/05-research.png",
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "关闭", exact: true })
        .first()
        .click();
      await state((g) => {
        g.meta.passives = { siphon: 1, rage: 1, salvage: 1, repair: 0 };
        g.resetHub();
        g.equip("siphon");
        g.equip("rage");
        g.equip("salvage");
      });
      assert.equal(await state((g) => g.meta.equipped.length), 2);
      assert.equal(await state((g) => g.stats.attack), 1.12);
    },
  );
  await check(
    "death returns to hub, retains resources, starts another free run",
    async () => {
      await page.getByRole("button", { name: "开始远征" }).click();
      await state((g) => {
        g.collect({ type: "point", value: 17, x: 0, y: 0, age: 0 });
        g.collect({
          type: "blueprint",
          kind: "cannon",
          value: 1,
          x: 0,
          y: 0,
          age: 0,
        });
        g.hitBlock(g.blocks[0], 99999);
      });
      await page.getByRole("button", { name: "返回准备房" }).waitFor();
      await page.screenshot({ path: "artifacts/06-death.png", fullPage: true });
      const points = await state((g) => g.meta.points);
      await page.getByRole("button", { name: "返回准备房" }).click();
      await page.getByRole("button", { name: "开始远征" }).click();
      assert.equal(await state((g) => g.meta.points), points);
      assert.equal(await state((g) => g.panel), null);
    },
  );
  await check(
    "boss projectile kill completes a run and grants permanent reward",
    async () => {
      await state((g) => {
        g.room = 7;
        g.enterRoom();
        g.enemies[0].hp = 1;
        g.enemies[0].timer = 999;
        g.enemies[0].x = g.x;
        g.enemies[0].y = g.y - 220;
        g.aim = { x: g.x, y: g.y - 220 };
        g.firing = true;
      });
      await page
        .getByRole("button", { name: "返回准备房" })
        .waitFor({ timeout: 5000 });
      assert.equal(await state((g) => g.victory), true);
      assert.equal(await state((g) => g.meta.wins), 1);
      await page.screenshot({
        path: "artifacts/07-victory.png",
        fullPage: true,
      });
    },
  );
  await check(
    "refresh restores permanent save and discards the current run",
    async () => {
      const expected = await state((g) => ({
        points: g.meta.points,
        wins: g.meta.wins,
      }));
      await page.reload();
      await page.locator("#game").waitFor();
      assert.equal(await state((g) => g.scene), "hub");
      assert.deepEqual(
        await state((g) => ({ points: g.meta.points, wins: g.meta.wins })),
        expected,
      );
      assert.equal(await state((g) => g.meta.settings.shake), false);
    },
  );
  await check("compact desktop does not overflow", async () => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.screenshot({ path: "artifacts/08-compact.png", fullPage: true });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  });
  assert.deepEqual(errors, [], "No uncaught browser errors");
  writeFileSync(
    "artifacts/browser-report.json",
    JSON.stringify({ browser: executablePath, checks: 12, errors }, null, 2),
  );
  console.log(
    "Browser acceptance passed. Screenshots:",
    path.resolve("artifacts"),
  );
} catch (error) {
  await page.screenshot({ path: "artifacts/failure.png", fullPage: true });
  console.error("Browser errors:", errors);
  throw error;
} finally {
  await browser.close();
}
