/**
 * 统一列表路由器单元测试
 *
 * 使用 mock 状态验证路由决策逻辑
 * @see app/src/protyle/wysiwyg/keydown.list/unified/router.ts
 */

import {describe, expect, expectTypeOf, test} from "vitest";
import {
    listMasterRouter,
    checkToggleSubRouter,
    outdentSubRouter,
    indentSubRouter,
    transformSubRouter
} from "../../src/protyle/wysiwyg/keydown.list/unified/router";
import { LIST_COMMANDS } from "../../src/protyle/wysiwyg/keydown.list/commands";
import type { UnifiedListState } from "../../src/protyle/wysiwyg/keydown.list/types";

// ============================================================================
// Mock 状态工厂函数
// ============================================================================

/**
 * 创建 Mock 统一列表状态
 *
 * 用途：生成测试用的完整状态对象
 * 使用场景：在各个测试用例中创建特定状态
 *
 * @param overrides - 覆盖默认值的部分状态
 * @returns 完整的 UnifiedListState 对象
 */
function createMockUnifiedState(
    overrides: Partial<{
        hotkeys: Partial<UnifiedListState["hotkeys"]>;
        selection: Partial<UnifiedListState["selection"]>;
        context: Partial<UnifiedListState["context"]>;
    }> = {}
): UnifiedListState {
    return {
        hotkeys: {
            checkToggle: false,
            outdent: false,
            indent: false,
            list: false,
            oList: false,
            check: false,
            quote: false,
            ...overrides.hotkeys
        },
        selection: {
            hasMultiple: false,
            isContinuous: true,
            firstInList: false,
            hasListItem: false,
            isSingle: true,
            ...overrides.selection
        },
        context: {
            inListItem: false,
            inCodeBlock: false,
            hasTaskItem: false,
            taskStatus: null,
            nextTaskStatus: null,
            hasPreviousSibling: true,
            blockType: "NodeParagraph",
            listSubtype: null,
            ...overrides.context
        }
    };
}

describe("router backend contract", () => {
    test("all list routers use the Zod formal state backend", () => {
        expect(listMasterRouter.__状态空间后端__.name).toBe("zod");
        expect(checkToggleSubRouter.__状态空间后端__.name).toBe("zod");
        expect(outdentSubRouter.__状态空间后端__.name).toBe("zod");
        expect(indentSubRouter.__状态空间后端__.name).toBe("zod");
        expect(transformSubRouter.__状态空间后端__.name).toBe("zod");
    });

    test("the master router accepts exactly the collected unified state", () => {
        expectTypeOf(listMasterRouter).parameter(0).toEqualTypeOf<UnifiedListState>();
    });
});

// ============================================================================
// 主路由器测试
// ============================================================================

describe("listMasterRouter - 主路由器", () => {
    describe("快速路径测试", () => {
        test("所有快捷键为 false 时返回 IGNORE", () => {
            const state = createMockUnifiedState();
            const result = listMasterRouter(state);
            expect(result).toBe(LIST_COMMANDS.IGNORE);
        });
    });

    describe("路由分发测试", () => {
        test("checkToggle 快捷键触发时委托给 checkToggleSubRouter", () => {
            const state = createMockUnifiedState({
                hotkeys: { checkToggle: true },
                context: { hasTaskItem: true }
            });
            const result = listMasterRouter(state);
            expect(result).toBe(LIST_COMMANDS.CHECK_TOGGLE);
        });

        test("outdent 快捷键触发时委托给 outdentSubRouter", () => {
            const state = createMockUnifiedState({
                hotkeys: { outdent: true },
                context: { inListItem: true }
            });
            const result = listMasterRouter(state);
            expect(result).toBe(LIST_COMMANDS.OUTDENT);
        });

        test("indent 快捷键触发时委托给 indentSubRouter", () => {
            const state = createMockUnifiedState({
                hotkeys: { indent: true },
                context: { inListItem: true }
            });
            const result = listMasterRouter(state);
            expect(result).toBe(LIST_COMMANDS.INDENT);
        });

        test("list 快捷键触发时委托给 transformSubRouter", () => {
            const state = createMockUnifiedState({
                hotkeys: { list: true },
                context: { blockType: "NodeParagraph" }
            });
            const result = listMasterRouter(state);
            expect(result).toBe(LIST_COMMANDS.TRANSFORM_TO_UL);
        });
    });
});

// ============================================================================
// checkToggleSubRouter 测试
// ============================================================================

