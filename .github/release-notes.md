## English

`v0.4.15` packages the self-hosted Server Web refresh and the matching `0.4.15` Plugin, VS Code extension, and Android metadata.

### What changed

- Adds the original-style self-hosted landing page, login flow, and device list.
- Aligns branding, favicon assets, color themes, GitHub links, Remote page layout, and footer sizing across the self-hosted pages.
- Serves the bundled `icon.png` and `brand-whale.webp` assets from the self-hosted Server.
- Documents self-hosting and the Tag packaging checks in `apps/server/README.md`.

### Verification

- `pnpm -r check` passes.
- `node scripts/verify-dsh-plugin.mjs` passes for `ds-harness-remote@0.4.15`.
- Plugin tarball packaging passes for `ds-harness-remote-0.4.15.tgz`.
- Server tests pass (11 tests).
- The full workspace test run still has 3 existing Plugin failures in Client capability expectations and saved Client startup timing; these are recorded for CI follow-up.

## 中文

`v0.4.15` 发布自部署 Server Web 页面更新，并同步 Plugin、VS Code 扩展和 Android 的 `0.4.15` 版本元数据。

### 主要变更

- 增加原版风格的自部署首页、登录流程和设备列表。
- 统一自部署页面的品牌图标、favicon、颜色主题、GitHub 链接、Remote 页面布局和页脚宽度。
- Server 直接提供 `icon.png` 与 `brand-whale.webp` 品牌资源。
- 在 `apps/server/README.zh.md` 中补充自部署和 Tag 打包检查说明。

### 验证

- `pnpm -r check` 通过。
- `node scripts/verify-dsh-plugin.mjs` 通过，插件版本为 `ds-harness-remote@0.4.15`。
- `ds-harness-remote-0.4.15.tgz` 打包通过。
- Server 测试 11 项全部通过。
- 全量 workspace 测试仍有 3 个既有 Plugin 测试失败，涉及 Client capability 断言和保存 Client 启动时序，待 CI 后续处理。

## English

