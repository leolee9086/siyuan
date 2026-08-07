# gulu.File.Grep 行为守恒 (TikTocTak)

> **归属**: [后端文件系统遍历统一抽象](后端文件系统遍历统一抽象.shorterm.ttt.md)
> **目标**: 在生产调用切换到 `fswalk` 前，以当前锁定依赖 `github.com/88250/gulu@v1.2.3-0.20260609090754-168309361d92` 的真实源码和差分测试冻结 `gulu.File.Grep`、MCP `fileGrep`、CLI `file grep` 的全部可观察行为。

## 门禁原则

- 先运行旧实现得到 oracle 结果，再对同一真实目录运行候选实现；不以重写旧算法后的期望常量代替 oracle。
- 比较结果数量、顺序、路径、行号、原始行文本、上下文标记、错误有无及调用方输出；错误类型/文本单独列为契约项。
- 每个输入分区至少包含一个边界夹具；随机夹具只补充覆盖，不能替代确定性边界测试。
- 授权边界强化必须与业务行为等价分开记录。未决差异存在时，生产迁移不得标记完成。

## 契约矩阵

| 分区 | 真实 gulu 行为 | 当前门禁 |
| --- | --- | --- |
| 正则 | 在根路径 `Stat` 前编译；非法表达式直接返回 `regexp` 错误 | [x] 已由同夹具 oracle 覆盖非法表达式与缺失根优先级 |
| 根类型 | 目录递归；普通文件直接读取且忽略 `includeGlob`；缺失根返回 `os.Stat` 错误 | [x] 已覆盖普通文件、目录和缺失根错误类型/文本 |
| 目录选择 | 跳过 `.git`、`.svn`、`.hg` 和任意点前缀目录；点前缀文件仍扫描 | [x] 已覆盖隐藏目录和点前缀文件 |
| include | 对目录内文件的 basename 使用 `filepath.Match`；递归 brace expansion；无效 glob 静默不匹配 | [x] 已覆盖递归 brace、无效 glob、单文件忽略 include |
| 顺序 | `filepath.WalkDir` 深度优先；每层按原始文件名逐字节词法排序 | [x] 候选已改为与 gulu 相同的原始字典序并由限额差分锁定 |
| 文件类型 | 目录项仅处理 `d.Type().IsRegular()`；嵌套 symlink 不递归；二进制/NUL/无效 UTF-8 不主动拒绝 | [~] NUL、无效 UTF-8、junction 和真实 symbolic-link 已覆盖；特殊文件仍未验收 |
| 行语义 | `bufio.ScanLines`；保留 BOM/无效字节，去除 LF 及其前一个 CR；末尾空行不产生 token | [x] BOM、CRLF、孤立 CR、末尾换行和空内容均已差分 |
| 上下文 | 命中前缓冲、命中后计数；重叠窗口不重复输出；匹配行可覆盖此前 after-context 状态 | [x] 文件首尾、连续命中、重叠窗口和 `context=-1` 已差分 |
| 上限 | `maxResults<=0` 在 gulu 入口默认为 64；上下文也占上限；达到上限后结果截断 | [x] gulu 入口及 MCP/CLI 的 200 包装上限均已覆盖 |
| 大行 | Scanner token 上限为 1 MiB；扫描错误静默，保留错误前已提交的结果 | [x] 1 MiB 边界、超长行前已提交结果均已差分 |
| I/O 错误 | 根 `Stat` 错误返回；遍历和单文件打开/扫描错误静默 | [ ] 待覆盖根目录读取失败、文件打开失败和遍历期间消失 |
| 链接入口 | `os.Stat(root)` 跟随入口；文件 symlink 被读取；目录 symlink 作为 WalkDir 根不递归；中间 symlink 由路径解析行为决定 | [x] UAC strict 夹具已覆盖文件、目录根、中间路径、断目标和越界；pnpm junction 根/中间路径单独验证 |
| MCP 输出 | 非正 limit 先归一为 200；文本头、相对路径、分隔符和错误包络保持原样 | [x] 生产入口仍使用 gulu；真实 MCP 输出与 oracle 已覆盖 200 上限、错误文本和 junction 边界 |
| CLI 输出 | 非正 limit 先归一为 200；文本输出相对工作空间；JSON 字段名/大小写和绝对路径保持原样 | [x] 已用真实 Cobra 命令覆盖 stdout、200 上限、上下文、include、JSON nil 形状和字段映射 |

## 已关闭偏差与未决项

- 普通文件 include、CLI 非正 limit、负 context、目录排序、缺失根错误和调用方输出的候选偏差均已由同夹具 oracle 关闭。
- `fswalk` 的 reparse 边界测试与 gulu 行为差分保持分离：pnpm junction 只证明 junction，不能替代 symbolic-link 证据。
- 普通进程令牌不含 `SeCreateSymbolicLinkPrivilege`；这只说明普通入口未完成权限前置，不再作为放弃真实夹具的理由。UAC strict 入口见 [Windows symbolic-link UAC 验收](Windows%20symbolic-link%20UAC验收.shorterm.ttt.md)。
- 待补门禁：权限/文件消失等 I/O 竞态和特殊文件。

