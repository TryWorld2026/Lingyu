# Lingyu 免费能力与品牌目标核对

日期：2026-10-01。延续当前项目与上游的对抗式审查，并按用户补充的产品目标调整判断重点。

**用户目标：把上游付费能力在 Lingyu 中免费提供，并打造、强化 Lingyu 品牌。** 用户已明确“免费”的口径：软件功能免费，AI 支持本地模型和用户自带 API Key。Lingyu 不应再以会员资格限制这些软件能力；第三方模型调用费用按用户选择的服务计算，不默认承诺由 Lingyu 补贴云端调用。

差距核对以本地 `d4a0e5ad` 和上游 `68d26bbc` 为基线。当前工作区已完成入口／IPC、免费 AI 第一阶段及继续功能修复和本地打包，尚未提交或发布；第 7 节记录各阶段结果，原始审查证据保留不变。

## 1. 当前完成度判断

Lingyu 已经具备独立产品的基础：安装包使用 `com.lingyu.app`／`Lingyu`，有自己的图标、域名、GitHub 发布仓库及关于页；账号／支付入口已被移除，天气改用其他数据源，更新源不再按 Pro 资格限制。

**去除收费体系与保留原收费能力是两个需要分别验收的工作项。** 基线曾移除 AI 客户端、聊天页和模型设置。现在已恢复独立的 Ollama／自带 Key 文字对话、模型连接设置、流式 Markdown 和取消；工具调用、上下文容量配置及天气预警仍待恢复，不能宣传“上游付费能力已经完整免费化”。

基线证据是 README 当时描述“剥离了全部收费功能与自建服务依赖”，且缺少 AI 路由。当前实现见 [主进程 AI 服务](../src/main/ai/ipc.ts)、[聊天页](../src/renderer/components/states/maxExpand/components/ai/AiTab.tsx) 与 [免费 AI 验收](LINGYU_FREE_AI_2026-10-01.md)。残留翻译、类型和 SDK 不能当作功能可用的证据。

## 2. 已核实的上游 Pro 能力及本地差距

下表依据上游明确的角色判断、disabled 条件和客户端检查，不能由“看起来高级”推断某功能收费。线上实际套餐和服务端资格规则未作完整验证。

