# 多API配置存储 — 现状调查

## 调查范围

本文档记录2026-03-02对项目中AI配置存储实现的全面调查，覆盖后端kernel配置结构、前端配置读写链路、S-forge扩展层的Profile机制、以及MAGI系统的配置消费方式。

---

## 文件清单

### 后端（Kernel）

| 文件 | 职责 |
|------|------|
| `kernel/conf/ai.go` | 定义 `AI{OpenAI}` 结构体，从环境变量初始化默认值 |
| `kernel/api/ai.go` | AI相关API handler |
| `kernel/model/ai.go` | AI模型层逻辑 |

### 前端 — 上游核心配置

| 文件 | 职责 |
|------|------|
| `app/src/types/config.d.ts` (L116-179) | 定义 `IAI{openAI: IOpenAI}` 类型接口 |
| `app/src/config/ai/ai.ts` | AI设置面板，生成HTML并绑定事件，通过 `/api/setting/setAI` 保存 |
| `app/src/config/configSchemas/ai.schema.ts` | `IOpenAI` 的 zod 验证 schema |
| `app/src/mobile/settings/ai.ts` | 移动端AI设置（未深入调查） |

### 前端 — S-forge 扩展层

| 文件 | 职责 |
|------|------|
| `app/src/config/profileManager.ts` | 多配置管理器，基于 `/api/file/{putFile,getFile,readDir}` 实现 |
| `app/src/config/profile.types.ts` | `Profile<T>` 和 `NamespaceState` 类型 |
| `app/src/config/sforge.ts` | S-forge 配置入口，`getSForgeConfigs()` |
| `app/src/config/ai/ModelScopeConfig.vue` | ModelScope 多配置 Vue 组件（已使用 Profile 机制） |

### 前端 — 配置消费者

| 文件 | 职责 |
|------|------|
| `app/src/ai/types.ts` | `AIConfig` 接口和 `aiConfigSchema` |
| `app/src/ai/utils.config.ts` | `getAIConfigFromSiyuan()` 从 `window.siyuan.config.ai.openAI` 读取 |
| `app/src/magi/core/configLoader.ts` | 从工作空间 `ai-config.json` 文件加载配置（Marduk用） |
| `app/src/magi/core/marduk.ts` | 从 `petal/SACKeyManager` 目录加载配置文件 |
| `app/src/magi/core/wise/mockWise.ts` | `合并MockWISE配置()` 合并全局配置与子类配置 |
| `app/src/magi/core/wise/mockWise.subclass.ts` | 三贤人子类，只覆盖 `temperature`、`max_tokens` 等人格参数 |
| `app/src/magi/service/requestController.ts` | 构建流式请求配置 |

---

## 配置数据结构分析

### 上游 kernel 结构（`kernel/conf/ai.go`）

```go
type AI struct {
    OpenAI *OpenAI `json:"openAI"`
}

type OpenAI struct {
    APIKey         string  `json:"apiKey"`
    APITimeout     int     `json:"apiTimeout"`
    APIProxy       string  `json:"apiProxy"`
    APIModel       string  `json:"apiModel"`
    APIMaxTokens   int     `json:"apiMaxTokens"`
    APITemperature float64 `json:"apiTemperature"`
    APIMaxContexts int     `json:"apiMaxContexts"`
    APIBaseURL     string  `json:"apiBaseURL"`
    APIUserAgent   string  `json:"apiUserAgent"`
    APIProvider    string  `json:"apiProvider"`  // OpenAI, Azure
    APIVersion     string  `json:"apiVersion"`   // Azure API version
}
```

**关键特征**：
- **单配置**：`AI` 结构只有一个 `OpenAI` 字段
- 保存在 kernel 的 `conf.json` 中
- 通过 `/api/setting/setAI` 读写（请求体 `{openAI: {...}}`，响应体同结构）
- 支持环境变量覆盖（如 `SIYUAN_OPENAI_API_KEY`）

### 前端类型接口（`config.d.ts`）

