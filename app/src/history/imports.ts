/**
 * 用途：为历史文件预览提供唯一的运行时依赖入口。
 * 使用范围：当前仅供 repoFile.ts 组合列表、回滚、导出和快照预览流程使用。
 * 解耦评估：该网关只聚合稳定的跨领域服务；高层编辑器创建仍由 AppFacade 类型契约表达，未把具体应用类引回历史层。
 */

/** 用途：生成资源快照预览标记。使用范围：历史文件中的媒体内容。解耦评估：纯展示函数，不持有历史状态。 */
import {renderAssetsPreview} from "../asset/renderAssets";
/** 用途：提供历史预览的媒体类型和编辑器动作常量。使用范围：内容分发与只读预览创建。解耦评估：常量无运行时所有权。 */
import {Constants} from "../constants";
/** 用途：展示回滚确认对话框。使用范围：历史文件回滚操作。解耦评估：历史面板拥有该交互，不向底层传播 UI 事件。 */
import {confirmDialog} from "../dialog/confirmDialog";
/** 用途：将导出路径交给宿主保存。使用范围：历史文件导出操作。解耦评估：兼容层隔离了宿主保存实现。 */
import {saveExportFile} from "../protyle/util/compatibility";
/** 用途：配置只读历史编辑器。使用范围：历史快照文档预览。解耦评估：由历史组合层消费，不让编辑器实现依赖历史模块。 */
import {disabledProtyle} from "../protyle/util/onGet";
/** 用途：消费历史文档内容响应。使用范围：只读历史编辑器初始化收尾。解耦评估：复用既有编辑器协议，不反向暴露历史状态。 */
import {onGet} from "../protyle/util/onGet";
/** 用途：转义历史条目的属性。使用范围：比较模式列表标题属性。解耦评估：无状态安全工具。 */
import {escapeAttr} from "../util/DOM/escape";
/** 用途：转义历史条目的文本。使用范围：移动和桌面列表显示。解耦评估：无状态安全工具。 */
import {escapeHtml} from "../util/DOM/escape";
/** 用途：调用仓库历史和导出 HTTP 接口。使用范围：历史文件操作。解耦评估：复用应用统一请求边界。 */
import {fetchPost} from "../util/network/fetch";
/** 用途：检测当前平台布局。使用范围：选择移动和桌面历史条目。解耦评估：无状态平台能力。 */
import {isMobile} from "../util/platform/functions";
/** 用途：读取内容文件扩展名。使用范围：快照内容预览分发。解耦评估：无状态路径工具。 */
import {pathPosix} from "../util/file/path/operations";
/** 用途：格式化历史快照时间。使用范围：列表和确认文本。解耦评估：第三方纯日期工具没有业务反向依赖。 */
import * as dayjs from "dayjs";

/** 历史资源预览所需的纯展示依赖。 */
export {renderAssetsPreview};
/** 历史内容分发所需的固定协议常量。 */
export {Constants};
/** 历史文件回滚交互所需的确认入口。 */
export {confirmDialog};
/** 历史文件导出交付所需的平台保存入口。 */
export {saveExportFile};
/** 历史文档快照创建后所需的只读状态配置。 */
export {disabledProtyle};
/** 历史文档快照创建后所需的内容响应处理。 */
export {onGet};
/** 历史比较列表属性所需的转义工具。 */
export {escapeAttr};
/** 历史文件显示文本所需的转义工具。 */
export {escapeHtml};
/** 历史文件操作所需的统一 HTTP 请求入口。 */
export {fetchPost};
/** 历史文件列表布局选择所需的平台探测。 */
export {isMobile};
/** 历史快照内容分类所需的路径工具。 */
export {pathPosix};
/** 历史列表和确认文本所需的日期格式化工具。 */
export {dayjs};
