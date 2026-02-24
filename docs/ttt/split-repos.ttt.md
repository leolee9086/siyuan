# 拆分方案：repos.ts (632行)

> 文件路径：`app/src/config/repos.ts`
> 相关规程：`docs/规程/代码质量/超长文件拆分.procedure.md`

## 文件结构分析

| 行范围 | 函数 | 行数 | 导出 | 职责 |
|--------|------|------|------|------|
| 1-8 | imports | 8 | - | 导入 |
| 10-214 | renderProvider() | 205 | - | 渲染同步提供商配置HTML（极长） |
| 216-408 | bindProviderEvent() | 193 | - | 绑定提供商配置事件 |
| 410-508 | repos.genHTML() | 99 | export | 生成主面板HTML模板 |
| 510-631 | repos.bindEvent() | 122 | export | 绑定主面板事件 |

## 核心问题

- `renderProvider()` 占205行，主要是S3/WebDAV/Local三种提供商的HTML模板
- `bindProviderEvent()` 占193行，主要是三种提供商的blur事件处理（大量重复模式）
- repos对象的genHTML()和bindEvent()相对合理

## 拆分方案

### 目标文件结构

```
app/src/config/
├── repos.ts                 ← 主文件：repos对象 + genHTML + bindEvent (~300行)
└── repos.provider.ts        ← renderProvider + bindProviderEvent (~300行)
```

### 拆分细节

1. `repos.provider.ts` (~300行)
   - renderProvider()：三种提供商的HTML模板生成
   - bindProviderEvent()：提供商配置的blur事件、import事件等

2. `repos.ts` (~300行)
   - repos对象定义
   - repos.genHTML()（保持导出）
   - repos.bindEvent()（保持导出，从provider导入bindProviderEvent）

### 拆分顺序

1. 提取renderProvider和bindProviderEvent到 `repos.provider.ts`
2. 调整主文件导入

## 完成标志

- 两个文件均不超过300行
- repos对象导出签名不变
- 构建通过
