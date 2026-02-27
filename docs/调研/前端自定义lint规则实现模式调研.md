# 前端自定义 lint 规则实现模式调研

## 1. 文件列表

`app/0_lints/` 目录下共 15 个文件：

| 文件 | 用途 |
|------|------|
| `shared-constants.mjs` | 共享常量（全量修复提示、单文件检查提示） |
| `code-size-limits.mjs` | 文件/函数最大行数限制 |
| `no-inline-callback.mjs` | 禁止超长内联回调 |
| `no-alias-usage.mjs` | 禁止别名定义 |
| `no-export-forwarding.mjs` | 禁止导出转发 |
| `no-extends.mjs` | 禁止 extends |
| `no-large-inline-array.mjs` | 禁止大型内联数组 |
| `no-trivial-wrapper.mjs` | 禁止无意义包装函数 |
| `require-async-export.mjs` | 要求异步导出 |
| `require-function-comment.mjs` | 要求函数注释 |
| `require-if-comment.mjs` | 要求 if 注释 |
| `require-timeout-comment.mjs` | 要求 timeout 注释 |
| `ai-worker-rules.mjs` | AI worker 相关规则 |
| `vue-custom-rules.mjs` | Vue 自定义规则 |
| `task-checker.mjs` | 任务检查器（含 processor） |

## 2. 规则文件结构与实现模式

基于 `code-size-limits.mjs` 和 `no-inline-callback.mjs` 的分析：

### 文件格式

- ESM 模块（`.mjs` 后缀）
- 导出一个**插件对象**，包含 `rules` 属性
- 同时提供中文命名导出和英文别名导出

```js
// 示例结构
export const 禁止内联回调插件 = {
    rules: {
        "no-inline-callback": {
            meta: { ... },
            create(context) { ... }
        }
    }
};
export const noInlineCallbackPlugin = 禁止内联回调插件;
```

### meta 定义

```js
meta: {
    type: "problem",           // 固定为 "problem"
    docs: {
        description: "...",    // 规则描述
        category: "Best Practices",
        recommended: true
    },
    schema: [...]              // 可选，定义配置参数
}
```

### create 函数模式

- 接收 `context` 参数
- 通过 `context.sourceCode` 或 `context.getSourceCode()` 获取源码
- 通过 `context.options[0]` 获取用户配置
- 返回 AST 访问者对象（visitor pattern）
- 通过 `context.report({ node, message, loc })` 报告错误
- 错误信息中拼接 `全量修复提示` 和 `单文件检查提示`（从 `shared-constants.mjs` 导入）

### 共享常量

`shared-constants.mjs` 提供两个关键常量：
- `全量修复提示` / `FULL_FIX_REMINDER`：提醒修复所有 lint 错误
- `单文件检查提示` / `SINGLE_FILE_LINT_TIP`：提示单文件检查命令

### 一个插件可包含多个规则

如 `code-size-limits.mjs` 在同一个插件对象中定义了 `max-lines` 和 `max-lines-per-function` 两个规则。

## 3. ESLint 配置注册方式

配置文件：`app/eslint.config.mjs`（ESLint flat config 格式）

### 导入

每个插件文件的英文别名导出被 import 到配置文件：

```js
import { noInlineCallbackPlugin } from "./0_lints/no-inline-callback.mjs";
import { codeSizeLimitsPlugin } from "./0_lints/code-size-limits.mjs";
// ...
```

### 注册到 SHARED_PLUGINS

所有自定义插件统一注册到 `SHARED_PLUGINS` 对象，key 为插件命名空间：

```js
const SHARED_PLUGINS = {
    "no-inline-callback": noInlineCallbackPlugin,
    "code-size": codeSizeLimitsPlugin,
    // ...
};
```

### 启用规则

在 `SHARED_RULES` 中以 `<插件命名空间>/<规则名>` 格式启用：

```js
const SHARED_RULES = {
    "code-size/max-lines": ["error", { "max": 300, ... }],
    "no-inline-callback/no-inline-callback": "error",
    // ...
};
```

### 应用到文件

通过 flat config 的 `files` 字段分别应用到 `.ts/.tsx/.mjs` 和 `.vue` 文件，两者共享同一套 `SHARED_PLUGINS` 和 `SHARED_RULES`。

此外还有针对特定文件后缀的额外规则块（如 `.guard.ts` 豁免类型断言限制）。

## 4. Lint 相关 Scripts

`app/package.json` 中的 lint 脚本：

| 脚本 | 命令 | 用途 |
|------|------|------|
| `lint` | `eslint . --fix --cache` | 全量 lint 并自动修复 |
| `lint:report` | `eslint . --fix --cache --no-color --output-file lint-report.txt` | 输出报告到文件 |
| `lint:file` | `node ./scripts/check-file-lint.js` | 单文件 lint 检查 |
| `lint:top` | `node ./scripts/lint-top-errors.js` | 统计最多错误 |
| `lint:rules` | `node ./scripts/lint-rule-stats.js` | 规则统计 |

## 5. 核心设计理念

本项目的 lint 规则本质上是**渐进披露的系统提示词**——它们不仅是代码检查工具，更是向 AI 协作者传达编码规范的机制。因此：

- 任何能够以 AST 或其它自动化手段描述的代码规范，都应该以 lint 规则实现
- 规则的报错信息**必须提供最佳实践指导**（替代方案、正确做法），而非简单报错
- 现有规则的 `message` 字段均遵循此模式：先说明禁止什么，再给出替代方案，最后附加修复提示
