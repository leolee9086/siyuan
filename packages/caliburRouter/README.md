# CalibURRouter

CalibURRouter 是基于集合切割的类型安全状态空间路由器。它同时在编译期追踪处理器输入、剩余集、模式互斥和穷尽状态，并在运行时验证模式、嵌套分发器和覆盖关系。

## 核心语义

- **Universe**：所有合法输入构成的状态空间。
- **Split**：从状态空间中切割互不重叠的模式子集。
- **Remain**：处理按注册顺序完成切割后的精确剩余集。
- **Otherwise**：处理剩余输入但不读取其状态，避免长链在类型层展开无用差集。
- **Nested dispatcher**：将一个可证明为父模式子集的分发器嵌入父路由，并为子空间外输入提供父级 fallback。

## 后端与安装

默认入口继续使用调用方提供的 ArkType：

```bash
pnpm add calibur-router arktype
```

`arktype` 是必需的 peer dependency，CaliburRouter 不捆绑或在内部调用 ArkType 的 `type()` 工厂。生产代码不要求包侧与消费者侧固定同一版本，也不要求调用方预先知道包的开发依赖版本。ArkType 的集合运算要求节点位于同一个 scope；适配器会在每次 `and/or/extends`、交集、子集或覆盖证明前，把所有外来模式通过目标模式的 `$.internal.bindReference` 绑定到当前运算 scope，再执行原生运算。因此同一 peer 范围内的不同安装和独立 scope 不依赖隐含约定即可协作。入口会逐项检查 `description/json/and/or/extends/get/distribute` 以及 `$.internal.bindReference`；能力缺失或绑定失败立即抛出带上下文的错误，不直接组合跨 scope 节点，也不静默回退。当前开发门禁同时使用 ArkType `2.1.29` 与消费者夹具 `2.2.3` 回归；推进 peer 范围前必须补充对应版本的跨消费者测试。

Zod 和 Effect Schema 通过独立子路径加载，属于可选 peer dependency：

```bash
pnpm add calibur-router zod
pnpm add calibur-router effect
```

| 后端 | 入口 | 模式构造 | 定位 |
| --- | --- | --- | --- |
| ArkType | `calibur-router` 或 `calibur-router/arktype` | ArkType `type(...)` | 兼容现有调用，允许 ArkType 原生类型作为模式 |
| Zod | `calibur-router/zod` | `zodState.*` | 生态与浏览器体积优先的形式化状态路由 |
| Effect Schema | `calibur-router/effect` | `effectState.*` | 类型求值和运行吞吐优先的形式化状态路由 |

## 快速开始

### ArkType

```ts
import { type } from "arktype";
import { calibur } from "calibur-router";

const dispatch = calibur.universe(type({
    key: "string",
    modifiers: { ctrl: "boolean", shift: "boolean" },
}))
    .split(type({ key: "'Enter'", modifiers: { ctrl: "true" } }), () => ({ command: "submit" as const }))
    .split(type({ key: "'Tab'" }), (state) => ({ command: "indent" as const, shift: state.modifiers.shift }))
    .remain((state) => ({ command: "input" as const, key: state.key }))
    .build();
```

### Zod

```ts
import { zodCalibur, zodState } from "calibur-router/zod";

const dispatch = zodCalibur.universe(zodState.object({
    mode: zodState.enumerated("edit", "readonly"),
    key: zodState.string(),
}))
    .split(zodState.object({ mode: zodState.literal("readonly") }), () => "ignore" as const)
    .remain((state) => {
        // state.mode 的类型是精确剩余值 "edit"。
        return state.key;
    })
    .build();
```

### Effect Schema

```ts
import { effectCalibur, effectState } from "calibur-router/effect";

const dispatch = effectCalibur.universe(effectState.object({
    mode: effectState.enumerated("edit", "readonly"),
    key: effectState.string(),
}))
    .split(effectState.object({ mode: effectState.literal("readonly") }), () => "ignore" as const)
    .remain((state) => state.key)
    .build();
```

## 可证明能力边界

Zod 和 Effect Schema 的生态能力远大于 CaliburRouter 可证明的集合代数。两者只通过 `zodState` / `effectState` 暴露经过形式化的模式构造器；任意原生 Schema 不会被当作状态空间模式接受。

