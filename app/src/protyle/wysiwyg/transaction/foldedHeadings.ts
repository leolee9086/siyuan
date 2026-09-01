/** 用途：重导出折叠标题展开能力。使用范围：兼容历史导入路径 `transaction/foldedHeadings`，供 `turns` 相关转换复用。解耦评估：通过直接重导出保持旧路径可用，避免调用方改为深层路径而增加耦合，且不引入额外依赖。 */
import { unfoldListHeadings } from "./foldedHeadings/index";
/** 导出折叠标题展开能力，供历史导入路径复用。 */
export { unfoldListHeadings };
