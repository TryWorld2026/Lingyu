# Lingyu 对抗式审查与上游对照

审查日期：2026-10-01。范围：当前本地分支的 Electron 主进程、preload、渲染层关键功能、存储、网络、更新链路、GitHub Actions，以及明确声明的上游 eIsland。第 1 至 6 节保留初始审查基线，第 7、8 节保留对应实施阶段；当前功能修复与打包验收见第 9 节。没有提交 PR 或执行远端攻击。

审查基线的主要风险集中在权限边界和状态一致性。基线测试全部通过，但外链进入应用窗口后仍能使用 preload 和 IPC；部分 CI 在有写权限的上下文中执行 PR 提供的代码；剪贴板隐私开关与重复闹钟存在已复现的错误。建议完成下面的 P1 修复，再把该分支作为发布安全基线。

用户随后明确产品目标为“上游付费能力在 Lingyu 免费提供，并强化 Lingyu 品牌”，并确认 AI 采用本地模型与用户自带 API Key。相应的功能覆盖、服务依赖和品牌差距核对见 [免费能力与品牌目标核对](LINGYU_FREE_FEATURES_AND_BRAND_2026-10-01.md)。本报告中的工程问题作为免费产品可靠发布与品牌信任的保障，与该产品目标共同验收。

## 1. 审查对象与证据等级