| Schema 能力 | Calibur 集合语义 | Zod / Effect 首批支持 |
| --- | --- | --- |
| literal | 单元素集合 | 是 |
| finite enum / literal union | 有限集合并 | 是 |
| boolean | `{false, true}` | 是 |
| string | 字符串基础域；只证明基础域与 literal 的关系 | 是 |
| finite JSON number | 数值基础域与有限数值 literal | 是 |
| required object | 字段集合的笛卡尔积 | 是 |
| partial object pattern | 对全集字段的投影约束 | 是 |
| nested required object | 递归笛卡尔积与投影 | 是 |
| union | 集合并 | 是 |
| optional / tuple / array | 需要新增差集和覆盖证明 | 当前未开放 |
| regex / refinement / predicate | 一般不可判定 | 不进入集合路由 |
| transform / Effect context | 改变值或依赖外部环境 | 不进入集合路由 |

这项限制是语义边界，不是 Schema 库能力评价。普通数据校验仍可在 CaliburRouter 外使用 Zod refinement、Effect transform、ArkType morph 等完整生态能力。

## 原生 Schema 入口与出口

`fromSchema()` 允许复用生态中已有的原生 Schema，但只在完整检查后接纳支持子集；`toSchema()` 返回创建模式时保留的原生 Schema：

```ts
import { z } from "zod";
import { zodState } from "calibur-router/zod";

const native = z.object({
    mode: z.enum(["edit", "readonly"]),
    focused: z.boolean(),
});

const pattern = zodState.fromSchema(native);
const sameNativeSchema = zodState.toSchema(pattern);
```

```ts
import * as Schema from "effect/Schema";
import { effectState } from "calibur-router/effect";

const native = Schema.Struct({
    mode: Schema.Literal("edit", "readonly"),
    focused: Schema.Boolean,
});

const pattern = effectState.fromSchema(native);
const sameNativeSchema = effectState.toSchema(pattern);
```

Zod 转换会先递归检查原生定义，再严格解析其公开 JSON Schema，避免 custom refinement 或 transform 在 JSON Schema 中丢失后被误接纳。Effect 转换直接解析公开 `SchemaAST`。ArkType 默认入口本身直接接收并保留原生 `Type`，因此它的原生入口和出口是同一个对象，不增加同义包装 API。

## 嵌套路由

子分发器全集必须包含父模式要求的全部约束，且必须使用同一个 Schema 后端：

```ts
import { zodCalibur, zodState } from "calibur-router/zod";

const codeEnter = zodCalibur.universe(zodState.object({
    block: zodState.literal("code"),
    key: zodState.literal("Enter"),
}))
    .remain(() => "newline" as const)
    .build();

const dispatch = zodCalibur.universe(zodState.object({
    block: zodState.enumerated("code", "paragraph"),
    key: zodState.string(),
}))
    .split(
        zodState.object({ block: zodState.literal("code") }),
        codeEnter,
        () => "code-fallback" as const,
    )
    .remain(() => "paragraph" as const)
    .build();
```

运行时会阻断跨后端嵌套、非法子全集、重叠模式、耗尽后继续切割以及缺失父 fallback；这些路径同时具有静态契约测试。

## 后端选型

以下数据采集于 2026-07-25，环境为 Windows、Node.js 22.19.0、TypeScript 5.9.3、CaliburRouter 开发/基准依赖 ArkType 2.1.29、Zod 4.4.3、Effect 3.22.0。应用消费者回归另使用 ArkType 2.2.3。微基准用于比较当前实现，不代表所有应用负载。

### 编译时代价

样例为相同的 29 段层次化导航路由，分别隔离编译并使用 `tsc --extendedDiagnostics`：

| 后端 | 类型实例化 | TypeScript 内存 | Check time | Total time |
| --- | ---: | ---: | ---: | ---: |
| ArkType | 156,640 | 154.0 MB | 1.27 s | 2.77 s |
| Zod | 134,884 | 168.9 MB | 1.75 s | 3.44 s |
| Effect Schema | 56,497 | 188.8 MB | 0.92 s | 3.10 s |

Effect 的类型实例化和纯检查时间最低，但其声明图最大，解析与内存成本最高。当前单次顺序样本中 ArkType 总耗时最低，Zod 内存居中但检查时间最高；三者均已远离此前的 4 GB OOM。ArkType 在当前兼容入口中实例化次数最高，但已从优化前的 1,379,212 次和约 528 MB 显著下降。

### 运行时代价

Vitest benchmark 使用同一个三分支有限状态路由；热路径输入命中第三分支：

