# Forge Dev Repo 工具增强计划

## 任务范围
对 MAGI 系统的 forge_dev_repo 工具集进行功能增强，覆盖缓存优化、搜索增强、编辑安全、配置化等方面。

## 任务列表

### 1. 缓存粒度优化
- [x] 在 `forge_dev_repo_read` 中添加 `readFileWithCache`，共享文件缓存
- [x] 实现包级 `forgeDevRepoFileCache` 缓存文件内容、总行数、文件大小

### 2. 搜索工具支持 glob 模式匹配
- [x] 在 `forge_dev_repo_search` 中添加 `filepattern` 参数
- [x] 使用 `filepath.Match` 过滤文件

### 3. 搜索工具支持正则表达式
- [x] 在 `forge_dev_repo_search` 中添加 `useRegex` 布尔参数
- [x] 使用 `regexp.MatchString` 替代 `strings.Contains` 当 useRegex=true
- [x] 自动处理 `ignoreCase` + `useRegex` 组合（`(?i)` 前缀）

### 4. 编辑工具回滚机制
- [x] 在 `materializeForgeDevRepoEditResult` 中写入文件前创建 `.bak` 备份
- [x] 使用 `os.WriteFile` 写入备份（对称于主写入路径）
- [x] 批量替换工具 `materializeForgeDevRepoBatchReplaceResult` 同样包含备份

### 5. 目录列表过滤功能
- [x] 在 `forge_dev_repo_list` 中添加 `typeFilter`（file/dir）和 `namePattern`（glob）参数
- [x] 过滤逻辑嵌入 list 函数（在排序前过滤）

### 6. 工具执行审计日志
- [x] 在 `forgeDevRepoToolResultExecutor.ExecuteToolCall` 中添加执行日志
- [x] 记录：工具名、参数摘要（截断至200字符）、执行耗时、是否成功

### 7. 批量文件操作支持
- [x] 新增 `forge_dev_repo_batch_replace` 工具名常量
- [x] 实现 `executeForgeDevRepoBatchReplace` 函数（验证 + 文件匹配 + preview/pending_governance）
- [x] 实现 `materializeForgeDevRepoBatchReplaceResult` 函数（治理后实际执行）
- [x] 接入治理系统（`isGovernedActionToolName`）
- [x] 接入材料化分发（`materializeToolResultForContext`）
- [x] 接入收集器（`collector.go` 工具集检测）

### 8. 工作区快照间隔可配置性
- [x] 为 Coordinator 添加 `SetWorkspaceSnapshotInterval` 方法
- [x] 允许外部设置而非硬编码 5 轮常量

### 9. 测试覆盖
- [x] `TestExecuteForgeDevRepoList_FiltersByType`
- [x] `TestExecuteForgeDevRepoList_FiltersByNamePattern`
- [x] `TestExecuteForgeDevRepoSearch_UseRegex`
- [x] `TestExecuteForgeDevRepoSearch_UseRegexWithIgnoreCase`
- [x] `TestExecuteForgeDevRepoSearch_FilePatternFilter`
- [x] `TestExecuteForgeDevRepoSearch_InvalidRegexReturnsError`
- [x] `TestExecuteForgeDevRepoBatchReplace_ValidatesRequiredFields`（5 个子 case）
- [x] `TestExecuteForgeDevRepoBatchReplace_PreviewMode`
- [x] `TestExecuteForgeDevRepoBatchReplace_ReturnsPendingGovernance`
- [x] `TestExecuteForgeDevRepoBatchReplace_GlobMatchesMultipleFiles`

### 10. 搜索性能优化失败记录（对标 ripgrep，2026-08-02，已撤销）
- [x] ~~重写 `executeForgeDevRepoSearch`：并行 worker + 零拷贝行扫描 + 整块快速跳过~~（已全部撤销）
- [x] ~~新增 `searchForgeRepoTargetsParallel` / `searchForgeRepoSingleFile` / `foldContains`~~（已全部删除）
- [x] ~~基准测试 `forge_repo_search_bench_test.go`~~（已删除）
- [x] 恢复原始实现；仅新增 `respectGitIgnore` / `includeIgnored` 两个参数开关

**失败现象**：全局匹配数达到 limit 后停止分发剩余文件——这是「部分扫描」，搜索工具语义错误（limit 只应限制返回条数，不应限制扫描范围）；且用部分扫描数据与 ripgrep 全量扫描对比得出「对标成功」的结论，同口径全量扫描实际仍慢 2-3 倍（117ms vs 36-50ms）。

**根因**：把「提前终止遍历」当成性能优化，混淆了「返回条数上限」与「扫描范围」两个概念；对比口径不诚实。

**教训**：搜索工具必须扫描全部文件；如需对标 ripgrep 性能，正确做法是直接调用 ripgrep 二进制（参考 `util/pandoc.go` 的 exec.Command + gulu.CmdAttr + CombinedOutput 模式），而非自研算法。

**最终保留改动**：`executeForgeDevRepoSearch` 新增 `respectGitIgnore=true`（默认，尊重仓库根 .gitignore，复用 `github.com/sabhiram/go-gitignore`）与 `includeIgnored=true`（强制包含被忽略路径）两个参数开关；工具描述同步（`config/toolset_forge.go`）。
