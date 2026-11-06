using Godot;
namespace BloxDungoen;

public sealed class Enemy
{
    public string Kind = "rush";
    public Vector2 Position;
    public float Hp, Max, Radius, Timer, Warn, Charge, Angle, Flash;
    public int Phase;
}
public sealed class Bullet
{
    public Vector2 Position, Velocity;
    public float Damage, Life, Radius;
    public bool Hostile;
    public string Color = "b5f58b";
}
public sealed class Loot
{
    public Vector2 Position;
    public string Kind = "scrap", Blueprint = "armor";
    public Block? Module;
    public int Value;
    public float Age;
}
public sealed class Spark
{
    public Vector2 Position, Velocity;
    public float Life, Max, Size;
    public string Color = "b5f58b";
}
public record Station(Vector2 Position, string Name, string Action, string Color);

public sealed class GameModel
{
    public readonly SaveStore Store;
    public MetaProgress Meta;
    public RunStats Stats;
    public bool InRun, Clear, FreeRepair, Victory;
    public string Panel = "", Route = "arms", Message = "";
    public Vector2 Position = new(750, 650), Aim = new(750, 300), Movement;
    public float Angle, Elapsed, RoomElapsed, WaveTimer, ContactCooldown, Shake, MessageTime;
    public int Room, Wave, Scrap, Kills, Earned, Found;
    public bool Firing;
    public List<Block> Blocks = [], Inventory = [], Wrecks = [];
    public readonly List<Enemy> Enemies = [];
    public readonly List<Bullet> Bullets = [];
    public readonly List<Loot> Drops = [];
    public readonly List<Spark> Sparks = [];
    public Action Changed = () => { };
    public Action<string> Sound = _ => { };
    public readonly Random Random;
    public RoomDefinition CurrentRoom => Definitions.Rooms[Room];
    public bool Functional => InRun && Clear && CurrentRoom.Kind is "workshop" or "research";
    public GameModel(SaveStore store, int? seed = null)
    {
        Store = store; Random = seed.HasValue ? new Random(seed.Value) : new Random(); Meta = store.Load(); Stats = RunStats.From(Meta); ReturnToHub();
    }
    public float Rand() => Random.NextSingle();
    public void Save() => Store.Save(Meta);
    public void Toast(string text) { Message = text; MessageTime = 4; Changed(); }
    public void Open(string panel) { Panel = panel; Firing = false; Movement = Vector2.Zero; Changed(); }
    public void ReturnToHub()
    {
        InRun = false; Panel = ""; Stats = RunStats.From(Meta); Blocks = Rules.FromLayout(Meta.Layout, Stats);
        if (Rules.Validate(Blocks, Stats) != null) Blocks = Rules.FromLayout(Definitions.StartingLayout, Stats);
        Inventory.Clear(); Wrecks.Clear(); Enemies.Clear(); Bullets.Clear(); Drops.Clear(); Sparks.Clear();
        Position = new(750, 650); Angle = 0; Aim = Position + Vector2.Up * 200; Firing = false; Clear = false; Changed();
    }
    public void Start()
    {
        var error = Rules.Validate(Blocks, Stats); if (error != null) { Toast(error); return; }
        Meta.Layout = Blocks.Where(b => b.Kind != "core").Select(b => new LayoutItem(b.Kind, b.X, b.Y)).ToList();
        Meta.Runs++; Save(); InRun = true; Stats = RunStats.From(Meta); Blocks = Rules.FromLayout(Meta.Layout, Stats);
        Inventory.Clear(); Wrecks.Clear(); Panel = ""; Room = 0; Scrap = Kills = Earned = Found = 0; Elapsed = 0; Victory = false; Route = "arms";
        EnterRoom(); Toast("远征开始 · 保护核心，带回新的发现");
    }
    public void EnterRoom()
    {
        Position = new(750, 800); Angle = 0; Aim = new(750, 200); Movement = Vector2.Zero; Firing = false;
        Enemies.Clear(); Bullets.Clear(); Drops.Clear(); Sparks.Clear(); Wave = 0; WaveTimer = 1.4f; RoomElapsed = 0; ContactCooldown = 1.5f;
        Clear = CurrentRoom.Kind is "workshop" or "research"; FreeRepair = Clear;
        if (CurrentRoom.Kind == "boss") { Spawn("boss", new(750, 240)); Wave = 1; }
        Changed();
    }
    public void Next(string route)
    {
        if (!Clear || Room >= 7) return; Route = route; Room++; Panel = ""; EnterRoom();
    }
    public void Finish(bool victory)
    {
        if (Panel == "result") return; Victory = victory;
        if (victory) { Meta.Wins++; Meta.Points += 40; Earned += 40; Save(); }
        Panel = "result"; Firing = false; Bullets.Clear(); Sound(victory ? "collect" : "explode"); Changed();
    }
    public List<Station> Stations()
    {
        if (!InRun) return [new(new(430, 390), "组装工作台", "build", "b5f58b"), new(new(1050, 390), "载具科技", "tech", "8ebcf2"), new(new(430, 740), "被动终端", "passives", "c8a3ec"), new(new(1050, 740), "开始远征", "start", "edc78a")];
        if (!Clear) return [];
        List<Station> stations = [new(new(750, 125), "下一间", "leave", "b5f58b")];
        if (Functional) stations.Add(new(new(540, 500), "组装与维修", "build", "b5f58b"));
        if (CurrentRoom.Kind == "research") stations.Add(new(new(960, 500), "永久研究", "tech", "8ebcf2"));
        return stations;
    }
    public void Interact()
    {
        if (Panel != "") return;
        var station = Stations().FirstOrDefault(s => s.Position.DistanceTo(Position) < 125);
        if (station == null) { Toast("靠近设施或出口，按 F 交互"); return; }
        if (station.Action == "start") Start(); else Open(station.Action);
    }
    public void Purchase(string key, bool passive = false)
    {
        var defs = passive ? Definitions.Passives : Definitions.Techs; if (!defs.TryGetValue(key, out var d)) return;
        var levels = passive ? Meta.Passives : Meta.Tech; int level = levels[key], price = Rules.Cost(level);
        if (level >= d.Max || Meta.Points < price) return;
        Meta.Points -= price; levels[key]++; Save();
        if (!InRun) { Stats = RunStats.From(Meta); foreach (var b in Blocks) b.Hp = Rules.MaxHp(b, Stats); }
        Sound("click"); Changed();
    }
    public void Equip(string key)
    {
        if (InRun || !Meta.Passives.TryGetValue(key, out int level) || level == 0) return;
        if (Meta.Equipped.Contains(key)) Meta.Equipped.Remove(key);
        else if (Meta.Equipped.Count < 2) Meta.Equipped.Add(key);
        else { Toast("最多装配两个被动，请先卸下一个"); return; }
        Stats = RunStats.From(Meta); Save(); Changed();
    }
    public void Repair()
    {
        if (!Functional) return;
        int price = FreeRepair ? 0 : Rules.RepairCost(Stats); if (Scrap < price) { Toast("废料不足"); return; }
        Scrap -= price; FreeRepair = false; Rules.RepairAll(Blocks, Inventory, Wrecks, Stats); Sound("collect"); Toast("整修完成 · 堡垒已恢复");
    }
    public void Improve(string id)
    {
        if (!Functional) return; var b = Blocks.Concat(Inventory).FirstOrDefault(p => p.Id == id);
        if (b == null || b.Kind == "core" || b.Level >= 3) return;
        int price = 16 * b.Level; if (Scrap < price) { Toast("废料不足"); return; }
        Scrap -= price; Rules.Upgrade(b, Stats); Sound("click"); Changed();
    }
    public Vector2 WorldBlock(Block b) => Position + Rules.Local(b).Rotated(Angle);
    public void Hit(Block b, float amount)
    {
        b.Hp -= amount; b.Flash = .12f; Shake = MathF.Max(Shake, 3); Sound("hit"); Particles(WorldBlock(b), b.Def.Color, 4);
        if (b.Hp > 0) return;
        if (b.Kind == "core") { Finish(false); return; }
        var position = WorldBlock(b); Blocks.Remove(b); Wrecks.Add(b); Particles(position, b.Def.Color, 20); Sound("explode");
        var links = Rules.Connected(Blocks);
        foreach (var lost in Blocks.Where(p => !links.Contains(p.Id)).ToArray())
        {
            Drops.Add(new() { Position = WorldBlock(lost), Kind = "module", Module = lost }); Blocks.Remove(lost);
        }
        Changed();
    }
    public void Spawn(string kind, Vector2 p)
    {
        float hp = (kind switch { "rush" => 58, "shooter" => 75, "heavy" => 230, _ => 2800 }) * (1 + Room * .13f);
        Enemies.Add(new() { Kind = kind, Position = p, Hp = hp, Max = hp, Radius = kind == "boss" ? 65 : kind == "heavy" ? 28 : 19, Timer = 1 + Rand() });
    }
    public void SpawnWave()
    {
        Wave++; int count = 4 + (int)(Room * .7f) + Wave;
        for (int i = 0; i < count; i++) { float a = i / (float)count * MathF.Tau + Rand() * .3f; Spawn(Room > 1 && i % 4 == 0 ? "heavy" : i % 3 == 0 ? "shooter" : "rush", new(750 + MathF.Cos(a) * 600, 500 + MathF.Sin(a) * 350)); }
        WaveTimer = Definitions.WaveDelay; Toast($"警戒波次 {Wave} / {Definitions.Waves}");
    }
    public void EnemyFire(Enemy e)
    {
        bool boss = e.Kind == "boss", heavy = e.Kind == "heavy";
        int count = boss ? e.Hp < e.Max / 2 ? 13 : 9 : heavy ? 3 : 1;
        for (int i = 0; i < count; i++)
        {
            float a = e.Angle + (i - (count - 1) / 2f) * (boss ? .2f : .16f), speed = boss ? 200 : heavy ? 240 : 290;
            var dir = Vector2.Right.Rotated(a);
            Bullets.Add(new() { Position = e.Position + dir * (e.Radius + 4), Velocity = dir * speed, Damage = boss ? 17 : heavy ? 14 : 10, Life = 7, Hostile = true, Radius = heavy ? 5 : 4, Color = "f4bb86" });
        }
    }
    public void Kill(Enemy e)
    {
        Kills++; Shake = e.Kind == "boss" ? 14 : 5; Sound("explode"); Particles(e.Position, "eea18d", e.Kind == "boss" ? 60 : 20);
        Drops.Add(new() { Position = e.Position, Kind = "scrap", Value = e.Kind == "heavy" ? 9 : 4 });
        if (Rand() < .45f) Drops.Add(new() { Position = e.Position + new Vector2(15, 0), Kind = "point", Value = 2 });
        if (Rand() < .1f) DropModule(e.Position - new Vector2(20, 0));
        var core = Blocks.First(b => b.Kind == "core"); core.Hp = MathF.Min(Rules.MaxHp(core, Stats), core.Hp + Stats.Passives["siphon"] * 2);
        if (e.Kind == "boss") { foreach (var drop in Drops) Collect(drop); Drops.Clear(); Finish(true); }
        Changed();
    }
    public void DropModule(Vector2 position, bool gun = false)
    {
        var pool = Definitions.ModuleKinds.Where(k => Definitions.Modules[k].Size <= Stats.Size).ToArray();
        string kind = gun ? "gun" : pool[Random.Next(pool.Length)]; float r = Rand(); int rarity = r < .05f + .015f * Stats.Luck ? 2 : r < .3f + .06f * Stats.Luck ? 1 : 0;
        Drops.Add(new() { Position = position, Kind = "module", Module = Rules.Create(kind, Stats, rarity: rarity) });
    }
    public void RoomCleared()
    {
        Clear = true; Bullets.Clear(); DropModule(new(700, 450), Room == 0); if (Route == "arms") DropModule(new(800, 450));
        Drops.Add(new() { Position = new(750, 500), Kind = "scrap", Value = 20 + Room * 4 });
        Drops.Add(new() { Position = new(750, 420), Kind = "point", Value = Route == "research" ? 14 : 8 });
        var locked = Definitions.ModuleKinds.Except(Meta.Blueprints).ToArray();
        if (locked.Length > 0 && (Room == 2 || Rand() < .3f)) Drops.Add(new() { Position = new(850, 480), Kind = "blueprint", Blueprint = locked[Random.Next(locked.Length)] });
        Toast("区域肃清 · 收集战利品，前往北侧出口");
    }
    public void Collect(Loot d)
    {
        switch (d.Kind)
        {
            case "module" when d.Module != null: if (!Blocks.Concat(Inventory).Any(b => b.Id == d.Module.Id)) { Inventory.Add(d.Module); Found++; } break;
            case "scrap": Scrap += (int)MathF.Round(d.Value * (1 + .15f * Stats.Passives["salvage"])); break;
            case "point": Meta.Points += d.Value; Earned += d.Value; Save(); break;
            case "blueprint":
                if (!Meta.Blueprints.Contains(d.Blueprint)) { Meta.Blueprints.Add(d.Blueprint); Toast("蓝图已永久解锁：" + Definitions.Modules[d.Blueprint].Name); }
                else { Meta.Points += 10; Earned += 10; }
                Save(); break;
        }
        Sound("collect"); Particles(d.Position, d.Kind == "point" ? "8ebcf2" : "b5f58b", 5); Changed();
    }
    public void Particles(Vector2 p, string color, int count)
    {
        for (int i = 0; i < count; i++) { float life = .2f + Rand() * .5f; Sparks.Add(new() { Position = p, Velocity = Vector2.Right.Rotated(Rand() * MathF.Tau) * (30 + Rand() * 180), Life = life, Max = life, Color = color, Size = 1 + Rand() * 3 }); }
        if (Sparks.Count > 450) Sparks.RemoveRange(0, Sparks.Count - 450);
    }
    public void Update(float dt)
    {
        MessageTime = MathF.Max(0, MessageTime - dt); if (Panel != "") return;
        Shake = MathF.Max(0, Shake - 30 * dt);
        foreach (var p in Sparks) { p.Position += p.Velocity * dt; p.Velocity *= .96f; p.Life -= dt; }
        Sparks.RemoveAll(p => p.Life <= 0);
        Position += Movement.LimitLength() * 205 * Stats.Speed * dt;
        if (Position.DistanceTo(Aim) > 12) Angle = Rules.Turn(Angle, (Aim - Position).Angle() + MathF.PI / 2, MathF.Tau * dt);
        float extent = 25; foreach (var b in Blocks) extent = MathF.Max(extent, Rules.Local(b).Length() + b.Def.Size * Definitions.Cell * .71f);
        Position = new(Math.Clamp(Position.X, extent + 35, 1465 - extent), Math.Clamp(Position.Y, extent + 35, 965 - extent));
        foreach (var b in Blocks) b.Flash = MathF.Max(0, b.Flash - dt);
        if (!InRun) return;
        Elapsed += dt; RoomElapsed += dt; ContactCooldown -= dt;
        var core = Blocks.First(b => b.Kind == "core"); bool low = core.Hp < Rules.MaxHp(core, Stats) * .35f;
        foreach (var b in Blocks)
        {
            b.Cooldown -= dt; var d = b.Def; if (!Firing || d.Damage == 0 || b.Cooldown > 0) continue; b.Cooldown = d.Interval;
            Vector2 p = WorldBlock(b); float a = (Aim - p).Angle();
            for (int i = 0; i < d.Pellets; i++)
            {
                float spread = b.Kind == "shotgun" ? (i - 2) * .13f : b.Kind == "twin" ? (i - .5f) * .028f : (Rand() - .5f) * .025f;
                Bullets.Add(new() { Position = p + Vector2.Right.Rotated(a) * 22, Velocity = Vector2.Right.Rotated(a + spread) * d.Speed, Damage = Rules.Damage(b, Stats, low), Life = b.Kind == "shotgun" ? .7f : 1.6f, Radius = b.Kind == "cannon" ? 5 : 2.5f, Color = d.Color });
            }
            Sound("shot");
        }
        if (!Clear && CurrentRoom.Kind == "battle")
        {
            WaveTimer -= dt; if (Wave < Definitions.Waves && WaveTimer <= 0) SpawnWave();
            if (Wave >= Definitions.Waves && Enemies.Count == 0) RoomCleared();
        }
        foreach (var e in Enemies)
        {
            e.Flash = MathF.Max(0, e.Flash - dt); Vector2 delta = Position - e.Position; float distance = MathF.Max(1, delta.Length()); bool boss = e.Kind == "boss";
            if (e.Charge > 0) { e.Charge -= dt; e.Position += Vector2.Right.Rotated(e.Angle) * 420 * dt; }
            else if (e.Warn > 0)
            {
                e.Warn -= dt;
                if (e.Warn <= 0) { if (e.Kind == "rush" || boss && e.Phase % 3 == 2) e.Charge = boss ? .85f : .45f; else EnemyFire(e); e.Timer = boss ? 1.45f : 2.6f; }
            }
            else
            {
                e.Timer -= dt; float speed = e.Kind == "rush" ? 78 : e.Kind == "heavy" ? 38 : boss ? 28 : 60;
                if (distance > (e.Kind == "rush" ? 45 : boss ? 340 : 310)) e.Position += delta / distance * speed * dt;
                if (e.Timer <= 0) { e.Warn = boss ? 1 : .7f; e.Phase++; e.Angle = delta.Angle(); }
            }
            e.Position = new(Math.Clamp(e.Position.X, e.Radius + 38, 1462 - e.Radius), Math.Clamp(e.Position.Y, e.Radius + 38, 962 - e.Radius));
            if (distance < extent + e.Radius + 10 && ContactCooldown <= 0)
            {
                Block? nearest = null; float best = float.PositiveInfinity;
                foreach (var b in Blocks) { float d = WorldBlock(b).DistanceTo(e.Position); if (d < best && d < e.Radius + b.Def.Size * Definitions.Cell * .7f) { nearest = b; best = d; } }
                if (nearest != null) { Hit(nearest, boss ? 28 : e.Kind == "heavy" ? 19 : 12); ContactCooldown = .6f; e.Position -= delta / distance * MathF.Max(8, e.Radius + 25 - best); if (Panel != "") return; }
            }
        }
        foreach (var bullet in Bullets)
        {
            Vector2 from = bullet.Position; bullet.Position += bullet.Velocity * dt; bullet.Life -= dt;
            if (bullet.Hostile)
            {
                Block? first = null; float nearest = float.PositiveInfinity;
                foreach (var b in Blocks) { float? t = Rules.SegmentBlock(from, bullet.Position, b, Position, Angle, bullet.Radius); if (t.HasValue && t.Value < nearest) { nearest = t.Value; first = b; } }
                if (first != null) { bullet.Life = 0; Hit(first, bullet.Damage); if (Panel != "") return; }
            }
            else
            {
                Enemy? first = null; float nearest = float.PositiveInfinity; Vector2 direction = bullet.Position - from;
                foreach (var e in Enemies)
                {
                    if (e.Hp <= 0) continue;
                    float t = Math.Clamp((e.Position - from).Dot(direction) / MathF.Max(.0001f, direction.LengthSquared()), 0, 1);
                    if ((from + direction * t).DistanceTo(e.Position) < e.Radius + bullet.Radius && t < nearest) { nearest = t; first = e; }
                }
                if (first != null) { first.Hp -= bullet.Damage; first.Flash = .09f; bullet.Life = 0; Particles(bullet.Position, "e7e6bc", 2); if (first.Hp <= 0) { Kill(first); if (Panel != "") return; } }
            }
        }
        Enemies.RemoveAll(e => e.Hp <= 0); Bullets.RemoveAll(b => b.Life <= 0 || b.Position.X < 20 || b.Position.X > 1480 || b.Position.Y < 20 || b.Position.Y > 980);
        if (Bullets.Count > 700) Bullets.RemoveRange(0, Bullets.Count - 700);
        for (int i = Drops.Count - 1; i >= 0; i--) { var d = Drops[i]; d.Age += dt; if (d.Age > .35f && d.Position.DistanceTo(Position) < 68) { Drops.RemoveAt(i); Collect(d); } }
    }
}
