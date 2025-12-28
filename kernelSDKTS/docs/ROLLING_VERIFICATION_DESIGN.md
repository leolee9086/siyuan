# API 定义滚动核对机制设计

> 创建日期: 2025-12-28
> 状态: 设计阶段

---

## 1. 背景与问题

### 1.1 现状

`kernelSDKTS/src/apiDefs/*.ts` 中的 API 定义需要与后端 Go 代码保持一致。目前存在以下问题：

1. **无法追踪核对状态** - 不知道哪些 API 已经核对过、哪些没有
2. **容易遗漏** - 新增或修改的 API 可能被忽略
3. **无优先级** - 不知道应该先核对哪些 API
4. **依赖人工记忆** - 容易忘记上次核对到哪里了

### 1.2 目标

建立一个**滚动核对机制**，使得：
- 所有 API 定义都能被定期核对
- 自动识别需要优先核对的 API
- 追踪每个 API 的核对历史
- 与 AI 辅助核对工作流无缝衔接

---

## 2. 设计方案

### 2.1 核心字段：`lastVerified`

在 `Api定义` 接口中增加可选字段：

```typescript
// src/client/types.ts
export interface Api定义 {
    method: 'GET' | 'POST';
    endpoint: string;
    en: string;
    zh_cn: string;
    description: string;
    needAuth: boolean;
    needAdminRole: boolean;
    unavailableIfReadonly: boolean;
    zodRequestSchema: z.ZodType<any>;
    zodResponseSchema: z.ZodType<any>;
    
    // 新增字段
    lastVerified?: string;  // ISO 日期格式: "2025-12-28"
}
```

### 2.2 字段语义

| 值 | 含义 |
|----|----|
| `undefined` | 从未核对过（最高优先级）|
| `"2025-12-28"` | 在该日期核对过，与 Go 代码一致 |

### 2.3 核对优先级规则

按以下优先级排序待核对 API：

1. **`lastVerified` 为空** → 最高优先级（从未核对）
2. **`lastVerified` 超过 30 天** → 高优先级（需要定期刷新）
3. **`lastVerified` 超过 14 天** → 中等优先级
4. **其他** → 低优先级（近期已核对）

---

## 3. 配套工具

### 3.1 脚本：`scripts/listPendingVerification.ts`

功能：列出需要核对的 API

```typescript
import { allApiDefs } from '../src/apiDefs';

interface PendingApi {
    endpoint: string;
    en: string;
    file: string;
    lastVerified: string | null;
    daysSinceVerified: number | null;
    priority: 'critical' | 'high' | 'medium' | 'low';
}

function daysSince(dateStr: string): number {
    const date = new Date(dateStr);
    const now = new Date();
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function getPriority(lastVerified?: string): PendingApi['priority'] {
    if (!lastVerified) return 'critical';
    const days = daysSince(lastVerified);
    if (days > 30) return 'high';
    if (days > 14) return 'medium';
    return 'low';
}

function main() {
    const pending: PendingApi[] = [];
    
    for (const [file, defs] of Object.entries(allApiDefs)) {
        for (const api of defs) {
            const priority = getPriority(api.lastVerified);
            if (priority !== 'low') {
                pending.push({
                    endpoint: api.endpoint,
                    en: api.en,
                    file,
                    lastVerified: api.lastVerified || null,
                    daysSinceVerified: api.lastVerified ? daysSince(api.lastVerified) : null,
                    priority,
                });
            }
        }
    }
    
    // 按优先级排序
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    pending.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    console.log(`\n📋 待核对 API 列表 (共 ${pending.length} 个)\n`);
    console.log('=' .repeat(80));
    
    for (const api of pending.slice(0, 20)) {
        const status = api.lastVerified 
            ? `${api.daysSinceVerified} 天前` 
            : '从未核对';
        const icon = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[api.priority];
        console.log(`${icon} [${api.priority.padEnd(8)}] ${api.endpoint}`);
        console.log(`   └─ ${api.file} :: ${api.en} (${status})`);
    }
    
    if (pending.length > 20) {
        console.log(`\n... 还有 ${pending.length - 20} 个待核对 API`);
    }
}

main();
```

### 3.2 npm script

```json
// package.json
{
    "scripts": {
        "verify:list": "tsx scripts/listPendingVerification.ts",
        "verify:report": "tsx scripts/generateVerificationReport.ts"
    }
}
```

### 3.3 输出示例

