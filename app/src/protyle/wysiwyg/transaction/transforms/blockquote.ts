/** 用途：重导出空引述插入能力。使用范围：兼容历史导入路径 `transaction/transforms/blockquote`，供 `input.ts` 等调用方复用。解耦评估：通过直接重导出保持旧路径可用，避免调用方改为深层路径而增加耦合，且不引入额外依赖。 */
import { insertEmptyBlockquote } from "./blockquote/index";
/** 用途：重导出引述包裹能力。使用范围：兼容历史导入路径 `transaction/transforms/blockquote`，供 `input.ts` 等调用方复用。解耦评估：通过直接重导出保持旧路径可用，避免调用方改为深层路径而增加耦合，且不引入额外依赖。 */
import { wrapBlockInBlockquote } from "./blockquote/index";
/** 导出引述转换能力，供历史导入路径复用。 */
export { insertEmptyBlockquote, wrapBlockInBlockquote };
