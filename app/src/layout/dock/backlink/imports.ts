/**
 * 用途：集中转发反链状态路由所需的 CaliburRouter Zod 后端。
 * 使用范围：仅供 backlink 目录内的声明式键盘和工具栏路由使用，不承担状态收集、模型创建或副作用执行。
 * 解耦评估：第三方包路径属于路由基础设施边界；通过同层网关隐藏包路径，但保留原始 zodCalibur/zodState 能力，不复制或削弱状态空间语义。
 */
import {zodCalibur} from "calibur-router/zod";
/** 用途：取得 Zod 状态定义构建器。使用范围：反链状态空间 Schema。解耦评估：保持第三方原始能力，只通过网关收口包路径。 */
import {zodState} from "calibur-router/zod";
/** 导出原始 CaliburRouter Zod 构建器，供反链路由声明使用。 */
export {zodCalibur};
/** 导出原始 Zod 状态构建器，供反链路由声明使用。 */
export {zodState};
