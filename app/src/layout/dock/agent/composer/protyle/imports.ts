/** 用途：转发 Protyle Composer 所需的平台、编辑器和网络能力；使用范围：protyle 子领域实现；解耦评估：所有跨目录运行时依赖统一经父级 imports 网关进入。 */
import {
    blockRender,
    Constants,
    escapeHtml,
    fetchPost,
    focusBlock,
    genEmptyElement,
    hintRef,
    matchHotKey,
} from "../../imports";
/** 用途：转发完整应用宿主类型；使用范围：Protyle 实例化与运行时状态。 */
import type {AppFacade} from "../../imports";
/** 用途：转发上游技能 Hint 的请求有效性与让位判断；使用范围：Protyle 技能菜单竞态防护。 */
import {isSkillHintRequestActive, shouldYieldSkillHint} from "../../agentHintState";
/** 用途：转发 Composer 历史纯状态转换；使用范围：Protyle 键盘分派和公共句柄；解耦评估：函数只接收公开状态，不引入模块级可变对象。 */
import {
    beginComposerHistoryBrowsing,
    clearComposerHistory,
    hasComposerHistory,
    isBrowsingComposerHistory,
    navigateComposerHistoryDown,
    navigateComposerHistoryUp,
    pushComposerHistory,
    resetComposerHistoryCursor,
    restoreComposerHistory,
} from "../AgentComposer.history";
/** 用途：转发 Composer 历史状态类型；使用范围：Protyle 运行时和键盘分派。 */
import type {ComposerHistoryState} from "../AgentComposer.history.types";
/** 用途：转发 Composer 公共协议；使用范围：Protyle 句柄和变化通知。 */
import type {AgentComposerOptions, ComposerChangeCallback, ComposerHandle, ComposerSendData} from "../AgentComposer.types";

/** 导出块渲染能力。 */
export {blockRender};
/** 导出平台常量。 */
export {Constants};
/** 导出 HTML 转义能力。 */
export {escapeHtml};
/** 导出统一网络请求入口。 */
export {fetchPost};
/** 导出块聚焦工具。 */
export {focusBlock};
/** 导出空块元素工厂。 */
export {genEmptyElement};
/** 导出 Protyle 块引用 Hint。 */
export {hintRef};
/** 导出快捷键匹配工具。 */
export {matchHotKey};
/** 导出技能 Hint 请求有效性判断。 */
export {isSkillHintRequestActive};
/** 导出技能 Hint 让位判断。 */
export {shouldYieldSkillHint};
/** 导出完整应用宿主类型。 */
export type {AppFacade};
/** 导出进入历史浏览转换。 */
export {beginComposerHistoryBrowsing};
/** 导出清空历史转换。 */
export {clearComposerHistory};
/** 导出历史存在性判断。 */
export {hasComposerHistory};
/** 导出历史浏览状态判断。 */
export {isBrowsingComposerHistory};
/** 导出历史向下导航转换。 */
export {navigateComposerHistoryDown};
/** 导出历史向上导航转换。 */
export {navigateComposerHistoryUp};
/** 导出历史追加转换。 */
export {pushComposerHistory};
/** 导出历史游标重置转换。 */
export {resetComposerHistoryCursor};
/** 导出历史恢复转换。 */
export {restoreComposerHistory};
/** 导出 Composer 历史状态类型。 */
export type {ComposerHistoryState};
/** 导出内容变化回调类型。 */
export type {ComposerChangeCallback};
/** 导出公共 Composer 句柄类型。 */
export type {ComposerHandle};
/** 导出发送快照类型。 */
export type {ComposerSendData};
/** 导出上游编辑态挂载选项类型。 */
export type {AgentComposerOptions};
