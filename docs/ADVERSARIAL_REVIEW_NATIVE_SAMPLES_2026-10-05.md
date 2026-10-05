# 原生样板对抗式审查：音乐、专注、天气、媒体

审查日期：2026-10-05。范围：原生版 `native/` 的音乐、专注、天气、媒体四个样板，目标是确认所有功能正常，并复现、修复、回归各自的真实边界。本报告只记录本轮新发现与本轮证据；此前的专项验收仍见 `docs/NATIVE_MUSIC_ISLAND_VERIFICATION_2026-10-05.md`、`docs/NATIVE_FOCUS_VERIFICATION_2026-10-05.md`、`docs/NATIVE_WEATHER_VERIFICATION_2026-10-05.md`、`docs/NATIVE_MEDIA_VERIFICATION_2026-10-05.md`。

## 结论

审查发现并修复 1 个真实缺陷：天气城市搜索遇到缺字段的地理编码条目时，`KeyNotFoundException` 会从 `Settings.Search()` 这个未捕获异常的 `async void` 冒到全局未处理异常处理，按当前实现会写日志并退出应用。修复后单条畸形结果只被跳过，搜索仍返回其余有效城市。为音乐样板补上本地歌词导入的行为探针；本轮未发现音乐、专注、媒体的新缺陷。

## 发现与修复

### WX-01 · P1 · 畸形地理编码条目会导致应用退出

**位置：**`native/Lingyu.App/Models/SessionModel.Weather.cs`、`native/Lingyu.App/Views/WorkspacePages.Settings.cs`。

**触发条件：**搜索城市时，Open-Meteo 地理编码响应 `results` 中任一条目缺少 `name`、`latitude` 或 `longitude`，原实现对每个条目直接 `GetProperty`。`Settings.Search()` 是 `async void`，只捕获 `HttpRequestException/OperationCanceledException/JsonException`；`KeyNotFoundException` 会走到 `App.xaml.cs` 的 `DispatcherUnhandledException`，记录 `startup-errors.log` 并 `Shutdown(1)`。

**复现：**先在 `WeatherChecks` 增加“畸形城市搜索条目”探针，夹具返回 6 条含缺字段、错误类型、空名称、数值溢出的条目。修复前运行 `--verify-weather`，报告为 `malformed city search entries are skipped without ending the session: The given key was not present in the dictionary.`，退出码 1。

**修复：**`SearchCitiesAsync` 改为逐条 `TryGetProperty` 校验：根节点必须是对象、`results` 必须是数组；条目必须是对象，`name` 必须是非空字符串，`latitude/longitude` 必须是有限数值，`country` 缺失或类型不符时回落为空字符串。畸形条目跳过，其余正常返回。异常类型不再依赖 `async void` 调用方兜底。

**验收：**扩展探针还覆盖 `results` 非数组和根节点非对象，均作为空列表返回。修复后同一入口运行通过，详见证据。

## 音乐样板补充验证

本轮为音乐样板新增“本地歌词导入”行为探针，覆盖此前没有直接断言的路径：

- 合法 LRC 导入后，`Lyrics`、工作台 `CurrentLyric` 与音乐岛 `MusicLyric` 绑定到当前曲目，并只发一次 `lyricsLoaded` 提示。
- 用户延迟 `SetLyricOffset(-2)` 生效，当前行仍正确。
- 无时间戳的空 LRC 触发 `lyricsFailed`，不替换已导入歌词；不存在的文件同样失败且保留旧歌词。
- 媒体会话移除后，歌词列表与岛上歌词清空，工作台回到 `lyricsHint`，不把上一首歌词留给下一首。

音乐既有探针继续覆盖：无时间轴时禁用控制、播放脉冲只在可见播放且未减少动效时运行、封面与强调色原子成对、同封面不重复解码、约 100 次窗口开关后窗口和脉冲均可回收。

## 回归结果

证据目录：`dist/adversarial-20261005/`。四个窗口验证逐个运行，共用验证互斥锁，不覆盖用户正在运行的预览实例。

| 检查 | 结果 |
| --- | --- |
| 原生业务与提示词 | `dotnet run --project native/Lingyu.Tests -c Release`：`RESULT failed=0` |
| Release 构建 | 0 警告、0 错误 |
| 双语和资源契约 | 192 个双语键通过 |
| 音乐专项 | `music/music-report.json`：22 项通过，failed=0 |
| 专注专项 | `focus/focus-report.json`：23 项通过，failed=0 |
| 天气专项 | `weather/weather-report.json`：14 项通过，failed=0 |
| 媒体专项 | `media/media-report.json`：13 项通过，包含真实 SMTC 会话，failed=0 |

天气修复的红/绿证据：修复前 `weather-probe-a/weather-report.json` 中该探针失败，错误为 `The given key was not present in the dictionary.`；修复后 `weather-probe-b/weather-report.json` 该探针通过。音乐新探针为 `music-probe-c/music-report.json`。

## 残余风险

- 媒体样板的 `physicalDeviceSwitchVerified=false`：设备热插拔在 COM 夹具层已覆盖，但没有在实际物理设备上拔插验证。
- 天气的自动刷新基于 30 分钟缓存和 1 分钟失败退避，本轮使用受控传输；`--live-weather` 真实服务读取未在本轮重复执行，上一次结果见天气专项文档。
- 专注样板的 `physicalSleepVerified=false`：使用注入时钟模拟到期与后台间隔，未让机器实际进入睡眠。
- 城市搜索仍依赖远程服务的字段语义；修复保证畸形条目不崩、不污染其余结果，但不会替服务补齐缺失的地理位置。

