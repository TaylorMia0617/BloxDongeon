using Godot;
namespace BloxDungoen;

public partial class Main : Control
{
    public GameModel Game = null!;
    public ArenaView Arena = null!;
    public Font GameFont = null!;
    private ClientUi _ui = null!;
    private bool _dirty = true;
    private float _hudTimer;
    private NativeAudio _audio = null!;
    private bool _automation;
    public override void _Ready()
    {
        SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        var args = OS.GetCmdlineUserArgs();
        _automation = args.Contains("--self-test") || args.Contains("--smoke-test");
        GameFont = new SystemFont { FontNames = ["Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI"], AllowSystemFallback = true };
        var theme = new Theme { DefaultFont = GameFont, DefaultFontSize = 15 };
        theme.SetColor("font_color", "Label", ArenaView.C("d7dfd0"));
        theme.SetColor("font_color", "Button", ArenaView.C("d7dfd0"));
        theme.SetColor("font_disabled_color", "Button", ArenaView.C("596950"));
        foreach (var (name, color) in new[] { ("normal", "222d22"), ("hover", "30402b"), ("pressed", "435b34"), ("disabled", "182119"), ("focus", "273321") })
        {
            var style = ClientUi.Style(color, name is "focus" or "hover" ? "a1c084" : "43503d", 1, 4);
            style.ContentMarginLeft = style.ContentMarginRight = 13; style.ContentMarginTop = style.ContentMarginBottom = 9;
            theme.SetStylebox(name, "Button", style);
        }
        Theme = theme;
        string directory = _automation ? System.IO.Path.Combine(ProjectSettings.GlobalizePath("res://.godot"), "acceptance-save") : ProjectSettings.GlobalizePath("user://");
        Game = new(new SaveStore(directory));
        Game.Changed = () => _dirty = true;
        _audio = new NativeAudio(); AddChild(_audio); Game.Sound = kind => { if (Game.Meta.Settings.Sound && !_automation) _audio.PlayEffect(kind); };
        _ui = new ClientUi(this); _ui.Create();
        ApplyWindowSettings();
        if (args.Contains("--self-test")) CallDeferred(nameof(RunTests));
        if (args.Contains("--smoke-test")) CallDeferred(nameof(SmokeTest));
    }
    public override void _PhysicsProcess(double delta)
    {
        if (Game == null) return;
        if (Game.Panel == "")
        {
            Game.Movement = new Vector2((Input.IsPhysicalKeyPressed(Key.D) ? 1 : 0) - (Input.IsPhysicalKeyPressed(Key.A) ? 1 : 0), (Input.IsPhysicalKeyPressed(Key.S) ? 1 : 0) - (Input.IsPhysicalKeyPressed(Key.W) ? 1 : 0));
            if (!Input.IsMouseButtonPressed(MouseButton.Left)) Game.Firing = false;
        }
        Game.Update((float)delta);
    }
    public override void _Process(double delta)
    {
        if (Game == null) return;
        if (_dirty) { _dirty = false; _ui.Refresh(); }
        _hudTimer += (float)delta; if (_hudTimer >= .12f) { _hudTimer = 0; _ui.Tick(); }
    }
    public override void _UnhandledKeyInput(InputEvent e)
    {
        if (e is not InputEventKey { Pressed: true, Echo: false } key) return;
        if (key.PhysicalKeycode == Key.F11) { Game.Meta.Settings.Fullscreen = !Game.Meta.Settings.Fullscreen; ApplyWindowSettings(); Game.Save(); }
        if (key.PhysicalKeycode == Key.Escape && Game.Panel != "result") Game.Open(Game.Panel == "" ? "pause" : "");
        if (key.PhysicalKeycode == Key.F && Game.Panel == "") Game.Interact();
    }
    public override void _Notification(int what)
    {
        if (what == NotificationApplicationFocusOut && !_automation && Game?.InRun == true && Game.Panel == "") Game.Open("pause");
        if (what == NotificationWMCloseRequest) Game?.Save();
    }
    public void ApplyWindowSettings()
    {
        if (DisplayServer.GetName() == "headless") return;
        DisplayServer.WindowSetMode(Game.Meta.Settings.Fullscreen ? DisplayServer.WindowMode.Fullscreen : DisplayServer.WindowMode.Windowed);
        DisplayServer.WindowSetVsyncMode(DisplayServer.VSyncMode.Enabled);
    }
    public void Refresh() => _dirty = true;
    public void RunTests() { int failures = SelfTests.Run(); GetTree().Quit(failures == 0 ? 0 : 1); }
    private async void SmokeTest()
    {
        try
        {
            Game.Meta = new(); Game.ReturnToHub();
            await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
            await ToSignal(RenderingServer.Singleton, RenderingServer.SignalName.FramePostDraw);
            Capture("01-hangar");
            Game.Open("build"); await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame); await ToSignal(RenderingServer.Singleton, RenderingServer.SignalName.FramePostDraw); Capture("02-assembly");
            Game.Open(""); Game.Start(); Game.SpawnWave(); Game.Aim = new(300, 250); Game.Firing = true;
            await ToSignal(GetTree().CreateTimer(1), SceneTreeTimer.SignalName.Timeout); Capture("03-combat");
            Game.Room = 3; Game.EnterRoom(); Game.Inventory.Add(Rules.Create("shotgun", Game.Stats, rarity: 1)); Game.Open("build");
            await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame); await ToSignal(RenderingServer.Singleton, RenderingServer.SignalName.FramePostDraw); Capture("04-workshop");
            Game.Meta.Points = 100; Game.Open("tech"); await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame); await ToSignal(RenderingServer.Singleton, RenderingServer.SignalName.FramePostDraw); Capture("05-research");
            Game.Open("passives"); await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame); await ToSignal(RenderingServer.Singleton, RenderingServer.SignalName.FramePostDraw); Capture("06-passives");
            Game.Open(""); Game.Room = 7; Game.EnterRoom(); await ToSignal(GetTree().CreateTimer(.5), SceneTreeTimer.SignalName.Timeout); Capture("07-boss");
            Game.Hit(Game.Blocks[0], 99999); await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame); await ToSignal(RenderingServer.Singleton, RenderingServer.SignalName.FramePostDraw); Capture("08-result");
            GD.Print("SMOKE TEST PASSED"); GetTree().Quit();
        }
        catch (Exception e) { GD.PushError(e.ToString()); GetTree().Quit(1); }
    }
    private void Capture(string name)
    {
        string dir = ProjectSettings.GlobalizePath("res://.godot/acceptance-screenshots"); Directory.CreateDirectory(dir);
        Error e = GetViewport().GetTexture().GetImage().SavePng(System.IO.Path.Combine(dir, name + ".png"));
        if (e != Error.Ok) throw new IOException("Screenshot failed: " + e);
    }
}
