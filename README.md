<div align="center">
  <h1><img src="assets/lingyu.svg" alt="灵屿 Logo" height="32" style="vertical-align: middle;" />&nbsp;灵屿 Lingyu</h1>
  <p><strong>免费、开源的 Windows 桌面灵动岛</strong></p>
  <p>基于 Electron + React + TypeScript 构建，灵感来自 Apple Dynamic Island</p>
  <p>免费 AI 对话、实时天气、同步歌词、音乐控制、文件暂存架、系统通知接管、音量 HUD、倒计时与系统工具</p>

  [![官网](https://img.shields.io/badge/官网-lingyu.tryworld.com.cn-4d8bff)](https://lingyu.tryworld.com.cn/)
  [![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
  [![Electron](https://img.shields.io/badge/Electron-43-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
  [![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
</div>

---

> **全免费 · 无广告 · 无会员 · 无付费墙**
> 桌面功能下载即用。AI 可连接本地模型或使用你自己的 API Key。

灵屿是一款受 Apple Dynamic Island 启发的 Windows 桌面灵动岛悬浮组件。
本项目由 TryWorld2026 基于开源项目 [eIsland](https://github.com/JNTMTMTM/eIsland) 二次开发，移除了上游账号、支付和会员依赖，逐项恢复独立可用的高级能力。
**Lingyu 的软件功能免费提供**；选择云端模型时，API 调用费用由你选择的模型服务收取。

## ✨ 功能

| 功能 | 说明 |
| --- | --- |
| 🕐 时间/农历 | 实时时钟与农历日期 |
| 🌤 天气 | Open-Meteo 免费天气源（无需 Key） |
| 🎵 音乐 + 歌词 | 系统媒体控制（SMTC）+ 多源同步歌词 |
| ⏳ 倒计时/闹钟 | 倒计时、番茄钟、闹钟提醒 |
| 📎 文件暂存架 | Yoink 式：拖文件到岛暂存，复制取回，只存路径不复制文件 |
| 🔔 通知接管 | 系统应用通知上岛显示 |
| 🔊 音量 HUD | 调节音量时灵动岛显示音量条 |
| 🔋 电量胶囊 | 电池电量与充电状态显示 |
| 🛠 系统工具 | 音量/亮度/蓝牙/WiFi/电源/进程/性能监控/截图 |
| ⚙️ 高度可定制 | 丰富的设置中心与快捷键 |
| 🤖 Lingyu AI | Ollama 本地模型或自带 Key 的 OpenAI 兼容 API；多轮对话、流式回复、Markdown 与取消，无账号和会员门槛 |

## 🤖 免费 AI

在全展开界面选择 **Lingyu AI**，或在 **设置 → AI 模型连接** 配置服务：

1. **本地模型：**先启动 Ollama 并安装模型，填写服务地址（默认 `http://127.0.0.1:11434`），点击“保存并加载模型”，选择模型后保存。
2. **自带 Key：**选择“OpenAI 兼容 API”，填写包含 `/v1` 的 Base URL、模型名称和自己的 Key。云端地址须使用 HTTPS；本机兼容服务可使用 HTTP 并留空 Key。
3. 输入问题开始对话；Enter 发送，Shift + Enter 换行。“停止生成”会取消请求，离开 AI 页也会停止生成。

Key 由主进程加密保存在本机，公开设置不返回 Key；更换服务地址后需重新填写。提示词随软件维护，对话直接发送到所选模型服务，不经过上游账号服务。当前对话保留在本次运行中，未自动保存聊天记录。

当前 AI 支持文字对话和使用说明，尚未接入自动桌面工具、MCP、联网检索或 1M 上下文配置；模型能力由所选服务决定。这些能力的恢复进度见 [免费能力核对](docs/LINGYU_FREE_FEATURES_AND_BRAND_2026-10-01.md)。

## 🎬 宣传片

<p align="center">
  <a href="https://lingyu.tryworld.com.cn/#promo" target="_blank">
    <img src="assets/screenshot-hover.png" alt="观看灵屿宣传片（点击前往官网）" width="90%" style="border-radius: 16px;" />
  </a>
  <br/>
  <em>👆 点击前往官网观看宣传片 · lingyu.tryworld.com.cn</em>
</p>

## 🖼 预览

<p align="center">
  <img src="assets/screenshot-idle.png" alt="贴顶形态" width="80%" />
  <br/>
  <em>贴顶形态 — 灵动岛悬浮于桌面顶部</em>
</p>

<p align="center">
  <img src="assets/screenshot-hover.png" alt="悬停形态" width="90%" />
  <br/>
  <em>悬停扩展 — 悬浮显示更多信息</em>
</p>

<p align="center">
  <img src="assets/screenshot-expanded.png" alt="展开形态" width="90%" />
  <br/>
  <em>展开面板 — 音乐控制与系统信息</em>
</p>

<p align="center">
  <img src="assets/screenshot-full.png" alt="全功能界面" width="90%" />
  <br/>
  <em>全功能界面 — 设置与系统工具</em>
</p>

## 🚀 安装

- 🌐 官网：https://lingyu.tryworld.com.cn/

1. 前往 [Releases](https://github.com/TryWorld2026/Lingyu/releases) 下载 `Lingyu-Setup.exe`
2. 双击安装，即可使用

> 提示：Windows SmartScreen 可能提示"未知发布者"，点击"更多信息 → 仍要运行"即可（免费项目暂未购买代码签名证书）。

## 🛠 开发

```bash
npm install
npm run dev        # 开发模式
npm run build      # 编译
npm run package    # 打包安装包
```

## 📄 许可证

本项目基于 [GPL-3.0-or-later](LICENSE) 发布，并附带原作者的附加条款（见 LICENSE 全文）：

- 必须保留以下署名：
  - Copyright (C) 2026-present JNTMTMTM (https://github.com/JNTMTMTM)
  - Copyright (C) 2026-present pyisland.com (https://pyisland.com)
- 本软件仅面向 Windows 平台开发，禁止移植/改编到任何 Apple 操作系统

## 🙏 致谢

- 原项目 [eIsland](https://github.com/JNTMTMTM/eIsland) 及其作者 JNTMTMTM、pyisland.com
- 天气数据：Open-Meteo（免费开源）
- 图标：iconfont
- 壁纸图片：NASA（Artemis II 任务）
