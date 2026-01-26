/**
 * listRouter Transform 路由器
 *
 * 本文件包含列表转换操作的路由决策逻辑
 * 由于 transform 路由较为复杂，单独拆分为独立模块
 */

import { calibur } from "calibur-router";
import { type } from "arktype";
import { LIST_COMMANDS } from "./commands";
import { TransformStateSchema } from "./types";

/**
 * Phase 4: 列表转换路由器
 * @AIDONE 已检查路由规则，逻辑合理且完整
 * 用途：根据列表转换状态决定执行的命令
 * 使用场景：在 listTransformMiddleware 中调用
 *
 * 路由决策树：
 * ```
 * 状态输入
 *     │
 *     ├─ 未按任何转换快捷键 ──> IGNORE
 *     │
 *     ├─ 按了转换快捷键
 *     │   │
 *     │   ├─ 单选场景 (selectCount <= 1)
 *     │   │   │
 *     │   │   ├─ 当前是段落 (NodeParagraph)
 *     │   │   │   ├─ isListKey ──> TRANSFORM_TO_UL
 *     │   │   │   ├─ isOListKey ──> TRANSFORM_TO_OL
 *     │   │   │   ├─ isCheckKey ──> TRANSFORM_TO_TL
 *     │   │   │   └─ isQuoteKey ──> TRANSFORM_TO_QUOTE
 *     │   │   │
 *     │   │   ├─ 当前是列表 (NodeList)
 *     │   │   │   ├─ 无序列表 (u) + (isOListKey | isCheckKey) ──> TRANSFORM_TO_OL/TL
 *     │   │   │   ├─ 有序列表 (o) + (isListKey | isCheckKey) ──> TRANSFORM_TO_UL/TL
 *     │   │   │   └─ 任务列表 (t) + (isListKey | isOListKey) ──> TRANSFORM_TO_UL/OL
 *     │   │   │
 *     │   │   ├─ 当前是标题 (NodeHeading) + isQuoteKey ──> TRANSFORM_TO_QUOTE
 *     │   │   │
 *     │   │   └─ 其他情况 ──> IGNORE
 *     │   │
 *     │   └─ 多选场景 (selectCount > 1)
 *     │       │
 *     │       ├─ 选中不连续 ──> IGNORE
 *     │       │
 *     │       ├─ 选中连续但包含列表项 ──> IGNORE
 *     │       │
 *     │       └─ 选中连续且不包含列表项
 *     │           ├─ isListKey ──> TRANSFORM_TO_UL
 *     │           ├─ isOListKey ──> TRANSFORM_TO_OL
 *     │           ├─ isCheckKey ──> TRANSFORM_TO_TL
 *     │           └─ isQuoteKey ──> TRANSFORM_TO_QUOTE
 * ```
 *
 * 路由规则说明：
 * 1. 未按任何转换快捷键 -> IGNORE（快速路径）
 * 2-5. 单选 + 段落 -> 根据快捷键转换为对应类型
 * 6-11. 单选 + 列表 -> 根据当前子类型和快捷键决定转换
 * 12. 单选 + 标题 + 引用键 -> 转换为引用
 * 13. 多选 + 不连续 -> IGNORE
 * 14. 多选 + 包含列表项 -> IGNORE
 * 15-18. 多选 + 连续 + 无列表项 -> 根据快捷键转换
 */
