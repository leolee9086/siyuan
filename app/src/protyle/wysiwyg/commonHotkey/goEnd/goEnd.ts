/** 替代关系：本模块承接原 `wysiwyg/commonHotkey.ts` 的文档末尾导航动作。 */
import {fetchPost} from "./imports";
import {getSiyuanConfig} from "./imports";
import {focusBlock} from "./imports";
import {handleGoEndResponse} from "./imports";
import {calibur} from "./imports";
import {type} from "./imports";
import {GoEndCommand} from "./imports";
import type {GoEndState} from "./imports";

// ============================================================================
// 路由器定义
// ============================================================================

/**
 * goEnd 决策路由器
 *
 * 使用显式状态空间进行决策，替代嵌套 if-else。
 *
 * 状态维度：
 * - hasLastElement: 是否存在最后一个元素（前置条件）
 * - needsDynamicLoad: 是否需要动态加载（scrollVisible && !isEOF）
 * - canScroll: 是否可以滚动（hasContentElement）
 *
 * 决策优先级（按互斥模式排列）：
 * 1. !hasLastElement -> IGNORE
 * 2. hasLastElement && needsDynamicLoad -> DYNAMIC_LOAD
 * 3. hasLastElement && !needsDynamicLoad && canScroll -> SCROLL_TO_END
 * 4. hasLastElement && !needsDynamicLoad && !canScroll -> IGNORE
 */
const goEndRouter = calibur
    .universe(type({
        hasLastElement: "boolean",
        needsDynamicLoad: "boolean",
        canScroll: "boolean"
    }))
    // 情况1：无最后一个元素，无法执行任何操作
    .split(
        type({ hasLastElement: "false" }),
        () => GoEndCommand.IGNORE
    )
    // 情况2：需要动态加载（滚动组件可见且未到达末尾）
    .split(
        type({ hasLastElement: "true", needsDynamicLoad: "true" }),
        () => GoEndCommand.DYNAMIC_LOAD
    )
    // 情况3：无需动态加载且可以滚动，直接滚动到末尾
    .split(
        type({ hasLastElement: "true", needsDynamicLoad: "false", canScroll: "true" }),
        () => GoEndCommand.SCROLL_TO_END
    )
    // 情况4：无需动态加载但无法滚动（有最后一个元素但无内容元素）
    .remain(() => GoEndCommand.IGNORE)
    .build();

// ============================================================================
// 状态提取
// ============================================================================

/**
 * 从 protyle 实例提取 goEnd 决策所需的状态
 */
const extractGoEndState = (protyle: IProtyle, lastElement: Element): GoEndState => {
    const scrollVisible = Boolean(
        protyle.scroll && !protyle.scroll.element.classList.contains("fn__none")
    );
    const isEOF = lastElement.getAttribute("data-eof") === "2";

    return {
        hasLastElement: true,
        needsDynamicLoad: scrollVisible && !isEOF,
        canScroll: Boolean(protyle.contentElement)
    };
};

// ============================================================================
// 命令执行器
// ============================================================================

/**
 * 命令执行器映射表
 *
 * 使用对象字面量替代 switch 语句，实现策略模式。
 * 每个命令对应一个执行函数，接收必要的上下文参数。
 */
const commandExecutors: Record<
    GoEndCommand,
    (protyle: IProtyle, lastElement: Element) => void
> = {
    [GoEndCommand.IGNORE]: () => {
        // 无操作
    },

    [GoEndCommand.DYNAMIC_LOAD]: (protyle: IProtyle) => {
        fetchPost("/api/filetree/getDoc", {
            id: protyle.block.rootID,
            mode: 4,
            size: getSiyuanConfig().editor.dynamicLoadBlocks,
        }, getResponse => {
            handleGoEndResponse(protyle, getResponse);
        });
    },

    [GoEndCommand.SCROLL_TO_END]: (protyle: IProtyle, lastElement: Element) => {
        const contentElement = protyle.contentElement;
        if (!contentElement) {
            return;
        }

        // 将视口滚动到文档最底部
        contentElement.scrollTop = contentElement.scrollHeight;

        // 同步滚动组件记录的滚动位置，确保滚动状态一致性
        if (protyle.scroll) {
            protyle.scroll.lastScrollTop = contentElement.scrollTop;
        }

        // 将焦点设置到最后一个块
        focusBlock(lastElement, undefined, false);
    }
};

// ============================================================================
// 主函数
// ============================================================================

/**
 * 跳转到文档末尾。
 *
 * @description
 * - 作用：将编辑器视口滚动到文档末尾，并将光标定位到最后一个块。
 * - 意图：与 `goHome` 配对，提供快速导航到文档尾部的能力。
 * - 调用时机：
 *   - 用户按下 Ctrl+End 快捷键时
 *   - 用户点击滚动条的向下箭头按钮时
 *
 * 实现采用显式状态空间 + 路由决策模式：
 * 1. 提取当前状态
 * 2. 路由器根据状态决定命令
 * 3. 执行器执行对应命令
 *
 * @param protyle - 编辑器实例
 */
export const goEnd = async (protyle: IProtyle): Promise<void> => {
    const lastElement = protyle.wysiwyg?.element?.lastElementChild;

    if (!lastElement) {
        return;
    }

    const state = extractGoEndState(protyle, lastElement);
    const command = goEndRouter(state);

    commandExecutors[command](protyle, lastElement);
};
