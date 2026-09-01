/**
 * 用途：集中转发桌面端全局命令执行器所需依赖。
 * 使用范围：仅供 command/global/desktop 目录内模块使用。
 * 解耦评估：桌面全局命令涉及布局、Dock、搜索、窗口与平台能力；通过本地 imports.ts 收敛依赖路径，避免叶子执行器跨目录散落导入。
 */

/** 用途：引入编辑器模型类型；使用范围：close.ts 判断未修改编辑器；解耦评估：类型来自编辑器模块公开入口。 */
import { Editor } from "../../../../../editor";
/** 用途：引入全局常量；使用范围：navigation.ts 搜索热键与窗口 IPC；解耦评估：避免重复硬编码协议字段。 */
import { Constants } from "../../../../../constants";
/** 用途：引入桌面搜索入口；使用范围：navigation.ts；解耦评估：搜索 UI 构造由搜索模块封装。 */
import { openSearch } from "../../../../../search/spread";
/** 用途：引入历史导航入口；使用范围：navigation.ts；解耦评估：平台历史行为由既有工具封装。 */
import { goBack, goForward } from "../../../../../util/platform/backForward";
/** 用途：引入 Dock 与文档辅助面板入口；使用范围：dock.ts 与 recentClosed 委托；解耦评估：布局 Dock 层保留自身创建逻辑。 */
import { toggleDockBar } from "../../../../../layout/dock/util";
/** 用途：引入已有 Dock 类型守卫；使用范围：close.ts 从 DOM 类名恢复 Dock 类型；解耦评估：复用布局层现有运行时校验。 */
import { isTDock } from "../../../../../layout/dock/dock.guard";
/** 用途：引入标签和 Dock 工具；使用范围：dock.ts、tabs.ts、split.ts、close.ts；解耦评估：布局状态操作通过既有布局工具完成。 */
import { getDockByType, switchTabByIndex, getActiveTab, getAllTabs, getAllWnds, copyTab } from "../../../../../layout/tabUtil";
/** 用途：重排页签内容；使用范围：桌面分屏命令；解耦评估：直达布局重排唯一实现，不经 tabUtil 综合入口。 */
import {resizeTabs} from "../../../../../layout/resize/resizeTabs";
/** 用途：按 ID 查询完整布局实例；使用范围：tabs.ts 恢复刚创建的页签；解耦评估：该无状态查询的唯一实现位于 layout/query，命令网关应直接引用其真实所有者。 */
import {getInstanceById} from "../../../../../layout/query/layoutInstance";
/** 用途：引入标签关闭工具；使用范围：close.ts；解耦评估：关闭策略继续由布局工具处理。 */
import { closeTabByType } from "../../../../../layout/utils/closeTabByType";
/** 用途：引入工作空间菜单入口；使用范围：navigation.ts；解耦评估：菜单构造仍由菜单模块负责。 */
import { workspaceMenu } from "../../../../../menus/workspace";
/** 用途：引入独立窗口判断；使用范围：navigation.ts；解耦评估：平台状态通过既有工具同步读取。 */
import { isWindow } from "../../../../../util/platform/functions";
/** 用途：引入最近文档入口；使用范围：navigation.ts；解耦评估：最近文档业务由业务模块封装。 */
import { openRecentDocs } from "../../../../../business/openRecentDocs";
/** 用途：引入 Dock 栏、平台和 IPC 能力；使用范围：navigation.ts；解耦评估：桌面专属行为通过既有平台边界发送。 */
import { isElectron } from "../../../../../platform";
/** 用途：引入 Electron IPC 发送入口；使用范围：navigation.ts；解耦评估：命令层通过 IPC 协议触发主进程行为。 */
import { ipcSend } from "../../../../../platform/electron/ipcRenderer";
/** 用途：引入 Tab 类型和值；使用范围：tabs.ts、split.ts、close.ts；解耦评估：保留布局模型精确类型。 */
import { Tab } from "../../../../../layout/Tab";
/** 用途：引入 Wnd 类型和值；使用范围：split.ts；解耦评估：取消拆分需要识别窗口节点。 */
import { Wnd } from "../../../../../layout/Wnd";
/** 用途：引入 Layout 类型和值；使用范围：split.ts；解耦评估：取消拆分需要识别布局节点。 */
import { Layout } from "../../../../../layout";
/** 用途：引入新窗口打开入口；使用范围：split.ts；解耦评估：窗口创建逻辑由窗口模块封装。 */
import { openNewWindow } from "../../../../../window/openNewWindow";
/** 用途：引入取消拆分工具；使用范围：split.ts；解耦评估：布局重组仍由菜单层既有工具执行。 */
import { unsplitWnd, unsplitCurrentWnd } from "../../../../../menus/tab";
/** 用途：引入运行态访问器；使用范围：close.ts、split.ts；解耦评估：避免新增直接 window 访问。 */
import { getSiyuanLayout, getSiyuanBlockPanels } from "../../../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 用途：引入路由 DSL；使用范围：index.ts 与各子路由；解耦评估：用户指定的声明式路由模式。 */
import { calibur } from "calibur-router";
/** 用途：引入 arktype 类型声明器；使用范围：CaliburRouter split 条件；解耦评估：属于路由 schema 基础设施。 */
import { type } from "arktype";
/** 用途：引入桌面命令常量；使用范围：桌面路由与执行器条件判断；解耦评估：集中命令契约。 */
import { DESKTOP_GLOBAL_COMMANDS } from "../commands";
/** 用途：引入最近关闭恢复执行器；使用范围：navigation.ts；解耦评估：复杂恢复流程独立模块承接。 */
import { executeRecentClosedGlobalCommand } from "../recentClosed";
/** 用途：引入全局命令上下文类型；使用范围：桌面执行器签名；解耦评估：复用 global/types.ts 契约。 */
import type {AppFacade} from "../../../../../app/AppFacade.types";
/** 用途：泛型全局命令上下文协议；使用范围：桌面命令实现；解耦评估：纯同域契约由桌面网关转发。 */
import type { GlobalCommandContext } from "../types";

