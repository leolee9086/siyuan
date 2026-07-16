/** 用途：转发 MAGI 环境层依赖。使用范围：同目录入口环境初始化。解耦评估：集中收口跨目录环境能力，避免入口文件直接依赖上层路径。 */
import { loadForgeI18n } from "../../../util/siyuanEnvironments/forgeI18n.getI18n.environment";

/** 用途：导出国际化加载能力。使用范围：MAGI 独立入口初始化。解耦评估：入口只依赖环境层稳定接口，不直接感知底层实现路径。 */
export { loadForgeI18n };
