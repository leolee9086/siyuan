/**
 * 链接菜单模块
 *
 * 显示针对链接元素的上下文菜单，提供链接编辑、复制、剪切、
 * 删除、重命名、转换等功能。
 */
/**
 * 用途：生成事务更新时间
 * 使用范围：菜单关闭后有变更时更新 node 的 updated 字段
 * 解耦评估：通过 imports.ts 转发，业务文件不直接耦合第三方库
 */
import { dayjs } from "./imports";
/**
 * 用途：恢复编辑器选区焦点
 * 使用范围：链接编辑关闭后把焦点恢复到原链接位置
 * 解耦评估：通过 imports.ts 转发，避免业务文件跨层依赖
 */
import { focusByRange } from "./imports";
/**
 * 用途：读取菜单常量标识
 * 使用范围：设置当前菜单 data-name 为内联链接菜单标识
 * 解耦评估：通过 imports.ts 转发，降低对 constants 路径的硬耦合
 */
import { Constants } from "./imports";
/**
 * 用途：判断是否移动端
 * 使用范围：选择链接菜单使用 fullscreen 或 popup 展示
 * 解耦评估：通过 imports.ts 转发，平台判断逻辑可集中替换
 */
import { isMobile } from "./imports";
/**
 * 用途：隐藏 tooltip 浮层
 * 使用范围：打开链接菜单前清理旧提示，避免界面冲突
 * 解耦评估：通过 imports.ts 转发，避免业务层直接依赖 UI 基础模块
 */
import { hideTooltip } from "./imports";
/**
 * 用途：触发插件 open-menu-link 事件
 * 使用范围：链接菜单构建完毕后通知插件追加菜单项
 * 解耦评估：通过 imports.ts 转发，事件总线实现可独立演进
 */
import { emitOpenMenu } from "./imports";
/**
 * 用途：隐藏 util/toolbar/hint 浮层
 * 使用范围：打开链接菜单前清理编辑器上下文 UI
 * 解耦评估：通过 imports.ts 转发，UI 协作逻辑与业务文件解耦
 */
import { hideElements } from "./imports";
/**
 * 用途：定位链接所在的块级节点
 * 使用范围：获取 data-node-id 与旧 HTML 作为事务基线
 * 解耦评估：通过 imports.ts 转发，DOM 工具能力统一收口
 */
import { hasClosestBlock } from "./imports";
/**
 * 用途：识别链接是否处于 popover 环境
 * 使用范围：设置菜单 data-from，区分 app/popover 来源
 * 解耦评估：通过 imports.ts 转发，DOM 查询实现可独立维护
 */
import { hasTopClosestByClassName } from "./imports";
/**
 * 用途：提交事务更新
 * 使用范围：菜单关闭后链接属性有变化时写入事务
 * 解耦评估：通过 imports.ts 转发，事务系统依赖边界更清晰
 */
import { updateTransaction } from "./imports";
/**
 * 用途：获取全局菜单实例
 * 使用范围：菜单构建、弹出、关闭回调设置
 * 解耦评估：通过 imports.ts 转发，菜单实现细节与业务解耦
 */
import { getSiyuanGlobalMenusMenu } from "./imports";
/**
 * 用途：约束链接菜单上下文结构
 * 使用范围：主流程与辅助函数间共享状态传递
 * 解耦评估：通过 imports.ts 转发类型，业务文件不直接上跳父目录
 */
import type { LinkMenuContext } from "./imports";
/**
 * 用途：追加可编辑模式菜单项
 * 使用范围：非只读模式下插入链接/锚文本/标题编辑区域
 * 解耦评估：同目录模块协作，边界清晰且仅暴露必要 API
 */
import { 添加编辑模式菜单项 } from "./protyle.linkMenu.utils";
/**
 * 用途：追加复制当前链接节点菜单项
 * 使用范围：链接菜单的通用复制能力
 * 解耦评估：同目录模块协作，逻辑拆分后可单独维护
 */
import { 添加复制菜单项 } from "./protyle.linkMenu.items";
/**
 * 用途：追加“复制链接地址”菜单项
 * 使用范围：只读模式下提供链接地址复制
 * 解耦评估：同目录模块协作，行为封装在 items 模块内
 */
