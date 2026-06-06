import { fixTable } from "../util/table/fix";
import { editorContext } from "./types";

/**
 * 表格修复中间件
 *
 * 意图：将表格相关的键盘事件委托给fixTable处理，
 *       fixTable内部通过中间件链匹配并处理各种表格快捷键
 * 调用时机：keydown主中间件链中，光标位于表格内时
 *
 * @param ctx 编辑器上下文
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const fixTableMiddleware = (
    ctx: editorContext
) => {
    const { protyle, event, range, controller } = ctx;
    // fixTable返回true表示事件已被表格修复处理，需阻止默认行为并终止后续中间件
    if (fixTable(protyle, event, range)) {
        event.preventDefault();
        controller.abort("表格修复");
    }
};