## 实施状态

- [x] 锁定依赖版本并直接阅读 `file.go` 的 `Grep`、`grepFile`、`matchInclude`、`expandBrace` 和依赖自带测试。
- [x] 撤销“已有少量差分样例即可证明接口等价”的结论。
- [x] 完成确定性契约矩阵和同夹具 oracle 差分测试；覆盖真实目录、文件字节、上下文、上限、排序、brace、Scanner 边界、缺失根和调用方输出。
- [x] 真实 link/reparse：UAC strict 动态 symbolic-link 与 pnpm `app/node_modules/vue` junction 分别通过；每个动态链接校验 `IO_REPARSE_TAG_SYMLINK`，junction 校验 `IO_REPARSE_TAG_MOUNT_POINT`。
- [x] 已修正已发现的业务可观察偏差；生产 MCP/CLI grep 已恢复 gulu，候选仅保留在 fswalk 差分门禁中。
- [~] 仍待补：权限/文件消失等 I/O 竞态和特殊文件。

## 2026-08-07 实证记录

- `go test ./fswalk ./mcp/tools ./cli/cmd ./nerv/magi/coordinator -count=1`：通过。
- `go test -race ./fswalk ./mcp/tools ./cli/cmd -count=1`：通过。
- `go vet ./fswalk ./mcp/tools ./cli/cmd`：通过；`GOOS=linux go vet ./fswalk`：通过。
- `SFORGE_TEST_DIRECTORY_REPARSE=D:\dev\s-forge\app\node_modules\vue`：读取 `fsutil` tag `0xA0000003`，根入口与 `package.json` 中间入口均与 gulu 差分通过；该证据只归类为 junction。
- `Get-ChildItem D:\dev -Recurse -Attributes ReparsePoint` 的只读审计未找到目标位于 D 盘的 symbolic link；现存跨卷对象未进入测试命令或验收记录。
- 当前普通令牌 `whoami /priv` 不含 `SeCreateSymbolicLinkPrivilege`；普通测试结果保持未验收，strict 入口负责提升令牌并验证真实创建。
- 生产 MCP/CLI grep 已恢复锁定 gulu 入口；symbolic-link 门禁已关闭，仍需关闭 I/O 竞态、特殊文件和其余调用点审计后再评估候选切换。

## 2026-08-07 夹具范围纠偏

- Windows 目录重解析夹具改为始终使用 `mklink /J`，不再根据权限把 junction 测试偶然变成 symbolic-link 测试。
- symbolic-link 环境夹具在解析前校验目标卷；跨卷目标直接拒绝，避免触碰无关系统目录。
- 所有本轮 Go 验证均显式将 `TEMP`、`TMP` 和 `GOTMPDIR` 指向 `D:\dev\s-forge\.dev-workspace\temp\go-test`。
- 当次普通令牌 `go test ./fswalk ./mcp/tools ./cli/cmd -run 'Grep' -count=1 -v` 只计非 symbolic-link 项；后续 UAC strict 轮已补齐真实链接验收。
- pnpm junction 实夹具分别以目录根和 `package.json` 中间路径运行 `TestGrepTextExistingDirectoryReparse`：两次均通过。
- 生产入口恢复 gulu 后重新执行 `go test ./fswalk ./mcp/tools ./cli/cmd ./nerv/magi/coordinator -count=1`、`go test -race ./fswalk ./mcp/tools ./cli/cmd -count=1`、`go vet ./fswalk ./mcp/tools ./cli/cmd` 和 `GOOS=linux go vet ./fswalk`：全部通过。

## 2026-08-07 UAC strict symbolic-link 验收

- 新增统一测试夹具：严格模式要求所有目标与链接均位于 `D:\dev\s-forge\.dev-workspace\temp\go-test`，通过 `AdjustTokenPrivileges` 临时启用 `SeCreateSymbolicLinkPrivilege`，并在创建后恢复原 enabled 位。
- 每个创建结果都以 `Lstat` 和 `FSCTL_GET_REPARSE_POINT` 验证 tag 为 `IO_REPARSE_TAG_SYMLINK`；junction 继续按 `IO_REPARSE_TAG_MOUNT_POINT` 独立验证。
- `scripts/test-windows-symlink-uac.ps1 -Race`：标准 symbolic-link、pnpm junction 和 race 三轮均通过；`52` 个 `PASS`、`0` 个 `SKIP`。
- 最终证据位于 `.dev-workspace/temp/go-test/windows-symlink-uac-20260807-094056-40312/evidence.json` 和同目录 `test.log`；全部临时路径均在 D 盘仓库隔离根内。
