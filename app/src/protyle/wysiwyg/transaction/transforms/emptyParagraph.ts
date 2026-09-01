/** 用途：重导出空段落判空能力。使用范围：兼容历史导入路径 `transaction/transforms/emptyParagraph`，供 `keydown.ts` 等调用方复用。解耦评估：通过直接重导出保持旧路径可用，避免调用方改为深层路径而增加耦合，且不引入额外依赖。 */
import { isEmptyParagraph } from "./emptyParagraph/index";
/** 用途：重导出空段落转换事务。使用范围：兼容历史导入路径 `transaction/transforms/emptyParagraph`，供 `keydown.ts` 等调用方复用。解耦评估：通过直接重导出保持旧路径可用，避免调用方改为深层路径而增加耦合，且不引入额外依赖。 */
import { turnEmptyParagraphsIntoTransaction } from "./emptyParagraph/index";
/** 导出空段落转换能力，供历史导入路径复用。 */
export { isEmptyParagraph, turnEmptyParagraphsIntoTransaction };