| 上游受 Pro 限制的能力 | 上游源码证据 | 当前 Lingyu 状态 | 免费化完成标准 |
| --- | --- | --- | --- |
| Ollama 本地模型／Agent | [ollamaLocalAgent.ts:137](https://github.com/JNTMTMTM/eIsland/blob/68d26bbcbe97eddd7d533cfd2b81632cf7ffe3df/src/renderer/api/ai/ollamaLocalAgent.ts#L137) 要求登录及 Pro | 第一阶段已实现模型列表、文字对话、流式显示与取消；工具未接入 | 无 Lingyu／上游账号也可连接用户本地模型，完成对话、取消和明确范围的工具调用 |
| 自定义 AI API／用户 Key | [agentRunnerPreparation.ts:58](https://github.com/JNTMTMTM/eIsland/blob/68d26bbcbe97eddd7d533cfd2b81632cf7ffe3df/src/renderer/components/states/agent/utils/agentRunnerPreparation.ts#L58)、[AiSettingsSection.tsx:240](https://github.com/JNTMTMTM/eIsland/blob/68d26bbcbe97eddd7d533cfd2b81632cf7ffe3df/src/renderer/components/states/maxExpand/components/setting/components/ai/AiSettingsSection.tsx#L240) | 已实现 OpenAI 兼容 Chat Completions、自选地址／模型、加密 Key；尚未用真实云端账号验收 | 用户自选 endpoint／model／Key，软件侧不收会员费，不向上游账号服务转交 Key |
| 部分模型选择与长上下文选项 | [useChatState.ts:262](https://github.com/JNTMTMTM/eIsland/blob/68d26bbcbe97eddd7d533cfd2b81632cf7ffe3df/src/renderer/components/states/maxExpand/components/agent/hooks/useChatState.ts#L262)、[chatConstants.ts:30](https://github.com/JNTMTMTM/eIsland/blob/68d26bbcbe97eddd7d533cfd2b81632cf7ffe3df/src/renderer/components/states/maxExpand/components/agent/config/chatConstants.ts#L30) | 模型名不按会员限制；上下文容量选择尚未实现 | 软件不按会员锁模型／上下文，实际支持范围由所选模型与服务决定 |
| 和风天气源与启动天气预警 | [WeatherSettingsSection.tsx:243](https://github.com/JNTMTMTM/eIsland/blob/68d26bbcbe97eddd7d533cfd2b81632cf7ffe3df/src/renderer/components/states/maxExpand/components/setting/components/weather/WeatherSettingsSection.tsx#L243)、[同文件:292](https://github.com/JNTMTMTM/eIsland/blob/68d26bbcbe97eddd7d533cfd2b81632cf7ffe3df/src/renderer/components/states/maxExpand/components/setting/components/weather/WeatherSettingsSection.tsx#L292) | 保留普通天气，类型与选项主要为 Open-Meteo／UAPI；未保留对应预警流程 | 单独补齐预警能力，核实数据源覆盖与使用条件，不把普通天气展示算作预警已实现 |
| COS／OSS 更新与静态资源节点 | [dynamicIslandUpdateSource.ts:29](https://github.com/JNTMTMTM/eIsland/blob/68d26bbcbe97eddd7d533cfd2b81632cf7ffe3df/src/renderer/components/config/dynamicIslandUpdateSource.ts#L29)、[SettingsTab.tsx:383](https://github.com/JNTMTMTM/eIsland/blob/68d26bbcbe97eddd7d533cfd2b81632cf7ffe3df/src/renderer/components/states/maxExpand/components/SettingsTab.tsx#L383) | 更新源取消 Pro 限制，已有自有 Cloudflare 下载配置；静态资源选项只有 R2 | 免费用户可稳定下载 Lingyu 自己的更新／资源；来源、版本和完整性验证正确 |

其中前三项最符合已确认的免费 AI 路线，应优先恢复。更新加速应按下载成功率和体验验收，底层使用哪个云厂商不必照搬上游。

## 3. AI 免费化的真正依赖

上游本地 Ollama 路径仍先向账号服务获取 system prompt，见 [ollamaLocalAgent.ts:79](https://github.com/JNTMTMTM/eIsland/blob/68d26bbcbe97eddd7d533cfd2b81632cf7ffe3df/src/renderer/api/ai/ollamaLocalAgent.ts#L79)。该接口要求 token，见 [mihtnelisAgentStream.ts:283](https://github.com/JNTMTMTM/eIsland/blob/68d26bbcbe97eddd7d533cfd2b81632cf7ffe3df/src/renderer/api/ai/mihtnelisAgentStream.ts#L283)。因此免费独立运行需要连同提示词、工具定义与会话编排一起建立。

建议第一阶段做到：

1. **本地模型入口：**连接地址、模型列表、连接检查、对话与取消均独立可用；测试时阻断上游账号域名，功能仍正常。
2. **自带 Key 入口：**支持明确的 API 协议、endpoint 和 model；凭据交给所选模型服务，渲染页外链不能读到。验证流式响应、服务失败、取消与重启后的配置行为。
3. **Lingyu 提示词与工具定义：**描述本项目实际存在的功能，缺失功能不宣传为可用。用户授权自行安排后，当前提示词确定为本仓库的 [systemPrompt.ts](../src/main/ai/systemPrompt.ts)，由本地主进程注入，并同步 AGENTS.md 的维护入口。第一阶段没有工具，提示词明确禁止声称已访问私有文件或执行桌面动作。
4. **模型能力边界：**软件侧开放选项，显示模型实际支持的上下文；不能将解锁原 1M 选项当作所有模型都具备 1M 能力。

## 4. 免费化残留需要按可达性核对

- 更新资格已解除：[dynamicIslandUpdateSource.ts:50](../src/renderer/components/config/dynamicIslandUpdateSource.ts#L50) 返回 false，[settingsTabConfig.ts:83](../src/renderer/components/states/maxExpand/components/setting/config/settingsTabConfig.ts#L83) 的 Pro 集合为空。
- 当前设置仍把 `isProUser` 固定为 false：[SettingsTab.tsx:209](../src/renderer/components/states/maxExpand/components/SettingsTab.tsx#L209)。[storage.ts:172](../src/renderer/store/utils/storage.ts#L172) 也保留身份决定节点的规则；当前 UI 只提供 R2，所以这是待恢复能力时需要处理的旧规则，不能直接说用户已经遇到一个可点击的付费墙。
- COS／OSS 更新值会被转换为 GitHub：[updater.ts:39](../src/main/ipc/app/updater.ts#L39)。类型支持一个名称，不证明 provider 已实现。
- 翻译文件仍含“购买 Pro”等文本：[zh-CN.json:3107](../i18n/zh-CN.json#L3107)。未找到现行支付页，应标为残留资源，不能据此认定当前 UI 仍收费。清理时需同时处理 en-US，并保留恢复功能真正需要的非付费文案。

## 5. 品牌建设现状与改进

建议定位为：**“灵屿 Lingyu，免费开源的 Windows 桌面助手。”** 产品主叙事围绕桌面效率、功能开放和模型选择；AI 未完成验收前，宣传只描述当前可用功能。

| 品牌触点 | 当前证据 | 下一步 |
| --- | --- | --- |
| 安装与系统身份 | [electron-builder.json:2](../electron-builder.json#L2) 已配置 Lingyu appId、productName、图标、发布仓库 | 验证真实 installer、卸载项、任务栏与系统通知均正确显示 Lingyu |
| 关于页与产品入口 | [AboutSettingsSection.tsx:93](../src/renderer/components/states/maxExpand/components/setting/components/about/AboutSettingsSection.tsx#L93) 已关联 TryWorld2026、Lingyu 官网和本仓库 | 统一产品名、维护者／出品方和反馈入口；上游来源信息保留在致谢与许可记录 |
| 软件包元数据 | [package.json:6](../package.json#L6) 已补齐 TryWorld2026、官网、仓库和反馈地址；contributors 保留原作者 | 验证正式安装包中的发行主体信息 |
| 社区与支持路径 | [CONTRIBUTING.md](../.github/CONTRIBUTING.md)、[SECURITY.md](../.github/SECURITY.md) 已改为 Lingyu 技术栈和本仓库反馈；issue 安全入口已改到本项目 | 上线前核实实际维护渠道，不承诺未经确认的私密报告功能或响应 SLA |
| 免费承诺文案 | README 和关于页已统一免费软件／第三方模型成本口径，关于页添加本项目反馈入口 | 后续官网与发布文案随实际验收范围更新 |
| 用户认可与传播 | 项目已有音乐、天气、暂存架、剪贴板、笔记、倒数日等能力 | 选择能稳定演示的桌面效率场景，记录明确的功能改善；发布视频、截图和说明随验收后的版本更新 |

版权头部、许可证与用户看到的产品身份是不同用途的记录。品牌工作应明确 Lingyu 的产品和维护主体，并保留现有上游来源署名。

官网页面本次网页抓取失败，未验证线上视觉和当前内容；不据此判断官网不可用。仓库内域名与产品入口已经核实。

## 6. 调整后的实施顺序

1. **先确保免费承诺可信：**修复外链 IPC、剪贴板关闭失效、重复闹钟、文件剪贴板这些已复现问题，并处理 CI 执行边界。它们会直接损害用户信任和品牌口碑，证据见 [工程审查报告](ADVERSARIAL_REVIEW_2026-10-01.md)。
2. **优先补齐可独立免费运行的 AI：**Ollama → 用户自带 Key → Lingyu 提示词与工具；每项都以无账号、无 Pro、无上游服务依赖的真实使用链路验收。
3. **补齐其余付费能力的用户收益：**预警和免费加速下载独立验收；明确服务成本与可用范围，不要求完整复制上游的服务器架构。
4. **同步完善品牌触点：**维护者信息、社区文档、反馈入口、关于页、首启引导、安装包和官网文案一致；发布内容只展示已完成能力。

对外表述应随完成度更新：当前可以承诺现有软件功能免费；完成对应验收后，再逐项宣传本地 AI、自带 Key 和恢复的高级能力。产品成功标准是用户获得完整、稳定的免费体验，并清楚知道产品由 Lingyu 维护与发行。

## 7. 当前落地状态

已完成外链／IPC 权限边界修复：窗口只信任各自入口与主 frame，外链交给外部浏览器；preload 不再暴露环境变量和通用 invoke。该修复的 99 个文件、1,239 项测试及原生权限证据见 [工程报告第 7 节](ADVERSARIAL_REVIEW_2026-10-01.md)。

免费 AI 第一阶段已接入全展开导航和设置搜索，包含独立本地提示词、Ollama／OpenAI 兼容服务、多轮文字对话、流式 Markdown、取消与 Key 加密。中英文均已补齐。完整测试 104 个文件、1,289 项通过；类型检查、构建和翻译检查通过。原生 Electron 的实际页面／preload／主进程／网络流及 Windows 凭据加密链路通过自有模拟接口验收，进程正常退出。

以上为第一阶段当时的结果；使用方法和边界见 [免费 AI 实施与验收](LINGYU_FREE_AI_2026-10-01.md)。当时未生成 installer，LY-02 至 LY-13 和原有 3 处注释失败待处理。

继续修复后的完整测试为 **112 个文件、1,351 项通过**，类型、构建、双语与注释门禁全通过。已处理 CI、剪贴板开关、周期闹钟、计时器、多窗口保存及网络／搜索边界，补齐原生插件与辅助程序的打包依赖，修正 Lingyu.exe 的真实版本。15 个功能页、9 个设置分区及 35 个子页中英文渲染通过；已生成本地 Lingyu 0.3.8 NSIS 安装包，未安装、签名或发布。

实际验收范围见 [功能报告](FUNCTIONAL_VERIFICATION_2026-10-01.md)。真实模型、硬件控制、Explorer 粘贴、安装／升级及更新认证仍需验收；工具调用、MCP、联网检索、上下文容量配置及天气预警仍未恢复，不能宣传完整上游 Pro 能力免费化。