import { 添加复制链接地址菜单项 } from "./protyle.linkMenu.items";
/**
 * 用途：追加剪切/删除/重命名/转换等编辑菜单项
 * 使用范围：非只读模式下启用编辑动作
 * 解耦评估：同目录模块协作，主流程仅负责编排
 */
import { 添加编辑操作菜单项 } from "./protyle.linkMenu.items";
/**
 * 用途：追加打开/导出/复制资源等链接动作
 * 使用范围：链接地址存在时启用链接操作菜单项
 * 解耦评估：同目录模块协作，链接动作实现与主流程解耦
 */
import { 添加链接操作菜单项 } from "./protyle.linkMenu.items";
import {transaction} from "../../../protyle/wysiwyg/transaction/submit";
import {reportProtyleUserOperationIntent} from "../../../protyle/intent/userOperationIntent";
import {createLinkMenuSavePlan, LINK_MENU_SAVE_COMMANDS, type LinkMenuSaveSnapshot} from "./protyle.linkMenu.savePlan";

// ────────────────────────────────────────────────────────────
// 菜单显示和回调
// ────────────────────────────────────────────────────────────

/** 显示菜单弹窗 */
const 显示菜单弹窗 = (linkElement: HTMLElement, protyle: IProtyle) => {
    // 移动端使用全屏菜单
    if (isMobile) {
        getSiyuanGlobalMenusMenu().fullscreen();
    }
    // 非移动端使用弹出菜单
    if (!isMobile) {
        const rect = linkElement.getBoundingClientRect();
        getSiyuanGlobalMenusMenu().popup({
            x: rect.left,
            y: rect.top + 26,
            h: 26
        });
    }

    const popoverElement = hasTopClosestByClassName(protyle.element, "block__popover", true);
    const fromValue = popoverElement ? popoverElement.dataset.level + "popover" : "app";
    getSiyuanGlobalMenusMenu().element.setAttribute("data-from", fromValue);
};

/** 更新标题属性 */
const 更新标题属性 = (ctx: LinkMenuContext) => {
    if (!ctx.inputElements) {
        return;
    }
    const 标题输入框 = ctx.inputElements[2];
    if (!标题输入框) {
        return;
    }
    // 当标题输入框有值时，设置 data-title 属性；否则移除该属性
    if (标题输入框.value) {
        const title = Lute.EscapeHTMLStr(标题输入框.value.replace(/\n|\r\n|\r|\u2028|\u2029/g, ""));
        ctx.linkElements.forEach((linkElement) => linkElement.setAttribute("data-title", title));
        return;
    }
    ctx.linkElements.forEach((linkElement) => linkElement.removeAttribute("data-title"));
};

/** 更新链接地址 */
const 更新链接地址 = (ctx: LinkMenuContext) => {
    if (!ctx.inputElements) {
        return;
    }
    const 链接地址输入框 = ctx.inputElements[0];
    if (!链接地址输入框) {
        return;
    }
    const href = Lute.EscapeHTMLStr(链接地址输入框.value.replace(/\n|\r\n|\r|\u2028|\u2029/g, ""));
    ctx.linkElements.forEach((linkElement) => {
        if ((linkElement.getAttribute("data-type") ?? "").includes("a")) {
            linkElement.setAttribute("data-href", href);
            return;
        }
        linkElement.removeAttribute("data-href");
    });
};

/** 处理空锚文本 */
const 处理空锚文本 = (ctx: LinkMenuContext) => {
    if (!ctx.inputElements) {
        return;
    }
    const 锚文本输入框 = ctx.inputElements[1];
    const 链接地址输入框 = ctx.inputElements[0];
    const 标题输入框 = ctx.inputElements[2];
    if (!锚文本输入框 || !链接地址输入框 || !标题输入框) {
        return;
    }
    // 当锚文本为空但链接地址或标题有值时，使用 "*" 作为占位符防止链接丢失
    if (!锚文本输入框.value && (链接地址输入框.value || 标题输入框.value)) {
        ctx.linkElement.textContent = "*";
    }
};

