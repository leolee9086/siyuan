/**
 * Files 组件的事件处理器模块
 * 作为入口点，重新导出所有拆分的子模块
 * @module eventHandlers
 */

// 导出类型
export type {FilesDomain, FilesEventContext} from "./eventHandlers.types";

// 导出 closeElement 事件处理
export { setupCloseElementClickHandler } from "./eventHandlers.closeElement";

// 导出 actions 事件处理
export {
    setupCollapseClickHandler,
    setupActionsClickHandler
} from "./eventHandlers.actions";

// 导出 element mousedown 事件处理
export { setupElementMousedownHandler } from "./eventHandlers.element.mousedown";

// 导出 element click 事件处理
export { setupElementClickHandler } from "./eventHandlers.element.click";

// 导入所有 setup 函数用于 initAllEventHandlers
import { setupCloseElementClickHandler } from "./eventHandlers.closeElement";
import { setupCollapseClickHandler, setupActionsClickHandler } from "./eventHandlers.actions";
import { setupElementMousedownHandler } from "./eventHandlers.element.mousedown";
import { setupElementClickHandler } from "./eventHandlers.element.click";
import type { FilesEventContext } from "./eventHandlers.types";
import type { AppFacade } from "../../../app/AppFacade.types";

/**
 * 初始化所有事件监听器
 * @同步豁免: UI构建
 * @param ctx - 事件上下文，包含 files 实例和 app 实例
 */
export function initAllEventHandlers(ctx: FilesEventContext<AppFacade>): void {
    const { files, app } = ctx;
    setupCloseElementClickHandler(files, app);
    setupCollapseClickHandler(files);
    setupActionsClickHandler(files);
    setupElementMousedownHandler(files, app);
    setupElementClickHandler(ctx);
}
