/** 用途：重导出递归列表转换能力。使用范围：兼容历史导入路径 `transaction/transforms/list`，供 `gutter` 递归转换复用。解耦评估：通过直接重导出保持旧路径可用，避免调用方改为深层路径而增加耦合，且不引入额外依赖。 */
import { turnListsRecursively } from "./list/index";
/** 导出递归列表转换能力，供历史导入路径复用。 */
export { turnListsRecursively };
