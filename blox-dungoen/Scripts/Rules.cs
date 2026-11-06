using Godot;
namespace BloxDungoen;

public record LayoutItem(string Kind, int X, int Y);
public sealed class Block
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Kind { get; set; } = "armor";
    public int X { get; set; }
    public int Y { get; set; }
    public float Hp { get; set; }
    public int Level { get; set; } = 1;
    public int Rarity { get; set; }
    public float Cooldown { get; set; }
    public float Flash { get; set; }
    public ModuleDefinition Def => Definitions.Modules[Kind];
    public Block Copy() => (Block)MemberwiseClone();
}
public sealed class RunStats
{
    public int Count = 8, Capacity = 12, Size = 1, Luck;
    public float Hp = 1, Attack = 1, Speed = 1;
    public Dictionary<string, int> Passives = Definitions.Passives.Keys.ToDictionary(k => k, _ => 0);
    public static RunStats From(MetaProgress m) => new()
    {
        Count = 8 + 2 * m.Tech["count"],
        Capacity = 12 + 4 * m.Tech["capacity"],
        Size = m.Tech["size"] > 0 ? 2 : 1,
        Hp = 1 + .15f * m.Tech["hp"],
        Attack = 1 + .12f * m.Tech["attack"],
        Speed = 1 + .08f * m.Tech["speed"],
        Luck = m.Tech["luck"],
        Passives = Definitions.Passives.Keys.ToDictionary(k => k, k => m.Equipped.Contains(k) ? m.Passives[k] : 0)
    };
}
public static class Rules
{
    public static Block Create(string kind, RunStats s, int x = 0, int y = 0, int rarity = 0, int level = 1)
    {
        var b = new Block { Kind = kind, X = x, Y = y, Rarity = rarity, Level = level }; b.Hp = MaxHp(b, s); return b;
    }
    public static List<Block> FromLayout(IEnumerable<LayoutItem> layout, RunStats s) => [Create("core", s), .. layout.Select(p => Create(p.Kind, s, p.X, p.Y))];
    public static float MaxHp(Block b, RunStats s) => MathF.Round(b.Def.Hp * s.Hp * (1 + .3f * b.Rarity) * (b.Def.Damage > 0 ? 1 : 1 + .3f * (b.Level - 1)));
    public static float Damage(Block b, RunStats s, bool low) => b.Def.Damage * s.Attack * (1 + .3f * b.Rarity) * (1 + .3f * (b.Level - 1)) * (low ? 1 + .2f * s.Passives["rage"] : 1);
    public static Vector2 Local(Block b) => new((b.X + (b.Def.Size - 1) / 2f) * Definitions.Cell, (b.Y + (b.Def.Size - 1) / 2f) * Definitions.Cell);
    public static IEnumerable<Vector2I> Cells(Block b)
    { for (int x = 0; x < b.Def.Size; x++) for (int y = 0; y < b.Def.Size; y++) yield return new(b.X + x, b.Y + y); }
    public static int Capacity(IEnumerable<Block> blocks) => blocks.Where(b => b.Kind != "core").Sum(b => b.Def.Size * b.Def.Size);
    public static HashSet<string> Connected(IReadOnlyList<Block> blocks)
    {
        var map = new Dictionary<Vector2I, Block>(); foreach (var b in blocks) foreach (var p in Cells(b)) map[p] = b;
        var root = blocks.FirstOrDefault(b => b.Kind == "core"); var visited = new HashSet<string>(); if (root == null) return visited;
        var queue = new Queue<Block>(); queue.Enqueue(root); visited.Add(root.Id);
        Vector2I[] dirs = [Vector2I.Up, Vector2I.Down, Vector2I.Left, Vector2I.Right];
        while (queue.TryDequeue(out var b)) foreach (var p in Cells(b)) foreach (var d in dirs)
                    if (map.TryGetValue(p + d, out var next) && visited.Add(next.Id)) queue.Enqueue(next);
        return visited;
    }
    public static string? PlacementError(IReadOnlyList<Block> blocks, Block b, RunStats s)
    {
        if (b.Def.Size > s.Size && b.Kind != "core") return "先研究大型接口，才能安装大型模块";
        if (b.X < -4 || b.Y < -4 || b.X + b.Def.Size - 1 > 4 || b.Y + b.Def.Size - 1 > 4) return "模块超出 9×9 建造边界";
        var occupied = blocks.SelectMany(Cells).ToHashSet(); if (Cells(b).Any(occupied.Contains)) return "这个位置已被占用";
        if (b.Kind != "core" && blocks.Count(p => p.Kind != "core") >= s.Count) return "模块数量已达上限";
        if (b.Kind != "core" && Capacity(blocks) + b.Def.Size * b.Def.Size > s.Capacity) return "载具容量不足";
        return null;
    }
    public static string? Validate(IReadOnlyList<Block> blocks, RunStats s)
    {
        if (blocks.Count(b => b.Kind == "core") != 1 || !blocks.Any(b => b.Kind == "core" && b.X == 0 && b.Y == 0)) return "核心必须位于中央";
        var check = new List<Block>(); foreach (var b in blocks) { var e = PlacementError(check, b, s); if (e != null) return e; check.Add(b); }
        if (Connected(blocks).Count != blocks.Count) return "所有模块必须通过边相邻连接核心";
        return blocks.Any(b => b.Def.Damage > 0) ? null : "至少安装一个炮塔才能出发";
    }
    public static void RepairAll(List<Block> blocks, List<Block> inventory, List<Block> wrecks, RunStats s)
    {
        foreach (var b in blocks.Concat(inventory)) b.Hp = MaxHp(b, s);
        foreach (var b in wrecks)
        {
            if (blocks.Concat(inventory).Any(p => p.Id == b.Id)) continue;
            b.Hp = MaxHp(b, s); if (PlacementError(blocks, b, s) == null) blocks.Add(b); else inventory.Add(b);
        }
        var links = Connected(blocks); foreach (var b in blocks.Where(b => !links.Contains(b.Id)).ToArray()) { blocks.Remove(b); inventory.Add(b); }
        wrecks.Clear();
    }
    public static bool Upgrade(Block b, RunStats s)
    {
        if (b.Level >= 3 || b.Kind == "core") return false;
        float ratio = b.Hp / MaxHp(b, s); b.Level++; b.Hp = MathF.Max(1, MathF.Round(MaxHp(b, s) * ratio)); return true;
    }
    public static float Turn(float angle, float target, float step)
    { float d = MathF.Atan2(MathF.Sin(target - angle), MathF.Cos(target - angle)); return angle + Math.Clamp(d, -step, step); }
    public static float? SegmentBlock(Vector2 from, Vector2 to, Block b, Vector2 origin, float angle, float radius = 2)
    {
        Vector2 p = (from - origin).Rotated(-angle), q = (to - origin).Rotated(-angle), c = Local(b); float half = b.Def.Size * Definitions.Cell / 2f + radius, lo = 0, hi = 1;
        for (int axis = 0; axis < 2; axis++)
        {
            float start = axis == 0 ? p.X : p.Y, delta = (axis == 0 ? q.X : q.Y) - start, center = axis == 0 ? c.X : c.Y;
            if (MathF.Abs(delta) < 1e-8f) { if (start < center - half || start > center + half) return null; }
            else { float a = (center - half - start) / delta, z = (center + half - start) / delta; if (a > z) (a, z) = (z, a); lo = MathF.Max(lo, a); hi = MathF.Min(hi, z); if (lo > hi) return null; }
        }
        return lo;
    }
    public static int Cost(int level) => 18 * (level + 1);
    public static int RepairCost(RunStats s) => (int)MathF.Ceiling(30 * (1 - .15f * s.Passives["repair"]));
}
