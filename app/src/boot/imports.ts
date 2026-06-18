/** 用途：网络请求工具（POST）。使用范围：boot 模块调用后端 API。解耦评估：通过 imports.ts 转发。 */
import { fetchPost } from "../util/network/fetch";
/** 导出 fetchPost，供 boot 模块使用 */
export { fetchPost };

/** 用途：Dialog 对话框组件。使用范围：boot 模块打开更新日志对话框。解耦评估：通过 imports.ts 转发。 */
import { Dialog } from "../dialog";
/** 导出 Dialog，供 boot 模块使用 */
export { Dialog };

/** 用途：代码高亮渲染器。使用范围：boot 模块对更新日志内容进行高亮渲染。解耦评估：通过 imports.ts 转发。 */
import { highlightRender } from "../protyle/render/highlightRender";
/** 导出 highlightRender，供 boot 模块使用 */
export { highlightRender };

/** 用途：平台判断工具（是否为移动端）。使用范围：boot 模块适配移动端/桌面端 UI。解耦评估：通过 imports.ts 转发。 */
import { isMobile } from "../util/platform/functions";
/** 导出 isMobile，供 boot 模块使用 */
export { isMobile };

/** 用途：全局常量定义。使用范围：boot 模块使用 DIALOG_CHANGELOG 等常量。解耦评估：通过 imports.ts 转发。 */
import { Constants } from "../constants";
/** 导出 Constants，供 boot 模块使用 */
export { Constants };

/** 用途：国际化文案。使用范围：boot 模块使用更新日志相关文案。解耦评估：通过 imports.ts 转发。 */
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 siyuanI18n，供 boot 模块使用 */
export { siyuanI18n };

/** 用途：安全获取 SiYuan 全局配置。使用范围：boot 模块读取系统配置（如 kernelVersion）。解耦评估：通过 imports.ts 转发。 */
import { getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSiyuanConfig，供 boot 模块使用 */
export { getSiyuanConfig };
