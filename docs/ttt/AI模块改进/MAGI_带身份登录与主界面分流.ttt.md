# MAGI 带身份登录与主界面分流执行跟踪 (TikTocTak)

> **目标**: 在不引入权限系统的前提下，为 MAGI 增加“带身份登录 + 工具着甲 token”能力，并强制执行门禁链：`workspace API token` 为基础要求；`magi-main-ui` 额外复用现有 `AccessAuthCode` 鉴权；实现多端可使用不同身份昵称，且仅 `guardian` 身份可直连 MAGI，其他身份统一分流 Avatar。编程工具（Claude Code 等）调用时必须校验 `API token + 请求渠道 + 请求身份`，同时保持接口外观与普通 LLM API 完全一致。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## ℹ️ 如何维护此文档

1. **完成归档**: 任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**: 当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**: 如果发现计划不合理，随时修改或删除。
4. **数据驱动**: 用数据说话，不凭感觉。

---

## 核心原则

1. **昵称与身份分离**: `nickname` 仅用于会话展示，不作为认证主键，不参与路由权限判定。
2. **身份与权限分离**: 本项目不引入 RBAC/ACL；`guardian` 标记仅用于 MAGI 路由策略（是否直答），不授予额外系统管理权限。
3. **API Token 基础门禁**: 所有身份登录必须先满足 `workspace API token` 校验；后续对话凭证必须与该 workspace 门禁绑定。
4. **主界面额外门禁**: `magi-main-ui` 请求必须复用现有 `AccessAuthCode` 鉴权链路（含本地与网络伺服差异处理），禁止绕过。
5. **工具调用着甲**: Claude Code 等编程工具调用 MAGI 时必须携带“着甲 token”，其 claims 至少包含 `identity_id` 与 `request_channel`，并由后端验签与时效校验。
6. **接口外观同构**: `/chat/completions` 与 `/messages` 保持普通 OpenAI/Claude 接口外观，不新增私有必填 body，不依赖自定义请求头。
7. **不兼容旧请求**: 不保留旧字段回退、不做降级兜底；缺少新认证材料直接拒绝（fail-closed）。
8. **model 仅作语义提示**: `model` 字段可用于“响应语义/路由意图”提示，但绝不作为身份、渠道、权限或直答资格的安全依据。
9. **口令只存哈希**: 身份密码仅以 `bcrypt` 哈希形式落盘，禁止明文存储；身份配置文件位于 `conf/magi-identities.json`。

**验证检查清单**:
- [ ] 未携带或携带错误 `workspace API token` 时，身份登录接口返回 401。
- [ ] `magi-main-ui` 在未通过 `AccessAuthCode` 时返回与现有主界面一致的拒绝语义。
- [ ] Claude Code 等工具请求在无着甲 token 时返回 401。
- [ ] Claude Code 等工具请求在着甲 token claims 与请求镜像信息不一致时返回 403。
- [ ] `guardian` 身份 `DirectResponseAllowed=true`，非 `guardian` 身份强制走 Avatar 分流。
- [ ] 同一工作空间多端登录可使用不同 `nickname`，日志中可区分身份与昵称。
- [ ] OpenAI/Claude 标准请求体可直接调用，无需额外私有字段。
- [ ] `model` 字段只影响语义策略，不可提升身份权限或绕过分流。
- [ ] magi主界面中的测试聊天面板能够模拟不同的调用情景
- [ ] `conf/magi-identities.json` 不出现明文密码，仅包含 `password_hash`。
---

## 协议约束（外观一致前提）

1. **OpenAI 兼容端点**: `POST /api/s-forge/magi/v1/chat/completions`
2. **Claude 兼容端点**: `POST /api/s-forge/magi/v1/messages`
3. **请求体约束**: 仅使用标准协议字段（如 OpenAI `messages/user`、Claude `messages/metadata`），不新增私有必填 body 字段。
4. **认证契约（唯一方式，不回退）**:
   - `POST /api/s-forge/magi/v1/identity/list`
   - `POST /api/s-forge/magi/v1/identity/upsert`
   - `POST /api/s-forge/magi/v1/identity/remove`
   - `POST /api/s-forge/magi/v1/identity/login`
   - 请求头: `Authorization: Bearer <workspace_api_token>`（必填）
   - 请求体: `identity_id` + `password` + `nickname` + `channel`
   - 返回: `magi_armor_key`（短期、可轮换、绑定 workspace）
   - 身份存储: `conf/magi-identities.json`（字段: `identity_id`、`display_name`、`password_hash`、`route_class`、`enabled`）
