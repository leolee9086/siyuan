/**
 * 用途：集中转发 global 命令拆分模块所需的外部依赖。
 * 使用范围：仅供 command/global 目录内非 desktop 子目录的命令执行器使用。
 * 解耦评估：globalCommand 是跨 UI 域调度入口，通过本文件收敛外部路径，避免拆分文件散落跨层导入。
 */

/** 用途：每日笔记入口；使用范围：common.ts；解耦评估：业务流程由文件模块封装。 */
import { newDailyNote } from "../../../../util/file/mount";
/** 用途：历史面板入口；使用范围：common.ts；解耦评估：历史 UI 由 history 模块封装。 */
import { openHistory } from "../../../../history/history";
/** 用途：移动端 Dock 入口；使用范围：mobile.ts；解耦评估：移动端 UI 事件由 dock 工具封装。 */
import { openDock } from "../../../../mobile/dock/util";
/** 用途：移动端主菜单入口；使用范围：mobile.ts；解耦评估：菜单 UI 由 mobile/menu 封装。 */
import { popMenu } from "../../../../mobile/menu";
/** 用途：移动端搜索入口；使用范围：mobile.ts；解耦评估：搜索 UI 由 mobile/menu/search 封装。 */
import { popSearch } from "../../../../mobile/menu/search";
/** 用途：移动端最近文档入口；使用范围：mobile.ts；解耦评估：最近文档 UI 由 mobile 模块封装。 */
import { getRecentDocs } from "../../../../mobile/menu/getRecentDocs";
/** 用途：Dock 相关入口；使用范围：common.ts、recentClosed.ts；解耦评估：布局 Dock 层保留自身创建逻辑。 */
import { selectOpenTab, openBacklink, openGraph, openOutline } from "../../../../layout/dock/util";
/** 用途：常量集合；使用范围：recentClosed.ts；解耦评估：避免重复硬编码存储键。 */
import { Constants } from "../../../../constants";
/** 用途：编辑器设置运行时 API；使用范围：common.ts；解耦评估：配置写入由设置命名空间统一处理。 */
import { editorConfigApi } from "../../../../config/tabs/editorRuntime";
/** 用途：锁屏入口；使用范围：common.ts；解耦评估：系统对话流程由 lockScreen 封装。 */
import { lockScreen } from "../../../../dialog/processSystem/lockScreen";
/** 用途：新建文件入口；使用范围：common.ts；解耦评估：文件创建由 util/file 封装。 */
import { newFile } from "../../../../util/file/newFile";
/** 用途：闪卡入口；使用范围：common.ts；解耦评估：卡片 UI 由 card 模块封装。 */
import { openCard } from "../../../../card/openCard";
/** 用途：同步入口；使用范围：common.ts；解耦评估：同步流程由 syncGuide 编排。 */
import { syncGuide } from "../../../../sync/syncGuide";
/** 用途：文件打开入口；使用范围：recentClosed.ts；解耦评估：页签恢复复用 editor/util 统一入口。 */
import {openFile} from "../../../../editor/open/openFile";
/** 用途：网络请求工具；使用范围：recentClosed.ts；解耦评估：保持原 fetchPost 回调语义。 */
import { fetchPost } from "../../../../util/network/fetch";
/** 用途：存储写入工具；使用范围：recentClosed.ts；解耦评估：存储兼容写入由 protyle 工具封装。 */
import { setStorageVal } from "../../../../protyle/util/compatibility";
/** 用途：环境访问器；使用范围：common.ts、recentClosed.ts；解耦评估：替代新增直接 window 访问。 */
import { getSiyuanConfig, getSiyuanStorage } from "../../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 用途：平台判断；使用范围：global.ts 根路由选择移动端或桌面端命令域。解耦评估：平台常量是同步环境信息，命令入口需要即时读取。 */
import { isMobile } from "../../../../platform";
/** 用途：应用实例类型；使用范围：types.ts；解耦评估：保持 globalCommand 既有 app 参数边界。 */
import type { AppFacade } from "../../../../app/AppFacade.types";
/** 用途：CaliburRouter 构建器；使用范围：所有命令路由；解耦评估：用户指定的声明式路由 DSL。 */
import { calibur } from "calibur-router";
/** 用途：arktype 类型声明器；使用范围：CaliburRouter split 条件；解耦评估：属于路由 schema 基础设施。 */
import { type } from "arktype";

/** 导出每日笔记入口。 */
export { newDailyNote };
/** 导出历史面板入口。 */
export { openHistory };
/** 导出移动端 Dock 入口。 */
export { openDock };
/** 导出移动端主菜单入口。 */
export { popMenu };
/** 导出移动端搜索入口。 */
export { popSearch };
/** 导出移动端最近文档入口。 */
export { getRecentDocs };
/** 导出已打开标签选择入口。 */
export { selectOpenTab };
/** 导出反链页签入口。 */
export { openBacklink };
/** 导出关系图页签入口。 */
export { openGraph };
/** 导出大纲页签入口。 */
export { openOutline };
/** 导出常量集合。 */
export { Constants };
/** 导出编辑器设置运行时 API。 */
export { editorConfigApi };
/** 导出锁屏入口。 */
export { lockScreen };
/** 导出新建文件入口。 */
export { newFile };
/** 导出闪卡入口。 */
export { openCard };
/** 导出同步入口。 */
export { syncGuide };
/** 导出文件打开入口。 */
export { openFile };
/** 导出网络请求工具。 */
export { fetchPost };
/** 导出存储写入工具。 */
export { setStorageVal };
/** 导出配置访问器。 */
export { getSiyuanConfig };
/** 导出存储访问器。 */
export { getSiyuanStorage };
/** 导出移动端环境判断。 */
export { isMobile };
/** 导出 CaliburRouter 构建器。 */
export { calibur };
/** 导出 arktype 类型声明器。 */
export { type };
/** 导出应用实例类型。 */
export type { AppFacade };