describe("checkToggleSubRouter - 任务列表切换子路由器", () => {
    test("在任务列表项中按 Ctrl/Cmd+Enter → CHECK_TOGGLE", () => {
        const result = checkToggleSubRouter({
            context: { hasTaskItem: true }
        });
        expect(result).toBe(LIST_COMMANDS.CHECK_TOGGLE);
    });

    test("不在任务列表项中 → IGNORE", () => {
        const result = checkToggleSubRouter({
            context: { hasTaskItem: false }
        });
        expect(result).toBe(LIST_COMMANDS.IGNORE);
    });
});

// ============================================================================
// outdentSubRouter 测试
// ============================================================================

describe("outdentSubRouter - 列表缩出子路由器", () => {
    describe("多选场景", () => {
        test("多选 + 不连续 → IGNORE", () => {
            const result = outdentSubRouter({
                selection: {
                    hasMultiple: true,
                    isContinuous: false,
                    firstInList: true
                },
                context: {
                    inListItem: true,
                    inCodeBlock: false
                }
            });
            expect(result).toBe(LIST_COMMANDS.IGNORE);
        });

        test("多选 + 连续 + 第一个不在列表 → IGNORE", () => {
            const result = outdentSubRouter({
                selection: {
                    hasMultiple: true,
                    isContinuous: true,
                    firstInList: false
                },
                context: {
                    inListItem: true,
                    inCodeBlock: false
                }
            });
            expect(result).toBe(LIST_COMMANDS.IGNORE);
        });

        test("多选 + 连续 + 第一个在列表 → OUTDENT", () => {
            const result = outdentSubRouter({
                selection: {
                    hasMultiple: true,
                    isContinuous: true,
                    firstInList: true
                },
                context: {
                    inListItem: true,
                    inCodeBlock: false
                }
            });
            expect(result).toBe(LIST_COMMANDS.OUTDENT);
        });
    });

    describe("单选场景", () => {
        test("单选 + 在代码块中 → IGNORE", () => {
            const result = outdentSubRouter({
                selection: {
                    hasMultiple: false,
                    isContinuous: true,
                    firstInList: false
                },
                context: {
                    inListItem: true,
                    inCodeBlock: true
                }
            });
            expect(result).toBe(LIST_COMMANDS.IGNORE);
        });

        test("单选 + 不在列表项中 → IGNORE", () => {
            const result = outdentSubRouter({
                selection: {
                    hasMultiple: false,
                    isContinuous: true,
                    firstInList: false
                },
                context: {
                    inListItem: false,
                    inCodeBlock: false
                }
            });
            expect(result).toBe(LIST_COMMANDS.IGNORE);
        });

        test("单选 + 在列表项中 → OUTDENT", () => {
            const result = outdentSubRouter({
                selection: {
                    hasMultiple: false,
                    isContinuous: true,
                    firstInList: false
                },
                context: {
                    inListItem: true,
                    inCodeBlock: false
                }
            });
            expect(result).toBe(LIST_COMMANDS.OUTDENT);
        });
    });
});

// ============================================================================
// indentSubRouter 测试
// ============================================================================

describe("indentSubRouter - 列表缩进子路由器", () => {
    describe("多选场景", () => {
        test("多选 + 不连续 → IGNORE", () => {
            const result = indentSubRouter({
                selection: {
                    hasMultiple: true,
                    isContinuous: false,
                    firstInList: true
                },
                context: {
                    inListItem: true,
                    inCodeBlock: false
                }
            });
            expect(result).toBe(LIST_COMMANDS.IGNORE);
        });

        test("多选 + 连续 + 第一个不在列表 → IGNORE", () => {
            const result = indentSubRouter({
                selection: {
                    hasMultiple: true,
                    isContinuous: true,
                    firstInList: false
                },
                context: {
                    inListItem: true,
                    inCodeBlock: false
                }
            });
            expect(result).toBe(LIST_COMMANDS.IGNORE);
        });

        test("多选 + 连续 + 第一个在列表 → INDENT", () => {
            const result = indentSubRouter({
                selection: {
                    hasMultiple: true,
                    isContinuous: true,
                    firstInList: true
                },
                context: {
                    inListItem: true,
                    inCodeBlock: false
                }
            });
            expect(result).toBe(LIST_COMMANDS.INDENT);
        });
    });

    describe("单选场景", () => {
        test("单选 + 在代码块中 → IGNORE", () => {
            const result = indentSubRouter({
                selection: {
                    hasMultiple: false,
                    isContinuous: true,
                    firstInList: false
                },
                context: {
                    inListItem: true,
                    inCodeBlock: true
                }
            });
            expect(result).toBe(LIST_COMMANDS.IGNORE);
        });

        test("单选 + 不在列表项中 → IGNORE", () => {
            const result = indentSubRouter({
                selection: {
                    hasMultiple: false,
                    isContinuous: true,
                    firstInList: false
                },
                context: {
                    inListItem: false,
                    inCodeBlock: false
                }
            });
            expect(result).toBe(LIST_COMMANDS.IGNORE);
        });

        test("单选 + 在列表项中 → INDENT", () => {
            const result = indentSubRouter({
                selection: {
                    hasMultiple: false,
                    isContinuous: true,
                    firstInList: false
                },
                context: {
                    inListItem: true,
                    inCodeBlock: false
                }
            });
            expect(result).toBe(LIST_COMMANDS.INDENT);
        });
    });
});

