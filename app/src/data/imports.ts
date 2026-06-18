// 跨目录依赖转发
/** 用途：应用常量定义。使用范围：data 模块本地存储。解耦评估：通过 imports.ts 转发。 */
import { Constants } from "../constants";
/** 导出 Constants，供 data 模块使用 */
export { Constants };

/** 用途：本地存储写入工具。使用范围：data 模块持久化 AI 动作。解耦评估：通过 imports.ts 转发。 */
import { setStorageVal } from "../protyle/util/compatibility";
/** 导出 setStorageVal，供 data 模块使用 */
export { setStorageVal };
