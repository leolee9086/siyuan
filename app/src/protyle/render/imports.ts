// 跨目录依赖转发
/** 用途：国际化文本。使用范围：render 模块 UI 文案。解耦评估：通过 imports.ts 转发。 */
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 siyuanI18n，供 render 模块使用 */
export { siyuanI18n };

/** 用途：动态添加脚本到页面。使用范围：render 模块加载第三方渲染库。解耦评估：通过 imports.ts 转发。 */
import { addScript } from "../util/addScript";
/** 导出 addScript，供 render 模块使用 */
export { addScript };

/** 用途：应用常量。使用范围：render 模块配置项。解耦评估：通过 imports.ts 转发。 */
import { Constants } from "../../constants";
/** 导出 Constants，供 render 模块使用 */
export { Constants };

/** 用途：DOM 工具函数。使用范围：render 模块 DOM 操作。解耦评估：通过 imports.ts 转发。 */
import { hasClosestByTag } from "../util/hasClosest";
/** 导出 hasClosestByTag，供 render 模块使用 */
export { hasClosestByTag };
import { hasClosestBlock } from "../util/hasClosest";
/** 导出 hasClosestBlock，供 render 模块使用 */
export { hasClosestBlock };

/** 用途：DOM 类型守卫。使用范围：render 模块查找元素。解耦评估：通过 imports.ts 转发。 */
import { hasClosestByClassName } from "../util/hasClosest";
/** 导出 hasClosestByClassName，供 render 模块使用 */
export { hasClosestByClassName };
import { hasClosestByAttribute } from "../util/hasClosest";
/** 导出 hasClosestByAttribute，供 render 模块使用 */
export { hasClosestByAttribute };
