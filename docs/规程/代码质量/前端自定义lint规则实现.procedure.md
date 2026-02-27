# 前端自定义 Lint 规则实现规程

> **版本**: 1.0.0  
> **最后更新**: 2026-02-27  
> **适用范围**: `app/0_lints/` 目录下自定义 ESLint 规则的新建与维护

## 目录

- [1. 适用范围](#1-适用范围)
- [2. 文件格式与导出结构](#2-文件格式与导出结构)
- [3. 规则 meta 定义](#3-规则-meta-定义)
- [4. create 函数实现](#4-create-函数实现)
- [5. 报错信息规范](#5-报错信息规范)
- [6. 注册方式](#6-注册方式)
- [7. 测试验证](#7-测试验证)
- [8. 相关文档](#8-相关文档)

---

## 1. 适用范围

### 1.1 适用场景

- 新建自定义 ESLint 规则
- 修改现有自定义规则的检测逻辑或报错信息
- 为自定义规则添加可配置参数

### 1.2 不适用场景

- 修改第三方 ESLint 插件的配置（仅涉及 `eslint.config.mjs` 调整）
- 修复 lint 报错（参见 [`lint错误修复.procedure.md`](./lint错误修复.procedure.md)）

### 1.3 核心理念

本项目的 lint 规则是**渐进披露的系统提示词**——不仅是代码检查工具，更是向 AI 协作者传达编码规范的机制。任何能以 AST 描述的代码规范，都应以 lint 规则实现。

---

## 2. 文件格式与导出结构

### 2.1 文件格式

- **必须**使用 ESM 模块格式，文件后缀为 `.mjs`
- **必须**放置在 `app/0_lints/` 目录下
- **应该**以规则功能命名文件，使用 kebab-case

### 2.2 导出结构

- **必须**导出一个包含 `rules` 属性的插件对象
- **必须**同时提供中文命名导出和英文别名导出
- 一个插件文件可包含多个相关规则

```js
export const 禁止某模式插件 = {
    rules: {
        "rule-name": {
            meta: { /* ... */ },
            create(context) { /* ... */ }
        }
    }
};

// 英文别名导出
export const noSomePatternPlugin = 禁止某模式插件;
```

### 2.3 共享常量引用

- **应该**从 `shared-constants.mjs` 导入 `全量修复提示` 和 `单文件检查提示`
- **不得**在规则文件中重复定义这些共享常量

---

## 3. 规则 meta 定义

### 3.1 必要字段

- **必须**包含 `type` 字段，值为 `"problem"`
- **必须**包含 `docs` 对象，含 `description`、`category`、`recommended` 字段
- **应该**包含 `messages` 对象（当规则有多种报错场景时）
- **应该**包含 `schema` 数组（当规则接受用户配置时）

### 3.2 meta 结构示例

```js
meta: {
    type: "problem",
    docs: {
        description: "规则的简要描述",
        category: "Best Practices",
        recommended: true
    },
    messages: {
        ruleViolation: "违规信息模板 {{detail}}"
    },
    schema: [
        {
            type: "object",
            properties: {
                max: { type: "number" }
            },
            additionalProperties: false
        }
    ]
}
```

### 3.3 约束

- **不得**将 `type` 设为 `"suggestion"` 或 `"layout"`，本项目自定义规则统一为 `"problem"`
- **不得**省略 `docs.description`

---

## 4. create 函数实现

### 4.1 基本结构

- **必须**接收 `context` 参数
- **必须**返回 AST 访问者对象（visitor pattern）
- **应该**通过 `context.sourceCode`（或 `context.getSourceCode()`）获取源码信息
- **应该**通过 `context.options[0]` 获取用户配置

### 4.2 辅助函数

- **应该**将复杂检测逻辑提取为独立的辅助函数
- **应该**为辅助函数添加 JSDoc 注释说明用途
- **不宜**在 `create` 函数体内定义超过 20 行的内联逻辑

### 4.3 豁免机制

- **应该**支持通过注释标记豁免检查
- **应该**定义明确的豁免注释常量（如 `const EXEMPT_COMMENT = "@某豁免标记"`）
- **应该**检查节点及其父节点链上的注释

### 4.4 实现示例

```js
create(context) {
    const sourceCode = context.getSourceCode();

    function 检查节点(node) {
        // 豁免检查
        if (检查豁免注释(node, sourceCode)) return;

        // 检测逻辑
        if (违反条件) {
            context.report({
                node,
                message: 生成错误信息(详情)
            });
        }
    }

    return {
        FunctionDeclaration: 检查节点,
        ArrowFunctionExpression: 检查节点
    };
}
```

---

## 5. 报错信息规范

### 5.1 信息结构

报错信息**必须**包含以下三个层次：

1. **违规说明**：明确指出禁止什么，附带当前违规数据
2. **最佳实践指导**：给出替代方案或正确做法
3. **修复提示**：拼接 `全量修复提示` 和 `单文件检查提示`

### 5.2 格式要求

- **必须**以 ❌ 开头标识违规
- **应该**以 💡 标识豁免方式（如有）
- **必须**在末尾拼接共享提示常量
- **不得**仅输出简单的禁止信息而不提供替代方案

### 5.3 示例

```js
function 生成错误信息(actualLines) {
    return `❌ 禁止超过 ${MAX_LINES} 行的内联回调。当前 ${actualLines} 行。`
        + `请提取为命名函数以提高可读性。\n`
        + `💡 豁免方式: 在调用语句前添加 // ${EXEMPT_COMMENT} 注释`
        + 全量修复提示
        + 单文件检查提示;
}
```

---

## 6. 注册方式

### 6.1 配置文件

注册位置为 `app/eslint.config.mjs`。

### 6.2 导入

- **必须**导入规则文件的英文别名导出

```js
import { noSomePatternPlugin } from "./0_lints/no-some-pattern.mjs";
```

### 6.3 插件注册

- **必须**将插件添加到 `SHARED_PLUGINS` 对象
- key 为插件命名空间，value 为插件对象

```js
const SHARED_PLUGINS = {
    "no-some-pattern": noSomePatternPlugin,
    // ...其他插件
};
```

### 6.4 规则启用

- **必须**在 `SHARED_RULES` 中以 `<插件命名空间>/<规则名>` 格式启用
- **应该**根据规则性质选择 `"error"` 或带配置的数组形式

```js
const SHARED_RULES = {
    "no-some-pattern/rule-name": "error",
    // 或带配置
    "code-size/max-lines": ["error", { max: 300 }],
};
```

### 6.5 约束

- **不得**在 `SHARED_PLUGINS` 和 `SHARED_RULES` 之外的位置注册自定义规则
- **不得**使插件命名空间与已有命名空间冲突

---

## 7. 测试验证

### 7.1 基本验证

- **必须**对目标文件运行 `cd app && pnpm run lint:file -- <文件路径>` 确认规则生效
- **必须**验证违规代码被正确检出
- **必须**验证合规代码不被误报

### 7.2 豁免验证

- **应该**验证豁免注释能正确跳过检查
- **应该**验证豁免注释仅作用于预期范围

### 7.3 配置验证

- **应该**验证 schema 定义的配置参数能正确传入并生效
- **应该**验证默认配置下规则行为符合预期

### 7.4 回归验证

- **必须**运行 `cd app && pnpm run lint` 确认未引入新的配置错误
- **不得**因新规则导致已有文件产生非预期的大量报错

---

## 8. 相关文档

- [`docs/调研/前端自定义lint规则实现模式调研.md`](../../调研/前端自定义lint规则实现模式调研.md) — 实现模式调研
- [`docs/规程/代码质量/lint错误修复.procedure.md`](./lint错误修复.procedure.md) — Lint 错误修复规程
- [`app/0_lints/shared-constants.mjs`](../../../app/0_lints/shared-constants.mjs) — 共享常量
- [`app/eslint.config.mjs`](../../../app/eslint.config.mjs) — ESLint 配置文件

---

**文档版本**: 1.0.0  
**创建时间**: 2026-02-27
