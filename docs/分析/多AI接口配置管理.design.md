# 多 AI 接口配置管理功能设计

## 概述

为思源笔记实现多个 OpenAI 兼容 AI 接口配置的存储与快速切换功能。该功能允许用户保存多套 AI 配置（如个人 Key、公司 Key、不同模型服务商），并能随时在它们之间切换。

> 本功能基于现有 SForge 扩展配置系统（`ProfileManager`）实现，与 ModelScope 配置使用相同的技术架构，确保代码复用和一致性。

---

## 设计目标

1. **多配置存储**：支持保存多个 OpenAI 兼容 API 配置
2. **快速切换**：一键切换当前激活的配置
3. **不修改后端**：所有扩展配置存储在前端管理的文件中，不改动思源核心 `conf.json`
4. **可扩展性**：为未来更多类型的配置（布局、主题、快捷键映射等）提供统一模式
5. **参考实现**：借鉴 keymanager 插件的数据管理模式

---

## 现有基础设施分析

### 1. ProfileManager（已实现 ✅）

位置：`app/src/config/profileManager.ts`

**核心能力**：
- 命名空间隔离：每种配置类型独立目录
- 配置档案CRUD：创建、读取、更新、删除
- 激活状态管理：记录当前激活的配置 ID
- 文件存储：基于 `/data/storage/profiles/<namespace>/` 目录

**数据结构**：
```typescript
interface Profile<T> {
    id: string;      // UUID
    name: string;    // 用户可读名称
    data: T;         // 具体配置内容（泛型）
}

interface NamespaceState {
    activeProfileId: string;
}
```

### 2. 思源原有 AI 配置结构

通过 `/api/setting/setAI` 保存到后端 `conf.json`：

```typescript
interface OpenAIConfig {
    apiProvider: "OpenAI" | "Azure";
    apiKey: string;
    apiBaseURL: string;
    apiModel: string;
    apiProxy: string;
    apiTimeout: number;
    apiMaxTokens: number;
    apiTemperature: number;
    apiMaxContexts: number;
    apiVersion: string;
    apiUserAgent: string;
}
```

### 3. keymanager 插件参考

位置：`toread/keymanager/source/data/index.js`

**核心模式**：
```javascript
const configs = reactive({
    currentAIConfig: globalThis.siyuan.config.ai.openAI,  // 当前生效配置
    savedConfigs: [],                                      // 已保存的配置列表
    savedDescribes: {},                                    // 配置元数据
});

// 使用 watch 自动保存变更
watch(() => JSON.stringify(configs.savedConfigs), (newConfigs, oldConfigs) => {
    // 差异比较，增量保存
    addedConfigs.forEach(item => plugin.saveData(item.name, item.value));
    removedConfigs.forEach(item => plugin.removeData(item.name));
});
```

**可借鉴点**：
- 配置与元数据分离（`describes` 文件存储配置名称等）
- Vue reactive + watch 实现自动持久化
- 差异比较减少不必要的写操作

---

## 技术方案

### 1. 存储结构

复用 ProfileManager，新增命名空间：

```
data/storage/profiles/
├── ai_openai_compatible/         # OpenAI 兼容配置命名空间
│   ├── _state.json               # 激活配置 ID
│   ├── <uuid1>.json              # 配置1: 个人 Key
│   ├── <uuid2>.json              # 配置2: 公司 Key
│   └── <uuid3>.json              # 配置3: DeepSeek
└── ai_modelscope_auth/           # ModelScope 配置（已有）
```

### 2. 配置数据结构

```typescript
// OpenAI 兼容配置数据
interface OpenAICompatibleData {
    // 基础配置
    apiProvider: "OpenAI" | "Azure" | "Custom";
    apiKey: string;
    apiBaseURL: string;
    apiModel: string;
    
    // 高级配置
    apiProxy?: string;
    apiTimeout?: number;
    apiMaxTokens?: number;
    apiTemperature?: number;
    apiMaxContexts?: number;
    apiVersion?: string;
    apiUserAgent?: string;
    
    // 扩展元数据
    providerName?: string;  // 供应商名称，如 "DeepSeek", "Kimi" 等
    description?: string;   // 用户备注
}

// 完整配置档案
type OpenAICompatibleProfile = Profile<OpenAICompatibleData>;
```

### 3. SForge 入口扩展

修改 `app/src/config/sforge.ts`：

```typescript
export const getSForgeConfigs = () => ({
    ai: {
        modelScope: {
            auth: ProfileManager.getInstance("ai_modelscope_auth"),
            text2image: ProfileManager.getInstance("ai_modelscope_text2image")
        },
        // 新增
        openAICompatible: ProfileManager.getInstance("ai_openai_compatible")
    }
});
```

### 4. 配置同步策略

**核心问题**：思源后端 AI 功能读取 `window.siyuan.config.ai.openAI`，而我们的多配置存储在文件中。

**解决方案**：
1. **启动时同步**：应用启动后，从激活配置加载数据并更新 `window.siyuan.config.ai.openAI`
2. **切换时同步**：用户切换配置时，调用 `/api/setting/setAI` 更新后端
3. **编辑时同步**：修改当前激活配置时，同时保存到文件和后端

