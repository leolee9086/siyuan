/** 用途：网络请求。使用范围：解析 assets 相对路径；解耦评估：稳定网络基础设施。 */
import {fetchPost} from "../../util/network/fetch";
/** 导出网络请求。 */
export {fetchPost};

/** 用途：系统 Shell 文件操作。使用范围：打开路径或在文件夹中定位；解耦评估：现有文件平台唯一实现。 */
import {useShell} from "../../util/file/pathName";
/** 导出系统 Shell 文件操作。 */
export {useShell};

/** 用途：Electron 平台事实。使用范围：限制本地路径操作宿主；解耦评估：稳定平台边界。 */
import {isElectron} from "../index";
/** 导出 Electron 平台事实。 */
export {isElectron};

/** 用途：系统配置读取。使用范围：Windows file URL 转换；解耦评估：稳定环境边界。 */
import {getSiyuanConfig} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出系统配置读取。 */
export {getSiyuanConfig};