5. **对话端点调用方式（工具可落地）**:
   - `/chat/completions` 与 `/messages` 仅使用 `Authorization: Bearer <magi_armor_key>`。
   - 不依赖 `X-*` 头，不新增私有必填 body 字段。
   - `magi_armor_key` claims 最小集合: `sub(identity_id)`、`chn(request_channel)`、`ws(workspace)`、`iat/exp/jti`。
6. **渠道枚举（最小集合）**:
   - `magi-main-ui`
   - `tool-claude-code`
   - `tool-openai-sdk`
   - `tool-claude-sdk`
   - `tool-custom`
7. **后端固定判定链路**:
   - 验 `magi_armor_key`（签名、`exp`、`jti` 防重放）
   - 验 `ws` 绑定关系（workspace 门禁仍有效；被轮换/吊销则 key 失效）
   - 取 `request_channel = claims.chn`
   - 取 `request_identity = claims.sub`
   - 若请求体存在镜像字段（如 OpenAI `user`、Claude `metadata.user_id`），仅做一致性比对
   - 进入 MAGI/Avatar 路由
8. **冲突处理规则**:
   - 任一不一致直接拒绝，禁止自动修正、禁止降级继续执行。
   - 拒绝码约定: 缺失/无效 token -> `401`；身份/渠道冲突 -> `403`。

---

## model 字段语义约定（非安全）

1. **定位**: `model` 是“语义策略键”，不是后端真实模型选择器。
2. **用途**: 可用于提示响应风格、工具偏好、是否偏向 Avatar 表达等语义行为。
3. **建议语义键**:
   - `magi-default`: 默认对话语义。
   - `magi-coding`: 编程助手语义（更偏代码解释与补丁建议）。
   - `magi-review`: 代码审查语义（更偏风险与回归检查）。
   - `magi-avatar`: Avatar 表达语义（可请求降级到 Avatar 路径）。
4. **强约束**:
   - `model` 不得参与 `identity/channel/token` 安全判定。
   - `model` 不得提升直答资格；非 `guardian` 即使传入任意 `model` 仍必须走 Avatar 分流。
   - 未识别 `model` 统一回落到 `magi-default`（语义回落，不是安全回退）。

---

## 🟢 近期计划

- [ ] **Phase 0.5: 缺失身份会话自动引导与面板显化修复 (P0)**
  - **背景**: 当前主聊天在无 `magi_armor_key` 时会抛出未捕获异常，且身份管理入口未形成强引导。
  - **行动**:
    1. 主聊天 `submit` 链路对 `magi identity session missing` 做显式捕获，禁止 `Uncaught (in promise)`。
    2. 在命中该错误时，自动高亮并滚动定位 `Identity Access Control` 面板。
    3. 调整 `magi-main-stack` 为“模式切换 + 单内容区”布局，确保身份面板、来源仿真面板、主聊天面板三者模态互斥显示（同一时刻仅显示一个）。
    4. 在主消息流追加明确的登录引导文案，提示先完成身份登录。
  - **验收标准**: 缺失身份会话时不出现浏览器未捕获异常；身份管理面板自动可见并可直接完成登录；三大面板不发生层叠混显。
  - **参考文档**: `app/src/magi/entry/MagiRoot.ctx.ts`、`app/src/magi/components/magi-identity-panel/MagiIdentityPanel.vue`、`app/src/magi/entry/MagiRoot.css`

- [ ] **Phase 1: 身份模型与着甲 claims 规范冻结 (P0)**
  - **背景**: 先固定身份、昵称、渠道、着甲 token 的边界，避免后续耦合。
  - **行动**:
    1. 定义身份实体最小字段: `identity_id`、`password_hash`、`route_class`（`guardian|avatar-only`）、`display_name`。
    2. 定义会话昵称字段: `nickname`（每端可不同，不回写身份主键）。
    3. 定义着甲 token claims: `sub(identity_id)`、`chn(request_channel)`、`ws(workspace)`、`iat/exp/jti`。
  - **验收标准**: 文档可明确回答“用什么鉴权、用什么展示、用什么分流、用什么声明渠道”。
  - **参考文档**: `docs/设计/MAGI_Go后端落实工程设计.design.md`

