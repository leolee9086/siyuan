/** 用途：发起桌面保存对话框；使用范围：Electron 资源导出；解耦评估：这是桌面适配器唯一实现，Web 分支不会调用。 */
import {ipcInvoke} from "../../platform/electron/ipcRenderer";
/** 用途：描述 Electron 保存对话框的确定响应；使用范围：桌面资源导出；解耦评估：使用 Electron 官方数据契约，不引入本地猜测类型。 */
import type {SaveDialogReturnValue} from "electron";
/** 用途：选择 Web 或 Electron 导出路径；使用范围：资源导出动作；解耦评估：运行平台是执行期事实，不应由每个菜单调用者传递。 */
import {isElectron} from "../../platform";
/** 用途：复制资源文件和写入系统剪贴板路径；使用范围：资源导出与复制动作；解耦评估：直接复用网络原语，避免菜单层重复协议。 */
import {fetchPost} from "../../util/network/fetch";
/** 用途：生成默认导出文件名与扩展名；使用范围：Electron 保存对话框；解耦评估：路径规则已有唯一实现。 */
import {getAssetName, pathPosix} from "../../util/file/pathName";
/** 用途：提供 IPC 命令和资源扩展名常量；使用范围：资源导出；解耦评估：稳定常量不应复制或参数化。 */
import {Constants} from "../../constants";
/** 用途：处理 Android 图片剪贴板和 Web 下载；使用范围：图片复制与 Web 资源导出；解耦评估：平台适配已集中在 compatibility，资源动作直接使用其唯一实现。 */
import {isInAndroid, saveExportFile} from "../../protyle/util/compatibility";
/** 用途：提供资源动作菜单文案；使用范围：导出菜单配置；解耦评估：文案随运行时语言变化，继续使用环境访问器。 */
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 用途：报告复制、导出和权限结果；使用范围：资源动作完成与失败分支；解耦评估：保持既有全局消息语义，不把消息基础设施扩散到菜单调用者。 */
import {showMessage} from "../../dialog/message";
/** 用途：读取已初始化的系统配置；使用范围：文件剪贴板平台判断；解耦评估：初始化缺失应显式失败，不用可选链静默降级。 */
import {getSiyuanConfig} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

/** 导出桌面 IPC 调用原语。 */
export {ipcInvoke};
/** 导出 Electron 平台事实。 */
export {isElectron};
/** 导出后端请求原语。 */
export {fetchPost};
/** 导出资源名解析规则。 */
export {getAssetName};
/** 导出 POSIX 路径操作。 */
export {pathPosix};
/** 导出稳定应用常量。 */
export {Constants};
/** 导出 Android 平台判断。 */
export {isInAndroid};
/** 导出 Web 资源保存适配器。 */
export {saveExportFile};
/** 导出运行时菜单文案。 */
export {siyuanI18n};
/** 导出全局消息实现。 */
export {showMessage};
/** 导出已初始化的系统配置访问器。 */
export {getSiyuanConfig};
/** 导出 Electron 官方保存对话框响应类型。 */
export type {SaveDialogReturnValue};
