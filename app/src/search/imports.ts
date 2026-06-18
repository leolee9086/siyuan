// 跨目录依赖转发
/** 用途：安全读取思源配置。使用范围：search 模块搜索配置。解耦评估：通过 imports.ts 转发。 */
import { getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSiyuanConfig，供 search 模块使用 */
export { getSiyuanConfig };

/** 用途：应用常量定义。使用范围：search 模块搜索类型列表。解耦评估：通过 imports.ts 转发。 */
import { Constants } from "../constants";
/** 导出 Constants，供 search 模块使用 */
export { Constants };

/** 用途：存储值设置工具。使用范围：search 模块保存布局状态。解耦评估：通过 imports.ts 转发。 */
import { setStorageVal } from "../protyle/util/compatibility";
/** 导出 setStorageVal，供 search 模块使用 */
export { setStorageVal };

/** 用途：安全获取 SiYuan 存储。使用范围：search 模块读取存储状态。解耦评估：通过 imports.ts 转发。 */
import { getSiyuanStorage } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSiyuanStorage，供 search 模块使用 */
export { getSiyuanStorage };

/** 用途：国际化文案。使用范围：search 模块排序文案。解耦评估：通过 imports.ts 转发。 */
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 siyuanI18n，供 search 模块使用 */
export { siyuanI18n };

/** 用途：布局 Model 基类。使用范围：Search 类继承。解耦评估：通过 imports.ts 转发。 */
import { Model } from "../layout/Model";
/** 导出 Model，供 search 模块使用 */
export { Model };

/** 用途：布局 Tab 类型。使用范围：Search 构造参数。解耦评估：通过 imports.ts 转发。 */
import { Tab } from "../layout/Tab";
/** 导出 Tab，供 search 模块使用 */
export { Tab };

/** 用途：Protyle 编辑器类型。使用范围：Search 编辑器引用。解耦评估：通过 imports.ts 转发。 */
import { Protyle } from "../protyle";
/** 导出 Protyle，供 search 模块使用 */
export { Protyle };

/** 用途：App 根实例类型。使用范围：Search 构造参数。解耦评估：通过 imports.ts 转发。 */
import { App } from "../index";
/** 导出 App，供 search 模块使用 */
export { App };

/** 用途：面板焦点设置工具。使用范围：Search 点击处理。解耦评估：通过 imports.ts 转发。 */
import { setPanelFocus } from "../layout/utils/setPanelFocus";
/** 导出 setPanelFocus，供 search 模块使用 */
export { setPanelFocus };

/** 用途：清理 outline 和 gutter 高亮。使用范围：Search 点击处理。解耦评估：通过 imports.ts 转发。 */
import { clearOBG } from "../layout/dock/util";
/** 导出 clearOBG，供 search 模块使用 */
export { clearOBG };
