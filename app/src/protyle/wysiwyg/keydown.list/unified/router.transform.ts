/**
 * 列表转换子路由器
 *
 * 本文件实现了列表类型转换的子路由器
 * 从主路由器文件拆分出来以满足行数限制
 *
 * @see docs/ttt/键盘事件处理重构-列表归并设计.md
 */

/**
 * 用途：复用 unified 目录同层转发的声明式路由构建器，以保持当前子路由器继续使用既有静态 DSL 定义方式。
 * 使用范围：仅用于 [`transformSubRouter`](app/src/protyle/wysiwyg/keydown.list/unified/router.transform.ts:29) 构建路由实例；边界是不参与命令定义、状态 schema 声明或任何执行阶段逻辑。
 * 解耦评估：理论上可把路由构建器改为由外层工厂参数传入，但这会让当前静态常量式子路由器退化为初始化产物，并把装配责任扩散到调用方；在现有统一列表路由体系中，经由同层 [`imports.ts`](app/src/protyle/wysiwyg/keydown.list/unified/imports.ts) 收敛第三方依赖更低耦合。
 */
import { calibur } from "./imports";
/**
 * 用途：复用 unified 目录同层转发的 Arktype `type()` 声明器，用于描述转换子路由器的输入状态约束。
 * 使用范围：仅用于 [`transformSubRouter`](app/src/protyle/wysiwyg/keydown.list/unified/router.transform.ts:30) 及后续各个 [`split()`](app/src/protyle/wysiwyg/keydown.list/unified/router.transform.ts:49) 分支中的 schema 声明；边界是不负责运行时命令执行与依赖装配。
 * 解耦评估：理论上可以把所有 schema 预先定义在外部后再传入当前文件，但这会割裂规则与约束的就近声明关系，增加中间层和维护成本；当前通过同层网关复用 `type()`，已经是在不改造路由结构前提下的较优解。
 */
import { type } from "./imports";
/**
 * 用途：复用 unified 目录同层转发的列表命令常量，确保本子路由器返回值与执行层共享同一命令契约。
 * 使用范围：仅用于 [`transformSubRouter`](app/src/protyle/wysiwyg/keydown.list/unified/router.transform.ts:50) 之后各分支的命令返回值；边界是不承担命令执行、状态提取或入口导出职责。
 * 解耦评估：理论上可把命令表作为参数传入当前子路由器工厂，或改为返回更抽象的事件再由外层映射命令，但那会把统一命令契约扩散到更多装配点并增加调用复杂度；继续经由同层 [`imports.ts`](app/src/protyle/wysiwyg/keydown.list/unified/imports.ts) 读取共享常量，耦合面更小且满足 lint 约束。
 */
import { LIST_COMMANDS } from "./imports";

/**
 * 列表转换子路由器
 *
 * 前置条件：hotkeys.list | hotkeys.oList | hotkeys.check | hotkeys.quote = true
 * 决策逻辑：根据当前块类型和目标类型决定转换命令
 */
export const transformSubRouter = calibur
    .universe(type({
        hotkeys: {
            list: "boolean",
            oList: "boolean",
            check: "boolean",
            quote: "boolean"
        },
        selection: {
            isSingle: "boolean",
            isContinuous: "boolean",
            hasListItem: "boolean"
        },
        context: {
            blockType: "'NodeParagraph' | 'NodeList' | 'NodeHeading' | 'other'",
            listSubtype: "'u' | 'o' | 't' | null"
        }
    }))
    // ===== 单选 + 段落场景 =====
    .split(
        type({
            selection: { isSingle: "true" },
            context: { blockType: "'NodeParagraph'" },
            hotkeys: { list: "true", oList: "false", check: "false", quote: "false" }
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_UL
    )
    .split(
        type({
            selection: { isSingle: "true" },
            context: { blockType: "'NodeParagraph'" },
            hotkeys: { list: "false", oList: "true", check: "false", quote: "false" }
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_OL
    )
    .split(
        type({
            selection: { isSingle: "true" },
            context: { blockType: "'NodeParagraph'" },
            hotkeys: { list: "false", oList: "false", check: "true", quote: "false" }
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_TL
    )
    .split(
        type({
            selection: { isSingle: "true" },
            context: { blockType: "'NodeParagraph'" },
            hotkeys: { list: "false", oList: "false", check: "false", quote: "true" }
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_QUOTE
    )
    // ===== 单选 + 无序列表类型转换 =====
    .split(
        type({
            selection: { isSingle: "true" },
            context: { blockType: "'NodeList'", listSubtype: "'u'" },
            hotkeys: { list: "false", oList: "true", check: "false", quote: "false" }
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_OL
    )
    .split(
        type({
            selection: { isSingle: "true" },
            context: { blockType: "'NodeList'", listSubtype: "'u'" },
            hotkeys: { list: "false", oList: "false", check: "true", quote: "false" }
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_TL
    )
    // ===== 单选 + 有序列表类型转换 =====
    .split(
        type({
            selection: { isSingle: "true" },
            context: { blockType: "'NodeList'", listSubtype: "'o'" },
            hotkeys: { list: "true", oList: "false", check: "false", quote: "false" }
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_UL
    )
    .split(
        type({
            selection: { isSingle: "true" },
            context: { blockType: "'NodeList'", listSubtype: "'o'" },
            hotkeys: { list: "false", oList: "false", check: "true", quote: "false" }
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_TL
    )
    // ===== 单选 + 任务列表类型转换 =====
    .split(
        type({
            selection: { isSingle: "true" },
            context: { blockType: "'NodeList'", listSubtype: "'t'" },
            hotkeys: { list: "true", oList: "false", check: "false", quote: "false" }
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_UL
    )
    .split(
        type({
            selection: { isSingle: "true" },
            context: { blockType: "'NodeList'", listSubtype: "'t'" },
            hotkeys: { list: "false", oList: "true", check: "false", quote: "false" }
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_OL
    )
    // ===== 单选 + 标题 + 引用 =====
    .split(
        type({
            selection: { isSingle: "true" },
            context: { blockType: "'NodeHeading'" },
            hotkeys: { list: "false", oList: "false", check: "false", quote: "true" }
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_QUOTE
    )
    // ===== 多选场景 =====
    // 多选 + 不连续 -> IGNORE
    .split(
        type({ selection: { isSingle: "false", isContinuous: "false" } }),
        () => LIST_COMMANDS.IGNORE
    )
    // 多选 + 连续 + 包含列表项 -> IGNORE
    .split(
        type({ selection: { isSingle: "false", isContinuous: "true", hasListItem: "true" } }),
        () => LIST_COMMANDS.IGNORE
    )
    // 多选 + 连续 + 无列表项
    .split(
        type({
            selection: { isSingle: "false", isContinuous: "true", hasListItem: "false" },
            hotkeys: { list: "true", oList: "false", check: "false", quote: "false" }
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_UL
    )
    .split(
        type({
            selection: { isSingle: "false", isContinuous: "true", hasListItem: "false" },
            hotkeys: { list: "false", oList: "true", check: "false", quote: "false" }
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_OL
    )
    .split(
        type({
            selection: { isSingle: "false", isContinuous: "true", hasListItem: "false" },
            hotkeys: { list: "false", oList: "false", check: "true", quote: "false" }
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_TL
    )
    .split(
        type({
            selection: { isSingle: "false", isContinuous: "true", hasListItem: "false" },
            hotkeys: { list: "false", oList: "false", check: "false", quote: "true" }
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_QUOTE
    )
    .remain(() => LIST_COMMANDS.IGNORE)
    .build();