`v0.4.14` is the cumulative upgrade from `v0.4.13`. It adds configurable ACP
(Agent Client Protocol) IDE backends, surfaces connected Clients in the Remote
host picker, and extends DeepSeek Harness compatibility to the
`dsh-v0.1.6-alpha.1` line. It contains the changes since `v0.4.13`
([full comparison](https://github.com/liguobao/ds-harness-remote/compare/v0.4.13...v0.4.14)).

### What changed

- Adds configurable ACP IDE backends: a backend-neutral `AcpGateway`, a stdio
  JSON-RPC adapter, the `agent.acp.v1` capability with bounded prompt and update
  limits, and a Remote settings surface to enable, add, and probe backends
  (Codex, Cursor, Kimi, or a custom command). ACP is on by default but gated on
  an availability check, so a missing CLI reports `not installed` instead of
  failing the Host.
- Shows Host-side connected Clients as a `{count} connected` pill next to
  Refresh in the Remote host picker, with a dropdown listing the peers and their
  platform.
- Adds experimental `dsh-v0.1.6-alpha.1` support. A `0.1.6` Host reports patch
  `6`, which already selects the v0.1.5 Session V3 Typert Remote Gateway profile,
  so no wire-format adapter or version branch was needed.
- Extends the DSH peer dependency matrix to `>=0.1.5-alpha.1` and drops the
  `0.1.5-rc.1` upper bound. The range is intentionally left open-ended.
- Selects the command attachment field by Host version, so `dsh-commands` 0.1.2
  (`images`) and newer builds both round-trip image prompts.
- Publishes the `harnessCapabilities` constant from protocol §17, documents the
  control extensions, marks `webrtcEnabled` as an implementation extension, and
  adds the `HARNESS_VERSION_INCOMPATIBLE` and `RESPONSE_TOO_LARGE` error codes.
- Android: opens on the device list titled `DSH Remote` instead of connecting to
  the remembered Host on launch (`resolveAutoConnectDevice` is kept but no longer
  routed), adds per-host workspace favorites shown as home-screen links that
  connect and open the workspace's latest conversation, falls back to the three
  most recently visited workspaces while Favorites is empty, shows the device and
  transport as the workspaces header with back navigation, and aligns assistant
  activity, reasoning, and answer text on one left edge.
- Android: offers the conversation quick actions (review changes, commit,
  review screenshot) in Harness conversations as well as CodeX ones, stops icon
  buttons from painting solid black interiors in the light theme (the plus showed
  up as a filled black circle) with the create buttons now using the accent tint,
  and keeps the remembered workspace collapse when a home-screen shortcut opens
  the list.
- Synchronizes the Plugin, VS Code extension, and Android app at version
  `0.4.14` with Android `versionCode 31`.

### Verification

- `pnpm -r check`, `pnpm -r test`, `node scripts/verify-dsh-plugin.mjs`, and a
  frozen-lockfile install all pass on this tag.
- The Web → Host main path was verified against a standalone
  `dsh-v0.1.6-alpha.1` instance running this Plugin build. Cross-machine, CodeX,
  Android, VS Code, and WebRTC coverage on `0.1.6` remains tracked in `TODO.md`.

### Install and downloads

Install through DSH's plugin manager:

```sh
dsh plugin --profile web add -w ds-harness-remote@0.4.14
dsh plugin --profile dsh-tui add -w ds-harness-remote@0.4.14
```

- [npm package](https://www.npmjs.com/package/ds-harness-remote/v/0.4.14)
- [Android APK](https://github.com/liguobao/ds-harness-remote/releases/download/v0.4.14/dsh-remote-android-v0.4.14.apk)
- Release assets also include the npm tarball and `SHA256SUMS.txt`.

## 中文

`v0.4.14` 是从 `v0.4.13` 升级的累计版本。新增可配置的 ACP（Agent Client Protocol）
IDE backend、在 Remote Host 选择器里显示已连接 Client，并把 DeepSeek Harness 兼容线
扩展到 `dsh-v0.1.6-alpha.1`。本版本包含自 `v0.4.13` 以来的改动
（[完整对比](https://github.com/liguobao/ds-harness-remote/compare/v0.4.13...v0.4.14)）。

### 主要变更

- 新增可配置 ACP IDE backend：后端中立的 `AcpGateway`、stdio JSON-RPC 适配器、
  带 prompt/update 上限的 `agent.acp.v1` capability，以及在 Remote 设置面板中启用、
  新增和探测 backend（Codex、Cursor、Kimi 或自定义命令）。ACP 默认开启，但以可用性
  检测为前提，CLI 缺失时显示 `not installed` 而不会让 Host 加载失败。
- Remote Host 选择器在 Refresh 旁以 `{count} connected` pill 显示 Host 侧已连接的
  Client，下拉可查看 peers 及其平台。
- 新增实验性 `dsh-v0.1.6-alpha.1` 支持。`0.1.6` Host 上报的 patch 为 `6`，本身就会
  选中 v0.1.5 Session V3 Typert Remote Gateway profile，因此不需要 wire format
  适配层或版本分支。
- DSH peer dependency 矩阵扩展到 `>=0.1.5-alpha.1`，并去掉 `0.1.5-rc.1` 上界；
  该范围有意保持开放。
- 按 Host 版本选择命令附件字段，使 `dsh-commands` 0.1.2（`images`）与更新版本都能
  正常往返图片 Prompt。
- 补齐协议 §17 的 `harnessCapabilities` 常量，补充 control extensions 文档，把
  `webrtcEnabled` 标注为实现扩展，并新增 `HARNESS_VERSION_INCOMPATIBLE` 与
  `RESPONSE_TOO_LARGE` 错误码。
- Android：记住上次连接的 Host 并自动重连，连接后以 workspace 为主页、设备列表降为
  次级页面，过期会话跳回登录，并把 assistant activity、reasoning 与回答正文对齐到同一条
  左边缘。
- Plugin、VS Code Extension 与 Android App 版本统一更新为 `0.4.14`，Android
  `versionCode` 更新为 `31`。

### 验证

- 该 tag 上 `pnpm -r check`、`pnpm -r test`、`node scripts/verify-dsh-plugin.mjs`
  与 frozen-lockfile 安装全部通过。
- Web → Host 主链路已在独立 `dsh-v0.1.6-alpha.1` 实例 + 本 Plugin 构建上验证。
  `0.1.6` 的跨机、CodeX、Android、VS Code 与 WebRTC 覆盖仍记录在 `TODO.md`。

### 安装与下载

请通过 DSH Plugin 管理器安装：

```sh
dsh plugin --profile web add -w ds-harness-remote@0.4.14
dsh plugin --profile dsh-tui add -w ds-harness-remote@0.4.14
```

- [npm 包](https://www.npmjs.com/package/ds-harness-remote/v/0.4.14)
- [Android APK](https://github.com/liguobao/ds-harness-remote/releases/download/v0.4.14/dsh-remote-android-v0.4.14.apk)
- Release 附件还包括 npm tarball 与 `SHA256SUMS.txt`。
