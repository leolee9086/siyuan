/** 用途：全局常量配置的转发导出。使用范围：protyle/ui 模块内各子模块。解耦评估：通过 imports.ts 统一管理父级依赖，便于追踪和重构。 */
import { Constants } from "../../constants";
/** 导出 Constants 供 protyle/ui 子模块使用 */
export { Constants };
