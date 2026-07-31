# web_fetch 工具鲁棒性改进执行跟踪 (TikTocTak)

> **目标**: 依据真实使用 web_fetch 抓取中文权威站点（央视网、人民网、中国营养学会、默沙东、澎湃等）时的失败经验，提升工具的鲁棒性：HTML 转换失败自动降级、JS 渲染/JSON 内嵌正文的兜底提取、中文站点友好、5xx 重试，并补齐单元测试。
>
> **范围**: `kernel/util/webfetch.go`（核心）、`kernel/mcp/tools/web_fetch.go`（工具层，如需要）、新增 `kernel/util/webfetch_test.go`，以及本任务的验证记录。

## 背景（真实使用中观察到的失败）

| 站点 | 现象 | 根因 |
|------|------|------|
| msdmanuals.cn、dg.cnsoc.org | `HTML conversion failed: HTML to Markdown panicked: runtime error: invalid memory address or nil pointer dereference` | Lute `HTML2Markdown` 对部分页面 panic，无降级路径 |
| m.news.cctv.com、mp.weixin.qq.com、food.china.com.cn | `fetched page has empty text content` | 正文在 `<noscript>` / JS 变量 / JSON 中，`HTML2Text` 提取不到 |
| health.people.cn | `read body failed: context deadline exceeded` | 慢站点单次请求超时，无重试 |
| 中文站点通用 | 部分站点对 `Accept-Language: en-US` 返回英文/精简版 | 语言头不友好 |

## 同步规则

1. 代码、测试和验证未完成前，不将任务或阶段标记为完成。
2. 只改动本任务范围内的文件：`kernel/util/webfetch.go`、`kernel/util/webfetch_test.go`；工具层签名不变，未动 `web_fetch.go`。
3. 每次阶段结束后同步更新当前状态、验证命令、已知问题和更新日志。
4. 不改变既有公开错误语义（URL 校验、SSRF、大小限制等），只增强成功路径与降级路径。

## 架构边界

```text
kernel/mcp/tools/web_fetch.go (工具层，签名不变)
  -> kernel/util/webfetch.go FetchWebPage (核心，本次改动)
       -> convertWebFetchHTML (新增：markdown→text→原始 HTML 逐级降级)
       -> extractFallbackText (新增：noscript / meta / JSON-LD / __NEXT_DATA__ 兜底)
       -> isWebFetchRetryable (新增：429/5xx/cf-challenge 可重试判断)
```

## 当前同步状态 (2026-07-31)

- **总体状态**: 代码修改与单元测试已完成，`gofmt`/`go vet`/`go test` 全部通过；待 git 提交。
- **验证基线**: `go -C kernel test ./util`（含既有 proxy 测试与新增 7 个测试用例）全部通过。
- **工作区约束**: 工作区存在与本任务无关的 AgentChat 拆分改动（app/src 等），本任务提交仅包含 webfetch 三个文件的显式路径，不回退、不纳入无关改动。

## 近期计划

- [x] **Phase 0 任务初始化**
  - [x] 创建本 ttt 文档
  - [x] 确认现有实现与测试基线（仅 `proxy_test.go` 覆盖 `newWebFetchClient`，无 FetchWebPage 测试）

- [x] **Phase 1 转换失败降级与空内容兜底 (P0)**
  - [x] 新增 `convertWebFetchHTML`：markdown 转换 panic/失败后自动降级 `HTML2Text`，text 仍失败则返回原始 HTML 而不是报错
  - [x] 新增 `extractFallbackText`：转换结果为空时提取 `<noscript>`、`<title>`、meta description/og:description、JSON-LD、`__NEXT_DATA__` 中的正文；仍为空才报错，且错误信息提示可改用 `format=html`
  - [x] `Accept-Language` 改为中文优先：`zh-CN,zh;q=0.9,en-US,en;q=0.8`
  - [x] 新增 `isWebFetchRetryable`：对 429/5xx/cf-challenge 增加一次重试（300ms 间隔），网络层错误（超时等）同样重试一次

- [x] **Phase 2 单元测试补齐 (P1)**
  - [x] 新增 `webfetch_test.go` 7 个用例：retryable 判定、降级转换、noscript/meta/JSON-LD/__NEXT_DATA__ 兜底、空页面、标签剥离、截断；纯函数测试不依赖真实网络（SSRF 防线不允许 httptest 回环地址）
  - [x] 过程中通过测试发现并修复 RE2 不支持反向引用 `\1` 导致的 `stripTagsAndEntities` 正则 panic（改为 script/style 分开匹配）

- [ ] **Phase 3 验证与提交 (P1)**
  - [x] `gofmt -l` 无输出、`go vet ./util` 通过、`go test ./util` 全部 PASS
  - [ ] git 显式路径提交：`kernel/util/webfetch.go`、`kernel/util/webfetch_test.go`、`docs/ttt/web_fetch工具鲁棒性改进.ttt.md`
  - [ ] 更新本 ttt 文档状态并标记完成

## 验证记录

| 日期 | 命令 | 结果 | 备注 |
|------|------|------|------|
| 2026-07-31 | `go -C kernel vet ./util` | 通过 | |
| 2026-07-31 | `go -C kernel test ./util -run 'Test(IsWebFetchRetryable\|ConvertWebFetchHTML\|ExtractFallbackText\|StripTagsAndEntities\|TruncateRunes\|NewWebFetchClient)'` | 通过 | 7 个新用例 + 2 个既有 proxy 用例全部 PASS |
| 2026-07-31 | `gofmt -l kernel/util/webfetch.go kernel/util/webfetch_test.go` | 无输出 | 格式正确 |

## 已知问题与风险

- `extractFallbackText` 的 JSON 字段收集限定递归深度 4 层、仅提取常见正文型字段（content/description/headline/articleBody/text/abstract/summary），对嵌套更深或字段名不同的站点可能兜底不完整；作为兜底路径可接受，后续可按站点反馈扩展。
- 5xx 重试为单次固定 300ms 间隔，未做指数退避；避免慢站点放大请求时间。

## 更新日志

- 2026-07-31: 创建任务追踪文档，完成 Phase 0 侦查。
- 2026-07-31: 完成 Phase 1 代码修改与 Phase 2 单元测试（含 RE2 反向引用 bug 修复），gofmt/vet/test 全部通过；Phase 3 待 git 提交。
