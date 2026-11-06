using Godot;
namespace BloxDungoen;

public sealed class ClientUi(Main owner)
{
    private GameModel G => owner.Game;
    private VBoxContainer _sidebar = null!, _context = null!;
    private HBoxContainer _actions = null!;
    private Label _points = null!, _scrap = null!, _scene = null!, _clock = null!, _healthText = null!, _toast = null!, _save = null!;
    private ProgressBar _health = null!;
    private Control? _overlay;
    private string _lastPanel = "";
    private List<Block>? _draft, _inventory;
    private string? _choiceKind, _choiceId, _selected;
    private bool _edited;
    public static StyleBoxFlat Style(string color, string border = "34432d", int width = 1, int radius = 3) => new()
    {
        BgColor = ArenaView.C(color),
        BorderColor = ArenaView.C(border),
        BorderWidthLeft = width,
        BorderWidthRight = width,
        BorderWidthTop = width,
        BorderWidthBottom = width,
        CornerRadiusBottomLeft = radius,
        CornerRadiusBottomRight = radius,
        CornerRadiusTopLeft = radius,
        CornerRadiusTopRight = radius,
        ContentMarginLeft = 16,
        ContentMarginRight = 16,
        ContentMarginTop = 14,
        ContentMarginBottom = 14
    };
    private static void Clear(Node node) { foreach (Node child in node.GetChildren()) { node.RemoveChild(child); child.QueueFree(); } }
    private static T Expand<T>(T c) where T : Control { c.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill; return c; }
    private Label Label(Node parent, string text, int size = 14, string color = "d7dfd0")
    {
        var l = new Label { Text = text }; l.AddThemeFontSizeOverride("font_size", size); l.AddThemeColorOverride("font_color", ArenaView.C(color)); parent.AddChild(l); return l;
    }
    private Button Button(Node parent, string text, Action action, bool primary = false, bool disabled = false)
    {
        var b = new Button { Text = text, Disabled = disabled, MouseDefaultCursorShape = Control.CursorShape.PointingHand };
        if (primary) { b.AddThemeStyleboxOverride("normal", Style("b5f58b", "b5f58b")); b.AddThemeStyleboxOverride("hover", Style("cbffab", "cbffab")); b.AddThemeColorOverride("font_color", ArenaView.C("203019")); b.AddThemeColorOverride("font_hover_color", ArenaView.C("203019")); }
        b.Pressed += () => { G.Sound("click"); action(); }; parent.AddChild(b); return b;
    }
    private VBoxContainer Column(Node parent, int gap = 10)
    { var c = new VBoxContainer(); c.AddThemeConstantOverride("separation", gap); parent.AddChild(c); return c; }
    private HBoxContainer Row(Node parent, int gap = 12)
    { var c = new HBoxContainer(); c.AddThemeConstantOverride("separation", gap); parent.AddChild(c); return c; }
    private static void Rule(Node parent) => parent.AddChild(new HSeparator());
    public void Create()
    {
        var margin = new MarginContainer(); margin.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect);
        foreach (string side in new[] { "left", "right", "top", "bottom" }) margin.AddThemeConstantOverride("margin_" + side, side is "left" or "right" ? 24 : 16);
        owner.AddChild(margin); var root = Column(margin, 12);
        var header = Row(root, 30); Label(header, "▦  方块堡垒", 28, "e5ecd9"); Label(header, "BLOCK BASTION\nWINDOWS / 01", 11, "91a17d");
        header.AddChild(Expand(new Control())); _points = Label(header, "◇  永久研究点  0", 16, "acc9e7"); _scrap = Label(header, "⬡  废料  —", 16, "cfb17c");
        Button(header, "设置  ☰", () => G.Open("pause")); Rule(root);
        var body = Row(root, 22); body.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
        _sidebar = Column(body, 10); _sidebar.CustomMinimumSize = new(210, 0);
        var right = Expand(Column(body, 8)); right.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
        var top = Row(right); _scene = Label(top, "机库 · 准备区域", 13, "a1b58d"); top.AddChild(Expand(new Control())); _clock = Label(top, "SAFE ZONE", 12, "788e6c");
        owner.Arena = new ArenaView { Game = G, GameFont = owner.GameFont, SizeFlagsHorizontal = Control.SizeFlags.ExpandFill, SizeFlagsVertical = Control.SizeFlags.ExpandFill };
        right.AddChild(owner.Arena);
        var coreRow = Row(right); _healthText = Label(coreRow, "核心完整度", 12, "a1b58d");
        _health = Expand(new ProgressBar { CustomMinimumSize = new(180, 7), ShowPercentage = false, SizeFlagsVertical = Control.SizeFlags.ShrinkCenter });
        foreach (string key in new[] { "background", "fill" })
        { var style = Style(key == "background" ? "0a130c" : "b5f58b", "0a130c", 0, 0); style.ContentMarginLeft = style.ContentMarginRight = style.ContentMarginTop = style.ContentMarginBottom = 0; _health.AddThemeStyleboxOverride(key, style); }
        coreRow.AddChild(_health);
        Label(right, "[W A S D] 移动    鼠标自动转向 · 左键射击    [F] 交互    [Esc] 暂停    [F11] 全屏", 12, "829674");
        Rule(right); _context = Column(right, 6); _actions = Row(right, 8);
        var footer = Row(root); Label(footer, "BLOX DUNGOEN / NATIVE CLIENT · 0.2", 10, "627858"); footer.AddChild(Expand(new Control())); _save = Label(footer, "", 10, "829674");
        _toast = new Label { MouseFilter = Control.MouseFilterEnum.Ignore, HorizontalAlignment = HorizontalAlignment.Center, ZIndex = 100 };
        _toast.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.TopWide); _toast.OffsetTop = 100; _toast.AddThemeFontSizeOverride("font_size", 17); _toast.AddThemeColorOverride("font_color", ArenaView.C("dbffc0")); _toast.AddThemeColorOverride("font_shadow_color", Colors.Black); _toast.AddThemeConstantOverride("shadow_outline_size", 6); owner.AddChild(_toast);
        Refresh();
    }
    public void Refresh()
    {
        if (_lastPanel != G.Panel) { _draft = null; _inventory = null; _edited = false; _selected = _choiceId = _choiceKind = null; _lastPanel = G.Panel; }
        Clear(_sidebar);
        Label(_sidebar, "EXPEDITION LOG / 01", 11, "98a786");
        Label(_sidebar, G.InRun ? G.CurrentRoom.Name : "出发之前", 24);
        Label(_sidebar, G.InRun ? $"SECTOR {G.Room + 1:00} / 08" : "整备你的移动堡垒", 12, "a1b58d");
        Label(_sidebar, G.InRun ? G.CurrentRoom.Description : "研究、组装，然后深入废墟。", 11, "7e8d78"); Rule(_sidebar);
        for (int i = 0; i < Definitions.Rooms.Length; i++)
        {
            var r = Definitions.Rooms[i]; bool active = G.InRun && G.Room == i, done = G.InRun && G.Room > i;
            Label(_sidebar, $"{(done ? "✓" : active ? "▶" : (i + 1).ToString("00"))}   {r.Name}", 14, active ? "b5f58b" : done ? "a4b58a" : "71826c");
            Label(_sidebar, "       " + (r.Kind == "battle" ? "战斗区域" : r.Kind == "boss" ? "首领区域" : "安全功能房"), 10, "5f705b");
        }
        _sidebar.AddChild(new Control { SizeFlagsVertical = Control.SizeFlags.ExpandFill }); Rule(_sidebar);
        _sidebar.AddChild(new StructureView { Game = G });
        Label(_sidebar, $"模块 {G.Blocks.Count - 1} / {G.Stats.Count}     容量 {Rules.Capacity(G.Blocks)} / {G.Stats.Capacity}", 12, "abc194");
        Label(_sidebar, $"本局仓库：{G.Inventory.Count} 件模块", 12, "829674");
        Label(_sidebar, "被动：" + (G.Meta.Equipped.Count == 0 ? "尚未装配  0/2" : string.Join(" / ", G.Meta.Equipped.Select(k => Definitions.Passives[k].Name))), 11, "b6a0c6");
        _scene.Text = G.InRun ? $"区域 {G.Room + 1:00} · {G.CurrentRoom.Name}" : "机库 · 准备区域";
        Clear(_context); Clear(_actions);
        if (!G.InRun)
        {
            Label(_context, "整备指令", 11, "98a786"); Label(_context, "靠近设施按 F 交互，或使用快捷入口。死亡后免费重新出击。", 12, "829674");
            Button(_actions, "组装堡垒", () => G.Open("build")); Button(_actions, "载具科技", () => G.Open("tech")); Button(_actions, "被动协议", () => G.Open("passives")); Button(_actions, "开始远征  →", G.Start, true);
        }
        else if (G.Clear)
        {
            Label(_context, G.Functional ? "安全功能房 · 每站一次免费整修" : "区域肃清 · 收集战利品后继续深入", 13, "98a786");
            if (G.Functional) Button(_actions, "组装与维修", () => G.Open("build"));
            if (G.CurrentRoom.Kind == "research") Button(_actions, "永久研究", () => G.Open("tech"));
            Button(_actions, "选择下一间  →", () => G.Open("leave"), true);
        }
        else { Label(_context, "战斗指令", 11, "98a786"); Label(_context, "装甲拦截敌弹。转向保护缺口，靠近拾取掉落模块。", 13, "829674"); }
        DrawPanel(); Tick();
    }
    public void Tick()
    {
        _points.Text = $"◇  永久研究点  {G.Meta.Points}"; _scrap.Text = G.InRun ? $"⬡  废料  {G.Scrap}" : "⬡  废料  —";
        _clock.Text = G.InRun ? $"{(int)G.Elapsed / 60:00}:{(int)G.Elapsed % 60:00} / {G.Kills} 击破" : "HANGAR / SAFE ZONE";
        var core = G.Blocks.FirstOrDefault(b => b.Kind == "core"); float max = core == null ? 160 : Rules.MaxHp(core, G.Stats), hp = MathF.Max(0, core?.Hp ?? 0);
        _health.MaxValue = max; _health.Value = hp; _healthText.Text = $"核心完整度   {MathF.Ceiling(hp)} / {max}   ";
        _toast.Text = G.Message; _toast.Visible = G.MessageTime > 0;
        _save.Text = G.Store.Error ?? "永久进度已自动保存 · 本地 Windows 存档";
    }
    private VBoxContainer Modal(string title, string subtitle, bool wide = false)
    {
        _overlay = new Control(); _overlay.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect); owner.AddChild(_overlay);
        var shade = new ColorRect { Color = new Color(0, .02f, .01f, .88f), MouseFilter = Control.MouseFilterEnum.Stop }; shade.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect); _overlay.AddChild(shade);
        var center = new CenterContainer(); center.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect); _overlay.AddChild(center);
        var box = new PanelContainer { CustomMinimumSize = new(wide ? 1000 : 780, MathF.Min(owner.Size.Y - 80, wide ? 750 : 630)) }; box.AddThemeStyleboxOverride("panel", Style("172019", "526046", 1, 5)); center.AddChild(box);
        var column = Column(box, 14); var heading = Row(column); var titles = Expand(Column(heading, 5)); Label(titles, subtitle, 11, "98a786"); Label(titles, title, 27);
        if (G.Panel != "result") Button(heading, "关闭 ×", () => G.Open(""));
        Rule(column);
        var scroll = new ScrollContainer { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill, SizeFlagsVertical = Control.SizeFlags.ExpandFill, HorizontalScrollMode = ScrollContainer.ScrollMode.Disabled }; column.AddChild(scroll);
        var body = Expand(Column(scroll, 12)); return body;
    }
    private void DrawPanel()
    {
        if (_overlay != null) { owner.RemoveChild(_overlay); _overlay.QueueFree(); _overlay = null; }
        if (G.Panel == "") return;
        switch (G.Panel)
        {
            case "build": Build(); break;
            case "tech": Research(false); break;
            case "passives": Research(true); break;
            case "pause": Pause(); break;
            case "leave": Routes(); break;
            case "result": Result(); break;
        }
    }
    private void Research(bool passive)
    {
        var body = Modal(passive ? "被动协议" : "载具科技", passive ? "PASSIVE LOADOUT / MAX 2" : "PERMANENT RESEARCH", true);
        Label(body, $"永久研究点：◇ {G.Meta.Points}    " + (G.InRun ? "本次购买下一局生效" : passive ? "选择最多两个被动，构筑你的风格" : "研究扩展下一次出击的可能"), 14, "a1b58d");
        var grid = new GridContainer { Columns = passive ? 2 : 4, SizeFlagsHorizontal = Control.SizeFlags.ExpandFill }; grid.AddThemeConstantOverride("h_separation", 12); grid.AddThemeConstantOverride("v_separation", 12); body.AddChild(grid);
        var defs = passive ? Definitions.Passives : Definitions.Techs; var levels = passive ? G.Meta.Passives : G.Meta.Tech;
        foreach (var (key, d) in defs)
        {
            var card = new PanelContainer { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill, CustomMinimumSize = new(passive ? 440 : 215, 210) }; card.AddThemeStyleboxOverride("panel", Style("1c271d", G.Meta.Equipped.Contains(key) && passive ? "a5bf84" : "3a4933")); grid.AddChild(card);
            var col = Column(card, 10); int level = levels[key]; Label(col, $"{level} / {d.Max}", 12, passive ? "c8a3ec" : "b5f58b"); Label(col, d.Name, 19);
            var desc = Label(col, d.Description, 12, "899c7a"); desc.AutowrapMode = TextServer.AutowrapMode.WordSmart; desc.CustomMinimumSize = new(175, 45); desc.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            int price = Rules.Cost(level); Button(col, level >= d.Max ? "已完成研究" : $"{(level == 0 ? "研究" : "升级")} · ◇ {price}", () => G.Purchase(key, passive), false, level >= d.Max || G.Meta.Points < price);
            if (passive) Button(col, G.Meta.Equipped.Contains(key) ? "✓ 已装配 · 卸下" : "装配协议", () => G.Equip(key), G.Meta.Equipped.Contains(key), level == 0 || G.InRun);
        }
    }
    private void Build()
    {
        _draft ??= G.Blocks.Select(b => b.Copy()).ToList(); _inventory ??= G.Inventory.Select(b => b.Copy()).ToList();
        bool hub = !G.InRun; var body = Modal(hub ? "构筑你的堡垒" : "战地组装与维修", hub ? "ASSEMBLY / FREE LOADOUT" : "FIELD WORKSHOP", true);
        Label(body, $"模块 {_draft.Count - 1} / {G.Stats.Count}      容量 {Rules.Capacity(_draft)} / {G.Stats.Capacity}      接口 {G.Stats.Size}×{G.Stats.Size}", 13, "a1b58d");
        var row = Row(body, 25); var left = Expand(Column(row, 8));
        Label(left, "选择模块，再点击空格放置；点击已有模块可拆下。", 12, "829674");
        var grid = new GridContainer { Columns = 9, SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter }; grid.AddThemeConstantOverride("h_separation", 3); grid.AddThemeConstantOverride("v_separation", 3); left.AddChild(grid);
        var connected = Rules.Connected(_draft);
        for (int y = -4; y <= 4; y++) for (int x = -4; x <= 4; x++)
            {
                int px = x, py = y; var b = _draft.FirstOrDefault(b => Rules.Cells(b).Contains(new Vector2I(px, py))); bool anchor = b != null && b.X == px && b.Y == py;
                var button = Button(grid, anchor ? b!.Def.Glyph : "", () => Cell(px, py)); button.CustomMinimumSize = new(38, 38);
                var style = Style(b == null ? "182419" : b.Kind == "core" ? "3b562f" : "32402f", b == null ? "34432c" : !connected.Contains(b.Id) ? "d0846d" : b.Id == _selected ? "eddb9d" : b.Def.Color, b?.Id == _selected ? 2 : 1, 1);
                style.ContentMarginLeft = style.ContentMarginRight = style.ContentMarginTop = style.ContentMarginBottom = 0; button.AddThemeStyleboxOverride("normal", style);
                button.TooltipText = b == null ? $"{x},{y}" : $"{b.Def.Name} · Lv.{b.Level} · {MathF.Ceiling(b.Hp)} HP";
            }
        string? error = Rules.Validate(_draft, G.Stats); Label(left, error ?? "✓ 结构连接完整，可以出发", 12, error == null ? "b5f58b" : "e6a389");
        Label(left, _edited ? "有未应用改动；关闭会取消。请先应用再维修或升级。" : "所有模块通过边相邻连接核心；角相邻不算连接。", 11, "829674");
        var right = Column(row, 8); right.CustomMinimumSize = new(350, 0); Label(right, hub ? "已解锁蓝图 · 免费组装" : $"本局实体仓库 · {_inventory.Count} 件", 16);
        var scroll = new ScrollContainer { CustomMinimumSize = new(340, 220), SizeFlagsVertical = Control.SizeFlags.ExpandFill, HorizontalScrollMode = ScrollContainer.ScrollMode.Disabled }; right.AddChild(scroll); var palette = Expand(Column(scroll, 7));
        if (hub) foreach (string kind in G.Meta.Blueprints)
            {
                var def = Definitions.Modules[kind]; bool locked = def.Size > G.Stats.Size;
                Button(palette, $"{(_choiceKind == kind ? "▶ " : "")}{def.Glyph}  {def.Name}  {def.Size}×{def.Size}" + (locked ? " · 需大型接口" : " · 免费"), () => { _choiceKind = kind; _choiceId = null; _selected = null; owner.Refresh(); }, false, locked);
            }
        else foreach (var b in _inventory)
            {
                Button(palette, $"{(_choiceId == b.Id ? "▶ " : "")}{b.Def.Name} · {Definitions.RarityNames[b.Rarity]} · L{b.Level} · {MathF.Ceiling(b.Hp)}HP", () => { _choiceId = b.Id; _choiceKind = null; _selected = b.Id; owner.Refresh(); });
            }
        if (!hub && _inventory.Count == 0) Label(palette, "仓库还没有模块。\n战斗中靠近掉落物拾取。", 13, "829674");
        if (hub) Button(right, "恢复基础配置", () => { _draft = Rules.FromLayout(Definitions.StartingLayout, G.Stats); _edited = true; _selected = null; owner.Refresh(); });
        else
        {
            Rule(right); Label(right, $"被毁模块：{G.Wrecks.Count} 件    废料：{G.Scrap}", 12, "a1b58d");
            Button(right, G.FreeRepair ? "本站免费整修 · 恢复血量与被毁模块" : $"完整整修 · ⬡ {Rules.RepairCost(G.Stats)}", () => { _draft = null; _inventory = null; G.Repair(); }, false, _edited);
        }
        var selected = _draft.Concat(_inventory).FirstOrDefault(b => b.Id == _selected);
        if (selected != null)
        {
            Rule(body); var info = Row(body); Label(info, $"{selected.Def.Name} · Lv.{selected.Level}     {MathF.Ceiling(selected.Hp)} / {Rules.MaxHp(selected, G.Stats)} HP", 13);
            info.AddChild(Expand(new Control()));
            if (selected.Kind != "core")
            {
                Button(info, "拆下", () => { _draft.Remove(selected); if (!hub) _inventory.Add(selected); _selected = null; _edited = true; owner.Refresh(); }, false, !_draft.Contains(selected));
                if (!hub) Button(info, selected.Level >= 3 ? "已满级" : $"升级 · ⬡ {16 * selected.Level}", () => { _draft = null; _inventory = null; G.Improve(selected.Id); }, false, _edited || selected.Level >= 3 || G.Scrap < 16 * selected.Level);
            }
        }
        Rule(body); var footer = Row(body); Label(footer, "大型模块以点击位置为左上角。", 11, "829674"); footer.AddChild(Expand(new Control()));
        Button(footer, "应用配置 ✓", ApplyBuild, true, error != null);
    }
    private void Cell(int x, int y)
    {
        if (_draft == null || _inventory == null) return; var existing = _draft.FirstOrDefault(b => Rules.Cells(b).Contains(new Vector2I(x, y)));
        if (existing != null) { _selected = existing.Id; _choiceKind = _choiceId = null; owner.Refresh(); return; }
        Block? b = _choiceId != null ? _inventory.FirstOrDefault(b => b.Id == _choiceId) : _choiceKind != null ? Rules.Create(_choiceKind, G.Stats) : null;
        if (b == null) { G.Toast("先从右侧选择一个模块"); return; }
        var item = b.Copy(); item.X = x; item.Y = y; var error = Rules.PlacementError(_draft, item, G.Stats); if (error != null) { G.Toast(error); return; }
        _draft.Add(item); _inventory.RemoveAll(p => p.Id == item.Id); _selected = item.Id; if (_choiceId != null) _choiceId = null; _edited = true; owner.Refresh();
    }
    private void ApplyBuild()
    {
        if (_draft == null || _inventory == null) return; string? error = Rules.Validate(_draft, G.Stats); if (error != null) { G.Toast(error); return; }
        G.Blocks = _draft.Select(b => b.Copy()).ToList(); G.Inventory = _inventory.Select(b => b.Copy()).ToList();
        if (!G.InRun) { G.Meta.Layout = G.Blocks.Where(b => b.Kind != "core").Select(b => new LayoutItem(b.Kind, b.X, b.Y)).ToList(); G.Save(); }
        _edited = false; G.Toast("配置已应用");
    }
    private void Pause()
    {
        var body = Modal("稍作停留", "EXPEDITION PAUSED"); Label(body, "世界已经暂停。让引擎喘口气。", 16, "a1b58d");
        Button(body, "音效：" + (G.Meta.Settings.Sound ? "开启" : "关闭"), () => { G.Meta.Settings.Sound = !G.Meta.Settings.Sound; G.Save(); owner.Refresh(); });
        Button(body, "屏幕震动：" + (G.Meta.Settings.Shake ? "开启" : "关闭"), () => { G.Meta.Settings.Shake = !G.Meta.Settings.Shake; G.Save(); owner.Refresh(); });
        Button(body, "窗口模式：" + (G.Meta.Settings.Fullscreen ? "全屏" : "窗口") + "  [F11]", () => { G.Meta.Settings.Fullscreen = !G.Meta.Settings.Fullscreen; owner.ApplyWindowSettings(); G.Save(); owner.Refresh(); });
        Button(body, "继续  →", () => G.Open(""), true); if (G.InRun) Button(body, "结束远征并回城", () => G.Finish(false));
        Label(body, "已拾取的研究点和蓝图永久保留。\n当前远征不支持退出续玩。", 13, "829674");
        Button(body, "退出游戏", () => { G.Save(); owner.GetTree().Quit(); });
    }
    private void Routes()
    {
        var body = Modal("下一段旅程", "CHOOSE YOUR ROUTE"); int left = G.Drops.Count(d => d.Kind is "module" or "blueprint");
        Label(body, left > 0 ? $"还有 {left} 件模块或蓝图留在场上。离开后无法返回。" : "战利品已收好，选择接下来奖励的倾向。", 14, "e1c48d");
        Label(body, "下一站：" + Definitions.Rooms[Math.Min(G.Room + 1, 7)].Name, 21);
        Button(body, "▦ 军械补给   ·   下一战斗房额外奖励一个实体模块  →", () => G.Next("arms"), true);
        Button(body, "◇ 研究档案   ·   下一战斗房获得更多永久研究点  →", () => G.Next("research"));
        Label(body, "功能房会保留奖励倾向，直至下一次战斗。", 12, "829674");
    }
    private void Result()
    {
        var body = Modal(G.Victory ? "带着希望归来。" : "核心熄灭，远征未完。", G.Victory ? "EXPEDITION COMPLETE" : "CORE SIGNAL LOST");
        Label(body, G.Victory ? "◇" : "▦", 90, G.Victory ? "b5f58b" : "c79475").HorizontalAlignment = HorizontalAlignment.Center;
        Label(body, G.Victory ? "守门者已被摧毁。下一次，造一座更强的堡垒。" : "堡垒可以重建，发现不会丢失。下一次再向前一步。", 15, "acbd9d");
        Label(body, $"击破敌人   {G.Kills}      永久研究点   {G.Earned}      回收模块   {G.Found}", 19, "d6e3c4");
        Label(body, "永久研究点与蓝图已保留 · 回城免费重整", 14, "98a786"); Button(body, "返回准备房  →", G.ReturnToHub, true);
    }
}
