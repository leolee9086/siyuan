/** 用途：完整应用外观。使用范围：资产打开命令；解耦评估：稳定应用领域根，不加载具体 App class。 */
import type {AppFacade} from "../../app/AppFacade.types";
/** 导出完整应用外观。 */
export type {AppFacade};

/** 用途：资产扩展名常量。使用范围：拒绝非资产路径；解耦评估：稳定配置值。 */
import {Constants} from "../../constants";
/** 导出资产扩展名常量。 */
export {Constants};

/** 用途：POSIX 路径操作。使用范围：解析资产扩展名；解耦评估：稳定 path 唯一实现。 */
import {pathPosix} from "../../util/file/path/operations";
/** 导出 POSIX 路径操作。 */
export {pathPosix};

/** 用途：Editor 打开组合根。使用范围：创建资产页签；解耦评估：资产命令调用完整打开领域入口，不依赖具体 Editor class。 */
import {openFile} from "../../editor/open/openFile";
/** 导出 Editor 打开组合根。 */
export {openFile};
