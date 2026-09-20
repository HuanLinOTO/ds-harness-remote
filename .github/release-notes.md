## English

`v0.4.15` adds native remote development tools, a minimal self-hosted Server, safer Host authorization recovery, and automated Host installation. [Full comparison from v0.4.14](https://github.com/liguobao/ds-harness-remote/compare/v0.4.14...v0.4.15).

### What changed

- Adds the native workspace file tree and read-only previews through official Harness APIs, while retaining the optional dsh-file-viewer provider. Moves the development baseline to Harness `0.1.6-alpha.2`.
- Adds opt-in remote terminals. The Host-local **Remote terminal** switch saves and takes effect immediately without a restart; terminals run as the Host user, independently of Agent approvals. Terminal ownership is isolated by device, input authority by connection, and input is never replayed after disconnect.
- Adds **Preview service** to the Remote Header for HTTP/WebSocket development services on explicitly allowed Host `127.0.0.1` ports. Preview uses a separate random local origin and closes on disconnect or leaving Remote. It currently supports Desktop and browsers connected to a local Harness, not Remote Web, Android, or VS Code preview UI.
- Applies **Remote preview ports** live through the adjacent **Save access settings** button. Terminal and preview access settings can only be changed on the Host; remote settings calls cannot enable them. Terminals are off and the port allowlist is empty by default.
- Adds the minimal open-source self-hosted Server: an environment-configured single account, persistent device credentials and refresh, device discovery, Control/Noise handshake forwarding, and encrypted Relay. Includes a Dockerfile, Compose configuration, deployment documentation, and a version-tag-gated GHCR image workflow. This version is single-process and Relay-only; it does not provide Remote Web conversations, multi-account administration, WebRTC, or TURN.
- Refreshes the self-hosted landing, login, and device-status pages with consistent branding, favicon assets, theme switching, GitHub links, and layout. Bundles `icon.png` and `brand-whale.webp` and documents release/tag packaging checks.
- Fixes Host authorization recovery (#70): serializes credential refresh across processes, rereads credentials under the lock, retries a rejected handshake once after refresh, and stops automatic reconnect when another Host replaces the connection (`4003` / `CONNECTION_REPLACED`). Documents separate `DSH_HOME` directories for concurrent Hosts and recovery from an abandoned credential lock.
- Replaces repeated Desktop Host-status polling with one shared loopback SSE subscription for the Remote Header, workspace chooser, settings, and file viewer. Sends an initial full status and subsequent changes, with keep-alives while idle; older Hosts and unsupported carriers retain the unary status fallback.
- Adds self-contained macOS/Linux and Windows Host installation and uninstall scripts with background-service setup, CLI availability, and corrected profile installation using `-w`. Windows uses a private Node.js/pnpm/DSH runtime and WinSW under `%LOCALAPPDATA%\dsh-remote`, with a shared fixed `DSH_HOME` for the service and CLI; uninstall preserves profiles and credentials.
- Adds a packaged Chrome/Edge extension ZIP to release assets. Synchronizes Plugin, VS Code, and Android version metadata to `0.4.15`.

### Verification and remaining validation

- The final tag points to `b02277e`, which fixes the Client capability assertions and saved Client startup timing in tests. The earlier report of three failing Plugin tests no longer applies to this tag.
- [Tag CI](https://github.com/liguobao/ds-harness-remote/actions/runs/35507163143) and the [Release workflow](https://github.com/liguobao/ds-harness-remote/actions/runs/35507163128) pass: frozen-lockfile install, workspace checks/tests/production build, committed Host bundle verification, Plugin packaging, browser-extension packaging, and Android APK build/upload. Server coverage includes 11 core tests.
- Docker image build/container startup, self-hosted cross-machine and reverse-proxy endurance checks, Windows installation/multiple-instance checks, and native sidebar/terminal/preview cross-machine and real-network regression remain pending. The GHCR workflow configuration is not deployment acceptance.
- The known Metro `@noble/hashes/crypto.js` package-exports fallback warning remains tracked in `TODO.md`.

### Install and downloads

Install through DSH’s plugin manager and restart Harness:

```sh
dsh plugin --profile web add -w ds-harness-remote@0.4.15
dsh plugin --profile dsh-tui add -w ds-harness-remote@0.4.15
```

- [npm package](https://www.npmjs.com/package/ds-harness-remote/v/0.4.15)
- [Android APK](https://github.com/liguobao/ds-harness-remote/releases/download/v0.4.15/dsh-remote-android-v0.4.15.apk)
- [Chrome/Edge extension ZIP](https://github.com/liguobao/ds-harness-remote/releases/download/v0.4.15/dsh-remote-browser-v0.4.15.zip)
- [Plugin tarball](https://github.com/liguobao/ds-harness-remote/releases/download/v0.4.15/ds-harness-remote-0.4.15.tgz) · [SHA256SUMS (tarball and extension ZIP)](https://github.com/liguobao/ds-harness-remote/releases/download/v0.4.15/SHA256SUMS.txt)

## 中文

`v0.4.15` 新增原生远程开发能力、最小自部署 Server、安全的 Host 授权恢复与自动安装。包含[自 v0.4.14 以来的改动](https://github.com/liguobao/ds-harness-remote/compare/v0.4.14...v0.4.15)。

### 主要变更

- 接入 Harness 官方原生工作区文件树与只读预览，保留可选的 dsh-file-viewer 通道；开发基线升级至 Harness `0.1.6-alpha.2`。
- 新增可选远程终端。Host 本机「远程终端」开关切换即保存、立即生效，无需重启；终端以 Host 用户身份运行，独立于 Agent 审批。终端归属按设备隔离、输入权按连接隔离，断线后不重放输入。
- Remote 顶栏新增「预览服务」，支持访问 Host 明确授权的 `127.0.0.1` 端口上的 HTTP/WebSocket 开发服务。预览使用独立随机本机 origin，断线或退出 Remote 后关闭；当前仅支持 Desktop 和连接本机 Harness 的浏览器，不提供 Remote Web、Android 或 VS Code 预览入口。
- 「远程预览端口」通过输入框右侧「保存访问设置」按钮提交并立即生效。终端与预览访问设置只能在 Host 本机修改，远程 settings 调用不能开启；终端默认关闭，预览端口白名单默认为空。
- 新增最小开源自部署 Server：环境变量配置单账号、设备凭据持久化与刷新、设备发现、Control/Noise 握手转发和加密 Relay。提供 Dockerfile、Compose、部署文档及仅版本 Tag 触发的 GHCR 镜像工作流。该版本为单进程、Relay-only，不包含 Remote Web 会话、多账号管理、WebRTC 或 TURN。
- 更新自部署首页、登录页与设备状态页，统一品牌图标、favicon、主题切换、GitHub 链接和页面布局；内置 `icon.png`、`brand-whale.webp`，补充 Release/Tag 打包检查说明。
- 修复 Host 授权恢复问题（#70）：跨进程互斥刷新凭据，获得锁后重新读取凭据；握手被拒绝后最多刷新并重试一次；连接被其他 Host 替换（`4003` / `CONNECTION_REPLACED`）时停止自动重连。补充并行 Host 使用独立 `DSH_HOME` 和异常退出后凭据锁恢复说明。
- Desktop Host 状态改为共享 loopback SSE 推送，Remote 顶栏、工作区选择器、设置和文件预览共用订阅。首次发送完整状态，后续按变化推送、空闲时保活；旧 Host 或不支持的载体保留原有单次状态读取回退。
- 新增 macOS/Linux、Windows 自动安装与卸载脚本，配置 Host 后台服务和 CLI，并用 `-w` 修复 profile 安装。Windows 使用 `%LOCALAPPDATA%\dsh-remote` 下的独立 Node.js/pnpm/DSH 与 WinSW；服务和 CLI 共用固定 `DSH_HOME`，卸载保留 profile 与凭据。
- Release 附件新增 Chrome/Edge 扩展 ZIP，Plugin、VS Code 与 Android 版本元数据统一为 `0.4.15`。

### 验证与待验证范围

- 最终 Tag 指向 `b02277e`，已修正 Client capability 断言和保存 Client 启动时序测试；此前「3 项 Plugin 测试失败」不再适用于此 Tag。
- [Tag CI](https://github.com/liguobao/ds-harness-remote/actions/runs/35507163143) 与 [Release 工作流](https://github.com/liguobao/ds-harness-remote/actions/runs/35507163128) 均通过：frozen-lockfile 安装、workspace 检查/测试/生产构建、已提交 Host bundle 校验、Plugin 打包、浏览器扩展打包及 Android APK 构建上传。Server 包含 11 项核心测试。
- Docker 镜像构建与容器启动、自部署跨机和反向代理长期连接、Windows 安装/双实例，以及原生侧栏/终端/预览的跨机和真实网络回归仍待验证；已配置 GHCR 工作流不等于完成部署验收。
- Metro 对 `@noble/hashes/crypto.js` 的 package exports fallback 警告仍记录在 `TODO.md`。

### 安装与下载

通过 DSH Plugin 管理器安装，完成后重启 Harness：

```sh
dsh plugin --profile web add -w ds-harness-remote@0.4.15
dsh plugin --profile dsh-tui add -w ds-harness-remote@0.4.15
```

- [npm package](https://www.npmjs.com/package/ds-harness-remote/v/0.4.15)
- [Android APK](https://github.com/liguobao/ds-harness-remote/releases/download/v0.4.15/dsh-remote-android-v0.4.15.apk)
- [Chrome/Edge extension ZIP](https://github.com/liguobao/ds-harness-remote/releases/download/v0.4.15/dsh-remote-browser-v0.4.15.zip)
- [Plugin tarball](https://github.com/liguobao/ds-harness-remote/releases/download/v0.4.15/ds-harness-remote-0.4.15.tgz) · [SHA256SUMS (tarball and extension ZIP)](https://github.com/liguobao/ds-harness-remote/releases/download/v0.4.15/SHA256SUMS.txt)
