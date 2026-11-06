using Godot;
namespace BloxDungoen;

public partial class StructureView : Control
{
    public GameModel Game = null!;
    public override void _Ready() { CustomMinimumSize = new(81, 81); MouseFilter = MouseFilterEnum.Ignore; }
    public override void _Process(double delta) => QueueRedraw();
    public override void _Draw()
    {
        for (int y = 0; y < 9; y++) for (int x = 0; x < 9; x++) DrawRect(new(x * 9, y * 9, 8, 8), ArenaView.C("253421"), false);
        foreach (var b in Game.Wrecks.Concat(Game.Blocks))
        {
            float hp = MathF.Max(0, b.Hp / Rules.MaxHp(b, Game.Stats)); var rect = new Rect2((b.X + 4) * 9, (b.Y + 4) * 9, b.Def.Size * 9 - 1, b.Def.Size * 9 - 1);
            DrawRect(rect, ArenaView.C(hp > 0 ? b.Def.Color : "b87665", hp > 0 ? .25f + hp * .5f : .1f)); DrawRect(rect, ArenaView.C(hp > 0 ? b.Def.Color : "b87665"), false);
        }
    }
}