- [ ] **Phase 2: 带身份登录与着甲 token 签发 (P0)**
  - **背景**: 建立 `workspace token -> identity/password -> armor token` 的固定入口。
  - **行动**:
    1. 新增身份登录接口（建议: `POST /api/s-forge/magi/v1/identity/login`）。
    2. 前置校验 `workspace API token`，未通过直接 401。
    3. 校验 `identity_id + password`，并绑定会话级 `nickname`。
    4. 签发短期 `magi_armor_key`（单 Bearer 凭证），供 `/chat/completions` 与 `/messages` 使用。
  - **验收标准**: 无 `workspace token` 或身份口令错误均不能签发 `armor token`。
  - **参考文档**: `kernel/model/session.go`、`kernel/model/auth.go`、`kernel/api/router.go`

- [ ] **Phase 3: 工具请求链路校验（API token + 渠道 + 身份）(P0)**
  - **背景**: Claude Code 等工具调用必须在标准 LLM 外观下完成强校验。
  - **行动**:
    1. 在 `/chat/completions` 与 `/messages` 入口强制校验 `Authorization: Bearer <magi_armor_key>`。
    2. 从 `magi_armor_key` 读取 `identity_id` 与 `request_channel`，作为唯一可信来源。
    3. 对请求体中的标准镜像字段仅做一致性比对，不作为提权依据。
    4. 任一不一致直接返回 403，禁止自动修正与降级。
    5. `model` 只做语义路由，不参与身份或渠道安全判定。
  - **验收标准**: 伪造 body/model 不能绕过身份与渠道校验。
  - **参考文档**: `kernel/api/magi_source.go`、`kernel/api/magi.go`、`kernel/api/magi_messages.go`

- [ ] **Phase 4: 主界面 AccessAuthCode 复用接线 (P1)**
  - **背景**: `magi-main-ui` 必须与笔记界面保持同等访问门禁。
  - **行动**:
    1. `magi-main-ui` 路径复用现有 `CheckAuth` 中 `AccessAuthCode` 校验行为。
    2. 沿用本地访问与网络伺服差异处理，不另起鉴权分支。
    3. 输出明确错误语义，区分 `AccessAuthCode` 失败与身份失败。
  - **验收标准**: 未通过访问授权码时，不进入身份分流逻辑。
  - **参考文档**: `kernel/model/session.go`、`kernel/server/serve.go`

- [ ] **Phase 5: 接口外观一致性与 SDK 互通验收 (P1)**
  - **背景**: 目标是“安全增强”而非“协议变形”。
  - **行动**:
    1. 用 OpenAI SDK/Claude SDK/Claude Code 分别联调两条端点。
    2. 验证标准请求体零改造可用；工具侧仅设置 `Authorization` 即可调用。
    3. 验证 `model` 语义键生效，但不影响安全判定结果。
    4. 验证流式/非流式场景下错误码与拒绝语义一致。
  - **验收标准**: 接口外观与普通 LLM API 一致，新增安全逻辑不破坏工具接入。
  - **参考文档**: `kernel/api/magi.go`、`kernel/api/magi_messages.go`

- [ ] **Phase 6: 多端昵称与 guardian/Avatar 分流验收 (P1)**
  - **背景**: 最终目标是“多端不同昵称 + guardian 直答 + 其它 Avatar 分流”。
  - **行动**:
    1. 构建三组身份验收脚本: `guardian`、`family-member`、`guest`。
    2. 在桌面端/移动端/网页端并发发起请求，验证昵称互不影响。
    3. 核对路由日志: `guardian` 直答，非 `guardian` 进入 Avatar。
  - **验收标准**: 达成本文档顶部验证检查清单。
  - **参考文档**: `kernel/nerv/magi/coordinator/coordinator.go`、`app/src/magi/adapters/magiStandardLLMAdapter.ts`

---

## 🟡 中期计划

- [ ] **Phase 7: 身份生命周期管理 (P1)**
  - **背景**: 需要支持口令轮换、token 撤销、防重放。
  - **行动**: 增加口令修改、会话撤销、`jti` 黑名单与审计查询。

