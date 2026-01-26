# ModelScope 对接功能设计

## 概述

为思源笔记添加魔搭社区 (ModelScope) 的 AI 模型服务对接能力，首期实现**文生图功能**。该功能完全在前端实现，通过思源后端的正向代理 (`/api/network/forwardProxy`) 转发请求到 ModelScope API。

> 该功能基于 SForge 扩展配置系统实现，配置与思源核心后端 `conf.json` 完全隔离，存储于 `/data/storage/profiles/` 目录。

---

## 设计原则

1. **前端实现**：所有逻辑在前端 TypeScript 中实现，不修改 Go 后端
2. **配置隔离**：使用 SForge (`ProfileManager`) 管理配置，与核心配置分离
3. **透明代理**：通过思源正向代理处理 CORS 问题
4. **中文编程**：主要函数和类型使用中文命名，提高可读性
5. **类型安全**：使用 TypeScript 类型守卫确保运行时安全

---

## 模块架构

```
app/src/
├── apis/modelscope/              # ModelScope API 客户端模块
│   ├── index.ts                  # 模块入口（统一导出）
│   ├── client.ts                 # API 客户端核心实现
│   ├── client.guard.ts           # 客户端类型守卫
│   ├── types.ts                  # 类型定义
│   ├── constants.ts              # 常量配置
│   ├── utils.ts                  # 工具函数
│   └── utils.guard.ts            # 工具函数类型守卫
├── config/
│   ├── sforge.ts                 # SForge 配置入口
│   ├── profileManager.ts         # 通用配置管理器
│   └── ai/
│       ├── ai.ts                 # AI 设置 Tab 集成
│       ├── ModelScopeConfig.vue  # ModelScope 配置面板
│       └── sforge_modelscope.plan.md  # 实施方案
└── protyle/gutter/menus/
    ├── buildGutterAiMenu.ts      # AI 菜单入口
    └── generateBlockImage.ts     # 文生图功能实现
```

---

## 核心实现详情

### 1. API 客户端 (`apis/modelscope/`)

#### 1.1 常量定义 (`constants.ts`)

```typescript
export const 魔搭API基础URL = "https://api-inference.modelscope.cn";

export const 端点 = {
    图片生成: "/api/v1/images/generations",
    任务状态: "/api/v1/tasks"
};

export const 请求头 = {
    Authorization: "Authorization",
    ContentType: "Content-Type",
    AsyncMode: "X-ModelScope-Async-Mode",
    TaskType: "X-ModelScope-Task-Type"
};

export const 默认模型 = "modelscope/damo-text-to-image-synthesis";
```

#### 1.2 类型定义 (`types.ts`)

| 类型 | 说明 |
|------|------|
| `ModelScopeAuthData` | 认证配置 (`apiToken`) |
| `生成参数` | 文生图请求参数（model, prompt, size, width, height, steps 等） |
| `任务响应` | 提交任务后返回的 task_id |
| `任务状态响应` | 轮询任务状态（PENDING / RUNNING / SUCCEED / FAILED） |
| `思源代理响应` | 正向代理返回的数据结构 |

#### 1.3 客户端接口 (`client.ts`)

| 函数 | 说明 | 英文别名 |
|------|------|----------|
| `提交生成任务` | 提交文生图任务，返回 task_id | `submitGenerationTask` |
| `获取任务状态` | 查询单个任务的状态 | `getTaskStatus` |
| `轮询任务直到完成` | 轮询直到任务完成或超时 | `pollTaskUntilComplete` |
| `获取图片` | 通过代理下载图片，返回 Base64 | `fetchImage` |
| `提取图片URL` | 从任务响应中提取图片 URL | `extractImageUrl` |

**请求流程**：
```
前端 → /api/network/forwardProxy → ModelScope API → 正向代理返回 → 前端处理
```

### 2. 配置管理

#### 2.1 存储结构

```
data/storage/profiles/
├── ai_modelscope_auth/           # 认证配置命名空间
│   ├── _state.json               # 激活配置 ID
│   └── <uuid>.json               # 各认证配置文件
└── ai_modelscope_text2image/     # 生成参数命名空间
    ├── _state.json
    └── <uuid>.json
```

#### 2.2 SForge 访问入口 (`sforge.ts`)

```typescript
export const getSForgeConfigs = () => ({
    ai: {
        modelScope: {
            auth: ProfileManager.getInstance("ai_modelscope_auth"),
            text2image: ProfileManager.getInstance("ai_modelscope_text2image")
        }
    }
});
```

### 3. 用户界面

#### 3.1 设置面板 (`ModelScopeConfig.vue`)

**已实现功能**：
- ✅ 认证配置管理（Token）
- ✅ 生成参数配置（模型、尺寸、步数）
- ✅ 多配置档案切换
- ✅ 即时保存
- ✅ 测试生成功能（带实时进度）
- ✅ 国际化支持

**面板结构**：
```
┌─────────────────────────────────────────────────┐
│ 认证配置                                         │
├─────────────────────────────────────────────────┤
│ 配置档案: [下拉选择] [+新建] [删除]              │
│ 配置名称: [输入框]                              │
│ API Token: [密码输入]                           │
├─────────────────────────────────────────────────┤
│ 生成配置                                         │
├─────────────────────────────────────────────────┤
│ 配置档案: [下拉选择] [+新建] [删除]              │
│ 配置名称: [输入框]                              │
│ 模型: [输入框]                                  │
│ 宽度/高度/步数: [数字输入]                       │
├─────────────────────────────────────────────────┤
│ 测试生成                                         │
├─────────────────────────────────────────────────┤
│ 提示词: [输入框]                                │
│ [测试生成按钮]                                  │
│ [生成的图片预览]                                │
└─────────────────────────────────────────────────┘
```

