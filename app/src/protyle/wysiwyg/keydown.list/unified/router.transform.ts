/**
 * 列表转换子路由器
 *
 * 本文件实现了列表类型转换的子路由器
 * 从主路由器文件拆分出来以满足行数限制
 *
 * @see docs/ttt/键盘事件处理重构-列表归并设计.md
 */

import { calibur } from "calibur-router";
import { type } from "arktype";
import { LIST_COMMANDS } from "../commands";

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
