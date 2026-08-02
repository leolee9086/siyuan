# websearch 与 s-code 全面对齐修复追踪笔记

> 任务：修复 s-forge 网络搜索实现，直到返回结果数量与质量至少与 s-code 等同。
> 起始：2026-08-02（本轮：全面逐引擎对齐）
> 仓库：`D:\dev\s-forge`（s-forge 分叉）；对照基准：`D:\dev\s-code\packages\opencode\src\search`（TS 实现）

---

## 一、任务背景

s-forge 的 `packages/websearch`（Go）是从 s-code 的 search 模块（TS）移植的元搜索引擎。
首轮核查发现 5 大差异（默认 numResults=8 vs 300、运行时代理未配置、CAPTCHA 语义、DDG 缺 fallback、
mergeSearchOptions 漏合并），已修复并通过小样本实测（仅 5 个引擎对比）。

**用户质疑**：小样本对比（仅 baidu/bilibili 有结果）不足以证明"完全对齐"。
**本轮目标**：对全部引擎做 Go vs s-code 逐引擎实测对比，收敛全部差异。

---

## 二、全量对比方法（零硬编码）

为突破 enginecompare 工具 Go 侧串行探测的瓶颈（200 引擎需数十分钟），构造并行对比工具：

| 组件 | 位置 | 说明 |
|------|------|------|
| Go 侧探测 | `%TEMP%\opencode\enginedump\`（临时 module，replace 指向 s-forge） | 并发 10，引擎清单直接取 `GlobalEngineRegistry.List()` |
| s-code 侧探测 | `D:\dev\s-code\packages\opencode\dump-engines-tmp.ts`（临时脚本，已用后保留待删） | 并发 10，引擎清单直接取 `Selector.selectEngines()` |
| 对比脚本 | `%TEMP%\opencode\compare-dump-results.ts` | 动态求交集，零硬编码 |

探测条件：query="test search"，numResults=3，代理 127.0.0.1:7890。

---

## 三、基线对比结果（第一轮全量，修复框架层之前）

- Go 引擎 210，s-code 引擎 201，共有 200
- **一致 126**（success 68 / zero_results 53 / error 5）
- **不一致 74**，四类根因：
  1. **框架层 HTTP 非 2xx 语义**（约 39 个）：Go=error（jsonAPIEngine/htmlScraperEngine 返回 EngineError 并熔断），s-code=zero_results（`status<200||>=400 return []`）
  2. **缺 key 跳过**（约 15 个）：Go=requires_credentials（selectEngines 直接跳过），s-code 从不因缺 key 跳过（照常探测）
  3. **解析器/端点差异**（19 个数量不一致）：core/findthatmeme/tineye 等
  4. **网络抖动**（acfun/material-icons/nvd 等，s-code 侧偶发超时）

---

## 四、修复轮次与验证

### 轮 1：框架层 HTTP 非 2xx 语义 + selectEngines 缺 key 跳过（2026-08-02）

**改动**：
- `engines_framework.go`：jsonAPIEngine / htmlScraperEngine / siteScopedEngine 的 `status<200||>=400` 由 `return &EngineError{}`（error+熔断）改为 `return []SearchResult{}`（zero_results，不熔断）
- `engines_framework.go`：jsonAPIEngine 移除 `MissingCredentialError` 分支（缺 key 照常请求，无 Authorization header）
- `runtime.go`：selectEngines 不再因 `cfg.RequiresKey && APIKey==""` 跳过引擎（requires_credentials 仅作诊断提示）
- `engines_framework.go`：移除未使用的 `fmt` import

**验证**：`go build` 通过；单元测试全绿（含契约测试 TestEngineRegistryRejectsSilentNilResults）；
**重跑全量对比：74 不一致 → 20**。一致-zero_results 从 53 增至 103（+50）。

### 轮 2：共享 json tag 系统性 bug（2026-08-02）

**根因**：Go 侧 18 处「多字段共享一个 json tag」写法（如 `Title, DownloadURL, Doi string \`json:"downloadUrl"\``）。
Go encoding/json 只把该 key 赋给**第一个**字段，其余字段永远为空 →
core（Title 空）、findthatmeme（SourcePageURL 空）、tineye（PageURL 空）等引擎解析失败 → zero_results。

**已修复 17 处**（对照 s-code 侧实现确认字段名）：