/** 恢复焦点 */
const 恢复焦点 = (ctx: LinkMenuContext) => {
    const currentRange = getSelection()?.rangeCount === 0 ? undefined : getSelection()?.getRangeAt(0);
    const toolbarRange = ctx.protyle.toolbar?.range;
    // 当存在选区但选区不在编辑器内且工具栏 range 存在时，将焦点恢复到链接元素
    if (currentRange && !ctx.protyle.element.contains(currentRange.startContainer) && toolbarRange) {
        toolbarRange.selectNodeContents(ctx.linkElement);
        toolbarRange.collapse(false);
        focusByRange(toolbarRange);
    }
};

/** 处理空链接删除 */
const 处理空链接删除 = (ctx: LinkMenuContext) => {
    if (!ctx.inputElements) {
        return false;
    }
    const 锚文本输入框 = ctx.inputElements[1];
    const 链接地址输入框 = ctx.inputElements[0];
    const 标题输入框 = ctx.inputElements[2];
    if (!锚文本输入框 || !链接地址输入框 || !标题输入框) {
        return false;
    }
    // 当锚文本、链接地址、标题都为空时，删除整个链接元素
    if (!锚文本输入框.value && !链接地址输入框.value && !标题输入框.value) {
        ctx.linkElements.forEach((linkElement) => linkElement.remove());
        return true;
    }
    return false;
};

/** 设置菜单关闭时的回调 */
const 设置菜单关闭回调 = (ctx: LinkMenuContext) => {
    if (!ctx.inputElements) {
        return;
    }

    getSiyuanGlobalMenusMenu().removeCB = () => {
        更新标题属性(ctx);
        更新链接地址(ctx);
        处理空锚文本(ctx);
        恢复焦点(ctx);
        处理空链接删除(ctx);

        保存链接菜单修改(ctx);
    };
};

const 获取块ID = (blockElement: HTMLElement) => {
    const id = blockElement.getAttribute("data-node-id");
    if (!id) {
        throw new Error("Link menu cannot persist a block without data-node-id");
    }
    return id;
};

const 创建链接保存快照 = (ctx: LinkMenuContext): {baseline: "current-block" | "captured-blocks"; snapshots: LinkMenuSaveSnapshot[]} => {
    if (!ctx.oldHTMLs) {
        return {
            baseline: "current-block",
            snapshots: [{
                blockId: 获取块ID(ctx.nodeElement),
                previousHTML: ctx.html,
                nextHTML: ctx.nodeElement.outerHTML,
            }],
        };
    }
    return {
        baseline: "captured-blocks",
        snapshots: ctx.linkBlockElements.map((blockElement) => {
            const blockId = 获取块ID(blockElement);
            const previousHTML = ctx.oldHTMLs?.get(blockId);
            if (previousHTML === undefined) {
                throw new Error(`Link menu is missing the captured HTML for block ${blockId}`);
            }
            return {
                blockId,
                previousHTML,
                nextHTML: blockElement.outerHTML,
            };
        }),
    };
};

const 保存链接菜单修改 = (ctx: LinkMenuContext) => {
    const {baseline, snapshots} = 创建链接保存快照(ctx);
    const plan = createLinkMenuSavePlan(baseline, snapshots);
    if (plan.command === LINK_MENU_SAVE_COMMANDS.NO_CHANGE) {
        return;
    }
    reportProtyleUserOperationIntent(ctx.protyle, {
        actor: "user",
        surface: "editor",
        source: "link-menu",
        operation: "update-inline-link",
        trigger: "menu-close",
        blockIds: plan.updates.map((update) => update.blockId),
        linkCount: ctx.linkElements.length,
    });
    if (plan.command === LINK_MENU_SAVE_COMMANDS.UPDATE_CURRENT_BLOCK) {
        const [update] = plan.updates;
        if (!update) {
            throw new Error("Link menu current-block update plan has no changed block");
        }
        ctx.nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
        updateTransaction(ctx.protyle, ctx.nodeElement, update.previousHTML);
        ctx.html = ctx.nodeElement.outerHTML;
        return;
    }
    const blocksByID = new Map(ctx.linkBlockElements.map((blockElement) => [获取块ID(blockElement), blockElement]));
    const operations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    for (const update of plan.updates) {
        const blockElement = blocksByID.get(update.blockId);
        if (!blockElement) {
            throw new Error(`Link menu lost the target block ${update.blockId} before persistence`);
        }
        blockElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
        operations.push({action: "update", id: update.blockId, data: blockElement.outerHTML});
        undoOperations.push({action: "update", id: update.blockId, data: update.previousHTML});
    }
    transaction(ctx.protyle, operations, undoOperations);
    ctx.html = ctx.nodeElement.outerHTML;
};