export const transformRouter = calibur
    .universe(TransformStateSchema)
    // 规则 1: 未按任何转换快捷键，忽略
    .split(
        type({
            isListKey: "false",
            isOListKey: "false",
            isCheckKey: "false",
            isQuoteKey: "false"
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // ===== 单选场景 (isSingleSelect = true) =====
    // 规则 2: 单选 + 段落 + 无序列表键
    .split(
        type({
            isSingleSelect: "true",
            currentType: "'NodeParagraph'",
            isListKey: "true",
            isOListKey: "false",
            isCheckKey: "false",
            isQuoteKey: "false"
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_UL
    )
    // 规则 3: 单选 + 段落 + 有序列表键
    .split(
        type({
            isSingleSelect: "true",
            currentType: "'NodeParagraph'",
            isListKey: "false",
            isOListKey: "true",
            isCheckKey: "false",
            isQuoteKey: "false"
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_OL
    )
    // 规则 4: 单选 + 段落 + 任务列表键
    .split(
        type({
            isSingleSelect: "true",
            currentType: "'NodeParagraph'",
            isListKey: "false",
            isOListKey: "false",
            isCheckKey: "true",
            isQuoteKey: "false"
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_TL
    )
    // 规则 5: 单选 + 段落 + 引用键
    .split(
        type({
            isSingleSelect: "true",
            currentType: "'NodeParagraph'",
            isListKey: "false",
            isOListKey: "false",
            isCheckKey: "false",
            isQuoteKey: "true"
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_QUOTE
    )
    // 规则 6: 单选 + 无序列表 + 有序列表键
    .split(
        type({
            isSingleSelect: "true",
            currentType: "'NodeList'",
            currentSubtype: "'u'",
            isListKey: "false",
            isOListKey: "true",
            isCheckKey: "false",
            isQuoteKey: "false"
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_OL
    )
    // 规则 7: 单选 + 无序列表 + 任务列表键
    .split(
        type({
            isSingleSelect: "true",
            currentType: "'NodeList'",
            currentSubtype: "'u'",
            isListKey: "false",
            isOListKey: "false",
            isCheckKey: "true",
            isQuoteKey: "false"
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_TL
    )
    // 规则 8: 单选 + 有序列表 + 无序列表键
    .split(
        type({
            isSingleSelect: "true",
            currentType: "'NodeList'",
            currentSubtype: "'o'",
            isListKey: "true",
            isOListKey: "false",
            isCheckKey: "false",
            isQuoteKey: "false"
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_UL
    )
    // 规则 9: 单选 + 有序列表 + 任务列表键
    .split(
        type({
            isSingleSelect: "true",
            currentType: "'NodeList'",
            currentSubtype: "'o'",
            isListKey: "false",
            isOListKey: "false",
            isCheckKey: "true",
            isQuoteKey: "false"
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_TL
    )
    // 规则 10: 单选 + 任务列表 + 无序列表键
    .split(
        type({
            isSingleSelect: "true",
            currentType: "'NodeList'",
            currentSubtype: "'t'",
            isListKey: "true",
            isOListKey: "false",
            isCheckKey: "false",
            isQuoteKey: "false"
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_UL
    )
    // 规则 11: 单选 + 任务列表 + 有序列表键
    .split(
        type({
            isSingleSelect: "true",
            currentType: "'NodeList'",
            currentSubtype: "'t'",
            isListKey: "false",
            isOListKey: "true",
            isCheckKey: "false",
            isQuoteKey: "false"
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_OL
    )
    // 规则 12: 单选 + 标题 + 引用键
    .split(
        type({
            isSingleSelect: "true",
            currentType: "'NodeHeading'",
            isListKey: "false",
            isOListKey: "false",
            isCheckKey: "false",
            isQuoteKey: "true"
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_QUOTE
    )
    // ===== 多选场景 (isSingleSelect = false) =====
    // 注：规则 13-14（多选 + 不连续 | 包含列表项）由 remain() 处理，返回 IGNORE
    // 规则 15: 多选 + 连续 + 无列表项 + 无序列表键
    .split(
        type({
            isSingleSelect: "false",
            isContinuousSelection: "true",
            hasListItem: "false",
            isListKey: "true",
            isOListKey: "false",
            isCheckKey: "false",
            isQuoteKey: "false"
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_UL
    )
    // 规则 16: 多选 + 连续 + 无列表项 + 有序列表键
    .split(
        type({
            isSingleSelect: "false",
            isContinuousSelection: "true",
            hasListItem: "false",
            isListKey: "false",
            isOListKey: "true",
            isCheckKey: "false",
            isQuoteKey: "false"
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_OL
    )
    // 规则 17: 多选 + 连续 + 无列表项 + 任务列表键
    .split(
        type({
            isSingleSelect: "false",
            isContinuousSelection: "true",
            hasListItem: "false",
            isListKey: "false",
            isOListKey: "false",
            isCheckKey: "true",
            isQuoteKey: "false"
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_TL
    )
    // 规则 18: 多选 + 连续 + 无列表项 + 引用键
    .split(
        type({
            isSingleSelect: "false",
            isContinuousSelection: "true",
            hasListItem: "false",
            isListKey: "false",
            isOListKey: "false",
            isCheckKey: "false",
            isQuoteKey: "true"
        }),
        () => LIST_COMMANDS.TRANSFORM_TO_QUOTE
    )
    // 其他情况：忽略
    .remain(() => LIST_COMMANDS.IGNORE)
    .build();
