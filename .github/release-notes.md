## English

- Fixes CodeX Remote workspace file and terminal access for Desktop clients by forwarding `workspaceFiles/*` and `terminal/*` through the authenticated Host carrier.
- Completes the Host CodeX terminal contract with PTY-backed subprocess support when available, pipe fallback, bounded output replay, reconnect snapshots, terminal ownership, resize, and state handling.
- Collapses the Remote Host list while connecting so the progress panel is visible immediately.
- Limits the Host picker to five visible rows with internal scrolling for additional Hosts.

## 中文

- 修复 Desktop 客户端 CodeX Remote 工作区文件和终端访问，将 `workspaceFiles/*` 与 `terminal/*` 请求通过已认证的 Host 通道转发。
- 完善 Host 侧 CodeX 终端契约：优先使用 PTY，支持管道回退、有限输出回放、断线快照、终端输入归属、尺寸调整和状态更新。
- Remote 选择主机连接时收起主机列表，立即显示连接进度面板。
- 主机选择器默认显示 5 条记录，更多主机可在列表内部滚动查看。

## Contributors / 贡献者

- [@ccch1mneyyy](https://github.com/ccch1mneyyy) — Android 文件预览、会话工具栏和终端面板改动（PR [#73](https://github.com/liguobao/ds-harness-remote/pull/73)、[#74](https://github.com/liguobao/ds-harness-remote/pull/74)）。

[Full changelog / 完整改动](https://github.com/liguobao/ds-harness-remote/compare/v0.4.16...v0.4.17) · [Installation / 安装说明](https://github.com/liguobao/ds-harness-remote/blob/v0.4.17/README.md)
