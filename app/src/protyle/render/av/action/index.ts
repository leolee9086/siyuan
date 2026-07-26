/**
 * 用途：引入属性视图点击处理实现。
 * 使用范围：供 Protyle 点击事件入口复用，负责 action 子目录中的点击行为分发。
 * 解耦评估：外部调用方只关心点击入口函数，不需要知道内部拆分细节，由当前目录入口统一暴露最稳妥。
 */
import { avClick } from "./click";
/**
 * 用途：引入属性视图右键菜单实现。
 * 使用范围：供 Protyle 右键菜单入口复用，负责 action 子目录中的行级菜单构建。
 * 解耦评估：右键菜单与点击处理共享同一批 AV 结构约束，但调用时机独立，保留独立模块更利于维护。
 */
import { avContextmenu } from "./contextmenu";
/**
 * 用途：引入属性视图标题同步实现。
 * 使用范围：供输入、剪切、插入 HTML 等流程在标题被编辑后复用。
 * 解耦评估：标题同步需要事务和同页多实例同步，提为独立模块比内联在入口文件更清晰。
 */
import { updateAVName } from "./name";
/**
 * 用途：引入属性视图单元格动画与列删除动画实现。
 * 使用范围：供选择器、关联、列编辑等流程在局部更新 DOM 时复用。
 * 解耦评估：这部分逻辑本质是 UI 刷新适配层，拆出后能避免其它业务模块反向依赖点击或右键菜单代码。
 */
import { removeAttrViewColAnimation } from "./animation";
/**
 * 用途：引入属性视图完整复制实现。
 * 使用范围：供 gutter 菜单和快捷键触发“复制为完整副本”流程。
 * 解耦评估：完整复制需要组合接口调用、DOM 插入和事务提交，保留专门模块能把副作用边界收紧。
 */
import { duplicateCompletely } from "./duplicate";

/** 导出属性视图点击入口。 */
export { avClick };
/** 导出属性视图右键菜单入口。 */
export { avContextmenu };
/** 导出属性视图标题同步入口。 */
export { updateAVName };
/** 导出属性视图列删除动画入口。 */
export { removeAttrViewColAnimation };
/** 导出属性视图完整复制入口。 */
export { duplicateCompletely };
