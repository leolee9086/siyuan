/** 用途：异步内核请求。使用范围：搜索条件和路径选择；解耦评估：稳定网络基础设施。 */
import {fetchPost} from "../../../../../util/network/fetch";
/** 导出异步内核请求。 */
export {fetchPost};

/** 用途：搜索配置常量。使用范围：条件选择；解耦评估：稳定共享常量。 */
import {Constants} from "../../../../../constants";
/** 导出搜索配置常量。 */
export {Constants};

/** 用途：完整 Protyle 领域根。使用范围：路径与条件 handler 参数；解耦评估：纯类型完整领域抽象。 */
import type {ProtyleDomain} from "../../../../../protyle/protyle.types";
/** 导出完整 Protyle 领域根。 */
export type {ProtyleDomain};

/** 用途：HTML 转义。使用范围：路径结果渲染；解耦评估：稳定 DOM 工具。 */
import {escapeHtml} from "../../../../../util/DOM/escape";
/** 导出 HTML 转义。 */
export {escapeHtml};

/** 用途：笔记本名称和路径操作。使用范围：路径结果渲染；解耦评估：稳定文件路径领域。 */
import {getNotebookName} from "../../../../../util/file/pathName";
/** 导出笔记本名称读取。 */
export {getNotebookName};
/** 用途：POSIX 路径操作。使用范围：路径结果渲染；解耦评估：稳定文件路径领域。 */
import {pathPosix} from "../../../../../util/file/pathName";
/** 导出 POSIX 路径操作。 */
export {pathPosix};

/** 用途：移动文档路径。使用范围：路径选择动作；解耦评估：既有文件领域实现。 */
import {movePathTo} from "../../../../../util/file/movePath/movePathTo";
/** 导出移动文档路径动作。 */
export {movePathTo};

/** 用途：国际化文案。使用范围：路径选择界面；解耦评估：稳定环境边界。 */
import {siyuanI18n} from "../../../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出国际化文案。 */
export {siyuanI18n};

/** 用途：搜索默认类型。使用范围：条件切换；解耦评估：Search 稳定默认值子域。 */
import {getDefaultSubType} from "../../../../defaults/searchDefaults";
/** 导出默认搜索子类型。 */
export {getDefaultSubType};
/** 用途：搜索默认类型。使用范围：条件切换；解耦评估：Search 稳定默认值子域。 */
import {getDefaultType} from "../../../../defaults/searchDefaults";
/** 导出默认搜索类型。 */
export {getDefaultType};

/** 用途：更新搜索配置。使用范围：条件点击；解耦评估：Search 既有配置实现。 */
import {updateConfig} from "../../../../util";
/** 导出搜索配置更新。 */
export {updateConfig};

/** 用途：搜索输入事件。使用范围：路径选择后刷新；解耦评估：Search 既有输入编排。 */
import {inputEvent} from "../../../../inputEvent";
/** 导出搜索输入事件。 */
export {inputEvent};
