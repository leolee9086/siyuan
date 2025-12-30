# 配置 Schema 维护指南

本目录包含了用于验证应用配置的 Zod Schemas。这些 Schema 必须与 `app/src/types/config.d.ts` 中定义的 TypeScript 接口保持一致。

## 核心原理

我们利用 TypeScript 的结构化类型系统（Structural Typing）来确运行时验证逻辑（Schema）与静态类型定义（Interface）的一致性。

1.  **静态类型定义**: `app/src/types/config.d.ts` 定义了配置对象在代码中被使用时所期望的结构（例如 `Config.IConf`, `Config.IEditor`）。
2.  **运行时验证**: 本目录下的 Zod Schema（例如 `editorConfigSchema`）定义了运行时如何解析和验证 JSON 数据。
3.  **一致性检查**: 在 `index.ts` 或各模块文件中，我们会尝试将 Zod 解析后的结果（`z.infer<typeof schema>`）赋值给对应的 TypeScript 接口类型。

    例如，在 `app/src/config/configSchemas/index.ts` 中：

    ```typescript
    const parseAsConfig = (rawConf: object): Config.IConf => {
        const result = configSchema.safeParse(rawConf);
        // ...
        return result.data; // 关键点：如果 schema 与 Interface 不匹配，这里会报错
    };
    ```

    如果 `configSchema` 缺少了 `Config.IConf` 中要求的某个必填字段，或者字段类型不匹配，TypeScript 编译器会在构建时抛出错误（TS2322）。

## 维护流程

当你修改了 `app/src/types/config.d.ts` 中的配置接口时（例如新增了一个配置项）：

1.  **编译检查**: 运行构建或在 IDE 中查看，你会发现 `app/src/config/configSchemas/` 下的相关文件出现类型错误。
2.  **更新 Schema**: 根据错误提示，在对应的 `.ts` 文件中更新 Zod Schema 定义。
    *   如果是必填项：添加对应的 `z.string()`, `z.boolean()` 等。
    *   如果是可选项：使用 `.optional()`。
    *   如果是枚举：使用 `z.enum([...])`。
3.  **验证**: 错误消失即代表 Schema 已与 Interface 重新同步。

## 目录结构

*   `index.ts`: 聚合入口，定义主 `configSchema`。
*   `editor.ts`: 编辑器相关配置 (`Config.IEditor`)。
*   `uiLayout.schema.ts`: UI 布局相关配置。
*   ... 其他对应模块的 Schema。

这种机制确保了我们不会在运行时遇到“配置结构正确但这一行代码却崩溃了”的问题，因为 Schema 强制了输入数据必须符合代码的静态假设。
