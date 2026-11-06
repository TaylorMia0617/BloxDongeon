using Godot;
namespace BloxDungoen;

public partial class ArenaView : Control
{
    public GameModel Game = null!;
    public Font GameFont = null!;
    private float _time;
    public float ScaleFactor => MathF.Min(Size.X / 1500, Size.Y / 1000);
    public Vector2 Offset => (Size - Definitions.World * ScaleFactor) / 2;
    public Vector2 WorldMouse => (GetLocalMousePosition() - Offset) / ScaleFactor;
    public override void _Ready() { MouseFilter = MouseFilterEnum.Stop; FocusMode = FocusModeEnum.All; ClipContents = true; CustomMinimumSize = new(600, 390); }
    public override void _Process(double delta) { if (Game.Panel == "") _time += (float)delta; QueueRedraw(); }
    public override void _GuiInput(InputEvent e)
    {
        if (Game.Panel != "") return;
        if (e is InputEventMouseMotion) Game.Aim = WorldMouse;
        if (e is InputEventMouseButton { ButtonIndex: MouseButton.Left } click) { Game.Firing = click.Pressed; Game.Aim = WorldMouse; GrabFocus(); }
    }
    public static Color C(string hex, float alpha = 1) { var c = Color.FromHtml(hex); c.A = alpha; return c; }
    private void Box(float x, float y, float w, float h, string color, bool filled = true, float width = 1)
    { if (filled) DrawRect(new(x, y, w, h), C(color)); else DrawRect(new(x, y, w, h), C(color), false, width); }
    private void Line(Vector2 from, Vector2 to, string color, float width = 1) => DrawLine(from, to, C(color), width, true);
    private void Text(string text, Vector2 at, int size = 18, string color = "a4b298", bool center = false)
    { if (center) at.X -= GameFont.GetStringSize(text, fontSize: size).X / 2; DrawString(GameFont, at, text, fontSize: size, modulate: C(color)); }
    private void Ring(Vector2 at, float radius, string color, float width = 1) => DrawArc(at, radius, 0, MathF.Tau, 48, C(color), width, true);
    public override void _Draw()
    {
        if (Game == null || Size.X <= 0 || Size.Y <= 0) return;
        DrawRect(new(Vector2.Zero, Size), C("0e1711"));
        Vector2 shake = Game.Meta.Settings.Shake && Game.Shake > 0 ? new Vector2(MathF.Sin(_time * 93), MathF.Cos(_time * 71)) * Game.Shake * .5f : Vector2.Zero;
        DrawSetTransform(Offset + shake * ScaleFactor, 0, Vector2.One * ScaleFactor);
        Floor(); if (Game.InRun) Arena(); else Hangar();
        foreach (var s in Game.Stations()) Station(s);
        foreach (var d in Game.Drops)
        {
            var p = d.Position + Vector2.Down * MathF.Sin(_time * 3 + d.Position.X) * 4;
            Ring(p, d.Kind == "module" ? 24 : 14, d.Kind == "point" ? "5682a1" : "526044");
            if (d.Module != null) Module(d.Module, p, 0, .65f);
            else { string col = d.Kind == "point" ? "9cccf4" : d.Kind == "blueprint" ? "c8a3ec" : "cfb17c"; DrawColoredPolygon([p + new Vector2(0, -10), p + new Vector2(9, 0), p + new Vector2(0, 10), p + new Vector2(-9, 0)], C(col)); }
            if (d.Module != null && p.DistanceTo(Game.Position) < 140) Text(d.Module.Def.Name, p - new Vector2(0, 30), 15, Definitions.RarityColors[d.Module.Rarity], true);
        }
        foreach (var e in Game.Enemies) DrawEnemy(e);
        foreach (var b in Game.Blocks.OrderBy(b => b.Kind == "core" ? 1 : 0)) Module(b, Game.WorldBlock(b), Game.Angle);
        Text("▼", Game.Position + new Vector2(0, -63), 15, "b5f58b", true);
        foreach (var b in Game.Bullets) Line(b.Position - b.Velocity * .013f, b.Position, b.Color, b.Radius * 1.6f);
        foreach (var p in Game.Sparks) DrawRect(new(p.Position, Vector2.One * p.Size), C(p.Color, Math.Clamp(p.Life / p.Max, 0, 1)));
        if (Game.InRun && Game.Panel == "" && new Rect2(Vector2.Zero, Definitions.World).HasPoint(Game.Aim))
        {
            var p = Game.Aim; Ring(p, 10, "c4e9ab"); Line(p + Vector2.Left * 17, p + Vector2.Left * 7, "c4e9ab"); Line(p + Vector2.Right * 7, p + Vector2.Right * 17, "c4e9ab"); Line(p + Vector2.Up * 17, p + Vector2.Up * 7, "c4e9ab"); Line(p + Vector2.Down * 7, p + Vector2.Down * 17, "c4e9ab");
        }
        DrawSetTransform(Vector2.Zero);
        DrawRect(new(Vector2.Zero, Size), C("526046"), false, 1);
    }
    private void Floor()
    {
        Box(0, 0, 1500, 1000, "17211c");
        for (int x = 40; x < 1500; x += 50) DrawLine(new(x, 35), new(x, 965), C("71876b", .07f));
        for (int y = 40; y < 1000; y += 50) DrawLine(new(35, y), new(1465, y), C("71876b", .07f));
        for (int i = 0; i < 65; i++) DrawRect(new(60 + i * 271 % 1380, 50 + i * 163 % 900, 2, 2), C("566052", .2f));
        Box(34, 34, 1432, 932, "44503a", false, 2); Box(44, 44, 1412, 912, "364530", false);
        for (int i = 0; i < 18; i++) { Box(55 + i * 79, 35, 36, 7, i % 2 == 0 ? "66754a" : "574e31"); Box(55 + i * 79, 958, 36, 7, i % 2 == 0 ? "66754a" : "574e31"); }
    }
    private void Hangar()
    {
        Box(650, 80, 200, 210, "1e2b21"); for (int x = 665; x < 840; x += 22) Line(new(x, 100), new(x, 270), "384b30", 6);
        Text("BASTION / 01", new(750, 140), 22, "849773", true); Text("远 征 准 备 区", new(750, 225), 28, "c0c8ae", true);
        Ring(new(750, 610), 190, "2e4127", 2); Ring(new(750, 610), 180, "23391f");
        for (int y = 330; y < 910; y += 28) Line(new(742, y), new(758, y), "36492f");
        Text("01", new(185, 570), 100, "30442b"); Text("HANGAR", new(1110, 560), 45, "30442b");
        Text("准备好，再出发。", new(90, 100), 26, "dce6c8"); Text("死亡免费重整 · 研究与蓝图永久保留", new(90, 130), 16, "8fa17f");
        Text("FREE ASSEMBLY / WINDOWS CLIENT", new(750, 932), 16, "78876e", true);
    }
    private void Arena()
    {
        Text($"SECTOR {Game.Room + 1:00}", new(85, 98), 18, "768269"); Text(Game.CurrentRoom.Name, new(85, 135), 28, "bac4a9");
        foreach (var p in new Vector2[] { new(170, 240), new(1300, 240), new(170, 740), new(1300, 740) })
        { DrawRect(new(p - new Vector2(35, 20), new(70, 40)), C("283026")); Line(p - new Vector2(27, 12), p + new Vector2(27, 12), "465139"); Line(p + new Vector2(-27, 12), p + new Vector2(27, -12), "465139"); }
        if (!Game.Clear && Game.CurrentRoom.Kind == "battle") { Text($"WAVE {Game.Wave} / {Definitions.Waves}", new(1220, 98), 18); if (Game.Wave < Definitions.Waves) Text($"增援 {MathF.Ceiling(Game.WaveTimer)}s", new(1220, 126), 16, "77846b"); }
        if (Game.Clear && Game.CurrentRoom.Kind == "battle") { Text("区域肃清", new(750, 560), 30, "b5f58b", true); Text("拾取战利品 · 前往北侧出口", new(750, 592), 17, "8e9c80", true); }
        var boss = Game.Enemies.FirstOrDefault(e => e.Kind == "boss");
        if (boss != null) { Text("失控守门者", new(750, 70), 20, "efbd91", true); Box(500, 85, 500, 6, "0c130e"); Box(500, 85, 500 * MathF.Max(0, boss.Hp / boss.Max), 6, "dca278"); }
    }
    private void Station(Station s)
    {
        Vector2 p = s.Position; bool near = p.DistanceTo(Game.Position) < 125;
        DrawRect(new(p - new Vector2(80, 45), new(160, 90)), C("0c1410")); DrawRect(new(p - new Vector2(80, 45), new(160, 90)), C(near ? s.Color : "526149"), false, near ? 2 : 1);
        DrawRect(new(p - new Vector2(73, 38), new(146, 5)), C(s.Color, .6f));
        Text(s.Action.ToUpperInvariant(), p + new Vector2(-64, -9), 12, s.Color); Text(s.Name, p + new Vector2(-64, 16), 20, "dbe4cb");
        if (near) { Text("[ F ] 交互", p + new Vector2(0, -65), 17, s.Color, true); Ring(p, 110, "536449"); }
    }
    private void Module(Block b, Vector2 at, float rotation, float scale = 1)
    {
        float s = b.Def.Size * Definitions.Cell - 3, hp = b.Hp / Rules.MaxHp(b, Game.Stats); Color color = C(b.Def.Color);
        DrawSetTransform(Offset + at * ScaleFactor, rotation, Vector2.One * ScaleFactor * scale);
        DrawRect(new(-s / 2 + 3, -s / 2 + 5, s, s), C("000000", .25f));
        DrawRect(new(-s / 2, -s / 2, s, s), b.Flash > 0 ? C("e8f3d0") : C(b.Kind == "core" ? "8ebd65" : b.Def.Damage > 0 ? "293c2d" : "4a5c4e"));
        DrawRect(new(-s / 2, -s / 2, s, s), C(b.Rarity > 0 ? Definitions.RarityColors[b.Rarity] : b.Def.Color), false, b.Rarity > 0 ? 2 : 1);
        if (b.Kind == "core") { Box(-7, -7, 14, 14, "172715"); Box(-4, -4, 8, 8, "c9ff97"); }
        else if (b.Def.Damage == 0) for (int i = -1; i <= 1; i++) Line(new(-s / 2 + 5, i * 6), new(s / 2 - 5, i * 6), "72826c", 2);
        if (hp < .65f) { Line(new(-s / 3, -s / 2 + 2), new(1, 3), "0e1711", 2); Line(new(1, 3), new(-5, s / 2 - 2), "0e1711", 2); }
        if (b.Def.Damage > 0)
        {
            float aim = (Game.Aim - at).Angle(); DrawSetTransform(Offset + at * ScaleFactor, aim, Vector2.One * ScaleFactor * scale);
            DrawRect(new(-8, -8, 16, 16), color); DrawArc(Vector2.Zero, 10, 0, MathF.Tau, 24, C("17251d"), 2);
            DrawRect(new(0, -3, b.Def.Size == 2 ? 32 : 22, 6), color); if (b.Kind == "twin") { DrawRect(new(0, -10, 30, 5), color); DrawRect(new(0, 5, 30, 5), color); }
        }
        DrawSetTransform(Offset, 0, Vector2.One * ScaleFactor);
        if (hp < .98f) { DrawRect(new(at - new Vector2(12, 24), new(24, 3)), C("080e0a")); DrawRect(new(at - new Vector2(12, 24), new(24 * MathF.Max(0, hp), 3)), C(hp < .3f ? "ee927a" : "b5f58b")); }
    }
    private void DrawEnemy(Enemy e)
    {
        bool boss = e.Kind == "boss";
        if (e.Warn > 0)
        {
            bool charge = e.Kind == "rush" || boss && e.Phase % 3 == 2; var a = e.Position; var dir = Vector2.Right.Rotated(e.Angle); var side = dir.Orthogonal();
            DrawColoredPolygon([a, a + dir * 400 + side * (charge ? 35 : 180), a + dir * 400 - side * (charge ? 35 : 180)], C("ee9b71", .14f)); Ring(a, e.Radius + 12, "b57a52", 2);
        }
        DrawSetTransform(Offset + e.Position * ScaleFactor, (Game.Position - e.Position).Angle(), Vector2.One * ScaleFactor);
        float r = e.Radius; Box(-r, -r + 5, r * 2, r * 2, "0e120c"); Box(-r, -r, r * 2, r * 2, e.Flash > 0 ? "ffecd7" : boss ? "b07352" : e.Kind == "heavy" ? "8e8165" : "a76f60");
        Box(-r + 3, -r + 3, r * 2 - 6, r * 2 - 6, "e9b58e", false, 2); Box(-r * .4f, -r * .4f, r * .8f, r * .8f, "3a3026"); Box(0, -3, r + 12, 6, "ddae7b");
        if (boss) { Box(-35, -48, 70, 12, "362d21"); Box(-35, 36, 70, 12, "362d21"); Ring(Vector2.Zero, 26, "e6b775", 4); Box(-7, -7, 14, 14, "f2b26e"); }
        DrawSetTransform(Offset, 0, Vector2.One * ScaleFactor);
        if (e.Hp < e.Max) { DrawRect(new(e.Position - new Vector2(r, r + 12), new(r * 2, 4)), C("0a110d")); DrawRect(new(e.Position - new Vector2(r, r + 12), new(r * 2 * MathF.Max(0, e.Hp / e.Max), 4)), C("dc9c80")); }
    }
}