- [ ] **Phase 8: 身份配置可视化 (P2)**
  - **背景**: 为家庭场景降低维护门槛。
  - **行动**: 增加身份管理面板（新增/停用身份、路由标签、默认展示名）。

---

## 🔴 远期计划

- [ ] **Phase 9: 身份行为画像与提示词差异化 (P2)**
  - **愿景**: 在不引入权限系统的前提下，为不同身份提供稳定对话风格与披露策略。

---

## 🏁 已归档/已完成

- [x] **2026-03-12: Phase 1（身份模型与 claims）完成**
  - `identity_id / display_name / route_class / enabled / password_hash` 数据平面已落地。
  - `magi_armor_key` claims 已固定为 `sub/chn/ws/rtc/nck/iat/exp/jti`。
- [x] **2026-03-12: Phase 2（身份登录与 token 签发）完成**
  - 已实现 `POST /api/s-forge/magi/v1/identity/login`。
  - 登录前置 `workspace API token`，登录成功签发短期 `magi_armor_key`。
  - 密码仅以 `bcrypt` 哈希落盘，不写明文。
- [x] **2026-03-12: Phase 3（请求链路校验）完成**
  - `/chat/completions` 与 `/messages` 改为仅接受 `Authorization: Bearer <magi_armor_key>`。
  - 旧 `X-MAGI-*` 依赖已移除，镜像字段仅做一致性校验。
  - 渠道/身份冲突直接拒绝（403），缺失/无效 token 返回 401。
- [x] **2026-03-12: 前端管理与仿真面板完成首版**
  - MAGI 监控界面已增加身份管理面板（list/upsert/remove/login）。
  - 测试聊天面板已支持按面板独立设置 `identity/password/nickname/channel/model` 并发起仿真请求。

---

## 验收用例清单

1. **用例 A: 缺失 workspace token**
   - 预期: 身份登录接口返回 401。
2. **用例 B: workspace token 正确 + 身份口令错误**
   - 预期: 登录失败，不签发 `armor token`。
3. **用例 C: Claude Code 请求缺失 magi_armor_key**
   - 预期: `/chat/completions` 返回 401。
4. **用例 D: Claude Code 请求伪造 channel/identity 镜像字段**
   - 预期: 服务器检测镜像字段与 claims 不一致，返回 403。
5. **用例 E: 两端同一身份不同昵称**
   - 预期: 均可登录；审计记录中 `identity_id` 相同、`nickname` 不同。
6. **用例 F: guardian 身份请求**
   - 预期: `DirectResponseAllowed=true`，请求走 MAGI 直答链路。
7. **用例 G: 非 guardian 身份请求**
   - 预期: `DirectResponseAllowed=false`，请求被分流到 Avatar 渠道。
8. **用例 H: 协议外观一致性**
   - 预期: OpenAI/Claude 标准请求体无需私有字段即可调用成功。
9. **用例 I: 非 guardian 使用 `model=magi-default` 或 `model=magi-review`**
   - 预期: 仍走 Avatar 分流，不可被 `model` 提升为直答。
10. **用例 J: guardian 使用 `model=magi-avatar`**
   - 预期: 可按语义降级到 Avatar 表达路径，但不改变其身份本身。

---

## 风险与约束

1. 若昵称被误用为认证键，会直接破坏“昵称与身份分离”原则。
2. 若将 `guardian` 误实现为管理权限，将偏离“身份与权限分离”目标。
3. 若保留旧请求回退路径，将产生可伪造身份入口。
4. 若主界面未复用 `AccessAuthCode` 逻辑，会与现有产品安全边界不一致。
5. 若着甲 token 不绑定 `channel` 与 `identity`，编程工具请求无法可靠分流。
6. 若协议依赖自定义请求头，Claude Code/Gemini CLI 等工具将无法稳定接入。
7. 若为兼容工具而改造非标准 body，会破坏“接口外观一致”目标。
8. 若把 `model` 当作安全字段使用，会形成可伪造提权路径。

---

## 参考资料

- `docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`
- `kernel/model/session.go`
- `kernel/server/serve.go`
- `kernel/api/magi_source.go`
- `kernel/api/magi.go`
- `kernel/api/magi_messages.go`
- `kernel/nerv/magi/coordinator/coordinator.go`
- `app/src/magi/adapters/magiStandardLLMAdapter.ts`