| 后端 | 热分发吞吐 | 平均单次 | 三分支构建吞吐 | 平均单次构建 |
| --- | ---: | ---: | ---: | ---: |
| ArkType | 43,394 ops/s | 0.0230 ms | 633 ops/s | 1.579 ms |
| Zod | 12,894 ops/s | 0.0776 ms | 2,648 ops/s | 0.378 ms |
| Effect Schema | 558,966 ops/s | 0.0018 ms | 4,423 ops/s | 0.226 ms |

Effect 在该热路径中最快。Zod 的验证成本最高，但平均约 0.078 ms，常规 UI 事件路由通常仍远低于单帧预算；高频数据流、服务端批处理或每帧大量分发应优先评估 Effect。

### 浏览器体积

使用 esbuild 0.28.1 对每个独立入口执行 ESM、browser、minify、tree-shaking 打包：

| 后端入口 | Raw | Gzip | Brotli |
| --- | ---: | ---: | ---: |
| ArkType | 156.5 KiB | 48.4 KiB | 42.4 KiB |
| Zod | 89.8 KiB | 25.2 KiB | 22.1 KiB |
| Effect Schema | 181.4 KiB | 57.2 KiB | 50.5 KiB |

这些是独立入口全量打包值。应用已经使用同一 Schema 库时，应以构建产物的边际增量为准。

### 生态完整性

NPM 最近一周下载量采样：Zod 约 2.40 亿、Effect 约 2,602 万、ArkType 约 139 万。下载量只反映采用广度，但结合当前生态可作如下判断：

- **Zod**：通用 TypeScript Schema 生态最完整，框架、表单、API、OpenAPI、代码生成和工具链集成最广；Zod 4 提供 Standard Schema 与 JSON Schema 方向的良好互操作。其自身不提供 Calibur 所需的完整集合证明，因此本适配器必须使用受限形式化构造器。
- **Effect Schema**：与 Effect 的错误通道、编码/解码、服务 Context、并发和资源管理体系结合最深，适合已经采用 Effect 的大型应用与服务端系统；热运行和类型检查表现最好，但声明图、内存和浏览器体积成本最高。
- **ArkType**：类型表达式紧凑，原生提供 `and`、`or`、`extends`、`overlaps` 等集合相关能力，与 Calibur 初始设计最接近；生态规模较小，且对象属性联合覆盖需要 Calibur 的有限分区证明补足。

### 推荐结论

**新建的通用浏览器或全栈项目默认推荐 Zod 后端。** 它在当前实测中提供最小浏览器体积、最大的工具生态、受控的原生 Schema 转换入口和可接受的常规事件运行成本，是生态丰富性与整体工程代价最均衡的选择；其代价是三者中最慢的热分发和本次样本中最高的 TypeScript check time。

以下场景使用其它后端更合适：

- 已经使用 Effect，或路由处于高吞吐热路径：推荐 Effect Schema；需接受约 189 MB 的隔离编译内存和约 57.2 KiB gzip 的独立入口成本。
- 现有 Calibur/ArkType 代码、需要保持原生 `type(...)` DSL，或需要 ArkType 集合操作参与适配：继续使用默认 ArkType 入口，避免无收益迁移。
- 应用已经打包某个 Schema 库：优先测量边际体积，现有依赖复用通常比独立入口表格更重要。s-forge 当前已依赖 Zod，因此新增 Zod 路由的实际体积成本通常低于表中独立值。

## API

- `calibur.universe(pattern)` / `zodCalibur.universe(pattern)` / `effectCalibur.universe(pattern)`：创建绑定后端的路由构建器。
- `.split(pattern, handler)`：切割互斥子集并注册处理器。
- `.split(pattern, childDispatcher, fallback)`：委托给同后端子分发器。
- `.remain(handler)`：处理并读取精确剩余集。
- `.otherwise(handler)`：处理剩余输入但不读取其类型。
- `.build()`：构建最终分发器；未穷尽且未声明剩余处理时，静态类型禁止调用。
- `PatternState`、`PatternShapeState` 与 `FormalUnit`：后端公共声明共用的核心类型代数；消费方生成声明时只引用包公开入口。

## 验证与复现

```bash
pnpm typecheck
pnpm test
pnpm typecheck:performance
pnpm typecheck:performance:zod
pnpm typecheck:performance:effect
pnpm bench
```

Zod、Effect 各自具有独立的完整路由契约，覆盖精确剩余集、嵌套对象、编译期和运行时耗尽、重叠阻断、父 fallback、非法子全集、缺失 fallback 与三层嵌套路由；公共契约验证两个形式化后端的集合语义一致。

## License

MIT