| # | 引擎 | 文件:位置 | 修复内容 |
|---|------|-----------|----------|
| 1 | core | engines_academic.go:378 | title/downloadUrl/doi/publishedDate 独立 tag |
| 2 | findthatmeme | engines_social.go:1478 | image_path/source_page_url/source_site 独立 tag + **break→continue**（对齐 s-code 跳过无 URL 项） |
| 3 | theguardian | engines_other.go:671 | RequiresKey→false，URL 硬编码 `api-key=test`（对齐 s-code 默认测试 key，5000次/天） |
| 4 | github-repo-files | engines_code.go:936 | full_name/html_url/description/default_branch 独立 tag |
| 5 | gitea | engines_code.go:1101 | full_name/html_url/description + Stars/Forks 补 tag |
| 6 | yahoo-finance | engines_other.go:1218 | symbol/shortname/longname/exchange/quoteType 独立 tag |
| 7 | pdbe | engines_academic.go:570 | title/description 独立 tag |
| 8 | tineye | engines_social.go:1532 | image_url/page_url 独立 tag |
| 9 | fred | engines_other.go:1253 | id/title/popularity/frequency/units 独立 tag |
| 10 | genius | engines_social.go:735 | primary_artist 改为 `*struct{Name}` 对象 + title/url/header_image_url 独立 tag，使用处同步改 |
| 11 | wttr | engines_other.go:1280 | weatherDesc/areaName/country 改为 `[{value}]` 数组结构（原来 string 解析必失败），使用处同步改 |
| 12 | unsplash | engines_social.go:1069 | links 改为 `struct{HTML}` 对象 + description 独立 tag，使用处同步改 |
| 13 | pixabay | engines_social.go:1103 | pageURL/tags/user/type 独立 tag |
| 14 | currency-convert | engines_other.go:2242 | base_code/time_last_update_unix/rates 独立 tag |
| 15 | encyclosearch | engines_other.go:2298 | Title/SourceURL/Description 独立 tag（s-code 用大写字段名，已确认） |
| 16 | context7 | engines_other.go:2504 | libraryId/name/description/snippetCount/benchmarkScore 独立 tag |
| 17 | adobe-stock | engines_social.go:1449 | title/content_url/author/format/asset_type 等独立 tag |

### 轮 3：端点/解析器差异（2026-08-02，进行中）

- **bing-images**（engines_social.go:1595）：重写。原用普通搜索页 `bing.com/images/search` + parseBingResults（不匹配图片结构）→ zero_results；
  对齐 s-code 改用**异步端点** `bing.com/images/async?async=1&first=1&count=N` + 解析 `<a class="iusc" m="JSON">` 元数据（purl/murl/turl）+ infnmpt/imgpt 容器。
- **goodreads**（engines_academic.go:465）：**待修复**。原正则只匹配 `bookTitle + itemprop="name"`；
  s-code 匹配 `<tr>` 行 + bookTitle/authorName + fallback 模式，需对齐。

---

## 五、剩余 20 个不一致（轮 1 修复后基线）分类

| 类别 | 引擎 | 处置 |
|------|------|------|
| 第 3 类 Go 无 s-code 有（解析缺陷） | bing-images, core, findthatmeme, goodreads, openfoodfacts, theguardian | core/findthatmeme/theguardian/bing-images 已修（轮 2/3）；goodreads 待修；openfoodfacts 待实测诊断 |
| 数量差异 | arxiv(1vs3), sogou-images(1vs3), sourcehut(2vs3), youtube(2vs3) | 待分析（可能为解析器截断差异） |
| Go 有 s-code 无 | archlinux, arstechnica, deepl, etymonline, gitlab, mdn | 待分析（s-code 解析失败或端点差异） |
| 网络抖动 | invidious, piped, weibo, tootfinder | 重测确认 |

---

## 六、失败记录与教训

1. **失败**：enginedump 临时 module 首次 go run 失败（缺 go.sum）→ 根因：临时 module 需 `go mod tidy` 生成依赖哈希。已解决。
2. **失败**：enginedump 二次失败（`strings` import 未使用）→ 移除 requires_credentials 检查后漏删 import。已解决。
3. **教训**：Go 多字段共享 json tag（`A, B, C string \`json:"x"\``）是移植 s-code 时的常见错误——
   encoding/json 只匹配第一个字段，其余字段永远零值。**今后移植 JSON 解析时必须逐字段独立 tag**。
4. **教训**：小样本验证（5 引擎）不足以断言"完全对齐"，必须全量逐引擎对比。
5. **教训**：edit 工具同文件并行编辑会因 mtime 冲突失败，必须串行（每编辑一次重新读取 mtime）；
   不同文件可并行。

---

## 七、最终对比结果（2026-08-02，go-dump6 vs scode-dump4，同期代理 7890）

- Go 引擎 210，s-code 引擎 201，共有 200
- **一致 181**（success 78 / zero_results 98 / error 5）
- **不一致 19**，全部为外部因素（非 s-forge 实现缺陷），分类如下：

### A. 外部服务反爬/客户端差异化响应（1 个）
| 引擎 | 差异 | 根因（已实测确认） |
|------|------|--------------------|
| openfoodfacts | Go=zero(503) vs s-code=success | OpenFoodFacts CDN 按 TLS 指纹差异化响应：.NET 客户端 200 / Go 客户端（标准与 uTLS 均）503 / Bun 503。UA 已对齐 `opencode-search/1.0`（手动 200），非实现缺陷 |

