import "./style.css";
import { Game } from "./game";
import { UI } from "./ui";
import { Renderer } from "./render";
import { AudioSystem } from "./audio";
export const game = new Game();
export const ui = new UI(game);
const canvas = document.getElementById("game") as HTMLCanvasElement;
export const renderer = new Renderer(canvas, game);
// Expose the actual mounted instance only for opt-in development acceptance tests.
// Importing the entrypoint from a test after Vite HMR could initialize a second app.
if (import.meta.env.DEV && new URLSearchParams(location.search).has("test")) {
  Object.assign(window, { __bastion: { game, renderer, ui } });
}
const audio = new AudioSystem();
game.effect = (type) => {
  if (game.meta.settings.sound) audio.play(type);
};
window.addEventListener("pointerdown", () => audio.unlock(), { once: true });
canvas.addEventListener("pointermove", (e) => {
  game.aim = renderer.pointer(e.clientX, e.clientY);
});
canvas.addEventListener("pointerdown", (e) => {
  if (e.button === 0 && !game.panel) {
    canvas.focus();
    game.aim = renderer.pointer(e.clientX, e.clientY);
    game.firing = true;
  }
});
window.addEventListener("pointerup", () => (game.firing = false));
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (["w", "a", "s", "d", "f", "escape"].includes(key)) e.preventDefault();
  if (e.repeat) return;
  if (key === "escape") {
    if (game.panel === "result") return;
    game.open(game.panel ? null : "pause");
    return;
  }
  if (game.panel) return;
  if (key === "f") game.interact();
  else if (["w", "a", "s", "d"].includes(key)) game.keys.add(key);
});
window.addEventListener("keyup", (e) => game.keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => {
  game.keys.clear();
  game.firing = false;
  if (game.scene === "run" && !game.panel) game.open("pause");
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    game.keys.clear();
    game.firing = false;
    if (game.scene === "run" && !game.panel) game.open("pause");
  }
});
let last = performance.now(),
  accumulator = 0,
  hud = 0;
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.08);
  last = now;
  accumulator += dt;
  while (accumulator >= 1 / 60) {
    game.update(1 / 60);
    accumulator -= 1 / 60;
  }
  renderer.draw(dt);
  hud += dt;
  if (hud > 0.15) {
    ui.tick();
    hud = 0;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