#### 3.2 编辑器菜单入口

**已实现的入口**（`buildGutterAiMenu.ts`）：
- 块级 Gutter 菜单 → AI → "使用块内容生成图片"
- 弹出进度对话框，显示生成状态
- 生成完成后自动插入图片到当前块后

---

## 实现阶段

### 阶段一：基础设施 ✅ 已完成

- [x] `ProfileManager` 通用配置管理器
- [x] `sforge.ts` SForge 配置入口
- [x] `apis/modelscope/` API 客户端模块（7个文件）
- [x] 类型定义和类型守卫

### 阶段二：配置 UI ✅ 已完成

- [x] `ModelScopeConfig.vue` 配置面板组件
- [x] AI 设置 Tab 集成 (`ai.ts`)
- [x] 多配置档案支持
- [x] 国际化翻译 (`forge.i18n.json`)

### 阶段三：文生图功能 ✅ 已完成

- [x] `generateBlockImage.ts` 文生图调用封装
- [x] `buildGutterAiMenu.ts` Gutter 菜单入口
- [x] `AiImageGenerationProgress.vue` 进度对话框
- [x] 图片上传至资源系统
- [x] 自动插入图片到文档

### 阶段四：增强功能 📋 待实现

- [ ] 负面提示词支持
- [ ] LoRA 模型配置
- [ ] 图生图功能
- [ ] 批量生成支持
- [ ] 生成历史记录
- [ ] 后端集成（CronJob 定时生成）

---

## 使用流程

1. **配置 Token**：
   - 打开 `设置` → `AI` → `ModelScope` 标签页
   - 填入从 [ModelScope 账户设置](https://www.modelscope.cn/my/myaccesstoken) 获取的 API Token

2. **调整生成参数**（可选）：
   - 选择或新建生成配置
   - 设置模型、尺寸、步数等参数

3. **生成图片**：
   - 在编辑器中选择包含描述文本的块
   - 点击 Gutter（块左侧图标）→ `AI` → `使用块内容生成图片`
   - 等待生成完成，图片自动插入到块后

4. **测试功能**：
   - 在设置面板的"测试生成"区域输入提示词
   - 点击"测试生成"验证配置是否正确

---

## 已创建文件

### API 客户端 (`app/src/apis/modelscope/`)

| 文件 | 说明 | 行数 |
|------|------|------|
| [index.ts](file:///d:/dev/siyuan-note/app/src/apis/modelscope/index.ts) | 模块入口 | ~30 |
| [client.ts](file:///d:/dev/siyuan-note/app/src/apis/modelscope/client.ts) | API 客户端 | ~250 |
| [client.guard.ts](file:///d:/dev/siyuan-note/app/src/apis/modelscope/client.guard.ts) | 客户端类型守卫 | ~40 |
| [types.ts](file:///d:/dev/siyuan-note/app/src/apis/modelscope/types.ts) | 类型定义 | ~130 |
| [constants.ts](file:///d:/dev/siyuan-note/app/src/apis/modelscope/constants.ts) | 常量配置 | ~35 |
| [utils.ts](file:///d:/dev/siyuan-note/app/src/apis/modelscope/utils.ts) | 工具函数 | ~65 |
| [utils.guard.ts](file:///d:/dev/siyuan-note/app/src/apis/modelscope/utils.guard.ts) | 工具类型守卫 | ~15 |

### 配置模块

| 文件 | 说明 |
|------|------|
| [ModelScopeConfig.vue](file:///d:/dev/siyuan-note/app/src/config/ai/ModelScopeConfig.vue) | 配置面板组件 |
| [sforge.ts](file:///d:/dev/siyuan-note/app/src/config/sforge.ts) | SForge 入口 |

### 功能入口

| 文件 | 说明 |
|------|------|
| [generateBlockImage.ts](file:///d:/dev/siyuan-note/app/src/protyle/gutter/menus/generateBlockImage.ts) | 文生图功能封装 |
| [buildGutterAiMenu.ts](file:///d:/dev/siyuan-note/app/src/protyle/gutter/menus/buildGutterAiMenu.ts) | Gutter 菜单集成 |

---

## 参考资料

- [ModelScope API-Inference 文档](https://www.modelscope.cn/docs/model-service/API-Inference/intro)
- [SForge 实施方案](file:///d:/dev/siyuan-note/app/src/config/ai/sforge_modelscope.plan.md)
- [ProfileManager 实现](file:///d:/dev/siyuan-note/app/src/config/profileManager.ts)
- [思源正向代理 API](file:///d:/dev/siyuan-note/API.md)

---

## 技术细节

### 异步任务轮询机制

ModelScope 文生图 API 采用异步任务模式：

```
1. POST /api/v1/images/generations (异步请求头)
   ↓
2. 返回 task_id
   ↓
3. GET /api/v1/tasks/{task_id} (轮询)
   ↓
4. PENDING → RUNNING → SUCCEED/FAILED
   ↓
5. 提取 output_images[0] URL
   ↓
6. 通过代理下载图片
```

### 思源正向代理使用方式

```typescript
const payload = {
    url: "https://api-inference.modelscope.cn/api/v1/...",
    method: "POST",
    headers: [{ Authorization: "Bearer xxx" }],
    payload: { prompt: "...", model: "..." },
    timeout: 60000
};

const response = await fetchSyncPost("/api/network/forwardProxy", payload);
// response.data 包含目标服务器的响应
```

### 类型守卫示例

```typescript
// client.guard.ts
export function 断言思源代理请求响应(
    response: unknown
): asserts response is { code: number; msg: string; data: 思源代理响应 | null } {
    if (!response || typeof response !== "object") {
        throw new Error("无效的思源代理响应");
    }
    // ...验证逻辑
}
```
