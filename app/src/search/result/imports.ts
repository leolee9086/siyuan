/** 用途：判断 CSS Highlight 支持；使用范围：搜索结果标记轮转；解耦评估：直达 Protyle 搜索标记唯一实现。 */
import {isSupportCSSHL} from "../../protyle/render/searchMarkRender";
/** 导出 CSS Highlight 能力判断。 */
export {isSupportCSSHL};

/** 用途：在无文本范围时高亮目标块；使用范围：CSS Highlight 搜索结果轮转；解耦评估：直达通用 DOM 高亮实现。 */
import {highlightById} from "../../util/DOM/highlightById";
/** 导出块高亮。 */
export {highlightById};

/** 用途：将当前文本范围滚动到可视区域；使用范围：CSS Highlight 搜索结果轮转；解耦评估：直达 Search 滚动唯一实现。 */
import {scrollToCurrent} from "../utils/utils.scrollToCurrent";
/** 导出搜索范围滚动。 */
export {scrollToCurrent};

/** 用途：描述搜索预览编辑器完整领域表面；使用范围：结果标记轮转；解耦评估：纯类型直达 Protyle 领域根，不加载具体编辑器实现。 */
import type {ProtyleDomain} from "../../protyle/protyle.types";
/** 导出 Protyle 领域类型。 */
export type {ProtyleDomain};
