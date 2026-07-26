/** 用途：完整布局页签与窗口领域根。使用范围：打开目标选择；解耦评估：不加载具体 Tab/Wnd class。 */
import type {LayoutTab, LayoutWindow} from "../../layout/layout.types";
/** 导出完整布局页签领域根。 */
export type {LayoutTab};
/** 导出完整布局窗口领域根。 */
export type {LayoutWindow};

/** 用途：Editor 完整领域守卫。使用范围：复用已打开编辑器；解耦评估：厂牌守卫不加载具体 Editor class。 */
import {isEditorDomain} from "../model/editorDomain.types";
/** 导出 Editor 领域守卫。 */
export {isEditorDomain};

/** 用途：布局领域守卫。使用范围：查找目标窗口；解耦评估：只依赖完整布局根。 */
import {isLayoutDomain, isLayoutWindow} from "../../layout/layout.types.guard";
/** 导出布局容器守卫。 */
export {isLayoutDomain};
/** 导出布局窗口守卫。 */
export {isLayoutWindow};

/** 用途：布局实例查询。使用范围：定位页签和窗口；解耦评估：无状态查询子域。 */
import {getInstanceById, getWndByLayout} from "../../layout/query/layoutInstance";
/** 导出实例 ID 查询。 */
export {getInstanceById};
/** 导出活动窗口查询。 */
export {getWndByLayout};

/** 用途：PDF 加载门禁。使用范围：页签切换前检查；解耦评估：稳定 Layout loading 子域。 */
import {pdfIsLoading} from "../../layout/loading/pdfLoading";
/** 导出 PDF 加载门禁。 */
export {pdfIsLoading};

/** 用途：完整模型集合查询。使用范围：复用打开模型；解耦评估：返回既有完整领域集合。 */
import {getAllModels} from "../../layout/getAll";
/** 导出模型集合查询。 */
export {getAllModels};

/** 用途：系统常量。使用范围：打开动作和 IPC；解耦评估：稳定配置值。 */
import {Constants} from "../../constants";
/** 导出系统常量。 */
export {Constants};

/** 用途：Electron 平台事实。使用范围：桌面 IPC 分支；解耦评估：稳定平台边界。 */
import {isElectron} from "../../platform";
/** 导出 Electron 平台事实。 */
export {isElectron};

/** 用途：Electron IPC。使用范围：新窗口打开；解耦评估：平台封装唯一实现。 */
import {ipcInvoke} from "../../platform/electron/ipcRenderer";
/** 导出 IPC 调用。 */
export {ipcInvoke};

/** 用途：未初始化页签查询。使用范围：延迟页签恢复；解耦评估：Editor 打开子域协作算法。 */
import {getUnInitTab} from "../util.getUnInitTab";
/** 导出未初始化页签查询。 */
export {getUnInitTab};

/** 用途：编辑器切换编排。使用范围：复用已有模型；解耦评估：Editor 导航协作算法。 */
import {switchEditor} from "../util.switchEditor";
/** 导出编辑器切换编排。 */
export {switchEditor};

/** 用途：Layout 页签组合根。使用范围：创建新页签；解耦评估：具体构造仅发生于 Layout 创建边界。 */
import {newTab} from "../../layout/utils/newTab";
/** 导出新页签组合根。 */
export {newTab};

/** 用途：安全配置与布局读取。使用范围：打开策略和中心布局；解耦评估：稳定环境边界。 */
import {getSafeSiyuanConfig, getSafeSiyuanLayout} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出安全配置读取。 */
export {getSafeSiyuanConfig};
/** 导出安全布局读取。 */
export {getSafeSiyuanLayout};

/** 用途：已打开模型查找。使用范围：资产、自定义、Editor、Search 复用；解耦评估：同一打开领域的完整分类算法。 */
import {findAndOpenAsset, findAndOpenCustom, findAndOpenEditor, findAndOpenSearch} from "../util.find";
/** 导出资产查找。 */
export {findAndOpenAsset};
/** 导出自定义模型查找。 */
export {findAndOpenCustom};
/** 导出 Editor 查找。 */
export {findAndOpenEditor};
/** 导出 Search 查找。 */
export {findAndOpenSearch};
