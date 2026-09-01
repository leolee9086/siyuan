/** 独立 bootstrap 的最小依赖网关，避免启动配置加载提前拉入完整 Protyle。 */
/** 用途：加载独立脚本和样式；使用范围：bootstrap 资源阶段；解耦评估：直达 standalone runtime 资源实现。 */
import {loadStandaloneScript, loadStandaloneStyle} from "../standalone-runtime/assets";
/** 导出独立资源加载能力。 */
export {loadStandaloneScript, loadStandaloneStyle};

/** 用途：读取独立 Kernel 配置与语言；使用范围：bootstrap 数据阶段；解耦评估：直达 standalone runtime Kernel 实现。 */
import {fetchStandaloneLanguage, postStandaloneKernel} from "../standalone-runtime/kernel";
/** 导出独立 Kernel 请求能力。 */
export {fetchStandaloneLanguage, postStandaloneKernel};

/** 用途：解析和应用独立主题；使用范围：bootstrap 首帧阶段；解耦评估：直达 standalone runtime 主题实现。 */
import {applyStandaloneThemeAttributes, resolveStandaloneTheme} from "../standalone-runtime/theme";
/** 导出独立主题能力。 */
export {applyStandaloneThemeAttributes, resolveStandaloneTheme};

/** 用途：合并独立入口启动 Promise；使用范围：bootstrap 生命周期；解耦评估：直达 standalone runtime 缓存实现。 */
import {bootstrapStandaloneOnce} from "../standalone-runtime/bootstrap";
/** 导出独立启动缓存能力。 */
export {bootstrapStandaloneOnce};
