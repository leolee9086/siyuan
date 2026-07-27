/** 用途：导出菜单协议常量；使用范围：对话框和移动桥接；解耦评估：稳定协议值应直达声明。 */
import {Constants} from "../../../constants";
/** 用途：创建模板输入对话框；使用范围：模板 factory；解耦评估：具体构造仅位于 factory 边界。 */
import {Dialog} from "../../../dialog";
/** 用途：模板覆盖确认；使用范围：模板保存冲突；解耦评估：保持现有同步确认协议。 */
import {confirmDialog} from "../../../dialog/confirmDialog";
/** 用途：显示和隐藏导出进度；使用范围：全部异步导出动作；解耦评估：消息身份由全局 UI 统一管理。 */
import {hideMessage, showMessage} from "../../../dialog/message";
/** 用途：规范模板名；使用范围：模板导出；解耦评估：纯函数直达唯一实现。 */
import {replaceFileName} from "../../../editor/rename";
/** 用途：打开图片导出预览；使用范围：图片菜单动作；解耦评估：这是 2026-03-19 明确引入的唯一预览入口。 */
import {openExportPreviewTab} from "../../../export-preview/open";
/** 用途：判断桌面构建；使用范围：平台菜单分组；解耦评估：构建期平台事实不由调用方注入。 */
import {isElectron} from "../../../platform";
/** 用途：生成 HTML/PDF/Word 并保存；使用范围：平台导出动作；解耦评估：导出领域唯一实现。 */
import {onExport, saveExport} from "../../../protyle/export";
/** 用途：打开 Markdown 参数对话框并导出；使用范围：Markdown 菜单动作；解耦评估：2026-06-25 的唯一入口。 */
import {exportMarkdownZip} from "../../../protyle/export/exportMd";
/** 用途：判断移动原生平台并保存压缩包；使用范围：平台导出动作；解耦评估：现有兼容层是统一平台边界。 */
import {isInAndroid, isInHarmony, isInIOS, isInMobileApp, saveExportFile} from "../../../protyle/util/compatibility";
/** 用途：发起导出请求；使用范围：全部后端导出动作；解耦评估：保持当前回调协议与错误传播。 */
import {fetchPost, fetchSyncPost} from "../../../util/fetch";
/** 用途：严格读取配置、语言和存储；使用范围：菜单描述与移动 PDF 参数；解耦评估：读取同一全局状态并在缺失时显式失败。 */
import {getSiyuanConfig, getSiyuanLanguages, getSiyuanStorage} from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 用途：读取当前页面地址；使用范围：移动 PDF HTML 基址；解耦评估：稳定环境查询直达声明。 */
import {getLocationHost, getLocationProtocol} from "../../../util/siyuanEnvironments/windowLocation.environment";
/** 用途：读取原生打印桥；使用范围：移动 PDF；解耦评估：统一环境边界保持平台对象身份。 */
import {getWindowJSAndroid, getWindowJSHarmony, getWindowWebkit} from "../../../util/siyuanEnvironments/windowNative.environment";
/** 用途：判断移动布局；使用范围：模板对话框宽度；解耦评估：当前平台查询是唯一实现。 */
import {isMobile} from "../../../util/functions";
/** 用途：构建最终菜单 DOM；使用范围：导出菜单 factory；解耦评估：菜单领域唯一渲染实现。 */
import {MenuItem} from "../../Menu";

/** 导出协议常量。 */
export {Constants};
/** 导出对话框实现。 */
export {Dialog};
/** 导出确认动作。 */
export {confirmDialog};
/** 导出请求实现。 */
export {fetchPost};
/** 导出同步请求实现。 */
export {fetchSyncPost};
/** 导出严格配置读取。 */
export {getSiyuanConfig};
/** 导出严格语言读取。 */
export {getSiyuanLanguages};
/** 导出严格存储读取。 */
export {getSiyuanStorage};
/** 导出地址 host 查询。 */
export {getLocationHost};
/** 导出地址 protocol 查询。 */
export {getLocationProtocol};
/** 导出 Android 原生桥。 */
export {getWindowJSAndroid};
/** 导出 Harmony 原生桥。 */
export {getWindowJSHarmony};
/** 导出 iOS 原生桥。 */
export {getWindowWebkit};
/** 导出消息隐藏。 */
export {hideMessage};
/** 导出 Android 判定。 */
export {isInAndroid};
/** 导出 Harmony 判定。 */
export {isInHarmony};
/** 导出 iOS 判定。 */
export {isInIOS};
/** 导出移动应用判定。 */
export {isInMobileApp};
/** 导出桌面构建事实。 */
export {isElectron};
/** 导出移动布局判定。 */
export {isMobile};
/** 导出菜单项实现。 */
export {MenuItem};
/** 导出 HTML 生成。 */
export {onExport};
/** 导出图片预览入口。 */
export {openExportPreviewTab};
/** 导出模板名规范化。 */
export {replaceFileName};
/** 导出通用保存动作。 */
export {saveExport};
/** 导出压缩包保存动作。 */
export {saveExportFile};
/** 导出消息显示。 */
export {showMessage};
/** 导出 Markdown 参数入口。 */
export {exportMarkdownZip};
