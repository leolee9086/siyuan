# CaliburRouter 类型性能与多 Schema 后端评估（TikTocTak）

> **最终目标**：在不弱化层次化状态空间路由、编译期收窄、互斥和穷尽语义的前提下，将 CaliburRouter 核心与 Schema 实现解耦；分别实现 ArkType、Effect Schema 与 Zod 后端，仅允许可形式化证明的 Schema 子集进入集合推理，并以统一契约、类型性能、运行性能、包体积和生态能力确定推荐后端。
>
> **当前目标**：完成 Zod 原生 Schema 封包的类型保真与纯谓词语义门禁；封包往返保留具体 Schema 类型，任何可能改变处理器输入值的 Schema 能力在构建阶段显式失败。
>
> **下一步任务**：主项目继续按既有全量类型错误基线推进列表职责拆分；若扩展 Schema 能力或 ArkType peer 范围，必须先补充对应公共声明和跨消费者回归。

## 不变量

- `universe/split/remain/otherwise/build`、嵌套分发器、处理器收窄、模式互斥和穷尽能力不得弱化。
- 各 Schema 后端独立实现，不通过参数分支把不同 Schema 的运行时细节揉进同一实现，也不覆盖现有 ArkType 后端。
- 核心只依赖完整的状态空间后端协议；具体 Schema 类型和具体值只出现在 Adapter、入口工厂与契约测试边界。
- 仅支持能够形式化为集合代数并在运行时确定验证的能力。任意 refinement、transform、正则、用户谓词和其它不可判定约束不得参与子集、交集、互斥或覆盖证明。
- 后端遇到契约外 Schema 必须在路由构建阶段显式报错，不返回猜测结果，不静默跳过证明。
- 不以 `any`、宽泛 `unknown` 或类型断言替代 Schema 输出类型；`unknown` 只用于外部输入验证边界。
- 当前 ArkType 公共入口与应用调用保持兼容；ArkType 作为必需 peer dependency，实验后端通过独立导出路径使用。
- 每个有效阶段完成后运行统一静态契约、运行契约和性能基准，并进行原子提交。

## 基线与证据

- **2026-07-25，优化前长链**：1,379,212 次类型实例化，约 528 MB，约 6 秒。
- **2026-07-25，第一轮优化后**：178,688 次类型实例化，约 118 MB，约 2.64 秒。
- **2026-07-25，当前门禁**：153,231 次类型实例化，约 149 MB，检查 1.81 秒，总计 4.26 秒；Calibur 静态契约通过，9 个测试文件共 74 项运行测试通过。
- **2026-07-25，应用验证**：生产源码检查不再触发 4 GB OOM，约 40 秒正常结束并报告既存类型错误；说明 Calibur 类型爆炸阻塞已经解除，但应用全量类型门禁尚未全绿。
- 已修复测试回归：具体类型别名上的条件类型不会自动分发，原 ArkType 探索测试错误期待 `boolean`；现分别锁定 ArkType 实际推导边界，并由 Calibur 自身断言浅层/嵌套结构差集。
- 已修复运行回归：ArkType 原生 `extends` 不能证明有限对象状态空间被多个部分模式联合覆盖；ArkType 后端现对模式约束的有限 unit 路径分区并逐区证明，证明越界显式报错。
- ArkType 运行时对象不能跨包实例直接与另一实例创建的 `never` 或 `raw` 模式做集合运算；包库不得假定调用方复用自身导出的 Schema 构造器。
- CaliburRouter 的生产代码不导入 ArkType 运行时工厂；包开发测试使用 `2.1.29`，消费者夹具使用独立安装的 `2.2.3`。适配器通过 `$.internal.bindReference` 将跨安装模式绑定到目标 scope，不要求调用方预先知道或固定双方版本。
- Zod/Effect 旧声明把 `PatternShapeState`、`PatternState` 定义在内部 `formal/adapter`；外部项目导出推断路由或 union 时稳定触发 `TS2742/TS2883`。库内声明生成因内部相对路径可达而不能复现，必须使用真实外部消费者门禁。

## 支持能力边界

