/** 用途：反链完整领域根。使用范围：对象块图模型集合。 */
import type {BacklinkDomain} from "./imports";
/** 用途：关系图完整领域根。使用范围：对象块图模型集合。 */
import type {GraphDomain} from "./imports";
/** 用途：大纲完整领域根。使用范围：对象块图模型集合。 */
import type {OutlineDomain} from "./imports";

/** 对象块图相关面板的完整模型集合。 */
export interface ObjectBlockGraphModels {
    outline: OutlineDomain[];
    graph: GraphDomain[];
    backlink: BacklinkDomain[];
}
