using Godot;
namespace BloxDungoen;

public record ModuleDefinition(string Name, string Glyph, int Size, float Hp, string Color, float Damage = 0, float Interval = 0, float Speed = 0, int Pellets = 1);
public record ResearchDefinition(string Name, string Description, int Max = 3);
public record RoomDefinition(string Name, string Kind, string Description);

public static class Definitions
{
    public const int Cell = 30;
    public const int Waves = 4;
    public const float WaveDelay = 18;
    public static readonly Vector2 World = new(1500, 1000);
    public static readonly Dictionary<string, ModuleDefinition> Modules = new()
    {
        ["core"] = new("反应核心", "核", 1, 160, "b5f58b"),
        ["armor"] = new("轻型装甲", "甲", 1, 110, "8eaaa0"),
        ["plate"] = new("复合重甲", "重", 2, 480, "b1bcb0"),
        ["gun"] = new("速射机枪", "机", 1, 75, "b5f58b", 13, .19f, 720),
        ["shotgun"] = new("散射炮塔", "散", 1, 85, "efca83", 11, .8f, 560, 5),
        ["cannon"] = new("重型加农", "炮", 1, 100, "ed987c", 62, 1.05f, 600),
        ["twin"] = new("双联炮台", "双", 2, 240, "a9b8ff", 21, .24f, 740, 2)
    };
    public static readonly string[] ModuleKinds = ["armor", "plate", "gun", "shotgun", "cannon", "twin"];
    public static readonly string[] RarityNames = ["普通", "稀有", "史诗"];
    public static readonly string[] RarityColors = ["99aba0", "8cbffd", "d7a0ff"];
    public static readonly Dictionary<string, ResearchDefinition> Techs = new()
    {
        ["count"] = new("结构扩展", "模块上限 +2"),
        ["capacity"] = new("承载系统", "容量上限 +4"),
        ["size"] = new("大型接口", "解锁 2×2 模块", 1),
        ["hp"] = new("复合材料", "所有模块生命 +15%"),
        ["attack"] = new("武器校准", "炮塔伤害 +12%"),
        ["speed"] = new("矢量推进", "移动速度 +8%"),
        ["luck"] = new("寻宝雷达", "稀有与史诗掉率提高")
    };
    public static readonly Dictionary<string, ResearchDefinition> Passives = new()
    {
        ["siphon"] = new("余烬回流", "每次击杀恢复核心 2 / 4 / 6 点生命"),
        ["rage"] = new("绝境过载", "核心低于 35% 时，伤害 +20 / 40 / 60%"),
        ["salvage"] = new("精密拆解", "废料收益 +15 / 30 / 45%"),
        ["repair"] = new("维修专家", "付费维修价格降低 15 / 30 / 45%")
    };
    public static readonly RoomDefinition[] Rooms = [
        new("边缘哨站", "battle", "废弃防线仍有巡逻者。"), new("输送走廊", "battle", "选择你的补给路线。"),
        new("熔渣庭院", "battle", "穿过旧世界的残骸。"), new("流浪工坊", "workshop", "停下引擎，重新组装。"),
        new("铸铁阵地", "battle", "重装守卫正在集结。"), new("反应大厅", "battle", "堡垒深处传来轰鸣。"),
        new("档案维修站", "research", "让这次发现留给下一次远征。"), new("守门者", "boss", "摧毁失控的战争机器。")
    ];
    public static readonly LayoutItem[] StartingLayout = [new("gun", 0, -1), new("gun", -1, 0), new("armor", 1, 0), new("armor", 0, 1), new("armor", 1, -1), new("armor", -1, 1)];
}
