/** 用途：上传地址、大小阈值与固定资源路径；使用范围：传输准备；解耦评估：直达全局常量声明。 */
import {Constants} from "../../../constants";
/** 用途：确认大文件上传；使用范围：发送前确认；解耦评估：直达 Dialog 运行时唯一实现。 */
import {confirmDialog} from "../../runtime/dialog.port";
/** 用途：关闭上传进度消息；使用范围：XHR 完成；解耦评估：直达 Dialog 运行时唯一实现。 */
import {hideMessage} from "../../runtime/dialog.port";
/** 用途：展示验证、进度和错误；使用范围：完整传输生命周期；解耦评估：直达 Dialog 运行时唯一实现。 */
import {showMessage} from "../../runtime/dialog.port";
/** 用途：销毁已经脱离文档的编辑器；使用范围：XHR 完成门禁；解耦评估：直达 Protyle 生命周期实现。 */
import {destroy} from "../../util/destroy";
/** 用途：上传文案；使用范围：验证、进度和错误；解耦评估：直达 i18n 环境层。 */
import {siyuanI18n} from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 用途：编码文件名；使用范围：上传状态与确认 HTML；解耦评估：直达纯 DOM 文本编码器。 */
import {escapeHtml} from "../../../util/DOM/escape";
/** 用途：格式化大文件尺寸；使用范围：确认文案；解耦评估：直达第三方纯格式化实现。 */
import {filesize} from "filesize";

/** 导出上传常量。 */
export {Constants};
/** 导出确认 Dialog。 */
export {confirmDialog};
/** 导出编辑器销毁实现。 */
export {destroy};
/** 导出文件尺寸格式化。 */
export {filesize};
/** 导出消息关闭实现。 */
export {hideMessage};
/** 导出消息展示实现。 */
export {showMessage};
/** 导出上传文案。 */
export {siyuanI18n};
/** 导出文件名编码器。 */
export {escapeHtml};