| 能力 | 集合语义 | 首批支持 |
| --- | --- | --- |
| literal / unit | 单元素集合 | 是 |
| finite enum / literal union | 有限并集 | 是 |
| boolean | `{false, true}` | 是 |
| string / number 等基础域 | 仅证明同域与 literal 子集关系 | 是 |
| required object | 字段集合的笛卡尔积 | 是 |
| partial object pattern | 对全集字段的投影约束 | 是 |
| nested required object | 递归笛卡尔积与投影 | 是 |
| union | 集合并 | 是 |
| optional / tuple / array | 需单独证明差集与覆盖规则 | 后续评估 |
| refinement / regex / transform / predicate | 一般不可判定或含运行变换 | 禁止参与证明 |

## 分阶段计划

### Phase 0：ArkType 性能与回归基线

- [x] 建立 31 段长链类型性能回归。
- [x] 将逐段完整剩余集展开延迟到 `remain/build` 边界。
- [x] 使用覆盖联合执行增量互斥与耗尽判断。
- [x] 增加不读取剩余状态的 `otherwise()`。
- [x] 修复 ArkType 探索测试的条件分发测试回归并纳入静态门禁。
- [x] 修复有限层次状态空间的运行时覆盖证明。
- [x] 通过 74 项运行测试、完整静态契约和性能门禁。
- [x] 完成独立原子提交。

### Phase 1：完整后端协议

- [x] 定义完整 `StateSpaceBackend`，覆盖描述、验证、子集、交集、覆盖证明和后端身份。
- [x] 核心构建器改为依赖后端协议，并拒绝跨后端嵌套分发器。
- [x] ArkType 逻辑迁入独立 Adapter，默认 `calibur` API 保持兼容。
- [x] 为契约外能力定义统一、明确、可测试的构建错误。

### Phase 2：Effect Schema 与 Zod Adapter

- [x] 使用 Effect 当前 `effect/Schema` 实现独立 Adapter，不依赖已弃用的 `@effect/schema` 包。
- [x] 实现独立 Zod Adapter，使用 Zod 4 的 schema 输出类型与安全解析。
- [x] 两个后端只开放支持矩阵中的可证明构造器；未经形式化检查的原生 Schema 不进入集合路由。
- [x] 提供受控 `fromSchema()` / `toSchema()` 生态入口；Zod 双层检查定义与 JSON Schema，Effect 解析公开 `SchemaAST`，不可证明能力显式失败。
- [x] 每个 Adapter 提供独立导出路径、示例和声明构建。

### Phase 3：统一契约与性能比较

- [x] 对三个后端运行同一组浅层、嵌套、互斥、穷尽、剩余集、嵌套分发器和错误路径契约。
- [x] 比较 29 段长链的类型实例化、峰值内存和检查耗时。
- [x] 比较路由构建和热路径分发吞吐。
- [x] 比较浏览器包体积、Tree-shaking、错误信息、Schema 生态和维护活跃度。

### Phase 4：推荐与归档

- [x] 根据可证明能力完整度、类型性能、运行性能、生态和迁移成本给出推荐后端。
- [x] 推荐结论不得仅依据单项基准；层次化状态空间语义完整性为硬门槛。
- [x] 重建 `dist`，通过包门禁和 Calibur 源码循环依赖检查。
- [ ] 应用生产源码检查可在约 38 秒完成且不再 OOM，但当前仍报告 18,121 项既存类型错误；需由前端类型修复任务继续清理后才能宣称应用门禁通过。
- [x] 分阶段原子提交并归档本文中的多后端实现阶段。

### Phase 5：跨安装与跨版本确定性边界

- [x] 将 ArkType 模式能力校验与跨 scope 绑定收口到单一适配边界，避免 `setOps` 反向依赖适配器形成循环。
- [x] 交集、子集、覆盖证明及有限路径分区在执行 ArkType 原生运算前统一归一化到左操作数或全集 scope。
- [x] 增加包侧 ArkType `2.1.29` 与消费者侧 `2.2.3` 的跨版本分发、交集、子集和嵌套路由回归。
- [x] 对缺少 `$.internal.bindReference` 的模式显式失败，不使用直接跨 scope 运算或兼容回退。
- [x] 重建 `dist` 并执行完整包门禁、应用消费者门禁和循环依赖检查。