/** 导出编辑器模型类型。 */
export { Editor };
/** 导出全局常量集合。 */
export { Constants };
/** 导出桌面搜索入口。 */
export { openSearch };
/** 导出历史后退入口。 */
export { goBack };
/** 导出历史前进入口。 */
export { goForward };
/** 导出 Dock 栏切换工具。 */
export { toggleDockBar };
/** 导出 Dock 类型守卫。 */
export { isTDock };
/** 导出 Dock 获取工具。 */
export { getDockByType };
/** 导出按索引切换标签工具。 */
export { switchTabByIndex };
/** 导出活动标签获取工具。 */
export { getActiveTab };
/** 导出全部标签获取工具。 */
export { getAllTabs };
/** 导出全部窗口获取工具。 */
export { getAllWnds };
/** 导出实例查询工具。 */
export { getInstanceById };
/** 导出标签复制工具。 */
export { copyTab };
/** 导出标签尺寸重排工具。 */
export { resizeTabs };
/** 导出标签关闭工具。 */
export { closeTabByType };
/** 导出工作空间菜单入口。 */
export { workspaceMenu };
/** 导出独立窗口判断。 */
export { isWindow };
/** 导出最近文档入口。 */
export { openRecentDocs };
/** 导出 Electron 环境判断。 */
export { isElectron };
/** 导出 IPC 发送入口。 */
export { ipcSend };
/** 导出 Tab 类型和值。 */
export { Tab };
/** 导出 Wnd 类型和值。 */
export { Wnd };
/** 导出 Layout 类型和值。 */
export { Layout };
/** 导出新窗口打开入口。 */
export { openNewWindow };
/** 导出取消拆分工具。 */
export { unsplitWnd, unsplitCurrentWnd };
/** 导出布局访问器。 */
export { getSiyuanLayout };
/** 导出块面板访问器。 */
export { getSiyuanBlockPanels };
/** 导出 CaliburRouter 构建器。 */
export { calibur };
/** 导出 arktype 类型声明器。 */
export { type };
/** 导出桌面命令常量。 */
export { DESKTOP_GLOBAL_COMMANDS };
/** 导出最近关闭恢复执行器。 */
export { executeRecentClosedGlobalCommand };
/** 导出全局命令上下文类型。 */
export type { GlobalCommandContext };
/** 导出主应用宿主身份，供桌面命令绑定泛型上下文。 */
export type { AppFacade };