```typescript
interface IAI { openAI: IOpenAI; }
interface IOpenAI {
    apiBaseURL: string; apiKey: string;
    apiMaxContexts: number; apiMaxTokens: number;
    apiModel: TOpenAIAPIModel; apiProvider: TOpenAAPIProvider;
    apiProxy: string; apiTemperature: number;
    apiTimeout: number; apiUserAgent: string; apiVersion: string;
}
type TOpenAAPIProvider = "OpenAI" | "Azure" | "Claude";
```

### S-forge Profile 机制（`profileManager.ts`）

```typescript
interface Profile<T = unknown> {
    id: string;   // UUID
    name: string; // 人类可读名称
    data: T;      // 泛型数据载荷
}
interface NamespaceState { activeProfileId: string; }
```

**存储路径**：`/data/storage/profiles/{namespace}/`
- 每个 Profile 一个 `{uuid}.json` 文件
- 活跃配置ID存储在 `_state.json`

**已有 namespace**：
- `ai_modelscope_auth` — ModelScope 认证配置
- `ai_modelscope_text2image` — ModelScope 文生图配置

---

## 配置读取链路分析

### 链路1：上游 AI 菜单操作

```
用户操作编辑器AI菜单
  → ai/actions.ts
  → ai/utils.config.ts::getAIConfigFromSiyuan()
  → window.siyuan.config.ai.openAI
  → 直接使用
```

### 链路2：MAGI 三贤人系统

```
initMagi() 创建三贤人
  → 创建MockMelchior实例() 等子类工厂函数
  → 创建MockWISE实例(预设配置, {})
  → 合并MockWISE配置(基础默认, 用户输入)
  → getSafeSiyuanConfig()?.ai?.openAI  ← 全局配置作为后备
  → 合并优先级: 用户输入 > 预设 > 全局配置 > 硬编码后备
```

三贤人子类只覆盖人格相关参数：
- Melchior: `temperature: 0.3`
- Balthazar: `temperature: 0.7`
- Casper: `temperature: 0.7, max_tokens: 30`

### 链路3：Marduk 系统

```
createMarduk(fs, dataStoragePath)
  → loadLatestConfig(fs, dataStoragePath)
  → 从 petal/SACKeyManager/ 目录读取最新配置文件
  → validateConfig() 验证并标准化
```

Marduk 有独立的配置加载路径，不依赖 `window.siyuan.config`。

---

## 关键发现

### 1. 上游数据结构是单配置的

`IAI{openAI: IOpenAI}` 只支持**唯一一个** OpenAI 兼容配置。所有消费者共享同一份配置。

### 2. S-forge Profile 机制已经成熟

`ModelScopeConfig.vue` 已证明 `ProfileManager` 完全可用于多配置管理。支持创建/切换/删除/持久化。

### 3. MAGI 系统已预留扩展接口

`MockWISEConfig.openAIConfig?: Partial<OpenAICompatConfig>` 已允许子类覆盖 OpenAI 配置，且 `合并MockWISE配置()` 是 `async` 函数。

### 4. 配置消费者可适配

- `getAIConfigFromSiyuan()` 是同步的，改异步需要适配调用方
- `合并MockWISE配置()` 已经是异步的，改造成本低

### 5. 存在多套并行配置加载

- `ai/utils.config.ts` → 从 `window.siyuan.config`
- `magi/core/configLoader.ts` → 从工作空间 `ai-config.json`
- `magi/core/marduk.ts` → 从 `petal/SACKeyManager/`
- `mockWise.ts` → 从 `window.siyuan.config` + 子类覆盖

这些应该逐步统一到 S-forge Profile 机制。

---

## 设置面板现状

当前设置面板 `config/ai/ai.ts` 已有两个 tab：

| Tab | 实现方式 | 配置存储 |
|-----|---------|---------|
| OpenAI | 原生HTML模板 + 手动事件绑定 | kernel `conf.json` via `/api/setting/setAI` |
| ModelScope | Vue组件 (`ModelScopeConfig.vue`) | S-forge Profile (`/data/storage/profiles/`) |

OpenAI tab 使用传统 HTML 模板字符串拼接方式，每个字段手动绑定 change 事件后调用 `fetchPost("/api/setting/setAI", ...)`。