### Phase 6：公共声明可移植性

- [x] 在 `app/test` 建立外部消费者声明夹具，同时导出 ArkType、Zod 与 Effect 路由以及 Zod/Effect union。
- [x] 将已有 `PatternState`、`PatternShapeState` 与 `FormalUnit` 从形式化实现层提升到 Calibur 核心公共类型入口；不公开 `formal/adapter` 子路径。
- [x] Zod/Effect 公共签名改为只引用 `calibur-router` 根入口的类型代数，应用调用点不增加注解、断言或局部替代接口。
- [x] 使用应用自身的普通 `z.object()` 验证 `zodState.fromSchema()` 封装与 `toSchema()` 同对象解包，覆盖独立安装目录下的原生 ESM 运行边界。
- [x] 重建 `dist`；外部声明生成、完整静态契约、运行时契约与真实 `keydown.list` 路由测试通过。

### Phase 7：Zod 生态封包的类型与值语义保真

- [x] `ZodStatePattern` 同时携带状态类型和原始 Zod Schema 类型；`toSchema(fromSchema(schema))` 在类型层保持 `typeof schema`，并保留原对象身份。
- [x] 外部消费者声明夹具直接调用解包后 `ZodObject.pick()`，证明生成声明没有把具体 Schema 降为宽泛 `ZodType`。
- [x] 递归阻断顶层和嵌套 `coerce`；后端仍按谓词验证原输入，不把解析后的转换值冒充路由状态。
- [x] 包内契约、完整 `107/107` 运行测试、构建、应用外部声明和已构建包 ESM 运行契约通过。

## 风险与验收标准

- Schema 库的类型推断能力不等于集合证明能力；Adapter 必须携带可审计的形式化表示或使用后端可验证的等价证明。
- Zod 与 Effect Schema 的任意用户扩展能力丰富，但这部分不得被错误提升为集合代数。
- 验收要求：三个后端共用同一核心路由实现；默认 ArkType 行为不回归；Effect/Zod 契约外输入明确失败；完整性能表可复现；推荐结论具有测试数据和能力矩阵依据。

## 已归档/已完成

