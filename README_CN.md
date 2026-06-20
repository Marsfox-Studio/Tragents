<p align="center">
  <img src="./apps/web/static/logo.png" width="132" alt="Tragents logo" />
</p>

<h1 align="center">Tragents</h1>

<p align="center">
  本地优先的翻译工作台，面向长文本、产品文案、i18n 文件、代码注释和字幕。
</p>

<p align="center">
  <a href="./README.md">English</a>
  ·
  <a href="#本地运行">本地运行</a>
  ·
  <a href="#翻译模式">翻译模式</a>
  ·
  <a href="#社区">社区</a>
</p>

<p align="center">
  <img alt="build" src="https://img.shields.io/github/actions/workflow/status/Marsfox-Studio/Tragents/ci.yml?branch=main&label=build&style=for-the-badge" />
  <img alt="release" src="https://img.shields.io/badge/release-v0.10.1-2f6fed?style=for-the-badge" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-111111?style=for-the-badge" />
  <img alt="svelte" src="https://img.shields.io/badge/Svelte-5.x-ff3e00?style=for-the-badge" />
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-11.x-f69220?style=for-the-badge" />
</p>

<p align="center">
  <video src="./packages/resources/demo.mp4" controls width="860"></video>
</p>

---

Tragents 处理的是那些“格式和文字同样重要”的翻译任务。

一句话可以直接丢给模型。游戏本地化文件、字幕轨、README、章节草稿，或者一个仓库里的代码注释，
通常还要处理分片、复核、占位符、格式回填、术语一致性和过程记录。Tragents 把这些步骤做进一个
可以用自己 API key 运行的浏览器应用里。

开源 Web 版没有 Tragents 托管后端。Provider、项目、术语表、检查点、运行中任务和活动记录都保存在
浏览器本地。

## 能做什么

- 用可配置 Pipeline 跑翻译：translator、reviewer、consistency，以及可选 summarizer。
- 长文本支持分片、上下文摘要、并行 chunk 翻译和 provider 级限流。
- 结构化文件不会被粗暴压成普通文本；翻译后会尽量按原格式回写。
- 每次翻译可继承项目偏好：语气、读者、场景、约束、术语表和轻量项目记忆。
- IndexedDB 保存项目状态、任务、会话、检查点和活动记录。
- 支持本地备份导出/导入，也可以把同一份备份同步到你自己的 GitHub 私有仓库。
- BYOK：支持 Anthropic、OpenAI 和 OpenAI-compatible endpoint。

## 翻译模式

| 模式 | 适合输入 | Tragents 会重点保护 |
| --- | --- | --- |
| `text` | 短文本、消息、UI 文案 | 当前 Pipeline 的直接输出 |
| `long-form` | 书稿、论文、文章、长帖 | 分片顺序、上下文、一致性 |
| `document` | Markdown、HTML、LaTeX | 文档结构和标记 |
| `i18n` | JSON、YAML、`.po`、Android XML、iOS `.strings`、`.properties`、Fluent | key、占位符、回写形状 |
| `code-docs` | TS/JS、Python、Go、Rust 注释和 docstring | 注释之外的源码 |
| `subtitles` | `.srt`、`.vtt` | cue 编号和时间戳 |
| `ptp` | 按段落推进的项目翻译 | 行状态、检查点、逐行结果 |

## Pipeline

```text
检测或解析 -> 翻译 -> 复核 -> 一致性扫描 -> 合稿或回填
```

每个角色都可以指定不同 provider 和模型。快一点的配置可以只有一个 translator；更谨慎的配置可以加
reviewer、长文本 summarizer 和最后的一致性扫描。不同模式可以绑定不同默认 Pipeline，单次翻译也能
在输入区临时覆盖。

Provider 支持保持简单：

- Anthropic
- OpenAI
- OpenAI-compatible endpoint，包括本地服务和托管兼容 API

模型 ID 保留为可编辑文本，因为兼容端点之间没有统一的模型目录。

## 本地数据边界

Tragents 不会把项目数据发到 Tragents 服务器。

- API key 使用 WebCrypto 加密后存入 IndexedDB。
- 项目、术语表、检查点、任务、会话、活动记录和项目记忆保存在本地。
- 备份会包含工作区数据，但刻意不包含 provider 密钥和 GitHub token。
- 可选 GitHub 备份会从浏览器直接调用 GitHub Contents API。token 只在本机加密保存，不会写进备份 JSON。
- 页面刷新后会修正残留的 running 任务，避免旧流式任务看起来还在运行。
- 翻译内容仍会发送给你选择的模型 provider。

## 本地运行

需要：

- Node.js 22.13+（推荐 Node 24）
- pnpm 11+

```bash
pnpm install
pnpm dev
```

打开 <http://localhost:5173>。

生产构建：

```bash
pnpm build
pnpm preview
```

静态产物在 `apps/web/build/`。

## 仓库结构

```text
apps/web/         SvelteKit 应用、路由、stores、IndexedDB、WebCrypto
packages/core/    providers、agents、parsers、modes、orchestrator
packages/shared/  共享类型、prompt、常量
packages/ui/      theme tokens 和少量共享 UI
scripts/          项目维护脚本
```

## Roadmap

| 版本 | 重点 |
| --- | --- |
| v0.10 | 个性化、项目记忆、本地备份、GitHub 私有仓库备份 |
| v0.11 | 桌面壳、原生文件对话框、系统 Keychain 存储 |
| v0.12 | 面向 i18n 文件和代码注释的 VS Code 工作流 |

Hosted API 会和开源 BYOK 版本分开设计。

## 社区

- linux.do: <https://linux.do/>
- X: [@AflydreamCat](https://x.com/AflydreamCat)
- Telegram 频道: [@marsfox_offical](https://t.me/marsfox_offical)

## Star History

<a href="https://www.star-history.com/?repos=Marsfox-Studio%2FTragents&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=Marsfox-Studio/Tragents&type=date&theme=dark&legend=bottom-right" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=Marsfox-Studio/Tragents&type=date&legend=bottom-right" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=Marsfox-Studio/Tragents&type=date&legend=bottom-right" />
 </picture>
</a>

## License

MIT，见 [LICENSE](./LICENSE)。
