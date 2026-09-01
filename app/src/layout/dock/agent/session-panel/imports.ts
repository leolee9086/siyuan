/** 用途：约束会话摘要和目录命令；使用范围：controller/view 类型签名；解耦评估：纯类型依赖。 */
import type {SessionIndexItem} from "../session/AgentSession.types";
/** 用途：约束目录菜单动作；使用范围：controller 命令分派。 */
import type {TaskDirectoryMenuAction} from "../task-directory/AgentTaskDirectory.types";
/** 用途：约束目录动作执行依赖；使用范围：共享目录命令。 */
import type {AgentTaskDirectoryRepository} from "../task-directory/AgentTaskDirectory.types";
/** 用途：打开本地会话目录；使用范围：Electron 会话菜单；解耦评估：复用已有 shell 与路径适配器，不直接依赖 Electron shell。 */
import {originalPath, useShell} from "../../../../util/file/pathName";
/** 用途：区分原生目录选择和 Web 路径输入；使用范围：task-directory 绑定；解耦评估：平台判断必须由统一适配层提供。 */
import {isElectron} from "../../../../platform";
/** 用途：请求 Electron 主进程打开目录选择器；使用范围：task-directory 选择；解耦评估：IPC 细节经平台适配器集中隔离。 */
import {ipcInvoke} from "../../../../platform/electron/ipcRenderer";
/** 用途：获取统一 IPC channel；使用范围：Electron 目录选择；解耦评估：通道常量由应用级契约持有。 */
import {Constants} from "../../../../constants";
/** 用途：转义会话标题；使用范围：列表 HTML；解耦评估：复用通用 DOM 安全边界。 */
import {escapeHtml} from "../../../../util/DOM/escape";
/** 用途：定位会话弹层；使用范围：弹层挂载；解耦评估：复用现有布局定位规则。 */
import {setPosition} from "../../../../util/DOM/positioning/setPosition";
/** 用途：从委托事件中找到行动作；使用范围：列表点击；解耦评估：复用统一的 class 向上查找语义。 */
import {hasClosestByClassName} from "../../../../protyle/util/hasClosest";
/** 用途：提供搜索结果键盘导航；使用范围：搜索输入框；解耦评估：保持与其它列表一致的交互。 */
import {upDownHint} from "../../../../util/DOM/upDownHint";
/** 用途：创建应用内路径输入框；使用范围：Web/移动端 task-directory 绑定；解耦评估：复用统一 Dialog 生命周期和主题样式。 */
import {Dialog} from "../../../../dialog";

/** 导出 IPC channel 常量。 */
export {Constants};
/** 导出统一对话框实现。 */
export {Dialog};
/** 导出 DOM 文本转义函数。 */
export {escapeHtml};
/** 导出委托事件 class 查找函数。 */
export {hasClosestByClassName};
/** 导出 Electron IPC 调用适配器。 */
export {ipcInvoke};
/** 导出 Electron 平台标记。 */
export {isElectron};
/** 导出 Electron 原生路径入口。 */
export {originalPath};
/** 导出弹层定位函数。 */
export {setPosition};
/** 导出列表键盘导航函数。 */
export {upDownHint};
/** 导出桌面 shell 适配器。 */
export {useShell};
/** 导出会话摘要类型。 */
export type {SessionIndexItem};
/** 导出目录菜单动作类型。 */
export type {TaskDirectoryMenuAction};
/** 导出任务目录仓储类型。 */
export type {AgentTaskDirectoryRepository};