// ============================================================================
// transformSubRouter 测试
// ============================================================================

describe("transformSubRouter - 列表转换子路由器", () => {
    describe("段落转换场景", () => {
        test("段落 + 无序列表键 → TRANSFORM_TO_UL", () => {
            const result = transformSubRouter({
                hotkeys: { list: true, oList: false, check: false, quote: false },
                selection: { isSingle: true, isContinuous: true, hasListItem: false },
                context: { blockType: "NodeParagraph", listSubtype: null }
            });
            expect(result).toBe(LIST_COMMANDS.TRANSFORM_TO_UL);
        });

        test("段落 + 有序列表键 → TRANSFORM_TO_OL", () => {
            const result = transformSubRouter({
                hotkeys: { list: false, oList: true, check: false, quote: false },
                selection: { isSingle: true, isContinuous: true, hasListItem: false },
                context: { blockType: "NodeParagraph", listSubtype: null }
            });
            expect(result).toBe(LIST_COMMANDS.TRANSFORM_TO_OL);
        });

        test("段落 + 任务列表键 → TRANSFORM_TO_TL", () => {
            const result = transformSubRouter({
                hotkeys: { list: false, oList: false, check: true, quote: false },
                selection: { isSingle: true, isContinuous: true, hasListItem: false },
                context: { blockType: "NodeParagraph", listSubtype: null }
            });
            expect(result).toBe(LIST_COMMANDS.TRANSFORM_TO_TL);
        });

        test("段落 + 引用键 → TRANSFORM_TO_QUOTE", () => {
            const result = transformSubRouter({
                hotkeys: { list: false, oList: false, check: false, quote: true },
                selection: { isSingle: true, isContinuous: true, hasListItem: false },
                context: { blockType: "NodeParagraph", listSubtype: null }
            });
            expect(result).toBe(LIST_COMMANDS.TRANSFORM_TO_QUOTE);
        });
    });

    describe("列表类型互转场景", () => {
        test("无序列表 + 有序列表键 → TRANSFORM_TO_OL", () => {
            const result = transformSubRouter({
                hotkeys: { list: false, oList: true, check: false, quote: false },
                selection: { isSingle: true, isContinuous: true, hasListItem: false },
                context: { blockType: "NodeList", listSubtype: "u" }
            });
            expect(result).toBe(LIST_COMMANDS.TRANSFORM_TO_OL);
        });

        test("无序列表 + 任务列表键 → TRANSFORM_TO_TL", () => {
            const result = transformSubRouter({
                hotkeys: { list: false, oList: false, check: true, quote: false },
                selection: { isSingle: true, isContinuous: true, hasListItem: false },
                context: { blockType: "NodeList", listSubtype: "u" }
            });
            expect(result).toBe(LIST_COMMANDS.TRANSFORM_TO_TL);
        });

        test("有序列表 + 无序列表键 → TRANSFORM_TO_UL", () => {
            const result = transformSubRouter({
                hotkeys: { list: true, oList: false, check: false, quote: false },
                selection: { isSingle: true, isContinuous: true, hasListItem: false },
                context: { blockType: "NodeList", listSubtype: "o" }
            });
            expect(result).toBe(LIST_COMMANDS.TRANSFORM_TO_UL);
        });

        test("有序列表 + 任务列表键 → TRANSFORM_TO_TL", () => {
            const result = transformSubRouter({
                hotkeys: { list: false, oList: false, check: true, quote: false },
                selection: { isSingle: true, isContinuous: true, hasListItem: false },
                context: { blockType: "NodeList", listSubtype: "o" }
            });
            expect(result).toBe(LIST_COMMANDS.TRANSFORM_TO_TL);
        });

        test("任务列表 + 无序列表键 → TRANSFORM_TO_UL", () => {
            const result = transformSubRouter({
                hotkeys: { list: true, oList: false, check: false, quote: false },
                selection: { isSingle: true, isContinuous: true, hasListItem: false },
                context: { blockType: "NodeList", listSubtype: "t" }
            });
            expect(result).toBe(LIST_COMMANDS.TRANSFORM_TO_UL);
        });

        test("任务列表 + 有序列表键 → TRANSFORM_TO_OL", () => {
            const result = transformSubRouter({
                hotkeys: { list: false, oList: true, check: false, quote: false },
                selection: { isSingle: true, isContinuous: true, hasListItem: false },
                context: { blockType: "NodeList", listSubtype: "t" }
            });
            expect(result).toBe(LIST_COMMANDS.TRANSFORM_TO_OL);
        });
    });

    describe("标题转换场景", () => {
        test("标题 + 引用键 → TRANSFORM_TO_QUOTE", () => {
            const result = transformSubRouter({
                hotkeys: { list: false, oList: false, check: false, quote: true },
                selection: { isSingle: true, isContinuous: true, hasListItem: false },
                context: { blockType: "NodeHeading", listSubtype: null }
            });
            expect(result).toBe(LIST_COMMANDS.TRANSFORM_TO_QUOTE);
        });

        test("标题 + 列表键 → IGNORE (不支持的转换)", () => {
            const result = transformSubRouter({
                hotkeys: { list: true, oList: false, check: false, quote: false },
                selection: { isSingle: true, isContinuous: true, hasListItem: false },
                context: { blockType: "NodeHeading", listSubtype: null }
            });
            expect(result).toBe(LIST_COMMANDS.IGNORE);
        });
    });

    describe("多选场景", () => {
        test("多选 + 不连续 → IGNORE", () => {
            const result = transformSubRouter({
                hotkeys: { list: true, oList: false, check: false, quote: false },
                selection: { isSingle: false, isContinuous: false, hasListItem: false },
                context: { blockType: "NodeParagraph", listSubtype: null }
            });
            expect(result).toBe(LIST_COMMANDS.IGNORE);
        });

        test("多选 + 包含列表项 → IGNORE", () => {
            const result = transformSubRouter({
                hotkeys: { list: true, oList: false, check: false, quote: false },
                selection: { isSingle: false, isContinuous: true, hasListItem: true },
                context: { blockType: "NodeParagraph", listSubtype: null }
            });
            expect(result).toBe(LIST_COMMANDS.IGNORE);
        });

        test("多选 + 连续 + 无列表项 + 无序列表键 → TRANSFORM_TO_UL", () => {
            const result = transformSubRouter({
                hotkeys: { list: true, oList: false, check: false, quote: false },
                selection: { isSingle: false, isContinuous: true, hasListItem: false },
                context: { blockType: "NodeParagraph", listSubtype: null }
            });
            expect(result).toBe(LIST_COMMANDS.TRANSFORM_TO_UL);
        });

        test("多选 + 连续 + 无列表项 + 有序列表键 → TRANSFORM_TO_OL", () => {
            const result = transformSubRouter({
                hotkeys: { list: false, oList: true, check: false, quote: false },
                selection: { isSingle: false, isContinuous: true, hasListItem: false },
                context: { blockType: "NodeParagraph", listSubtype: null }
            });
            expect(result).toBe(LIST_COMMANDS.TRANSFORM_TO_OL);
        });

        test("多选 + 连续 + 无列表项 + 任务列表键 → TRANSFORM_TO_TL", () => {
            const result = transformSubRouter({
                hotkeys: { list: false, oList: false, check: true, quote: false },
                selection: { isSingle: false, isContinuous: true, hasListItem: false },
                context: { blockType: "NodeParagraph", listSubtype: null }
            });
            expect(result).toBe(LIST_COMMANDS.TRANSFORM_TO_TL);
        });

        test("多选 + 连续 + 无列表项 + 引用键 → TRANSFORM_TO_QUOTE", () => {
            const result = transformSubRouter({
                hotkeys: { list: false, oList: false, check: false, quote: true },
                selection: { isSingle: false, isContinuous: true, hasListItem: false },
                context: { blockType: "NodeParagraph", listSubtype: null }
            });
            expect(result).toBe(LIST_COMMANDS.TRANSFORM_TO_QUOTE);
        });
    });

    describe("边界情况", () => {
        test("未按任何转换键 → IGNORE", () => {
            const result = transformSubRouter({
                hotkeys: { list: false, oList: false, check: false, quote: false },
                selection: { isSingle: true, isContinuous: true, hasListItem: false },
                context: { blockType: "NodeParagraph", listSubtype: null }
            });
            expect(result).toBe(LIST_COMMANDS.IGNORE);
        });

        test("other 块类型 → IGNORE", () => {
            const result = transformSubRouter({
                hotkeys: { list: true, oList: false, check: false, quote: false },
                selection: { isSingle: true, isContinuous: true, hasListItem: false },
                context: { blockType: "other", listSubtype: null }
            });
            expect(result).toBe(LIST_COMMANDS.IGNORE);
        });
    });
});
