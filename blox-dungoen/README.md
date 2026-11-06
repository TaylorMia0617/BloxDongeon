# 方块堡垒 · Windows 客户端

本目录是项目主目录：**Godot 4.7.2 .NET + C#，Windows x86_64**。早期浏览器原型已移除，仓库只保留这个原生客户端。

## 直接游玩

双击 `builds/windows/BloxDungoen.exe`。完整分发单位是整个 `builds/windows` 文件夹，包括 `.pck` 和 .NET 运行时数据目录，不能只复制 exe。导出包包含 .NET 运行时，玩家不需要安装 Godot、.NET SDK、Node.js，也不需要启动网页服务。

操作：WASD 按屏幕方向移动；载具平滑追随鼠标；左键射击；F 与设施及出口交互；Esc 暂停；F11 切换窗口与全屏。Q/E 无旋转绑定。窗口失去焦点时，战斗自动暂停。

机库提供免费的初始组装、载具科技树、最多两个被动的装配，以及出击入口。局内有五个战斗房、两个功能房和一个首领房；清房后在出口选择奖励倾向，不能回溯。研究与蓝图拾取即永久保存，死亡免费回城，废料和本局构筑重置。

在组装界面选择右侧模块，点击网格放置；点击已有模块可拆下。模块必须边相邻连接核心。点击“应用配置”后保存布局；关闭则取消未应用改动。局内只能安装库存中的实体模块。拆卸不会恢复血量。功能房每站一次免费整修，之后消耗废料；布局改动需要先应用，再维修或升级。

## 在编辑器中开发

1. 使用 **Godot 4.7.2 .NET** 打开 `project.godot`。
2. 本项目使用 **.NET 10 SDK**；编译一次后按 F5 运行 `Scenes/Main.tscn`。
3. 编辑 C# 可使用 Visual Studio、Rider 或 VS Code。项目提供 `BloxDungoen.sln` 与 `.csproj`。

```powershell
dotnet build BloxDungoen.csproj
```

使用 Compatibility 渲染器，适合当前 2D 玩法。场景入口是 Godot Control，界面、绘图、输入、音效和窗口均为原生 Godot；没有嵌入网页或浏览器。核心规则与窗口界面分离，后续可以逐步替换程序绘图美术、添加独立场景和更多内容。

## 生成 Windows 构建

在 Godot 中安装 **4.7.2 .NET 导出模板**，从“项目 → 导出 → Windows Desktop”导出；预设已保存。也可运行：

```powershell
.\Tools\Build-Windows.ps1 -GodotPath 'D:\Godot\Godot_v4.7.2-stable_mono_win64\Godot_v4.7.2-stable_mono_win64_console.exe' -Test
```

脚本会编译、导入、运行规则测试，然后生成 `builds/windows`。本机所需的 Windows x86_64 导出模板已准备好。其他机器的 Godot 路径可能不同，需替换参数或设置 `GODOT_PATH`。

## 存档

原生客户端使用 Godot 的 `user://progress-v1.json`，Windows 默认位置是 `%APPDATA%\Godot\app_userdata\BloxDungoen\progress-v1.json`。

写入采用临时文件替换，保留最近一次有效 `.bak` 备份。出现损坏时尝试备份恢复；写入失败在界面提示。退出游戏会保存永久进度，当前远征不支持退出续玩。

## 验证

```powershell
# 在 Godot 实际运行时内测试规则，测试使用隔离存档，不改变玩家进度。
& 'D:\Godot\Godot_v4.7.2-stable_mono_win64\Godot_v4.7.2-stable_mono_win64_console.exe' --headless --path . -- --self-test

# 打开真实窗口，依次捕获机库、组装、战斗、工坊、科技、被动、首领和结算画面，然后退出。
& 'D:\Godot\Godot_v4.7.2-stable_mono_win64\Godot_v4.7.2-stable_mono_win64_console.exe' --path . -- --smoke-test
```

规则测试覆盖：占格与容量、连接检测、跨角度转向、屏幕方向移动、旋转碰撞、挡弹、脱落回收、维修唯一性、两类成长、被动槽、存档备份、死亡重开和完整八房间流程。图形验收输出位于 `.godot/acceptance-screenshots`。测试通过加速场景验证关卡推进，不代表数值平衡已完成。

## 代码分工

- `Definitions.cs`：模块、房间、科技与默认数值。
- `Rules.cs`：占格、连接、旋转碰撞、损毁恢复和强化。
- `GameModel.cs`：战斗模拟、敌人、掉落、远征、成长。
- `SaveStore.cs`：本地永久进度及备份。
- `Main.cs`：原生窗口、固定步长输入与应用生命周期。
- `ClientUi.cs`：Godot 原生菜单、组装、科技和结算界面。
- `ArenaView.cs` / `StructureView.cs`：战场与结构图绘制。
- `NativeAudio.cs`：程序合成音效；`SelfTests.cs`：Godot 内规则验收。

这是完整可玩循环的首个原生客户端版本。长期养成节奏、10～15 分钟目标时长和难度尚需真实试玩校准；暂不包含云存档、联机、手柄适配或中途续玩。
