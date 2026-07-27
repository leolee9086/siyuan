/** 用途：文件树导入菜单项；使用范围：导入菜单组合根；解耦评估：直达菜单项唯一实现。 */
import {MenuItem} from "../../Menu.Item";
/** 用途：后端导入请求；使用范围：压缩包和标准 Markdown 导入；解耦评估：直达网络实现。 */
import {fetchPost} from "../../../util/network/fetch";
/** 用途：Electron 文件选择；使用范围：桌面标准 Markdown 导入；解耦评估：直达 IPC 适配器。 */
import {ipcInvoke} from "../../../platform/electron/ipcRenderer";
/** 用途：Electron 宿主判别；使用范围：控制本地路径导入项；解耦评估：直达平台声明。 */
import {isElectron} from "../../../platform";
/** 用途：移动宿主判别；使用范围：选择当前移动文件树；解耦评估：直达平台函数。 */
import {isMobile} from "../../../platform";
/** 用途：完整桌面文件树领域根及其守卫；使用范围：导入完成后的树刷新；解耦评估：不加载 Files class。 */
import {isFilesDomain} from "../../../layout/dock/Files/eventHandlers.types";
/** 用途：完整桌面文件树领域类型；使用范围：导入菜单内部宿主联合类型；解耦评估：纯类型不加载 Files class。 */
import type {FilesDomain} from "../../../layout/dock/Files/eventHandlers.types";
/** 用途：完整移动文件树领域根及其守卫；使用范围：移动导入完成后的树刷新；解耦评估：不加载 MobileFiles class。 */
import {isMobileFilesDomain} from "../../../mobile/dock/files/mobileFiles.types";
/** 用途：完整移动文件树领域类型；使用范围：导入菜单内部宿主联合类型；解耦评估：纯类型不加载 MobileFiles class。 */
import type {MobileFilesDomain} from "../../../mobile/dock/files/mobileFiles.types";
/** 用途：查询桌面文件树 Dock；使用范围：导入完成后的树刷新；解耦评估：直达无状态查询实现。 */
import {getDockByType} from "../../../layout/query/dockByType";
/** 用途：系统 IPC 常量；使用范围：打开本地文件选择器；解耦评估：直达常量所有者。 */
import {Constants} from "../../../constants";
/** 用途：导入菜单语言；使用范围：导入、文档和文件夹标签；解耦评估：直达只读语言环境。 */
import {siyuanI18n} from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 用途：严格读取已初始化配置；使用范围：只读门禁和文件选择默认目录；解耦评估：直达环境所有者并保持缺失时显式失败。 */
import {getSiyuanConfig} from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 用途：严格读取当前全局菜单；使用范围：追加和关闭导入菜单；解耦评估：直达菜单环境所有者并保持缺失时显式失败。 */
import {getSiyuanGlobalMenusMenu} from "../../../util/siyuanEnvironments/getMenu.environment";

/** 导出菜单项唯一实现。 */
export {MenuItem};
/** 导出后端请求实现。 */
export {fetchPost};
/** 导出 Electron IPC 适配器。 */
export {ipcInvoke};
/** 导出 Electron 宿主判别。 */
export {isElectron};
/** 导出移动宿主判别。 */
export {isMobile};
/** 导出完整桌面文件树守卫。 */
export {isFilesDomain};
/** 导出完整桌面文件树类型。 */
export type {FilesDomain};
/** 导出完整移动文件树守卫。 */
export {isMobileFilesDomain};
/** 导出完整移动文件树类型。 */
export type {MobileFilesDomain};
/** 导出桌面 Dock 查询。 */
export {getDockByType};
/** 导出系统 IPC 常量。 */
export {Constants};
/** 导出导入菜单语言。 */
export {siyuanI18n};
/** 导出严格配置读取。 */
export {getSiyuanConfig};
/** 导出严格菜单读取。 */
export {getSiyuanGlobalMenusMenu};
