# 方块堡垒 · BLOCK BASTION

Godot 4.7.2 .NET + C# 的 Windows 原生客户端。2D 移动堡垒射击肉鸽：自己组装移动堡垒、在房间里打怪、拾取模块与科技、不断推进远征。

- 项目入口：[`blox-dungoen/project.godot`](blox-dungoen/project.godot)，用 Godot .NET 编辑器导入后按 F6/F5 运行主场景。
- Windows 构建：`blox-dungoen/builds/windows/BloxDungoen.exe`。分发时需一起复制整个 `windows` 文件夹。
- 编译、运行、存档与验证细节见 [`blox-dungoen/README.md`](blox-dungoen/README.md)。

## 运行与构建

需要 Godot 4.7.2 .NET 与 .NET 10 SDK。

```powershell
# 编译 C# 并生成 Windows 构建（含规则测试）
.\blox-dungoen\Tools\Build-Windows.ps1 -GodotPath 'D:\Godot\Godot_v4.7.2-stable_mono_win64\Godot_v4.7.2-stable_mono_win64_console.exe' -Test
```

生成后双击 `blox-dungoen\builds\windows\BloxDungoen.exe` 即可游玩，玩家机器不需要 Godot、.NET SDK 或 Node.js。

## 操作与循环

WASD 按屏幕方向移动；载具平滑追随鼠标；左键射击；F 与设施及出口交互；Esc 暂停；F11 切换窗口与全屏。

机库提供免费的初始组装、载具科技树、最多两个被动的装配，以及出击入口。远征包含五个战斗房、两个功能房和一个首领房；清房后在出口选择奖励倾向，不能回溯。战斗中不能建造；功能房可安装库存实体模块、升级、整修。修改布局后先应用配置，才能维修或升级。

模块各有血量，外层装甲挡住普通敌弹；结构断连会使外侧模块脱落，靠近回收后可在功能房重新安装。维修恢复已毁模块；脱落模块必须实际回收，不能通过维修复制。

核心归零即死亡，免费返回机库。研究点与蓝图拾取即永久保存；废料、模块与本局强化重置。

## 存档

原生客户端使用 Godot 的 `user://progress-v1.json`，Windows 默认位置是 `%APPDATA%\Godot\app_userdata\BloxDungoen\progress-v1.json`。写入采用临时文件替换并保留 `.bak` 备份，损坏时尝试恢复。当前远征不支持退出续玩。

## 代码分工

- `Definitions.cs`：模块、房间、科技与默认数值。
- `Rules.cs`：占格、连接、旋转碰撞、损毁恢复和强化。
- `GameModel.cs`：战斗模拟、敌人、掉落、远征、成长。
- `SaveStore.cs`：本地永久进度及备份。
- `Main.cs`：原生窗口、固定步长输入与应用生命周期。
- `ClientUi.cs`：Godot 原生菜单、组装、科技和结算界面。
- `ArenaView.cs` / `StructureView.cs`：战场与结构图绘制。
- `NativeAudio.cs`：程序合成音效；`SelfTests.cs`：Godot 内规则验收。

## 验证

```powershell
# 规则测试，使用隔离存档，不影响玩家进度
& 'D:\Godot\Godot_v4.7.2-stable_mono_win64\Godot_v4.7.2-stable_mono_win64_console.exe' --headless --path blox-dungoen -- --self-test
```

图形冒烟验收用 `--smoke-test`，截图输出到 `.godot/acceptance-screenshots`。

长期养成节奏、10～15 分钟目标时长和难度仍需真实试玩校准；暂不包含云存档、联机、手柄适配或中途续玩。
