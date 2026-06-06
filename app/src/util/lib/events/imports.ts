/** 用途：Zod 运行时校验库的转发导出。使用范围：eventEmitter 模块的类型守卫和运行时校验。解耦评估：通过 imports.ts 统一管理第三方依赖，便于替换实现。 */
import { z } from "zod";
/** 导出 z 供 eventEmitter 模块内使用 */
export { z };
