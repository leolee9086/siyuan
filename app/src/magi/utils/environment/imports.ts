/** 用途：转发 MAGI 环境层依赖。使用范围：同目录入口环境初始化。解耦评估：集中收口跨目录环境能力，避免入口文件直接依赖上层路径。 */
import { loadForgeI18n } from "../../../util/siyuanEnvironments/forgeI18n.getI18n.environment";
/** 用途：转发独立入口的 Kernel 请求能力。使用范围：MAGI 启动配置读取。解耦评估：请求协议属于环境边界，由网关集中依赖共享实现。 */
import {postStandaloneKernel} from "../../../standalone-runtime/kernel";
/** 用途：转发独立入口的主题解析能力。使用范围：MAGI 根主题初始化。解耦评估：纯配置解析和 DOM 属性映射无需注入宿主状态。 */
import {applyStandaloneThemeAttributes, resolveStandaloneTheme} from "../../../standalone-runtime/theme";

/** 用途：导出国际化加载能力。使用范围：MAGI 独立入口初始化。解耦评估：入口只依赖环境层稳定接口，不直接感知底层实现路径。 */
export { loadForgeI18n };
/** 用途：导出共享 Kernel 请求。使用范围：MAGI 环境启动流程。解耦评估：调用方只依赖本层环境网关。 */
export {postStandaloneKernel};
/** 用途：导出共享主题属性映射。使用范围：MAGI 主题加载流程。解耦评估：调用方只依赖本层环境网关。 */
export {applyStandaloneThemeAttributes};
/** 用途：导出共享主题选择。使用范围：MAGI 主题加载流程。解耦评估：调用方只依赖本层环境网关。 */
export {resolveStandaloneTheme};