/** 设置初始焦点 */
const 设置初始焦点 = (ctx: LinkMenuContext, focusText: boolean) => {
    if (!ctx.inputElements) {
        return;
    }

    const 锚文本输入框 = ctx.inputElements[1];
    const 链接地址输入框 = ctx.inputElements[0];
    if (!锚文本输入框 || !链接地址输入框) {
        return;
    }

    const shouldFocusAnchor = focusText ||
        ctx.protyle.lute?.GetLinkDest(ctx.linkAddress ?? "") ||
        ctx.linkAddress?.startsWith("assets/");

    if (shouldFocusAnchor) {
        锚文本输入框.select();
        return;
    }
    链接地址输入框.select();
};

// ────────────────────────────────────────────────────────────
// 主函数
// ────────────────────────────────────────────────────────────

/**
 * 链接右键菜单
 *
 * 显示针对链接元素的上下文菜单，提供以下功能：
 * - 编辑链接地址、锚文本、标题
 * - 复制、剪切、删除链接
 * - 重命名资源文件
 * - 转换为引用或纯文本
 * - 打开链接
 *
 * @param protyle - Protyle 编辑器实例
 * @param linkElement - 链接元素
 * @param focusText - 是否默认聚焦到锚文本输入框
 *
 * @同步豁免: UI构建 - 此函数用于同步构建右键菜单UI，需要在用户右键点击时立即响应并显示菜单。
 * 菜单项的添加、DOM操作和菜单显示必须同步完成以确保用户交互的即时性。
 */
export const linkMenu = (
    protyle: IProtyle,
    linkElement: HTMLElement,
    focusText = false,
    linkElements: readonly HTMLElement[] = [linkElement],
    oldHTMLs?: ReadonlyMap<string, string>,
) => {
    getSiyuanGlobalMenusMenu().remove();
    getSiyuanGlobalMenusMenu().element.setAttribute("data-name", Constants.MENU_INLINE_A);

    const nodeElement = hasClosestBlock(linkElement);
    if (!nodeElement) {
        return;
    }

    hideTooltip();
    hideElements(["util", "toolbar", "hint"], protyle);

    const linkBlockElements = Array.from(new Set(linkElements
        .map((element) => hasClosestBlock(element))
        .filter((element): element is HTMLElement => Boolean(element))));
    if (linkBlockElements.length > 1 && !oldHTMLs) {
        throw new Error("Link menu batch edit requires captured block HTML baselines");
    }

    // 创建上下文对象
    const ctx: LinkMenuContext = {
        protyle,
        linkElement,
        linkElements,
        linkBlockElements,
        nodeElement,
        id: nodeElement.getAttribute("data-node-id") ?? "",
        html: nodeElement.outerHTML,
        linkAddress: linkElement.getAttribute("data-href"),
        ...(oldHTMLs ? {oldHTMLs} : {}),
    };

    // 添加菜单项
    if (!protyle.disabled) {
        添加编辑模式菜单项(ctx);
    }

    添加复制菜单项(linkElement);

    if (protyle.disabled) {
        添加复制链接地址菜单项(ctx.linkAddress);
    }
    if (!protyle.disabled) {
        添加编辑操作菜单项(ctx);
    }

    添加链接操作菜单项(ctx);

    // 触发插件菜单事件
    if (!protyle.disabled && protyle?.app?.plugins) {
        emitOpenMenu({
            plugins: protyle.app.plugins,
            type: "open-menu-link",
            detail: {
                protyle,
                element: linkElement,
            },
            separatorPosition: "top",
        });
    }

    // 显示菜单
    显示菜单弹窗(linkElement, protyle);

    // 只读模式下直接返回
    if (protyle.disabled) {
        return;
    }

    // 设置初始焦点和关闭回调
    设置初始焦点(ctx, focusText);
    设置菜单关闭回调(ctx);
};
