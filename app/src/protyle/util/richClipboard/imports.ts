/** 用途：提供剪贴板协议标识；使用范围：富文本内核请求；解耦评估：协议常量必须与全局定义共享，局部字符串会产生命令漂移。 */
import {Constants} from "../../../constants";
/** 导出富文本剪贴板协议标识。 */
export {Constants};

/** 用途：判断 Electron 运行环境；使用范围：资源增强与清理；解耦评估：平台能力由统一环境模块提供，调用方无法可靠推断。 */
import {isElectron} from "../../../platform";
/** 导出 Electron 平台判定。 */
export {isElectron};

/** 用途：调用 Electron IPC；使用范围：富文本剪贴板文件写入与清理；解耦评估：IPC 是唯一返回型主进程边界，事件无法替代结果传播。 */
import {ipcInvoke} from "../../../platform/electron/ipcRenderer";
/** 导出富文本剪贴板 IPC 调用。 */
export {ipcInvoke};

/** 用途：解析 KaTeX 宏配置 JSON；使用范围：剪贴板数学规范化；解耦评估：复用全局宽松解析语义，局部实现会造成配置兼容差异。 */
import {looseJsonParse} from "../../../util/functions";
/** 导出剪贴板数学配置解析能力。 */
export {looseJsonParse};
