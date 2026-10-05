# Native weather reliability implementation plan

**Goal:** 原生天气按需刷新、切城立即清理旧数据，任何迟到请求不能覆盖新城市；错误与更新时间在真实窗口中可见。

**Architecture:** 保留 WPF 视图和现有 Open-Meteo 数据源。将天气请求、完整结果解析、单城市缓存和取消放入不依赖 WPF 的 `WeatherService`；`SessionModel` 负责本地化、城市保存和可见界面的使用计数，窗口只申请/释放天气使用权。现有每秒会话 Tick 检查是否到期，不增加常驻定时器。

**Tech Stack:** .NET 10、HttpClient、TimeProvider、WPF；独立工作区验证数据。沿当前线程执行，保留已有未提交修改，不做提交或发布。

## Task 1：保存失败证据

- [ ] `native/Lingyu.App/Verification/WeatherChecks.cs` 使用受控 HTTP 响应驱动实际 `SessionModel`，分别验证切城失败清空旧温度/预报、A/B 乱序只保留 B、缓存过期后可见界面自动请求。
- [ ] 以 `--verify-weather` 单独运行，保留修改前失败报告；不依赖公网天气是否可用。只在基线探针中通过反射替换现有私有 HTTP 字段，正式验证改用注入的天气服务。

## Task 2：实现可测试的天气服务

Files: `native/Lingyu.Core/WeatherService.cs`、`native/Lingyu.Tests/WeatherChecks.cs`、`native/Lingyu.Tests/Program.cs`。

- [ ] 先写业务断言：有效响应解析、切城后旧结果立即不可见、迟到成功/错误不覆盖当前结果、同城并发去重、30 分钟缓存、失败至少间隔 2 分钟重试、取消与退出后不发状态通知、坏数据不部分提交。
- [ ] 以 `WeatherService(HttpClient, TimeProvider?)` 注入传输与时间。服务提供当前 `City`、`Snapshot`、`IsLoading`、`Failed`、`Changed`，`RefreshAsync(city)`、`Cancel()`、`Dispose()`。
- [ ] `WeatherSnapshot` 携带城市、温度、天气代码、高低温、小时预报、成功获取时间；本轮只缓存当前城市。先构建完整快照，再原子替换。
- [ ] 选新城先取消前一请求并递增代次；完成前核对代次与城市。相同城市失败保留上次成功数据并标记过期；不同城市失败显示无数据。服务使用调用方同步上下文发布状态，不引用任何窗口。
- [ ] 运行业务测试，修复到全部通过。异常处理只覆盖 HTTP、取消及可预期的格式错误。

## Task 3：接入生命周期与反馈

Files: `SessionModel.Weather.cs`、`SessionModel.cs`、`Windows/IslandWindow.*`、`Windows/WorkspaceWindow.xaml.cs`、`Views/WorkspacePages.Today.cs`、`Views/WorkspacePages.Settings.cs`、双语目录。

- [ ] 展开且显示天气的小岛、今日页、设置页持有天气使用权；收起、隐藏、最小化、离开页面、关闭后释放。全部隐藏时停止自动刷新；再次显示时检查过期。显式选城立即请求。
- [ ] 使用既有 Tick 检查到期；重复 Tick 不发送重复请求。展示模式不连接真实天气、不伪造获取时间。
- [ ] 显示加载、更新失败、上次成功获取时间；城市变动立即通知所有天气绑定与预报。所有新文字同时加入中文、英文目录。
- [ ] 刷新只更新天气绑定与预报，不重建 AI/笔记等编辑页面。关闭窗口释放订阅，不让天气请求持有视觉树。

## Task 4：原生窗口与提示词验收

- [ ] 同步 `native/Lingyu.Core/NativePrompt.cs` 的天气行为和能力边界，补对应业务断言。
- [ ] 用隔离夹具验证加载、失败、恢复、切城乱序、可见性与窗口释放；保存中英文、宽窄窗口截图，并检查状态文字不裁切。
- [ ] 运行 `dotnet run --project native/Lingyu.Tests -c Release`、`dotnet build native/Lingyu.App -c Release`、`python native/scripts/check-contracts.py`、`--verify-weather` 和相关布局/原生交互回归。
- [ ] 公网验证只请求明确指定的测试城市，不把测试天气写入用户配置；记录成功或网络失败，不将本地夹具当作公网验收。
- [ ] 保存验收记录和后续边界。真实媒体兼容继续作为后续独立切片。

接口依据：[Open-Meteo 官方接口说明](https://open-meteo.com/en/docs)。保留 `timezone=auto` 和 ISO8601 的城市当地时间；成功获取时间单独记录，不能把本机时间误当城市预报时间。
