/**
 * 用途：清理 AV 选择态。
 * 使用范围：点击标题时清理选择。
 * 解耦评估：选择清理属共享工具，继续通过网关复用最稳妥。
 */
import {clearSelect} from "./imports";
/**
 * 用途：按类名查找祖先。
 * 使用范围：入口的标题判定。
 * 解耦评估：DOM 查找属共享工具，继续通过网关复用最稳妥。
 */
import {hasClosestByClassName} from "./imports";
/** 用途：反查属性视图根块。使用范围：avClick 入口。解耦评估：根块定位依赖既有 DOM 协议，继续复用共享工具最稳妥。 */
import { hasClosestBlock } from "./imports";
/** 用途：收窄属性视图根块节点类型。使用范围：avClick 入口获取 blockElement 后。解耦评估：DOM 守卫属于基础能力，继续复用共享实现最稳妥。 */
import { isHTMLElement } from "./imports";
/**
 * 用途：识别模板单元格中的可交互元素。
 * 使用范围：点击入口的最高优先级原生交互分支。
 * 解耦评估：模板交互判定依赖模板渲染协议，集中在共享工具中维护更稳妥。
 */
import {getAVTemplateInteractiveElement} from "./imports";
/**
 * 用途：判断是否为模板链接。
 * 使用范围：点击入口中对模板链接的特殊放行。
 * 解耦评估：链接判定与交互元素判定同属模板协议，拆分后更易单独演进。
 */
import {isAVTemplateLink} from "./imports";
/** 用途：识别仅含元键的点击。使用范围：avClick 最前面的快速放行分支。解耦评估：兼容性判断属于共享工具层，当前直接复用即可。 */
import { isOnlyMeta } from "./imports";
/** 用途：把 `data-av-type` 收窄为业务视图类型。使用范围：avClick 入口读取根块类型后。解耦评估：类型收窄应集中在 guards 文件，避免在入口散落断言。 */
import { toAttrViewType } from "./action.guards";
/** 用途：处理普通单元格点击。使用范围：class 分发里的 `.av__cell` 分支。解耦评估：单元格点击已拆成专门模块，入口只保留调度。 */
import { handleCellClick } from "./click/cell";
/** 用途：处理基础 class 分支。使用范围：普通单元格分支未命中后的 class 路由。解耦评估：class 驱动点击已拆到独立模块，入口只负责串联。 */
import { handleBasicClassClick } from "./click/className";
/** 用途：处理 data-type 驱动的按钮点击。使用范围：avClick 主循环中的优先分发。解耦评估：data-type 分发单独拆出后更利于保持行为顺序和代码规模。 */
import { handleTargetDataTypeClick } from "./click/dataType";

/**
 * 作用：分发属性视图内部点击。
 * 意图：在保持 `action.ts.backup.ts` 原始交互语义不变的前提下，让入口只保留最小调度逻辑。
 * 调用时机：AV 点击事件命中属性视图块时调用。
 * 问题/改进：当前仍依赖 DOM 结构和 data-type/class 协议，后续如 AV 完全组件化可进一步迁移到显式事件模型。
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const avClick = (protyle: IProtyle, event: MouseEvent & { target: HTMLElement }) => {
    const templateInteractiveElement = getAVTemplateInteractiveElement(event.target);
    // 模板链接拦截：当点击命中模板内的链接类交互元素时，阻止浏览器默认跳转，后续由 AV 统一处理
    if (templateInteractiveElement && isAVTemplateLink(templateInteractiveElement)) {
        event.preventDefault();
    }
    // 模板交互放行：任何模板可交互元素都应阻止冒泡并直接消费，避免继续走 AV 内部的 data-type/class 分发
    if (templateInteractiveElement) {
        event.stopPropagation();
        return true;
    }
    if (isOnlyMeta(event)) {
        return false;
    }
    const blockElement = hasClosestBlock(event.target);
    if (!blockElement || !isHTMLElement(blockElement)) {
        return false;
    }
    // 标题区域清理：点击 AV 标题时先清理旧的 av 选择态，避免残留选择影响后续单元格操作
    if (hasClosestByClassName(event.target, "av__title")) {
        clearSelect(["av"], blockElement);
    }
    const viewType = toAttrViewType(blockElement.getAttribute("data-av-type"));
    let target: HTMLElement | null = event.target;
    while (target && !target.isEqualNode(blockElement)) {
        if (handleTargetDataTypeClick(protyle, target, blockElement, viewType, event)) {
            return true;
        }
        if (handleCellClick(protyle, target, viewType, event)) {
            return true;
        }
        if (handleBasicClassClick(protyle, target, blockElement, event)) {
            return true;
        }
        target = target.parentElement;
    }
    return false;
};
