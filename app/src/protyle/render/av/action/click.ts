/** 用途：反查属性视图根块。使用范围：avClick 入口。解耦评估：根块定位依赖既有 DOM 协议，继续复用共享工具最稳妥。 */
import { hasClosestBlock } from "./imports";
/** 用途：收窄属性视图根块节点类型。使用范围：avClick 入口获取 blockElement 后。解耦评估：DOM 守卫属于基础能力，继续复用共享实现最稳妥。 */
import { isHTMLElement } from "./imports";
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
    if (isOnlyMeta(event)) {
        return false;
    }
    const blockElement = hasClosestBlock(event.target);
    if (!blockElement || !isHTMLElement(blockElement)) {
        return false;
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
