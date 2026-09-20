## English

- Adds the native workspace file tree and read-only previews for Harness `0.1.6-alpha.2`.
- Adds remote terminals and development-service previews, enabled locally on the Host with settings that apply immediately. Previews currently require Desktop or a browser connected to a local Harness.
- Adds a single-account self-hosted relay with Docker deployment files, plus refreshed landing, login, and device-status pages. Remote Web conversations are not included.
- Adds macOS/Linux and Windows Host installation scripts and a downloadable Chrome/Edge extension ZIP.
- Fixes Host authorization recovery and repeated connection replacement between instances (#70).
- Switches Desktop Host status to live updates, reducing polling.

CI checks, tests, and builds pass. Cross-machine and Windows validation remains ongoing.

## 中文

- 接入 Harness `0.1.6-alpha.2` 原生文件树与只读预览。
- 新增远程终端与开发服务预览，在 Host 本机开启后立即生效。服务预览目前限 Desktop 或连接本机 Harness 的浏览器。
- 新增单账号自部署中继 Server 与 Docker 部署配置，更新首页、登录页和设备状态页；不包含 Remote Web 会话界面。
- 新增 macOS/Linux、Windows Host 自动安装脚本，以及 Chrome/Edge 扩展下载包。
- 修复 Host 授权恢复和多实例反复抢占连接的问题（#70）。
- Desktop Host 状态改为实时推送，减少轮询。

CI 检查、测试和构建通过，跨机与 Windows 回归仍在完善。

[Full changelog / 完整改动](https://github.com/liguobao/ds-harness-remote/compare/v0.4.14...v0.4.15) · [Installation / 安装说明](https://github.com/liguobao/ds-harness-remote/blob/v0.4.15/README.md)
