/** 用途：提供菜单运行时契约校验；使用范围：Protyle runtime 守卫；解耦评估：Zod 是项目既有依赖，集中经网关引入便于后续替换。 */
import {z} from "zod";
/** 导出 Zod 命名空间供 runtime 守卫定义 schema。 */
export {z};