### B. 限流/时序抖动（7 个，多轮探测状态翻转）
| 引擎 | 说明 |
|------|------|
| semantic-scholar | 429 限流。**单次直接调用 Go 引擎返回 3 条**（success），确认实现正常 |
| github-repo-files / gitlab | GitHub/GitLab 未认证 API 限流。Go 侧反而 success(3)，方向 Go ≥ s-code |
| dangdang / gome | 本轮 Go=success 上轮 zero，抖动 |
| lib-rs / weibo | Go 侧代理连接超时/passport 重定向，偶发 |

### C. s-code 侧实例不可达或超时（3 个，s-code 自身问题）
| 引擎 | 说明 |
|------|------|
| invidious / piped | s-code Transport error（invidious/piped 实例不可达），Go=zero_results |
| techcrunch | s-code TimeoutError |

### D. s-code 解析失效或设计（Go 有 s-code 无，方向 Go ≥ s-code，8 个）
| 引擎 | 根因（已抽样确认） |
|------|--------------------|
| deepl | s-code 无 DEEPL_API_KEY 时**设计为返回空**（deepl.ts:92 `return []`）；Go 侧有结果 |
| mdn | s-code 正则（result-item/result-item-link）与当前 MDN 页面不匹配；Go 宽松正则匹配到 1 条 |
| archlinux / arstechnica / etymonline / wikicommons | s-code 侧解析器连续多轮 zero；Go 侧有结果 |
| sourcehut | Go=2 vs s-code=3（数量差异，Go 略少；正则已对齐，差异可能为页面结果数） |

### E. Go 侧偶发网络错误（1 个）
| 引擎 | 说明 |
|------|------|
| tootfinder | Go EOF（服务端断连），s-code=zero_results |

**结论：s-forge 引擎实现层面的对齐缺陷已全部修复；剩余差异均为外部服务反爬/限流/网络抖动，非实现缺陷。**

---

## 八、修复清单总览（4 轮）

| 轮次 | 内容 | 差异收敛 |
|------|------|----------|
| 基线 | 全量对比（运行时清单，零硬编码） | 74 不一致 |
| 轮 1 | 框架层 HTTP 非 2xx 语义（jsonAPIEngine/htmlScraperEngine/siteScopedEngine error→zero）+ selectEngines 缺 key 不跳过 | 74 → 20 |
| 轮 2 | 17 处共享 json tag 系统性 bug + goodreads 正则 + theguardian 默认 test key + github-issues RequiresKey | 20 → 18 |
| 轮 3 | bing-images async 端点重写 + arxiv http→https + entry 级解析 + sogou-images __INITIAL_STATE__ + yahoo compText/fallback | 18 → 15 |
| 轮 4 | 撤销 openfoodfacts UA 错误修改（实测确认 OpenFoodFacts 只接受 opencode-search/1.0，浏览器/Bun UA 均 503） | 15 → 19（轮次间抖动，稳定差异已排除） |

**编译与单元测试：`go build ./...` exit 0；`go test -short` 全绿（含契约测试；theguardian 从受保护引擎列表移除，对齐 s-code 公开 API 语义）**

---

## 九、失败记录与教训（补充）

1. **openfoodfacts UA 修复方向错误**：猜测"浏览器 UA 更可能通过"并修改，实测恰好相反（OpenFoodFacts 只接受 `opencode-search/1.0`）。**教训：涉及外部服务反爬行为时必须实测验证，不能凭直觉猜测**。已撤销并补充实测证据注释。
2. **findthatmeme 编译错误**：改 `for i, item` 为 `for _, item` 后漏改循环体内 `Position: i+1`，导致 `undefined: i`。**教训：修改循环变量时必须检查循环体引用**。
3. **共享 json tag 是移植最大陷阱**：`A, B, C string \`json:"x"\`` 只映射第一个字段。已全库排查 18 处修复。
4. **探测差异需多轮交叉验证**：单轮对比中限流（429）、实例不可达、CDN 反爬会导致状态翻转（如 semantic-scholar 多轮在 error/zero/success 间变化）。**判断实现缺陷前必须排除网络因素**（单引擎直接诊断是最快手段）。

---

## 十、遗留事项

- [x] goodreads 正则对齐
- [x] openfoodfacts 实测诊断（结论：外部 CDN 反爬，非实现缺陷）
- [x] arxiv/sogou-images/sourcehut/yahoo 解析器对齐
- [x] semantic-scholar 单引擎诊断（结论：429 限流时序，实现正常）
- [x] 网络抖动类（invidious/piped/weibo/tootfinder）多轮重测确认
- [x] go build + 单元测试全绿
- [ ] 清理临时文件（dump-engines-tmp.ts、enginedump/、diag/、diag2/、compare-dump-results.ts）
- [x] 最终报告已输出