```typescript
// 配置同步管理器
class AIConfigSyncManager {
    private manager = getSForgeConfigs().ai.openAICompatible;
    
    // 启动时调用
    async initFromActiveProfile() {
        const activeId = await this.manager.getActiveProfileId();
        if (activeId) {
            const profile = await this.manager.loadProfile<OpenAICompatibleData>(activeId);
            if (profile) {
                await this.applyConfig(profile.data);
            }
        }
    }
    
    // 切换配置
    async switchProfile(profileId: string) {
        const profile = await this.manager.loadProfile<OpenAICompatibleData>(profileId);
        if (profile) {
            await this.manager.setActiveProfileId(profileId);
            await this.applyConfig(profile.data);
        }
    }
    
    // 应用配置到后端
    private async applyConfig(data: OpenAICompatibleData) {
        await fetchPost("/api/setting/setAI", { openAI: data });
        window.siyuan.config.ai.openAI = { ...window.siyuan.config.ai.openAI, ...data };
    }
}
```

---

## UI 设计

### 1. 设置面板改造

在 AI 设置的 OpenAI Tab 中添加配置档案选择器：

```
┌─────────────────────────────────────────────────────────────┐
│ [OpenAI] [ModelScope]                                       │
├─────────────────────────────────────────────────────────────┤
│ 配置档案                                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [选择配置 ▼: 个人 OpenAI Key]  [+新建] [复制] [删除]    │ │
│ └─────────────────────────────────────────────────────────┘ │
│ 配置名称: [个人 OpenAI Key        ]                         │
│ 供应商:   [OpenAI | Azure | Custom ▼]                       │
├─────────────────────────────────────────────────────────────┤
│ API 配置                                                     │
│ API Key:      [sk-************************]                  │
│ Base URL:     [https://api.openai.com/v1   ]                │
│ Model:        [gpt-4o                       ]                │
│ Timeout:      [60] s                                         │
├─────────────────────────────────────────────────────────────┤
│ 高级设置                                                     │
│ Max Tokens:   [4096]                                         │
│ Temperature:  [1.0]                                          │
│ Max Contexts: [8]                                            │
│ Proxy:        [                             ]                │
│ User-Agent:   [                             ]                │
└─────────────────────────────────────────────────────────────┘
```

### 2. 快捷切换

在顶栏或状态栏添加快捷切换按钮（可选，阶段二实现）：

```
[AI: 个人 Key ▼] → 点击展开下拉列表选择配置
```

---

## 实现阶段

### 阶段一：基础多配置 📋 待实现

- [ ] 创建 `OpenAICompatibleConfig.vue` 配置面板组件
- [ ] 扩展 `sforge.ts` 添加 `openAICompatible` 命名空间
- [ ] 实现配置档案 CRUD 界面
- [ ] 实现配置切换同步到后端
- [ ] 整合到现有 AI 设置 Tab

### 阶段二：用户体验优化 📋 待实现

- [ ] 启动时自动同步激活配置
- [ ] 配置变更自动保存
- [ ] 配置导入/导出功能
- [ ] 顶栏快捷切换组件

### 阶段三：高级功能 📋 待实现

- [ ] 配置模板（预设常见服务商配置）
- [ ] 配置验证（测试连接）
- [ ] 配置分组/标签

---

## 文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `app/src/config/ai/OpenAICompatibleConfig.vue` | 配置面板组件 |
| `app/src/config/ai/openai.types.ts` | 类型定义 |
| `app/src/config/ai/aiConfigSync.ts` | 配置同步管理器 |

### 修改文件

| 文件 | 说明 |
|------|------|
| `app/src/config/sforge.ts` | 添加 `openAICompatible` 命名空间 |
| `app/src/config/ai/ai.ts` | 整合新组件 |
| `app/src/index.ts` | 启动时初始化配置同步 |
| `app/appearance/forge/lang/forge.i18n.json` | 添加国际化文本 |

---

## 与 keymanager 的区别

| 方面 | keymanager | 本方案 |
|------|------------|--------|
| 存储位置 | `/data/storage/petal/插件名/` | `/data/storage/profiles/命名空间/` |
| 实现方式 | 插件内独立实现 | 复用 ProfileManager |
| 数据格式 | 自定义 | 统一 Profile 结构 |
| 配置切换 | 需要重新加载 | 实时同步到后端 |
| 集成度 | 独立侧边栏 | 融入设置面板 |

---

## 扩展性设计

本方案为未来更多配置类型预留扩展空间：

```typescript
// 未来可扩展的配置类型
getSForgeConfigs = () => ({
    ai: {
        openAICompatible: ProfileManager.getInstance("ai_openai_compatible"),
        modelScope: { ... },
        // 未来可添加
        claude: ProfileManager.getInstance("ai_claude"),
        ollama: ProfileManager.getInstance("ai_ollama"),
    },
    // 其他配置类型
    editor: {
        layouts: ProfileManager.getInstance("editor_layouts"),
        themes: ProfileManager.getInstance("editor_themes"),
    },
    sync: {
        providers: ProfileManager.getInstance("sync_providers"),
    }
});
```

---

## 参考资料

- [ProfileManager 实现](file:///d:/dev/siyuan-note/app/src/config/profileManager.ts)
- [keymanager 数据管理](file:///d:/dev/siyuan-note/toread/keymanager/source/data/index.js)
- [ModelScope 配置面板](file:///d:/dev/siyuan-note/app/src/config/ai/ModelScopeConfig.vue)
- [ai.ts 设置面板](file:///d:/dev/siyuan-note/app/src/config/ai/ai.ts)
- [SForge 配置入口](file:///d:/dev/siyuan-note/app/src/config/sforge.ts)