- **2026-07-25**：创建本任务文档，Phase 0 已完成并形成独立提交。
- **2026-07-25**：完成核心 `StateSpaceBackend` 与后端身份校验；ArkType 保持默认入口，Zod 与 Effect Schema 使用独立子路径和形式化构造器，任意原生 Schema 在构建入口显式失败。
- **2026-07-25**：Zod、Effect 各 8 项完整路由契约及 7 项公共代数契约通过，覆盖精确剩余集、嵌套对象、静态/运行耗尽、重叠、fallback、非法子全集和三层嵌套路由。
- **2026-07-25**：加入原生转换后重新采样 29 段顺序编译：ArkType 156,640 次实例化、154.0 MB、check 1.27 秒；Zod 134,884 次、168.9 MB、check 1.75 秒；Effect 56,497 次、188.8 MB、check 0.92 秒。
- **2026-07-25**：三分支热分发：ArkType 43,394 ops/s，Zod 12,894 ops/s，Effect 558,966 ops/s；构建吞吐分别为 633、2,648、4,423 ops/s。
- **2026-07-25**：加入转换入口后的独立浏览器 gzip 体积：ArkType 48.4 KiB，Zod 25.2 KiB，Effect 57.2 KiB。综合生态、总体编译成本、体积与常规 UI 运行成本，README 推荐 Zod 作为新建通用项目的均衡默认；Effect 用于高吞吐或已有 Effect 项目，ArkType 用于现有兼容入口。
- **2026-07-25**：最终包门禁通过，14 个测试文件共 103 项运行测试通过，静态契约和三个发布入口构建通过；Madge 检查 10 个源码文件，无循环依赖。
- **2026-07-28 复现**：使用应用现有 `arktype` 构造 `windowKeyDown/navigation` 的真实嵌套全集和 `{isTabWindow: false}` 部分模式，导入 `calibur-router` 后稳定复现 `有交集() -> undefined.filter`；错误来自 `setOps.ts` 把包内 `type("never")` 与调用方模式交给跨实例 `extends`，不是路由规则本身，也不是测试夹具问题。
- **2026-07-28 修复**：移除集合运算对包内运行时 `type()` 工厂的依赖；交集空集改为检查交集自身的 ArkType `description/json`，有限路径分区改由全集模式自身的 `.and()` parser 构造嵌套约束。这样调用方可继续使用自身 ArkType 实例，包不再要求传入模式必须来自包内实例；没有 catch 回退、跳过覆盖证明或静默吞错。
- **2026-07-28 跨版本回归**：隔离环境用 ArkType `2.1.29` 与 `2.2.3` 互相组合模式，稳定复现 ArkType 原生跨 scope 错误 `intersection.equals is not a function`；同一调用方 scope 的集合运算通过。该复现证明“应用与库锁定同版本”不能作为问题归零方案。
- **2026-07-28 边界初版（已被后续修正）**：CaliburRouter 移除生产 `arktype` dependency，改为必需 peer dependency `>=2.1.29 <2.3.0`；开发/包契约测试固定 `2.1.29`，应用依赖更新为 `2.2.3`。该版本只检查公开能力并假定运算输入来自同一 scope，不能作为跨 scope 问题归零；本轮新增绑定适配后以新证据替代该前提。
- **2026-07-28 跨安装适配修复**：新增 `adapters/arktypePattern.ts` 作为唯一 ArkType 边界，入口检查 callable、`description`、`json`、`and`、`or`、`extends`、`get`、`distribute` 和 `$.internal.bindReference`。`是子集`、`有交集`、`全集被模式集合覆盖` 及有限路径证明在调用 ArkType 运算前，将右操作数/模式集合绑定到左操作数或全集 scope；绑定失败带源/目标描述显式抛错。新增 `arktype-consumer` 开发期 alias，以 ArkType `2.1.29` 与 `2.2.3` 实际运行跨版本分发和独立 scope 嵌套路由，包契约类型检查和新增 `15/15` 目标测试通过，未要求调用方固定双方版本。
- **2026-07-28 阶段验收**：重建 `dist`；包 `typecheck`、contracts、ArkType/Zod/Effect 三套性能类型门禁通过；包全量 `15` 个测试文件、`107/107` 测试通过；应用 ArkType 消费者 `2/2` 通过；`app/src` 为 `2396` 个文件、`0` 条循环，imports gateway hops 为 `0`。主项目全量类型检查仍保留既有错误基线，不在本阶段缩小检查范围或宣称全绿。
- **2026-07-29 声明复现**：外部消费夹具对 Zod/Effect 的对象路由和 union 生成声明时稳定得到四个 `TS2742`（编辑器显示同义 `TS2883`），均要求引用 `node_modules/calibur-router/dist/formal/adapter`；同一夹具置于库内会生成该内部路径但不报错，因此库内 `tsc` 不是充分证据。
- **2026-07-29 声明修复与验收**：将既有模式推断代数和 `FormalUnit` 移到 `core/types.ts` 并由包根公开，Zod/Effect 消费方的生成声明只再引用 `calibur-router`、`calibur-router/zod`、`calibur-router/effect` 与原生 Schema 包。外部三后端声明门禁通过；应用创建的普通 Zod Schema 经 `fromSchema()` 封装后可由 `toSchema()` 按同一对象身份取回；包 build、完整 typecheck/contracts、`15` 个测试文件 `107/107` 通过；应用 `keydown.list/router.test.ts` `41/41` 通过。未在应用调用点添加类型注解，也未改变 `.split/.remain` 的状态空间语义。
- **2026-07-29 Zod 封包语义修复**：回归测试先复现 `z.coerce.number()` 被接纳后，处理器静态收到 `number`、运行时却收到原字符串的类型不一致。`fromSchema()` 现保留具体 Schema 泛型，`toSchema()` 精确返回该类型；递归审查明确拒绝顶层和对象字段中的 `coerce`。外部声明夹具可直接调用解包后 `ZodObject.pick()`；包完整 typecheck、`15` 个测试文件 `107/107`、构建和应用消费者声明门禁通过。