```
📋 待核对 API 列表 (共 47 个)

================================================================================
🔴 [critical] /api/av/renderAttributeView
   └─ av.ts :: renderAttributeView (从未核对)
🔴 [critical] /api/av/getAttributeViewKeys
   └─ av.ts :: getAttributeViewKeys (从未核对)
🟠 [high    ] /api/block/updateBlock
   └─ block.ts :: updateBlock (35 天前)
🟠 [high    ] /api/filetree/getDoc
   └─ filetree.ts :: getDoc (42 天前)
🟡 [medium  ] /api/search/fullTextSearchBlock
   └─ search.ts :: fullTextSearchBlock (18 天前)

... 还有 42 个待核对 API
```

---

## 4. 工作流程

### 4.1 日常核对流程

```
┌─────────────────────────────────────────────────────────────┐
│                      滚动核对工作流                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 运行 pnpm verify:list                                   │
│     └─ 获取待核对 API 列表                                   │
│                                                             │
│  2. 选择一批 API (通常 5-10 个)                              │
│     └─ 优先处理 critical 和 high                            │
│                                                             │
│  3. AI 核对                                                 │
│     ├─ 读取对应的 Go 处理函数                                │
│     ├─ 对比 TS 定义的 zodRequestSchema                      │
│     ├─ 对比 TS 定义的 zodResponseSchema                     │
│     └─ 记录差异、修复问题                                    │
│                                                             │
│  4. 更新 lastVerified                                       │
│     └─ 核对通过的 API 更新为今天日期                          │
│                                                             │
│  5. 提交变更                                                │
│     └─ git commit -m "verify: block.insertBlock, ..."       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 新增 API 流程

1. 迁移新 API 定义时，**不设置** `lastVerified`
2. 新 API 自动进入 `critical` 优先级
3. 下次运行 `verify:list` 时会出现在列表顶部
4. 核对通过后设置 `lastVerified`

### 4.3 Go 代码变更检测（可选扩展）

未来可以增加 git 追踪：

```typescript
interface Api定义 {
    // ... 现有字段
    lastVerified?: string;
    verifiedGoCommit?: string;  // 核对时 Go 文件的 commit hash
}
```

脚本可以检测：
- 如果 `kernel/api/<file>.go` 在 `verifiedGoCommit` 之后有新 commit
- 则该 API 需要重新核对（即使 lastVerified 很新）

---

## 5. 实施计划

### Phase 1: 基础框架 (1 小时)

- [ ] 修改 `Api定义` 接口，增加 `lastVerified` 字段
- [ ] 更新类型检查确保可选字段不破坏现有代码
- [ ] 编写 `scripts/listPendingVerification.ts`
- [ ] 添加 npm script

### Phase 2: 初始化 (30 分钟)

- [ ] 已核对的 API 设置 `lastVerified` 为今天
- [ ] 未核对的 API 保持 `undefined`
- [ ] 运行脚本确认输出正确

### Phase 3: 纳入日常流程 (持续)

- [ ] 每次核对后更新 `lastVerified`
- [ ] 定期（每周/每两周）运行 `verify:list` 检查待核对列表
- [ ] 逐步覆盖所有 API

### Phase 4: 可选扩展

- [ ] 增加 `verifiedGoCommit` 字段
- [ ] 编写 Go 变更检测脚本
- [ ] 增加 API 优先级分类

---

## 6. 设计决策记录

### 6.1 为什么用日期字符串而不是时间戳？

- **可读性**: `"2025-12-28"` 一眼能看懂
- **简单**: 不需要额外转换
- **足够精确**: 核对粒度是"天"，不需要更细

### 6.2 为什么不用版本号？

- 版本号需要额外维护（递增、重置等）
- 日期自解释，不需要查表
- 可以直接计算"多久没核对了"

### 6.3 为什么是 30 天阈值？

- Go 代码的迭代周期大约是 2-4 周
- 30 天足以覆盖 1-2 个版本迭代
- 可以根据实际情况调整

---

## 7. 附录

### 7.1 与现有工具的关系

| 工具 | 功能 | 关系 |
|------|------|------|
| `sync:update` | 从 Go router 提取 API 列表 | 互补，提供新增 API 检测 |
| `sync:check` | 检查 endpoint 一致性 | 互补，检查结构性差异 |
| `verify:list` | 列出待核对 API | **新增**，追踪核对状态 |

### 7.2 参考：当前 API 统计

```
block.ts      - 53 个 API
av.ts         - 32 个 API  
filetree.ts   - 31 个 API
export.ts     - 29 个 API
bazaar.ts     - 24 个 API
...
总计约 350+ 个 API
```

按每次核对 10 个 API，需要 35+ 次才能完整覆盖一轮。
按每周核对 2 次，约需 4-5 个月完成首轮覆盖。

---

*文档结束*
