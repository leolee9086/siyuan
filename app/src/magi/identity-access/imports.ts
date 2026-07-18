/** 用途：思源基础样式；使用范围：独立 Identity Access 页面；解耦评估：仅入口需要主动加载。 */
import "../../assets/scss/base.scss";
/** 用途：独立页面环境初始化；使用范围：standalone.ts；解耦评估：复用 MAGI 环境适配层。 */
import { bootstrapMagiSiyuan } from "../utils/environment/magiEntry.environment";

/** 独立 Identity Access 入口的环境初始化能力。 */
export { bootstrapMagiSiyuan };
