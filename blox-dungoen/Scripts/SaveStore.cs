using System.Text.Json;
using Godot;
namespace BloxDungoen;

public sealed class ClientSettings { public bool Sound { get; set; } = true; public bool Shake { get; set; } = true; public bool Fullscreen { get; set; } }
public sealed class MetaProgress
{
    public int Version { get; set; } = 1;
    public int Points { get; set; }
    public List<string> Blueprints { get; set; } = ["armor", "gun"];
    public Dictionary<string, int> Tech { get; set; } = Definitions.Techs.Keys.ToDictionary(k => k, _ => 0);
    public Dictionary<string, int> Passives { get; set; } = Definitions.Passives.Keys.ToDictionary(k => k, _ => 0);
    public List<string> Equipped { get; set; } = [];
    public List<LayoutItem> Layout { get; set; } = [.. Definitions.StartingLayout];
    public int Runs { get; set; }
    public int Wins { get; set; }
    public ClientSettings Settings { get; set; } = new();
}
public sealed class SaveStore(string directory)
{
    public string PathName => System.IO.Path.Combine(directory, "progress-v1.json");
    public string? Error { get; private set; }
    public static MetaProgress Decode(string json)
    {
        var m = JsonSerializer.Deserialize<MetaProgress>(json) ?? throw new JsonException("存档内容为空");
        if (m.Version != 1) throw new JsonException("不支持的存档版本");
        m.Points = Math.Clamp(m.Points, 0, 100000000); m.Runs = Math.Max(0, m.Runs); m.Wins = Math.Max(0, m.Wins);
        m.Blueprints = (m.Blueprints ?? []).Where(Definitions.ModuleKinds.Contains).Concat(["armor", "gun"]).Distinct().ToList();
        m.Tech ??= []; m.Passives ??= [];
        foreach (var (k, d) in Definitions.Techs) m.Tech[k] = Math.Clamp(m.Tech.GetValueOrDefault(k), 0, d.Max);
        foreach (string k in Definitions.Passives.Keys) m.Passives[k] = Math.Clamp(m.Passives.GetValueOrDefault(k), 0, 3);
        m.Equipped = (m.Equipped ?? []).Where(k => Definitions.Passives.ContainsKey(k) && m.Passives[k] > 0).Distinct().Take(2).ToList();
        m.Settings ??= new();
        m.Layout = (m.Layout ?? []).Where(b => b != null && m.Blueprints.Contains(b.Kind) && b.X is >= -4 and <= 4 && b.Y is >= -4 and <= 4).Take(20).ToList();
        if (Rules.Validate(Rules.FromLayout(m.Layout, RunStats.From(m)), RunStats.From(m)) != null) m.Layout = [.. Definitions.StartingLayout];
        return m;
    }
    public MetaProgress Load()
    {
        if (!File.Exists(PathName)) return new();
        try { return Decode(File.ReadAllText(PathName)); }
        catch (Exception e) when (e is IOException or JsonException or UnauthorizedAccessException or ArgumentException)
        {
            Error = "存档异常，已尝试恢复备份";
            try { if (File.Exists(PathName + ".bak")) return Decode(File.ReadAllText(PathName + ".bak")); } catch { }
            return new();
        }
    }
    public void Save(MetaProgress meta)
    {
        try
        {
            Directory.CreateDirectory(directory);
            File.WriteAllText(PathName + ".tmp", JsonSerializer.Serialize(meta, new JsonSerializerOptions { WriteIndented = true }));
            if (File.Exists(PathName)) { try { Decode(File.ReadAllText(PathName)); File.Copy(PathName, PathName + ".bak", true); } catch (JsonException) { File.Copy(PathName, PathName + ".damaged", true); } }
            File.Move(PathName + ".tmp", PathName, true); Error = null;
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException) { Error = "无法写入存档，请检查文件夹权限"; }
    }
}