| 对象 | 核实结果 |
| --- | --- |
| 当前仓库 | [TryWorld2026/Lingyu](https://github.com/TryWorld2026/Lingyu) |
| 当前分支 | `chore/phase0-safety-baseline`，版本 `0.3.8` |
| 本地 HEAD | `d4a0e5adf37ed9036fc5c2a2cbafa18b7647b52f`，2026-09-22 |
| origin/main | 审查时远端为 `ec99d4cbc509402cb12e540488097ac1e40d9d43`；本报告针对本地 HEAD |
| 上游 | README 明确指向 [JNTMTMTM/eIsland](https://github.com/JNTMTMTM/eIsland) |
| 上游审查快照 | `main`，`68d26bbcbe97eddd7d533cfd2b81632cf7ffe3df`，2026-09-24，版本 `26.7.4` |
| 历史关系 | 两个快照没有共同 Git 祖先；不能把提交数量差直接解释为“落后若干提交” |

上游通过临时 bare clone 和源码工作树读取，未修改本项目的 remote 或 refs，也未安装、构建或运行上游程序。上游 lockfile 单独执行了依赖审计。

证据分为三类：**原生复现**使用真实 Electron 或 Win32 API；**隔离复现**执行实际项目源码、替换外部依赖或时钟；**源码确认／条件性风险**说明确定的代码行为及尚未验证的部署条件。隔离复现不等同于完整 UI 自动化。

优先级：P1 应优先修复，包含严重权限风险、隐私承诺失效或核心功能持续失效；P2 应在随后迭代处理；P3 为规范问题。共有 **13 项主要发现：8 项 P1、5 项 P2**，另有 3 处注释规范违规。这里的数量包含功能缺陷和条件性风险，不表示存在 13 个已利用的安全漏洞。

## 2. 优先级总表

| 编号 | 优先级 | 问题 | 证据 | 上游情况 |
| --- | --- | --- | --- | --- |
| LY-01 | P1 | 外链导航保留 preload 与 IPC 信任 | 原生 Electron 复现 | 同类边界仍不完整 |
| LY-02 | P1 | 特权 CI 执行 PR 控制的源码／脚本 | 源码确认，运行条件待核实 | 仍存在 |
| LY-03 | P1 | PR 分支名注入 Bash 命令 | 本地无害命令复现 | 一个工作流已修，另一个仍存在 |
| LY-04 | P1 | 剪贴板历史关闭后仍采集、落盘 | 实际 hook 隔离复现 | 当前常驻 collector 为本地差异 |
| LY-05 | P1 | 文件剪贴板格式与 Unicode 头部均错误 | Win32 解析复现＋底层源码 | 未发现对应实现 |
| LY-06 | P1 | 重复闹钟运行到第二天后不再响 | 当前与上游均隔离复现 | 同样存在 |
| LY-07 | P1 | 随应用发布的 Electron 35 已过支持期 | lockfile、实际 runtime、官方公告 | 已升级至 43.4.0 |
| LY-08 | P1 | 更新自动切换代理，缺少独立来源认证 | 条件性供应链风险 | 不能视为上游升级即可解决 |
| LY-09 | P2 | 整体覆盖存储丢失并发修改 | 实际 handler 隔离复现 | 已有原子操作／CAS 可参考 |
| LY-10 | P2 | 网络响应无限缓存到主进程内存 | 当前与上游 17 MiB 对照复现 | 已有 16 MiB 上限 |
| LY-11 | P2 | 显式搜索参数绕过条数／深度上限 | 实际搜索函数隔离复现 | 对应搜索入口有正确裁剪 |
| LY-12 | P2 | 计时依赖回调次数，闹钟依赖精确秒匹配 | 源码及回调模型验证 | 同类问题仍在 |
| LY-13 | P2 | 文件打开失败却报告成功 | 实际 handler 隔离复现 | 应按 Electron API 契约修复 |

## 3. 主要发现

### LY-01 · P1 · 外链导航后，远程页面继承本地应用的 preload 和 IPC 权限

**位置：**[MemoEditor.tsx:192](../src/renderer/components/states/maxExpand/components/memo/components/MemoEditor.tsx#L192)、[mainWindow.ts:163](../src/main/window/mainWindow.ts#L163)、[mainWindow.ts:213](../src/main/window/mainWindow.ts#L213)、[trustedSender.ts:94](../src/main/ipc/trustedSender.ts#L94)、[preload/index.ts:1457](../src/preload/index.ts#L1457)。独立窗口也采用同类注册和外链策略，见 [standaloneWindow.ts:70](../src/main/window/standaloneWindow.ts#L70)。

Markdown 预览使用默认链接。用户点击普通 HTTP(S) 链接会导航当前窗口，`setWindowOpenHandler` 只处理新窗口，不能阻止该导航。代码中没有对应的 `will-navigate`／`will-frame-navigate` 拦截。窗口注册后，IPC 门禁只要匹配 `webContents.id` 就直接放行，不再检查实际发送 frame 的 URL；未注册窗口还能依靠任意本地 file URL 或回环端口回退放行。

preload 每次加载页面都暴露完整 `api` 与工具包 `electronAPI`。后者包含任意通道的 `ipcRenderer.invoke/send` 和环境变量副本。现有 [trustedSender.test.ts:119](../src/main/ipc/trustedSender.test.ts#L119) 甚至明确断言“已注册窗口来自 evil.example.com 时应被信任”，测试把错误的安全边界固定了下来。

**复现：**使用当前构建出的 preload、实际 trustedSender 源码、Electron `35.7.5` 和隐藏窗口，从本地测试页点击链接进入仅映射到本机的 HTTP 测试站。远程页面中 `apiExposed=true`、`ipcTrusted=true`，并成功读取专门设置的无敏感环境变量哨兵。没有读取真实凭证、调用实际文件／截图接口或启动系统命令。确认的是远程页面获得桥接接口和信任，不是已经完成任意代码执行。

**影响：**用户点击不可信链接后，该站点可尝试调用剪贴板、截图、存储、文件路径操作和系统信息等已有主进程能力；环境变量桥接进一步扩大信息暴露。`contextIsolation=true`、`nodeIntegration=false` 不能抵消主进程主动授予的这些能力。

**修复与验收：**必须同时绑定已注册窗口、预期入口和当前发送 frame；生产模式拒绝任意 file／回环 URL 回退，开发模式仅允许实际配置的 origin。阻止应用页导航到外部站点，把经过协议校验的 HTTP(S) 外链交给浏览器；按窗口缩小 preload，移除通用 IPC 和完整环境变量暴露。验收覆盖当前窗口导航、重定向、子 frame、未知窗口、本地任意文件和其他回环端口。官方也要求限制导航、验证 IPC sender 并缩小桥接能力，见 [Electron 安全指南](https://www.electronjs.org/docs/latest/tutorial/security)。

### LY-02 · P1 · pull_request_target 中执行 PR 控制的代码

**位置：**[test.yml:4](../.github/workflows/test.yml#L4)、[test.yml:35](../.github/workflows/test.yml#L35)、[i18n-check.yml:24](../.github/workflows/i18n-check.yml#L24)、[build-size-report.yml:61](../.github/workflows/build-size-report.yml#L61)。

这些工作流在 `pull_request_target` 的基础仓库权限上下文中 checkout PR head，然后执行 npm 脚本或 PR 内的检查脚本。`npm ci --ignore-scripts` 不会限制随后执行的 `npm run typecheck/build/test`，也不能让 PR 内的脚本变为可信代码。工作流授予 `pull-requests: write`；checkout 默认还会保存认证信息。

尤其 [build-size-report.yml:81](../.github/workflows/build-size-report.yml#L81) 在执行不可信构建的同一个 job 中使用 `secrets.BOT_PAT || secrets.GITHUB_TOKEN` 发表评论。其他测试／i18n 评论使用独立 job，不能把它们也描述成同 runner 的 PAT 暴露，但前序 job 的权限边界仍有问题。

**成立条件与限制：**当这些工作流被允许运行时，PR 作者能控制被执行的文件。实际 GitHub 审批设置、BOT_PAT 是否存在和 scope 未读取，也未提交攻击 PR；因此不声称已获取远端 token。严重程度会随实际 token 权限变化。

**修复与验收：**PR 构建／测试改用无 secrets、只读权限的 `pull_request`；可信评论工作流只消费经过校验的数据，不 checkout 或执行 PR 内容。设置 `persist-credentials: false`，按 job 最小授权。用修改 package.json 脚本的 fork PR 验证只能执行在低权限环境。GitHub 官方对该组合明确给出风险说明，见 [Secure use of GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use)。上游仍保留同类设计。

### LY-03 · P1 · PR 分支名直接插入 Bash 源码

**位置：**[pr-code-quality-review.yml:255](../.github/workflows/pr-code-quality-review.yml#L255)、[pr-comment-report.yml:198](../.github/workflows/pr-comment-report.yml#L198)。

两处 `run:` 脚本将 `${{ github.event.pull_request.head.ref }}` 直接插入双引号内的 `echo`。GitHub 会先替换表达式，再把结果作为 shell 源码执行；双引号和用于 Markdown 的反引号转义不能阻止 `$()` 命令替换。

**复现：**`git check-ref-format --branch` 接受分支名 `$(printf${IFS}LINGYU_AUDIT_ONLY)`。在 Git Bash 中按相同插入方式组成命令后输出 `branch: LINGYU_AUDIT_ONLY`，证明原本的分支名被作为命令执行。探针只打印固定哨兵，没有网络访问或 secrets 读取。

**影响与条件：**无需把恶意业务代码并入 main，仅 PR 的分支名即可影响工作流执行。在工作流被允许运行的情况下，可使用该 job 可达的权限／凭证。其具体远端权限限制与 LY-02 相同。

**修复与验收：**将 head/base ref 通过 `env` 传入，shell 中以 `printf '%s' "$PR_HEAD_REF"` 等形式当作数据输出，并审查同类 event 字段插入。验收应显示分支名的字面值且不执行哨兵。上游 [e7d25bbe](https://github.com/JNTMTMTM/eIsland/commit/e7d25bbe2f72c8e0643af4fadf854e71ffedbdaf) 已修复 pr-comment-report，但其 pr-code-quality-review 在快照第 293 行仍保留相同漏洞，不能视为全部修复。

### LY-04 · P1 · 剪贴板历史隐私开关无法可靠停止采集

**位置：**[useClipboardHistoryCollector.ts:45](../src/renderer/components/states/maxExpand/components/clipBoardHistory/hooks/useClipboardHistoryCollector.ts#L45)、[useClipboardHistoryCollector.ts:84](../src/renderer/components/states/maxExpand/components/clipBoardHistory/hooks/useClipboardHistoryCollector.ts#L84)、[ClipboardHistorySettingsSection.tsx:83](../src/renderer/components/states/maxExpand/components/setting/components/app/components/ClipboardHistorySettingsSection.tsx#L83)。

collector 默认 `enabledRef=true`，先启动采集，再异步读取关闭配置；运行中只读取一次配置，没有订阅后续变化。设置页修改的是存储值，常驻 collector 的 ref 不会同步。采集结果随后进入 localStorage 和持久化存储。

**复现：**运行实际 hook，使用虚拟剪贴板和存储：启动配置为关闭时仍写入一次；启动启用后关闭，再提供一段新文本，总写入次数从 1 增为 2；设置订阅数为 0。代码注释把启动阶段保存一条文本视为“可接受”，这与用户选择关闭的含义冲突。

**影响：**用户明确关闭历史记录后，随后复制的内容仍可能落盘。密码、令牌等文本只要满足当前文本过滤条件，就可能被保留；未使用真实敏感内容测试。

**修复与验收：**配置就绪前禁止采集，持续同步开关和条数；同时覆盖当前窗口更新和跨窗口广播，因为 [broadcast.ts:38](../src/main/utils/broadcast.ts#L38) 排除发起者。剪贴板读取 await 返回后再次检查启用和卸载状态，避免关闭时正在进行的读取继续落盘。验收包括关闭启动零写入、运行中关闭零新增、重新开启恢复、同窗口修改即时生效。

### LY-05 · P1 · 暂存架文件复制不能正确互通 Windows 剪贴板

**位置：**[clipboard.ts:91](../src/main/ipc/settings/clipboard.ts#L91)、[clipboard.ts:103](../src/main/ipc/settings/clipboard.ts#L103)、[clipboard.ts:116](../src/main/ipc/settings/clipboard.ts#L116)、[ShelfTab.tsx:94](../src/renderer/components/states/maxExpand/components/shelf/components/ShelfTab.tsx#L94)。

存在两个独立错误。第一，路径按 UTF-16LE 写入，但 DROPFILES 头部偏移 16 的 `fWide` 未设置，默认 0 表示 ANSI。第二，`clipboard.writeBuffer('CF_HDROP', ...)` 走 Electron 的字符串自定义格式注册路径，不能把名称相同的注册格式等同于 Windows 预定义的数字格式 `CF_HDROP`。读取也使用同一个自定义字符串，并无条件按 UTF-16 解码，因此应用自己的读写往返能成功，却不能证明 Explorer 互通。

**复现：**实际 handler 生成的自有内存缓冲区交给 Win32 `DragQueryFileW`，一条预期完整路径被解析为 **22 个文件，首项为 `C`**，`fWide=0`。没有读取或覆盖用户的系统剪贴板，没有执行文件复制。格式标识问题由底层调用链确认，未执行完整 Explorer 粘贴测试。

`fWide` 的定义见 [Microsoft DROPFILES](https://learn.microsoft.com/en-us/windows/win32/api/shlobj_core/ns-shlobj_core-dropfiles)。格式调用链为 [Electron WriteBuffer](https://raw.githubusercontent.com/electron/electron/v35.7.5/shell/common/api/electron_api_clipboard.cc) → [WriteUnsafeRawData 补丁](https://raw.githubusercontent.com/electron/electron/v35.7.5/patches/chromium/add_ui_scopedcliboardwriter_writeunsaferawdata.patch) → [Clipboard 的平台格式分发](https://raw.githubusercontent.com/chromium/chromium/134.0.6998.205/ui/base/clipboard/clipboard.cc) → [CustomPlatformType 与 CFHDropType 的不同实现](https://raw.githubusercontent.com/chromium/chromium/134.0.6998.205/ui/base/clipboard/clipboard_format_type_win.cc)。

**修复与验收：**采用能读写 Win32 预定义文件剪贴板格式的原生接口／现有可靠 helper；写入 Unicode 时设 `fWide=1`，读取时按头部选择编码并校验边界。仅补 `fWide` 不足以解决格式标识错误。必须验证 Explorer → 暂存架、暂存架 → Explorer、多个文件、中文路径及外部 ANSI 格式，不能只断言 writeBuffer/readBuffer 往返。

### LY-06 · P1 · 重复闹钟第二天起被永久去重

**位置：**[useIslandTimerAndAlarm.ts:197](../src/renderer/components/hooks/useIslandTimerAndAlarm.ts#L197)、[useIslandTimerAndAlarm.ts:209](../src/renderer/components/hooks/useIslandTimerAndAlarm.ts#L209)、[useIslandTimerAndAlarm.ts:259](../src/renderer/components/hooks/useIslandTimerAndAlarm.ts#L259)。

响铃去重 key 只有 `alarm.id + 时:分:秒`，没有日期。常驻 ref 在下一天仍包含相同 key；仅在记录超过 200 项时整体清空。每天／每周重复的同一闹钟会在第一次触发后被持续跳过，直到重启或去重集合被清理。

**复现：**同一每天 09:00 响铃的闹钟，虚拟时钟分别设到 2026-10-01 与 2026-10-02 的 09:00:00，累计通知实际为 **1，预期 2**。相同探针执行上游实际 hook，结果相同。

**修复与验收：**去重应绑定具体发生日期／计划 occurrence，并按日期清理旧记录。验收覆盖次日、下一周、同一天重复检查、禁用后重新启用，以及长时间常驻。修复上游继承问题同样属于本项目责任。

### LY-07 · P1 · Electron 35 运行时超过支持期，依赖审计不能仅过滤 dev

**位置：**[package.json:104](../package.json#L104)、[package-lock.json](../package-lock.json)。安装锁定和原生探针均确认为 Electron `35.7.5`。上游锁定 `43.4.0`。

Electron 官方只维护最近三个稳定主版本，见 [发布与支持周期](https://www.electronjs.org/docs/latest/tutorial/electron-timelines)。35 已明显超出本次上游快照所处的受支持范围；官方安全公告也将 `<38.8.6` 纳入多项受影响版本，例如 [WebContents 权限回调 use-after-free](https://github.com/electron/electron/security/advisories/GHSA-8337-3p73-46f4)。这证明版本需要升级，不证明该项目满足每条公告的全部利用前提。

**审计口径：**全依赖 39 个受影响 package 节点，`--omit=dev` 为 22 个，上游为 30 个。Electron 虽列在 devDependencies，却作为运行时随安装包交付；相反，部分构建依赖被列在 dependencies，不能把 omit-dev 的结果直接当成安装包攻击面。Vitest 的一项 critical 公告要求开启 UI server，当前基线是 `vitest run`；systeminformation 的相关命令注入公告针对 Linux，不能直接认定 Windows 项目可利用。

**修复与验收：**升级至当时受支持且修复相关公告的 Electron 版本，逐项核实平台和实际调用条件；验证 native 模块 ABI、窗口、拖拽、截图、剪贴板、安装和更新。不要用 `npm audit fix --force` 一次性替换所有依赖，也不要以“上游也有告警”作为保留旧运行时的理由。

### LY-08 · P1 · 更新代理回退缺少独立的发布来源认证

**位置：**[updater.ts:74](../src/main/ipc/app/updater.ts#L74)、[updater.ts:132](../src/main/ipc/app/updater.ts#L132)、[updater.ts:209](../src/main/ipc/app/updater.ts#L209)、[electron-builder.json:65](../electron-builder.json#L65)、[README.md:81](../README.md#L81)。

默认 GitHub 更新源失败后，检查和下载自动回退到 ghproxy.net 的 generic 更新源。配置关闭可执行文件签名，README 说明尚无签名证书，仓库配置未指定 publisherName。安装依赖中的 [NsisUpdater.js:84](../node_modules/electron-updater/out/NsisUpdater.js#L84) 在配置没有 publisherName 时跳过发布者签名验证。

**条件性影响：**若实际发布包同样没有独立签名验证，代理被控制／返回恶意内容时，可同时替换更新元数据和安装程序；来自同一来源的 hash 只能验证两者一致，不能证明来自真正发布者。HTTPS 也不能保证第三方代理转发的是原作者文件。没有检查线上安装程序和最终打包的 app-update.yml，也未模拟恶意更新，因此不声称当前发布渠道已被入侵。

**修复与验收：**为更新建立独立的来源认证，例如验证签名发布者，或用内置公钥验证签名 manifest；为跨来源回退保留同等验证。验收必须证明恶意元数据＋恶意 installer 即使 hash 一致也会被拒绝，同时检查实际发布包中的配置。该项不能仅通过调整代理地址或依赖版本关闭。

### LY-09 · P2 · 整体快照覆盖会丢失其他窗口／任务的修改

**位置：**[store.ts:58](../src/main/ipc/app/store.ts#L58)、[useAlarmState.ts:155](../src/renderer/components/states/maxExpand/components/alarm/hooks/useAlarmState.ts#L155)、[useIslandTimerAndAlarm.ts:252](../src/renderer/components/hooks/useIslandTimerAndAlarm.ts#L252)、[useCountdownItems.ts:38](../src/renderer/components/states/maxExpand/components/countdown/hooks/useCountdownItems.ts#L38)。

主进程无条件覆盖整个 JSON；读、改、写是多次 IPC，单线程不会让整个序列原子化。闹钟 UI 保存整个列表，一次性闹钟自动关闭也用此前快照覆盖列表。倒数日 hook 只初始化读取，没有订阅后续变化，却在 items 更新时保存整个数组，长期保留过期快照。

**复现：**两个客户端读取同一 `[A=true,B=true]`，客户端 1 关闭 A 并保存，客户端 2 用旧快照关闭 B 并保存。实际最终为 `[A=true,B=false]`，客户端 1 的修改丢失。广播只能缩小时间窗口，不能防止已读快照覆盖。

**修复与验收：**闹钟启用／禁用由主进程按 ID 原子修改；整体编辑采用严格读取、版本或 compare-and-swap，并处理冲突／失败。倒数日同步外部变更，避免初始空状态或旧快照直接写回。上游 [448d5b74](https://github.com/JNTMTMTM/eIsland/commit/448d5b74ccf1cef89bc959c5c25dde2de2e7791b) 与 [5d0450d9](https://github.com/JNTMTMTM/eIsland/commit/5d0450d9225a02ebf4472ebc51d45c184d438390) 分别提供按 ID 更新及 CAS 参考；移植时必须保留本项目 IPC 校验。验收让两个编辑者交错读写，确保不同条目的修改都保留，冲突有可见反馈。

### LY-10 · P2 · 网络响应可以无限增长主进程内存

**位置：**[net.ts:181](../src/main/ipc/app/net.ts#L181)、[net.ts:188](../src/main/ipc/app/net.ts#L188)。站点标题等用户输入 URL 的元数据请求可到达该通道，见 [siteMetaApi.ts:228](../src/renderer/api/site/siteMetaApi.ts#L228)。

每个 response chunk 都进入数组，结束后 Buffer.concat 再转字符串，没有字节上限。超时不能限制超时之前可接收的数据量，也不能代替及时释放缓存。已有 settled 标记用于防止重复 resolve，但数据监听没有因此停止积累；需要统一处理响应上限、abort／close 和清理。

**对照复现：**实际当前 handler 接收模拟 17 MiB 分块响应，返回 200、完整 17 MiB、未 abort。上游相同探针返回 413 并 abort，因为存在 16 MiB 上限。没有制造真实 OOM，主进程内存耗尽的影响由无界缓存行为推导。

**修复与验收：**在 data 阶段计数并中止超限响应，Content-Length 只作提前判断，不能代替流式计数；所有终止路径释放 chunks 和计时器，并覆盖未正常 end 的情况。参考上游 [a6c25472](https://github.com/JNTMTMTM/eIsland/commit/a6c254723b6e0a146cda1155bcb46118840d7022)。验收未知长度、虚假长度、17 MiB 分块、abort／close／error，以及结束后的多余事件。

### LY-11 · P2 · 文件搜索参数上限仅在参数缺省时执行

**位置：**[localFileSearch.ts:90](../src/main/ipc/app/localFileSearch.ts#L90)。

解构写法 `limit = Math.min(options.limit ?? DEFAULT_LIMIT, 500)`、`maxDepth = Math.min(...)` 仅在属性为 undefined 时计算默认表达式。显式传入的数值完全绕过裁剪；代码表面看起来有 500／12 上限，实际没有。

**复现：**传 `limit=10000`，600 个模拟匹配文件全部返回；传 `maxDepth=10000`，20 层模拟目录全部访问。证据是实际函数和可控文件树，没有扫描用户真实磁盘。

**修复与验收：**先对原始值做有限整数和上下界归一化，再使用得到的变量。上游对应搜索入口在 [app.ts](https://github.com/JNTMTMTM/eIsland/blob/68d26bbcbe97eddd7d533cfd2b81632cf7ffe3df/src/main/ipc/app/app.ts#L92) 已单独裁剪数值。验收显式超限、负数、NaN、Infinity、默认值，以及命中 500 条时立即停止遍历。

### LY-12 · P2 · 计时器依赖回调次数，闹钟仅匹配精确的一秒

**位置：**[useIslandTimerAndAlarm.ts:156](../src/renderer/components/hooks/useIslandTimerAndAlarm.ts#L156)、[useIslandTimerAndAlarm.ts:204](../src/renderer/components/hooks/useIslandTimerAndAlarm.ts#L204)。

计时器每次 interval 回调只减 1，与实际经过时间无关。渲染进程阻塞或系统睡眠会延后完成；关闭 backgroundThrottling 不会防止这些延迟。闹钟用小时／分钟／秒全部相等才触发，若回调跨过目标秒则漏响，和 LY-06 的跨日期去重是不同问题。

**验证边界：**回调模型中 60 秒计时器在模拟长间隔后只执行一次 callback，剩余仍为 59。该探针证明按回调次数递减，未真的休眠 Windows 300 秒，也未进行系统恢复端到端测试。

**修复与验收：**保存目标截止时刻，按实际时间计算剩余；闹钟比较上次检查到本次检查之间的计划 occurrence，明确睡眠恢复和系统时间修改的产品行为。验收渲染阻塞、系统睡眠恢复、跨目标秒、重复回调，配合 LY-06 的发生日期去重。上游仍采用同类逻辑。

### LY-13 · P2 · shell.openPath 返回错误字符串时仍报告成功

**位置：**[app.ts:132](../src/main/ipc/app/app.ts#L132)。

handler await `shell.openPath` 后无条件返回 true，只把 reject 当成失败。Electron 正常失败路径是 resolve 错误字符串，见 [shell.openPath 官方契约](https://www.electronjs.org/docs/latest/api/shell)。同一文件的 [打开日志文件夹入口:99](../src/main/ipc/app/app.ts#L99) 已正确检查 `result === ''`。

**复现：**mock 返回 `Failed to open path`，实际 app:open-file handler 仍返回 true。没有打开真实文件。

**修复与验收：**沿用同文件现有正确模式，失败信息传递到必要的 UI 反馈，保持双语翻译。验收成功空字符串、resolve 错误字符串和 reject 三条路径。

## 4. 上游对照与可移植修复

**结论：上游有值得移植的局部修复，但不能作为已审定的安全基线整体合入。** 当前分支的广泛 IPC 入口门禁、专用 sandbox 截图 preload、部分生命周期处理属于有价值的改进；直接覆盖上游代码可能退回未统一校验的 IPC，也可能重新带回本项目已经移除的服务／功能。

| 对照主题 | 可参考的上游实现 | 移植注意 |
| --- | --- | --- |
| PR 分支名转义 | [e7d25bbe：PR comment report](https://github.com/JNTMTMTM/eIsland/commit/e7d25bbe2f72c8e0643af4fadf854e71ffedbdaf) | 同时修本地两个工作流；上游只修其中一个 |
| 网络响应边界 | [net.ts](https://github.com/JNTMTMTM/eIsland/blob/68d26bbcbe97eddd7d533cfd2b81632cf7ffe3df/src/main/ipc/app/net.ts#L189) | 保留本地 sender 与 URL 校验；补字节计数和终止清理 |
| 存储严格读取／CAS | [5d0450d9](https://github.com/JNTMTMTM/eIsland/commit/5d0450d9225a02ebf4472ebc51d45c184d438390) | 主进程、preload 类型和前端冲突处理需要一起适配 |
| 闹钟原子启用操作 | [448d5b74](https://github.com/JNTMTMTM/eIsland/commit/448d5b74ccf1cef89bc959c5c25dde2de2e7791b) | 不应移植成无 sender 验证的入口；此修复不解决日期去重 |
| 搜索参数限制 | [app.ts:92](https://github.com/JNTMTMTM/eIsland/blob/68d26bbcbe97eddd7d533cfd2b81632cf7ffe3df/src/main/ipc/app/app.ts#L92) | 将逻辑适配到本地拆分模块，避免搬回庞大旧模块 |
| 依赖升级 | [上游 lockfile](https://github.com/JNTMTMTM/eIsland/blob/68d26bbcbe97eddd7d533cfd2b81632cf7ffe3df/package-lock.json) | 版本仅供比较，上游仍有审计告警，需核实新版本与兼容性 |

实际锁定版本比较：

| 依赖 | 当前 | 上游快照 |
| --- | --- | --- |
| electron | 35.7.5 | 43.4.0 |
| electron-updater | 6.8.3 | 6.8.9 |
| electron-builder | 26.8.1 | 26.15.7 |
| vite | 6.4.1 | 7.3.6 |
| vitest | 2.1.9 | 4.1.10 |
| systeminformation | 5.31.6 | 5.33.1 |
| dompurify | 3.4.9 | 3.4.9 |
| zustand | 5.0.12 | 5.0.15 |
| i18next | 25.10.10 | 26.3.6 |
| react | 19.2.4 | 19.2.8 |
| get-windows | 9.3.0 | 9.3.0 |
| lyric-resolver | 0.1.6 | 0.1.6 |
| ffmpeg-static | 5.3.0 | 5.3.0 |

上游仍存在重复闹钟去重、窗口导航与桥接范围、特权 PR 执行，以及一个分支名 shell 注入入口。上游常驻剪贴板 collector 和 CF_HDROP 实现未找到，本地新增功能不能等待上游代为修复。没有共同 Git 祖先意味着应逐项适配、验证，并避免把版本号／提交数当作可直接合并的依据。

## 5. 运行检查与复现结果

| 检查 | 结果 | 解释 |
| --- | --- | --- |
| `npm run test` | 98 个文件、1,217 项通过 | 现有断言通过；并非安全边界认证 |
| `npm run typecheck` | 通过 | 主进程与渲染层类型检查 |
| `npm run build` | 通过 | 构建完成；未生成和安装正式 installer |
| `npm run i18n:check` | 通过 | zh-CN/en-US 各 2,521 键，未检测到缺失或无效键／硬编码中文 |
| `npm run comment:check` | 失败，3 处 | 见下方 P3 记录 |
| `npm audit --json` | 39 个受影响 package 节点 | critical 3、high 29、moderate 6、low 1 |
| `npm audit --omit=dev --json` | 22 个节点 | critical 1、high 17、moderate 3、low 1；不是 installer 可达性统计 |
| 上游 package-lock-only 审计 | 30 个节点 | critical 1、high 21、moderate 7、low 1；未安装上游 |

P3 注释门禁失败位置：[app.ts:39](../src/main/ipc/app/app.ts#L39)、[toastService.ts:41](../src/main/system/toastService.ts#L41)、[useSplashVideo.ts:27](../src/renderer/components/hooks/useSplashVideo.ts#L27)，均为导出函数缺少 JSDoc。它们应修复，但不应排在权限、隐私和功能正确性问题之前。

关键探针结果已保存到 [evidence.json](audits/2026-10-01/evidence.json)。探针采用实际源码转译执行，替代 fs、Electron 外部调用、React effect/ref 和时钟；实际 Electron 导航验证单独运行。临时脚本与原始日志位于 `C:\Users\18225\AppData\Local\Temp\lingyu-adversarial-audit-20261001`。

实际 Electron 探针已经返回预期的权限边界证据，但进程没有正常退出，最终采用有界等待后终止自有测试进程。因此该项记为“原生复现、清理强制结束”，不记为整个 GUI 测试通过。结束时未发现该探针的残留 Electron 进程。

未执行真实攻击 PR、凭证读取、系统剪贴板覆盖、真实文件复制、OOM、恶意更新安装或完整 installer 验证。网络超限使用有限大小的虚拟数据，Win32 只解析审查生成的自有内存。这些边界限制已逐项反映在对应发现中。

## 6. 修复顺序与关闭条件

1. **先收紧执行和权限边界：**LY-01、LY-02、LY-03。先替换错误的 IPC 信任断言，再实现入口／frame 校验和导航保护；拆开不可信 PR 执行与可信评论。成功条件是原生导航测试、恶意分支名和改动 npm scripts 的 PR 均无法跨越对应边界。
2. **恢复隐私与核心功能：**LY-04、LY-05、LY-06。用关闭启动、运行中关闭、Explorer 双向文件复制、次日／下周闹钟作为验收，避免只测同一实现的自我往返。
3. **完成运行时和更新验证：**LY-07、LY-08。升级受支持 Electron 后验证 native ABI 和 installer；对实际发布包验证发布者／manifest 认证，拒绝元数据与文件一起被替换的更新。
4. **再处理一致性和资源边界：**LY-09 至 LY-13。优先借鉴上游 CAS 与网络上限，补交错写入、延迟回调、异常返回和参数超限用例。最后关闭注释规范失败。

后续修复若改动用户可见能力，应执行项目规定的 agent prompt 同步；UI 新增提示必须同时补齐 zh-CN 与 en-US，并遵守注释／前端规范。此次未改变能力描述或 UI，未修改 prompt 与翻译文件。审查范围内未找到有效的 Lingyu server／agent prompt builder 实现，不应把残留 SDK 或类型当作已上线服务；真正实施功能变更时需先定位实际维护的服务仓库。

任何发现的关闭都需要上述对应验收证据；仅增加覆盖率、修改断言以适配错误行为，或整体合入上游，均不能作为关闭依据。

## 7. LY-01 修复进展与验收

状态：**LY-01 的窗口入口、导航与 IPC 权限边界已修复并验证，变更仍在本地工作区。** LY-02 至 LY-13、运行时升级和正式安装包验证仍待处理；本节不表示整份审查已全部关闭。

- 主岛、独立窗口、引导页、启动页和截图页显式登记各自入口。IPC 同时验证登记状态、主 frame 身份和完整入口地址；允许页面锚点，拒绝未知本地文件、其他开发端口／页面、子 frame 和导航后的远端页面。
- 统一阻止窗口内的非入口导航与重定向；普通 HTTP(S) 外链交给外部浏览器，新窗口统一拒绝。无效地址、携带用户名／密码的地址和系统协议不会交给操作系统执行。
- preload 的 `window.electron` 仅提供引导／启动生命周期消息和淡出订阅，不再暴露环境变量、通用 invoke 或任意消息通道。已有 `window.api` 保留各项专用接口，其主进程调用仍经过 sender 校验。
- 引导完成、启动就绪、播放完成还必须来自对应窗口的可信页面。无效消息不会消耗一次性处理机会，合法消息完成后才移除监听。
- 原生复测发现关窗后访问 `win.webContents.id` 会抛出异常。现在创建时保存 ID，关窗直接撤销对应登记；覆盖了对象已销毁的回归用例。

| 验收 | 结果 |
| --- | --- |
| 测试驱动复现 | 权限、工厂绑定、preload 暴露、生命周期消息与销毁清理用例均先观察失败，再修实现 |
| 完整单元测试 | 99 个文件、1,239 项通过 |
| 类型检查、构建 | 均通过 |
| 翻译检查 | 通过，zh-CN／en-US 各 2,521 键；此次未新增 UI 文案 |
| 注释检查 | 仍为第 5 节的 3 处既有违规；本次改动未新增违规 |
| 原生 Electron 权限探针 | 本地专用接口可调用；点击外链后保持原入口，远端请求数为 0；主进程强制加载远端测试页后调用返回 403，专用处理器未再执行 |
| 原生 preload 与清理 | 远端测试页无 process／环境变量／通用 invoke；修复后测试进程正常退出，exit code 为 0 |

修复证据见 [ly01-remediation.json](audits/2026-10-01/ly01-remediation.json)。原生探针使用实际 Electron 35.7.5、转译后的实际门禁源码和构建后的 preload，仅注册自有的合成 `store:read` 处理器，没有读取真实存储；外部浏览器调用被替换为记录函数。该项验证权限边界，不等同于完整应用 GUI 或 installer 测试。临时脚本位于 `C:\Users\18225\AppData\Local\Temp\lingyu-adversarial-audit-20261001\electron-security-fix-probe.cjs`。

LY-01 修复阶段未增减产品功能清单，不涉及 agent 能力描述。随后免费 AI 阶段已明确本地提示词入口并同步，见下节。

## 8. 免费 AI 第一阶段与品牌同步

用户确认“软件功能免费，本地模型或自带 API Key”后授权自行安排实施。当前工作区新增独立 Lingyu AI 文字对话，不需要上游账号、Pro 或在线提示词服务；尚未提交或发布。

- 主进程提供专用、受入口校验的配置／模型列表／流式对话／取消 IPC；对话事件发送前再次验证当前页面。请求按窗口隔离，导航和销毁停止生成，超时与响应大小有上限。
- 自带 Key 经 Windows `safeStorage` 加密，存放在通用 renderer store 之外。公开配置只有保存状态，没有明文读取接口；更换服务地址删除已有 Key，禁止兼容服务的远端 HTTP 与自动重定向，不回显第三方错误正文。
- 全展开导航和设置搜索已接入 AI；多轮文字、中文流式 Markdown、取消与会话内存状态已实现，错误／取消的半截回复不作为后续上下文。Markdown 禁止图片自动请求。
- 提示词集中在 [systemPrompt.ts](../src/main/ai/systemPrompt.ts)，同步 AGENTS.md 维护入口和能力测试，明确当前没有工具或私有数据自动访问。README、关于页、维护者元数据与社区文档同步 Lingyu 品牌及免费口径，保留来源署名。

| 验收 | 结果 |
| --- | --- |
| 完整测试 | 104 个文件、1,289 项通过 |
| 类型检查、构建 | 通过 |
| 翻译 | zh-CN／en-US 各 2,584 个键，缺失／无效／硬编码中文为 0；动态错误和反馈键另行核对 |
| 注释 | 第 5 节的 3 处既有违规仍在；没有新增违规 |
| 原生链路 | 实际 AiTab、构建后 preload、实际主进程源码、`net.fetch` 与 Windows 凭据加密 |
| 模拟模型与取消 | 自有接口的 Ollama NDJSON／兼容 SSE 中文与 Markdown 回复正确；取消关闭实际 HTTP 流 |
| 凭据与页面 | 测试 Key 加密落盘，公开设置无明文，更换地址清除；中文深色、英文浅色、420px 窄窗口验证 |
| 清理 | 探针正常退出，exit code 0 |

证据见 [free-ai-remediation.json](audits/2026-10-01/free-ai-remediation.json)，用法与边界见 [免费 AI 实施与验收](LINGYU_FREE_AI_2026-10-01.md)。这次原生探针只连接自有回环模拟接口，没有真实模型推理、真实云端 Key 或付费调用，也没有完整应用 GUI／installer 验收。

LY-02 至 LY-13 保持未关闭；新 AI 的资源上限不能关闭现有其他网络函数的 LY-10。工具调用、MCP、联网检索、上下文容量设置及天气预警尚未恢复，不能用第一阶段对话测试声称全部上游 Pro 能力免费化完成。

## 9. 继续修复与功能验收

以上未关闭状态是免费 AI 第一阶段当时的快照。继续实施后，LY-02／03 的 CI 边界、LY-04 的剪贴板开关、LY-06 的周期闹钟，以及 LY-09 至 LY-13 的已复现保存／资源／返回值问题完成修复和对应回归。LY-09 已覆盖待办、备忘录、闹钟、倒数日与总览待办，其他列表结构仍未作通用一致性认证。

LY-05 的文件格式和内存所有权实现已修复，实际 Win32 自有内存解析通过，Explorer 粘贴仍未完成实测。LY-07 已升级至 Electron 43.7.7，并验证包内原生模块和生成 NSIS 安装包；安装后系统集成未实测。LY-08 去掉自动第三方代理回退，发布者签名和可信 manifest 认证仍待完成，不能记为完全关闭。

当前完整测试 **112 个文件、1,351 项通过**；类型、构建、翻译、注释及差异门禁均通过，原有 3 处注释违规已修复。实际 Electron 检查覆盖 15 个功能页、9 个设置分区及 35 个子页，中英文均通过；包内 14 个模块加载成功，326 个构建文件逐一与打包内容一致。探针均正常退出。

新发现并修复了进程插件入口缺失、.NET 辅助程序未包含运行时／资源路径缺失、EXE 版本硬编码与 ABI 数据不识别新 Electron。安装包为当前工作区的本地未签名产物，尚未运行或发布。

细节、硬件／模型／安装后验收边界、依赖审计残留及上游能力差距见 [功能验收报告](FUNCTIONAL_VERIFICATION_2026-10-01.md)，本次证据见 [functional-verification.json](audits/2026-10-01/functional-verification.json)。初始 evidence.json 及前两阶段证据未覆盖。

## 10. LY-08 的处置：以披露代替签名

日期：2026-10-07。第 9 节记录的"LY-08 去掉自动第三方代理回退，发布者签名和可信 manifest 认证仍待完成"到本节作出处置决定。

**已查实的现状**（不是推断）：

- 发布产物 `resources/app-update.yml` 只含 `owner`、`repo`、`provider`、`private`、`releaseType`、`updaterCacheDirName`，没有 `publisherName`，也没有任何签名字段。
- `electron-builder.json` 中 `win.signAndEditExecutable: false`，未配置 `win.sign`，未设 `publisherName`；README 原有说明已承认未购买代码签名证书。
- [`updater.ts`](../src/main/ipc/app/updater.ts) 的 `applyUpdateSource` 仍支持 `ghproxy`（ghproxy.net 反代）与 `cf-dl`（自建 Cloudflare Worker）两个 generic 源，但只在用户显式选择时生效；GitHub 检查失败不再自动切换，[updaterHelpers.test.ts](../src/main/ipc/app/test/updaterHelpers.test.ts) 的"失败后不静默改用第三方代理"用例守着这条边界。
- `electron-updater` 6.8.10 已带 `builder-util-runtime@9.7.0`，GHSA-p2f4-r6v6-j797（跨域重定向泄露 `Authorization` / `PRIVATE-TOKEN`）不再适用。

**结论**：元数据里的校验值只能证明元数据与安装包彼此一致，不能证明二者来自本项目。在无证书、无内置公钥验签的前提下，元数据与安装程序被同时替换是无法被检测的。

**处置决定（用户于 2026-10-07 确认）**：接受现状，改为明确告知，不购买证书、不自建验签。已在 [`README.md`](../README.md) 与 [`README.zh-CN.md`](../README.zh-CN.md) 的安装提示处披露：更新通道无发布者签名验证、失败不自动回退镜像、需要更强保证时从 Releases 页面安装。

披露措辞经过核对，没有超出实际能力的承诺：仓库的发布脚本不产出 SHA-256 清单，因此文案建议的是"从 Releases 页面下载"，而不是"比对发布的校验值"。

**后续若要升级处置**，可选路线与代价：购买 OV 证书并配置 `win.sign` 与 `publisherName`（可真正关闭 LY-08，需年费）；或自签名 manifest 并在 `updater.ts` 内置公钥校验（不花钱，但自定义校验逻辑写错比不写更危险，需要独立设计与评审）。

## 11. LY-05 的资源管理器互通验证

日期：2026-10-07。LY-05 的记录是"文件格式和内存所有权实现已修复，实际 Win32 自有内存解析通过，Explorer 粘贴仍未完成实测"，而第 6 节给出的验收标准明确写了"不能只断言 writeBuffer/readBuffer 往返"——因为最初的 bug 恰恰是自往返通过、真实解析失败。

新增 [`fileClipboard.win32.test.ts`](../src/main/clipboard/fileClipboard.win32.test.ts)，沿用发现该 bug 时的同一方法：把 [`buildFileDropBuffer`](../src/main/clipboard/fileClipboard.ts) 产出的字节装进可移动全局内存，交给**真实的** `DragQueryFileW` 解析。这是资源管理器读取 CF_HDROP 用的同一个 API，所以解析结果就是写入方的实际互通表现。

覆盖：单个与多个中文路径完整解析；`fWide=1` 头部断言（当年漏掉它时一条路径被解析成 22 个文件、首项为 `C`）；双终止符导致不多算空项；外部 `fWide=0` 的 ANSI 来源可解析；非法与超限路径不产出数据。

有意为之的边界：**不碰真实剪贴板**，也不新建窗口句柄，因此不会清掉使用者或 CI 机器上的剪贴板内容，也不会因为拿不到 HWND 而不稳定。代价是没有覆盖"SetClipboardData 把数据真正放进系统剪贴板后 Explorer 能否粘贴"这一段——但这一段由 `fileClipboard.test.ts` 已有的契约断言兜底：传给真实 `SetClipboardData` 的第一个参数就是数字 `15`，这按定义就是预定义格式 `CF_HDROP`，而不是注册格式；同时断言了不再调用 `clipboard.writeBuffer`。

仍未实测：真实显卡/远程桌面会话里的 Explorer Ctrl+V、多显示器、以及 UAC 提权进程的剪贴板隔离。这些需要 GUI 验收，不适合放进单元测试。

## 12. LY-09 的剩余测绘：哪些列表还不受保护

日期：2026-10-07。第 9 节记录的"LY-09 已覆盖待办、备忘录、闹钟、倒数日与总览待办，其他列表结构仍未作通用一致性认证"到本节给出具体清单和迁移顺序。

已核实的保护机制有三层，都在 [`store.ts`](../src/main/ipc/app/store.ts)：`store:update-list` 按 `before`/`next` 走 [`mergeStoredList`](../src/main/ipc/app/listMerge.ts) 的条目与字段级合并，同字段冲突整单不写；revision 广播让渲染层丢弃过期响应；[`useStoredList`](../src/renderer/components/hooks/useStoredList.ts) 在渲染侧提供串行保存队列和 `before` 跟踪，并且已经带 `storageSync.*` 的冲突与失败双语反馈——也就是说迁移一个列表不需要再设计 UX。

`mergeStoredList` 的硬约束是每行必须有正整数 `id`（`isStoredList` 用 `Number.isSafeInteger(row.id) && row.id > 0` 校验）。据此把剩余列表分成三档：

| 存储键 | 条目类型 | 数值 id | 写入方 | 评估 |
| --- | --- | --- | --- | --- |
| `url-favorites` | `UrlFavoriteItem` | 有 | maxExpand 收藏页、`notificationHelpers`、`UrlFavoritesWidget` | **最高**：三个写入方跨窗口，且标题异步回填会再次整表覆盖 |
| shelf | `ShelfItem` | **无 id** | `shelfSlice` | **最高**：小岛拖入与工作台跨窗口写，且缺 id 无法直接套用合并 |
| `clipboard-history` | `ClipboardHistoryItem` | 有 | collector、`useClipboardHistoryItems`、设置页清空 | 中：写入最频繁，但主要在同一窗口 |
| 相册条目 | `AlbumItem` | 有 | `albumUtils`、`useAlbumItems` | 中：同窗口为主 |
| `app-shortcuts` | `AppShortcut` | 有 | `ToolsTab` 写、`OverviewTab` 只读 | 低：单写者 |
| break-reminder | `BreakReminderItem` | **id 是 string** | 部件与设置页 | 中：需要决定是否改成数值 id |
| `ui-custom-fonts` / `lyrics-custom-fonts` | 字体数组 | 未核实 | `ThemeSettingsPage` | 低：单写者 |

造成数据丢失的具体机制，以 `url-favorites` 为例：[`persistFavorites`](../src/renderer/components/states/maxExpand/components/urlFavorites/utils/urlFavoritesUtils.ts) 只拿当前数组整体 `storeWrite`，没有 `before` 快照；[`useUrlFavoritesPersistence`](../src/renderer/components/states/maxExpand/components/urlFavorites/hooks/useUrlFavoritesPersistence.ts) 的标题自动解析在异步回来后再次 `setFavorites`，于是多一次整表覆盖。两个窗口交错时，后写者用自己读到的旧快照覆盖前者的新增。

建议迁移顺序：先 `url-favorites`（收益最大、无 schema 障碍），再 clipboard-history 与相册；shelf 需要先给条目加稳定 id，break-reminder 需要先决定 id 类型，两者都不应混在功能迁移里顺手改。

清单里还有一处需要单独处理的陷阱：[`alarmUtils.ts`](../src/renderer/components/states/maxExpand/components/alarm/utils/alarmUtils.ts) 导出的 `persistAlarms` 用 `storeWrite` 整表写 `alarms`，绕开同一功能已在用的原子路径。**当前它在渲染层没有任何调用者**，所以不影响运行；但它是给下一个人准备的坑——一旦有人调用它，就会把已经修好的 LY-09 在闹钟上重新打开。迁移其他列表时不要参考它作为范例。
