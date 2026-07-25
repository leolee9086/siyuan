/** 用途：大纲完整领域根。使用范围：对象块图面板重置。解耦评估：只转发类型，不加载 Outline class。 */
import type {OutlineDomain} from "../outline/types";
/** 用途：关系图完整领域根。使用范围：对象块图面板重置。解耦评估：只转发类型，不加载 Graph class。 */
import type {GraphDomain} from "../graph/graph.types";
/** 用途：反链完整领域根。使用范围：对象块图面板重置。解耦评估：只转发类型，不加载 Backlink class。 */
import type {BacklinkDomain} from "../backlink/backlink.types";

/** 导出反链完整领域根。 */
export type {BacklinkDomain};
/** 导出关系图完整领域根。 */
export type {GraphDomain};
/** 导出大纲完整领域根。 */
export type {OutlineDomain};
