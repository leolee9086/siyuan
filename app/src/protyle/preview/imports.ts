/** 用途：预览导出常量。使用范围：复制平台请求；解耦评估：稳定共享常量。 */
import {Constants} from "../../constants";
/** 导出预览导出常量。 */
export {Constants};

/** 用途：异步内核请求。使用范围：在线资源转换与平台复制；解耦评估：稳定网络基础设施。 */
import {fetchPost} from "../../util/network/fetch";
/** 导出异步内核请求。 */
export {fetchPost};

/** 用途：消息提示。使用范围：复制结果反馈；解耦评估：Protyle 运行时宿主能力。 */
import {showMessage} from "../runtime/dialog.port";
/** 导出消息提示。 */
export {showMessage};

/** 用途：国际化文案。使用范围：复制结果反馈；解耦评估：稳定环境边界。 */
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出国际化文案。 */
export {siyuanI18n};

/** 用途：同步脚本加载。使用范围：平台内容转换依赖；解耦评估：Protyle 唯一加载实现。 */
import {addScriptSync} from "../util/addScript";
/** 导出同步脚本加载。 */
export {addScriptSync};

/** 用途：剪贴板写入。使用范围：复制预览内容；解耦评估：Protyle 兼容层既有实现。 */
import {writeText} from "../util/compatibility";
/** 导出剪贴板写入。 */
export {writeText};

/** 用途：恢复 Range 焦点。使用范围：复制前恢复选区；解耦评估：稳定 Protyle 选区实现。 */
import {focusByRange} from "../util/selection";
/** 导出 Range 焦点恢复。 */
export {focusByRange};
