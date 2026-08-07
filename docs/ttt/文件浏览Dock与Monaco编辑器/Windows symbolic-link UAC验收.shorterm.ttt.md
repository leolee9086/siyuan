# Windows symbolic-link UAC 验收 (TikTocTak)

> **归属**: [gulu.File.Grep 行为守恒](gulu.File.Grep行为守恒.shorterm.ttt.md)
> **目标**: 在 Windows 上用真实 `IO_REPARSE_TAG_SYMLINK` 夹具验证文件遍历、内容读取和根边界，不把 junction 或跳过结果当作 symbolic-link 证据。

## 路径与权限契约

- 所有测试临时目录、Go 构建临时目录和日志都位于仓库 `.dev-workspace/temp/go-test` 下；当前检出位于 `D:`，不使用系统 `C:` 临时目录。
- 验收入口先通过 UAC 启动提升后的独立测试进程；测试进程用 `AdjustTokenPrivileges` 临时启用 `SeCreateSymbolicLinkPrivilege`，创建链接后恢复令牌状态。
- 每个链接创建后读取 Windows reparse tag，必须等于 `IO_REPARSE_TAG_SYMLINK`；`IO_REPARSE_TAG_MOUNT_POINT` 只归入 junction 测试。
- 严格验收模式下创建失败、权限未分配、卷不一致、夹具越出隔离根或出现 `SKIP` 均使入口失败。

## 覆盖矩阵

- [x] 文件 symbolic link：根内目标、根内中间目录、越界目标和断目标。
- [x] 目录 symbolic link：作为目录项、作为请求入口和越界手动展开。
- [x] 内容搜索与 `gulu.File.Grep` oracle：路径、结果、错误和根边界。
- [x] 文件浏览：文件链接分类、目录链接不递归、越界项受限，以及工作空间根本身为目录 symbolic link 时的解析与浏览。
- [x] Agent task-directory、assetmeta、asset cache 的链接越界策略。

## 验收命令

- `scripts/test-windows-symlink-uac.ps1`：唯一允许把 strict symbolic-link 结果计入验收的入口。
- 结果日志和 JSON 证据写入 `.dev-workspace/temp/go-test/windows-symlink-uac/<run>/`。

## 证据记录

- [x] UAC 提升令牌包含 `SeCreateSymbolicLinkPrivilege`；每次创建前临时启用，创建后恢复原 enabled 位。
- [x] 每个动态夹具的 `Lstat` 与 reparse tag 检查通过。
- [x] `scripts/test-windows-symlink-uac.ps1 -Race`：标准轮、junction 轮和 race 轮退出码均为 `0`，共 `52` 个 `PASS`、`0` 个 `SKIP`。
- [x] pnpm `app/node_modules/vue` junction 的根入口与 `package.json` 中间入口单独通过，不与 symbolic-link 结果合并。
- [x] 证据：`.dev-workspace/temp/go-test/windows-symlink-uac-20260807-094056-40312/evidence.json` 与同目录 `test.log`；`processElevated=true`、`strictSymbolicLink=true`、`raceRequested=true`、总退出码 `0`。
