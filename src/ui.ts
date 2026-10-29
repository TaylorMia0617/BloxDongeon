import { Game } from "./game";
import {
  DEFS,
  KINDS,
  ROOMS,
  TECHS,
  PASSIVES,
  RARITY_NAMES,
  RARITY_COLORS,
  type ModuleKind,
  type TechKey,
  type PassiveKey,
} from "./data";
import {
  capacity,
  cells,
  connected,
  fromLayout,
  DEFAULT_LAYOUT,
  makeBlock,
  maxHp,
  placementError,
  repairPrice,
  techCost,
  validate,
  type Block,
} from "./core";
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const icon = (kind: ModuleKind) =>
  `<span class="module-icon" style="--module:${DEFS[kind].color}">${DEFS[kind].label}</span>`;
const fmt = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, "0");
export class UI {
  draft: { blocks: Block[]; inventory: Block[] } | null = null;
  dirty = false;
  choice: { kind?: ModuleKind; id?: string } = {};
  selected: string | null = null;
  lastPanel: string | null = null;
  constructor(public g: Game) {
    $("app").innerHTML =
      `<header class="topbar"><a class="brand" href="/" aria-label="方块堡垒"><span class="brand-mark"><i></i><i></i><i></i><i></i></span><div>方块堡垒<small>BLOCK BASTION</small></div></a><div class="edition"><span class="live-dot"></span>远征协议 <b>01</b></div><div class="top-resources"><span class="resource research"><i>◇</i><span><small>永久研究点</small><b id="points">0</b></span></span><span class="resource"><i>⬡</i><span><small>本局废料</small><b id="scrap">—</b></span></span></div><button class="menu-button" data-action="pause" aria-label="暂停与设置">☰</button></header>
    <main class="dashboard"><aside class="sidebar"><div class="sidebar-heading"><span class="eyebrow">EXPEDITION LOG</span><span class="tiny">/ 01</span></div><div id="sector"></div><div class="section-label">远征路线 <span>ROUTE</span></div><div id="route"></div><div class="sidebar-bottom"><div class="section-label">载具状态</div><div id="structure"></div><div id="passive-summary"></div><p class="motto">把残骸，拼成下一次希望。</p></div></aside><section class="game-column"><div class="viewport-top"><span><i class="live-dot"></i><b id="scene-title">机库 · 准备区域</b></span><span id="clock">HANGAR / SAFE ZONE</span></div><div class="viewport" id="viewport"><canvas id="game" tabindex="0" aria-label="方块堡垒游戏画面：WASD移动，鼠标转向，左键射击，F交互"></canvas><div id="scene-overlay"></div><div class="toast" id="toast" role="status"></div><div class="core-hud"><span>核心完整度 <b id="core-number">160 / 160</b></span><div class="health-track"><div id="core-health"></div></div></div><div class="arena-label" id="arena-label">B-01 / HANGAR</div></div><div class="bottom-bar"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移动</span><span><span class="mouse-icon">↗</span> 鼠标转向 · 左键射击</span><span><kbd>F</kbd> 交互</span><span><kbd>ESC</kbd> 暂停</span><span class="engine-label">CUSTOM BUILT · NO ENGINE</span></div><div id="context" class="context"></div></section></main><div id="modal-root"></div><footer class="footer"><span>BLOCK BASTION <b>·</b> EARLY EXPEDITION / 0.1</span><span id="save-status">永久进度自动保存于此浏览器 <i class="live-dot"></i></span></footer>`;
    document.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-action]",
      );
      if (btn && !btn.hasAttribute("disabled"))
        this.action(btn.dataset.action!, btn.dataset);
    });
    g.onChange = () => this.render();
    this.render();
  }
  render() {
    const g = this.g;
    if (this.lastPanel !== g.panel) {
      this.draft = null;
      this.dirty = false;
      this.choice = {};
      this.selected = null;
      this.lastPanel = g.panel;
    }
    $("sector").innerHTML =
      g.scene === "hub"
        ? `<h1>出发之前<span>整备你的移动堡垒</span></h1><p>研究、组装，然后深入废墟。<br>每一次发现，都将留下痕迹。</p>`
        : `<h1>${ROOMS[g.room].name}<span>SECTOR ${fmt(g.room + 1)} / 08</span></h1><p>${ROOMS[g.room].description}</p>`;
    $("route").innerHTML = ROOMS.map(
      (r, i) =>
        `<div class="route-item ${g.scene === "run" ? (i === g.room ? "current" : i < g.room ? "done" : "") : i === 0 ? "next" : ""}"><span class="route-node">${g.scene === "run" && i < g.room ? "✓" : r.kind === "boss" ? "◆" : r.kind === "battle" ? fmt(i + 1) : "＋"}</span><div>${r.name}<small>${r.kind === "battle" ? "战斗区域" : r.kind === "boss" ? "首领区域" : r.kind === "workshop" ? "组装 / 免费维修" : "永久研究 / 免费维修"}</small></div>${g.scene === "run" && i === g.room ? '<span class="route-arrow">←</span>' : ""}</div>`,
    ).join("");
    $("structure").innerHTML =
      `<div class="structure-overview"><div id="structure-map" class="structure-map" aria-label="载具结构与损伤图"></div><div class="structure-numbers"><div class="stat-line"><span>模块</span><b>${g.blocks.length - 1}<em> / ${g.stats.count}</em></b></div><div class="stat-line"><span>容量</span><b>${capacity(g.blocks)}<em> / ${g.stats.capacity}</em></b></div><div class="stat-line"><span>仓库</span><b>${g.inventory.length}<em> 件</em></b></div></div></div>`;
    $("passive-summary").innerHTML = `<div class="passive-slots">${[0, 1]
      .map((i) => {
        const k = g.meta.equipped[i];
        return `<span title="${k ? PASSIVES[k].description : "在被动终端装备"}">${k ? PASSIVES[k].icon : "＋"}<small>${k ? PASSIVES[k].name : "未装配"}</small></span>`;
      })
      .join("")}</div>`;
    $("scene-title").textContent =
      g.scene === "hub"
        ? "机库 · 准备区域"
        : `区域 ${fmt(g.room + 1)} · ${ROOMS[g.room].name}`;
    $("arena-label").textContent =
      g.scene === "hub"
        ? "B-01 / HANGAR"
        : g.clear
          ? "SECTOR CLEAR / 区域安全"
          : "LIVE COMBAT / 战斗中";
    $("scene-overlay").innerHTML =
      g.scene === "hub"
        ? `<div class="hangar-badge"><span class="eyebrow">YOUR NEXT EXPEDITION</span><strong>准备好，再出发。</strong><span>死亡无需维修费 · 蓝图与研究点永久保留</span></div>`
        : "";
    $("context").innerHTML =
      g.scene === "hub"
        ? `<div><span class="eyebrow">整备指令</span><p>靠近终端按 <kbd>F</kbd>，或使用快捷入口。免费组装已解锁的模块。</p></div><div class="context-actions"><button data-action="build">组装堡垒 <span>↗</span></button><button data-action="tech">科技树</button><button class="primary" data-action="start">开始远征 <span>→</span></button></div>`
        : g.clear
          ? `<div><span class="eyebrow">${ROOMS[g.room].kind === "battle" ? "区域已肃清" : "安全功能房"}</span><p>${ROOMS[g.room].kind === "battle" ? "靠近拾取战利品，再从北侧出口继续深入。" : "本站提供一次免费整修；永久研究从下一局生效。"}</p></div><div class="context-actions">${ROOMS[g.room].kind !== "battle" ? '<button data-action="build">组装与维修</button>' : ""}${ROOMS[g.room].kind === "research" ? '<button data-action="tech">永久研究</button>' : ""}<button class="primary" data-action="exit">选择下一间 →</button></div>`
          : `<div><span class="eyebrow">战斗指令</span><p>装甲会挡住敌弹。转向保护缺口，靠近回收脱落部件。</p></div><div class="combat-note"><span class="live-dot"></span> ${ROOMS[g.room].kind === "boss" ? "首领信号已锁定" : "清理敌人以解锁出口"}</div>`;
    if (g.panel) this.renderPanel();
    else $("modal-root").innerHTML = "";
    this.tick();
  }
  tick() {
    const g = this.g;
    $("points").textContent = String(g.meta.points);
    $("scrap").textContent = g.scene === "run" ? String(g.scrap) : "—";
    $("clock").textContent =
      g.scene === "hub"
        ? "HANGAR / SAFE ZONE"
        : `${fmt(g.elapsed / 60)}:${fmt(g.elapsed % 60)} / ${g.kills} 击破`;
    const core = g.blocks.find((b) => b.kind === "core"),
      max = core ? maxHp(core, g.stats) : 160,
      hp = Math.max(0, core?.hp ?? 0);
    $("core-number").textContent = `${Math.ceil(hp)} / ${max}`;
    $("core-health").style.width = `${(hp / max) * 100}%`;
    $("core-health").style.background = hp / max < 0.35 ? "#ee927a" : "#b5f58b";
    $("structure-map").innerHTML = [...g.destroyed, ...g.blocks]
      .map((b) => {
        const size = DEFS[b.kind].size;
        const ratio = Math.max(0, b.hp / maxHp(b, g.stats));
        return `<span title="${DEFS[b.kind].name}: ${Math.ceil(Math.max(0, b.hp))} HP" style="left:${(b.x + 4) * 9}px;top:${(b.y + 4) * 9}px;width:${size * 9 - 1}px;height:${size * 9 - 1}px;border-color:${ratio ? DEFS[b.kind].color : "#b87665"};background:${ratio ? DEFS[b.kind].color + (ratio < 0.35 ? "25" : "80") : "#b8766515"}"></span>`;
      })
      .join("");
    $("toast").textContent = g.message;
    $("toast").classList.toggle("visible", g.messageTime > 0);
    $("save-status").textContent = g.saveError
      ? "存档不可用：请允许浏览器本地存储"
      : "永久进度自动保存于此浏览器";
  }
  frame(title: string, subtitle: string, body: string, wide = false) {
    return `<div class="modal-backdrop"><section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${title}"><div class="modal-heading"><div><span class="eyebrow">${subtitle}</span><h2>${title}</h2></div>${this.g.panel === "result" ? "" : `<button class="close-button" data-action="close" aria-label="关闭">×</button>`}</div>${body}</section></div>`;
  }
  renderPanel() {
    const g = this.g;
    let html = "";
    if (g.panel === "build") html = this.buildPanel();
    if (g.panel === "tech")
      html = this.frame(
        "载具科技",
        "PERMANENT RESEARCH",
        `<p class="panel-note">永久提升载具性能。${g.scene === "run" ? "本次购买将在下一局生效。" : "升级后可立即用于下次出击。"}<b class="points-tag">◇ ${g.meta.points}</b></p><div class="tech-grid">${(
          Object.keys(TECHS) as TechKey[]
        )
          .map((k) => {
            const t = TECHS[k],
              l = g.meta.tech[k],
              full = l >= t.max,
              cost = techCost(l);
            return `<article class="tech-card"><div class="tech-icon">${{ count: "⊞", capacity: "▦", size: "⛶", hp: "✚", attack: "⌖", speed: "↗", luck: "◇" }[k]}</div><span class="level">${l} / ${t.max}</span><h3>${t.name}</h3><p>${t.description}</p><div class="pips">${Array.from({ length: t.max }, (_, i) => `<i class="${i < l ? "filled" : ""}"></i>`).join("")}</div><button data-action="purchase" data-key="${k}" ${full || g.meta.points < cost ? "disabled" : ""}>${full ? "已完成研究" : `研究 · ◇ ${cost}`}</button></article>`;
          })
          .join("")}</div>`,
      );
    if (g.panel === "passives")
      html = this.frame(
        "被动协议",
        "PASSIVE LOADOUT",
        `<p class="panel-note">选择最多两个被动，构筑你的战斗风格。<b class="points-tag">◇ ${g.meta.points} · ${g.meta.equipped.length} / 2 装配</b></p><div class="tech-grid passive-grid">${(
          Object.keys(PASSIVES) as PassiveKey[]
        )
          .map((k) => {
            const p = PASSIVES[k],
              l = g.meta.passives[k],
              eq = g.meta.equipped.includes(k),
              cost = techCost(l);
            return `<article class="tech-card ${eq ? "equipped" : ""}"><div class="tech-icon purple">${p.icon}</div><span class="level">Lv. ${l} / 3</span><h3>${p.name}</h3><p>${p.description}</p><button data-action="passive-buy" data-key="${k}" ${l >= 3 || g.meta.points < cost ? "disabled" : ""}>${l >= 3 ? "已满级" : `${l ? "升级" : "解锁"} · ◇ ${cost}`}</button><button class="${eq ? "primary" : ""}" data-action="equip" data-key="${k}" ${!l ? "disabled" : ""}>${eq ? "✓ 已装配 · 点击卸下" : "装配协议"}</button></article>`;
          })
          .join("")}</div>`,
      );
    if (g.panel === "pause")
      html = this.frame(
        "稍作停留",
        "EXPEDITION PAUSED",
        `<p class="panel-note">让引擎喘口气。世界已经暂停。</p><div class="settings"><button data-action="sound">音效 <b>${g.meta.settings.sound ? "开启" : "关闭"}</b></button><button data-action="shake">屏幕震动 <b>${g.meta.settings.shake ? "开启" : "关闭"}</b></button></div><div class="modal-actions"><button class="primary" data-action="close">继续${g.scene === "hub" ? "整备" : "远征"} →</button>${g.scene === "run" ? '<button data-action="abandon">结束远征并回城</button>' : ""}</div><p class="subtle">已拾取的研究点和蓝图会保留。当前局不支持刷新续玩。</p>`,
      );
    if (g.panel === "result")
      html = this.frame(
        g.victory ? "带着希望归来。" : "核心熄灭，远征未完。",
        g.victory ? "EXPEDITION COMPLETE" : "CORE SIGNAL LOST",
        `<div class="result-symbol ${g.victory ? "win" : ""}">${g.victory ? "◇" : "⊞"}</div><p class="result-copy">${g.victory ? "守门者已被摧毁。下一次，造一座更强的堡垒。" : "堡垒可以重建，发现不会丢失。下一次再向前一步。"}</p><div class="result-stats"><span><b>${g.kills}</b>击破敌人</span><span><b>${g.earned}</b>永久研究点</span><span><b>${g.found}</b>回收模块</span></div><p class="panel-note">永久研究点与蓝图已保留 · 回城免费重整</p><button class="primary full" data-action="return">返回准备房 →</button>`,
      );
    if (g.panel === "leave") {
      const left = g.drops.filter(
        (d) => d.type === "module" || d.type === "blueprint",
      ).length;
      html = this.frame(
        "下一段旅程",
        "CHOOSE YOUR ROUTE",
        `<p class="panel-note">${left ? `还有 ${left} 件模块或蓝图留在场上。离开后无法返回。` : "战利品已收好，选择接下来的奖励倾向。"}</p><div class="route-choices"><button data-action="next-arms"><span>⊞</span><h3>军械补给</h3><p>下一战斗房额外奖励一个实体模块</p><b>继续深入 →</b></button><button data-action="next-research"><span>◇</span><h3>研究档案</h3><p>下一战斗房获得更多永久研究点</p><b>继续深入 →</b></button></div><p class="subtle">下一站：${ROOMS[Math.min(g.room + 1, 7)].name}。功能房会保留所选倾向至下一次战斗。</p>`,
      );
    }
    $("modal-root").innerHTML = html;
  }
  buildPanel() {
    const g = this.g,
      hub = g.scene === "hub";
    if (!this.draft)
      this.draft = {
        blocks: structuredClone(g.blocks),
        inventory: structuredClone(g.inventory),
      };
    const d = this.draft,
      s = g.stats;
    const links = connected(d.blocks),
      error = validate(d.blocks, s);
    const chosen = [...d.blocks, ...d.inventory].find(
      (b) => b.id === this.selected,
    );
    const grid = Array.from({ length: 81 }, (_, i) => {
      const x = (i % 9) - 4,
        y = Math.floor(i / 9) - 4,
        b = d.blocks.find((b) => cells(b).includes(`${x},${y}`));
      const anchor = b && b.x === x && b.y === y;
      return `<button class="grid-cell ${b ? "occupied" : ""} ${b?.id === this.selected ? "selected" : ""} ${b && !links.has(b.id) ? "disconnected" : ""} ${x === 0 && y === 0 ? "core-cell" : ""}" style="${b ? `--block:${DEFS[b.kind].color};--rarity:${RARITY_COLORS[b.rarity]}` : ""}" data-action="cell" data-x="${x}" data-y="${y}" aria-label="${x},${y}${b ? " " + DEFS[b.kind].name : ""}">${anchor ? `<span>${DEFS[b!.kind].label}</span><small>${b!.kind === "core" ? "CORE" : `L${b!.level}`}</small>` : ""}</button>`;
    }).join("");
    const palette = hub
      ? g.meta.blueprints.map((kind) => ({ kind, id: undefined }))
      : d.inventory.map((b) => ({ kind: b.kind, id: b.id }));
    return this.frame(
      hub ? "构筑你的堡垒" : "战地组装与维修",
      hub ? "ASSEMBLY / FREE LOADOUT" : "FIELD WORKSHOP",
      `<div class="build-layout"><div class="build-main"><div class="build-stats"><span>模块 <b>${d.blocks.length - 1} / ${s.count}</b></span><span>容量 <b>${capacity(d.blocks)} / ${s.capacity}</b></span><span>规格 <b>${s.size}×${s.size}</b></span></div><div class="grid-wrap"><div class="grid-axis">← 装甲护翼 · 核心固定中央 · 炮口默认朝上 →</div><div class="build-grid">${grid}</div></div><div class="build-feedback ${error ? "error" : ""}">${error ?? "✓ 结构连接完整，可以出发"}${this.dirty ? " · 有未应用改动" : ""}</div><p class="subtle">选择右侧模块，再点击空格放置。点击已安装模块可查看、拆下。大模块以点击位置为左上角。</p></div><aside class="build-palette"><div class="palette-title">${hub ? "已解锁蓝图" : "本局实体仓库"} <span>${hub ? "免费组装" : `${d.inventory.length} 件`}</span></div><div class="palette-items">${
        palette.length
          ? palette
              .map(({ kind, id }) => {
                const b = id ? d.inventory.find((b) => b.id === id) : null,
                  locked = DEFS[kind].size > s.size,
                  active = id
                    ? this.choice.id === id
                    : this.choice.kind === kind;
                return `<button class="palette-item ${active ? "active" : ""}" data-action="choose" data-kind="${kind}" ${id ? `data-id="${id}"` : ""} ${locked ? "disabled" : ""}>${icon(kind)}<span>${DEFS[kind].name}<small>${DEFS[kind].size}×${DEFS[kind].size} · ${b ? `${RARITY_NAMES[b.rarity]} · Lv.${b.level} · ${Math.ceil(b.hp)} HP` : locked ? "需大型接口科技" : "普通 · 免费"}</small></span></button>`;
              })
              .join("")
          : '<p class="empty-inventory">仓库还没有模块。<br>战斗中靠近掉落物拾取。</p>'
      }</div>${hub ? '<button class="full" data-action="reset-layout">恢复基础配置</button>' : `<div class="repair-box"><span>维修服务 <b>${g.freeRepair ? "本站免费 1 次" : `⬡ ${repairPrice(s)}`}</b></span><p>补满血量，恢复本局被毁模块。<br>被毁 ${g.destroyed.length} 件 · 废料 ${g.scrap}</p><button class="full" data-action="repair" ${this.dirty ? "disabled" : ""}>${g.freeRepair ? "免费整修" : "消耗废料整修"}</button>${this.dirty ? "<small>请先应用配置，再整修或升级</small>" : ""}</div>`}</aside></div>${chosen ? `<div class="selected-detail">${icon(chosen.kind)}<div><b>${DEFS[chosen.kind].name} · Lv.${chosen.level}</b><small>${DEFS[chosen.kind].description}　${Math.ceil(chosen.hp)} / ${maxHp(chosen, s)} HP</small></div>${chosen.kind !== "core" ? `<button data-action="remove" data-id="${chosen.id}" ${!d.blocks.some((b) => b.id === chosen.id) ? "disabled" : ""}>拆下</button>${!hub ? `<button data-action="upgrade" data-id="${chosen.id}" ${this.dirty || chosen.level >= 3 || g.scrap < 16 * chosen.level ? "disabled" : ""}>${chosen.level >= 3 ? "已满级" : `升级 · ⬡ ${16 * chosen.level}`}</button>` : ""}` : ""}</div>` : ""}<div class="modal-actions"><button data-action="close">${this.dirty ? "取消改动" : "关闭"}</button><button class="primary" data-action="apply-build" ${error ? "disabled" : ""}>应用配置 ✓</button></div>`,
      true,
    );
  }
  action(action: string, data: DOMStringMap) {
    const g = this.g;
    if (action === "close") {
      g.open(null);
      return;
    }
    if (action === "pause") {
      if (!g.panel) g.open("pause");
      return;
    }
    if (action === "start") {
      g.start();
      return;
    }
    if (["build", "tech", "passives"].includes(action)) {
      if (
        g.scene === "run" &&
        (!g.clear || !["workshop", "research"].includes(ROOMS[g.room].kind))
      )
        return;
      g.open(action as "build" | "tech" | "passives");
      return;
    }
    if (action === "exit") {
      if (g.clear) g.open("leave");
      return;
    }
    if (action === "next-arms" || action === "next-research") {
      g.next(action === "next-arms" ? "arms" : "research");
      return;
    }
    if (action === "return") {
      g.resetHub();
      return;
    }
    if (action === "abandon") {
      g.finish(false);
      return;
    }
    if (action === "sound" || action === "shake") {
      g.meta.settings[action] = !g.meta.settings[action];
      g.save();
      g.changed();
      return;
    }
    if (action === "purchase") {
      g.purchase(data.key as TechKey);
      return;
    }
    if (action === "passive-buy") {
      g.buyPassive(data.key as PassiveKey);
      return;
    }
    if (action === "equip") {
      g.equip(data.key as PassiveKey);
      return;
    }
    if (action === "repair") {
      if (this.dirty) return;
      this.draft = null;
      g.repair();
      return;
    }
    if (action === "upgrade") {
      if (this.dirty) return;
      this.draft = null;
      g.improve(data.id!);
      return;
    }
    if (!this.draft) return;
    const d = this.draft;
    if (action === "reset-layout") {
      d.blocks = fromLayout(DEFAULT_LAYOUT, g.stats);
      this.dirty = true;
      this.selected = null;
    }
    if (action === "choose") {
      this.choice = data.id
        ? { id: data.id }
        : { kind: data.kind as ModuleKind };
      this.selected = data.id ?? null;
    }
    if (action === "cell") {
      const x = Number(data.x),
        y = Number(data.y);
      const existing = d.blocks.find((b) => cells(b).includes(`${x},${y}`));
      if (existing) {
        this.selected = existing.id;
        this.choice = {};
      } else {
        let b: Block | undefined;
        if (this.choice.id)
          b = d.inventory.find((b) => b.id === this.choice.id);
        else if (this.choice.kind)
          b = makeBlock(this.choice.kind, x, y, 0, 1, g.stats);
        if (!b) {
          g.toast("先从右侧选择一个模块");
          return;
        }
        const item = { ...b, x, y };
        const err = placementError(d.blocks, item, g.stats);
        if (err) {
          g.toast(err);
          return;
        }
        d.blocks.push(item);
        d.inventory = d.inventory.filter((a) => a.id !== b!.id);
        this.selected = item.id;
        if (this.choice.id) this.choice = {};
        this.dirty = true;
      }
    }
    if (action === "remove") {
      const b = d.blocks.find((b) => b.id === data.id);
      if (b && b.kind !== "core") {
        d.blocks = d.blocks.filter((a) => a.id !== b.id);
        if (g.scene === "run") d.inventory.push(b);
        this.dirty = true;
        this.selected = null;
      }
    }
    if (action === "apply-build") {
      const err = validate(d.blocks, g.stats);
      if (err) {
        g.toast(err);
        return;
      }
      g.blocks = structuredClone(d.blocks);
      g.inventory = structuredClone(d.inventory);
      if (g.scene === "hub") {
        g.meta.layout = g.blocks
          .filter((b) => b.kind !== "core")
          .map(({ kind, x, y }) => ({ kind, x, y }));
        g.save();
      }
      this.dirty = false;
      g.toast("配置已应用");
      return;
    }
    this.renderPanel();
  }
}
