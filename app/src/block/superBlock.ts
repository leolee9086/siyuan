/** 用途：重导出超级块生成能力。使用范围：兼容历史导入路径 `from "../block/superBlock"`，供事务转换等调用方复用。解耦评估：通过直接重导出保持旧路径可用，避免调用方改为深层路径而增加耦合，且不引入额外依赖。 */
import { genSBElement } from "./superBlock/index";
/** 用途：重导出超级块手柄刷新能力。使用范围：兼容历史导入路径 `from "../block/superBlock"`，供事务转换等调用方复用。解耦评估：通过直接重导出保持旧路径可用，避免调用方改为深层路径而增加耦合，且不引入额外依赖。 */
import { refreshSbResize } from "./superBlock/index";
/** 用途：重导出超级块宽度持久化能力。使用范围：兼容历史导入路径 `from "../block/superBlock"`，供事务转换等调用方复用。解耦评估：通过直接重导出保持旧路径可用，避免调用方改为深层路径而增加耦合，且不引入额外依赖。 */
import { refreshSbAndPersistWidth } from "./superBlock/index";
/** 用途：重导出超级块宽度重平衡能力。使用范围：兼容历史导入路径 `from "../block/superBlock"`，供事务转换等调用方复用。解耦评估：通过直接重导出保持旧路径可用，避免调用方改为深层路径而增加耦合，且不引入额外依赖。 */
import { rebalanceSbWidth } from "./superBlock/index";
/** 用途：重导出超级块子块计数能力。使用范围：兼容历史导入路径 `from "../block/superBlock"`，供事务转换等调用方复用。解耦评估：通过直接重导出保持旧路径可用，避免调用方改为深层路径而增加耦合，且不引入额外依赖。 */
import { getSbChildCount } from "./superBlock/index";
/** 导出超级块主实现，供历史导入路径复用。 */
export {genSBElement, refreshSbResize, refreshSbAndPersistWidth, rebalanceSbWidth, getSbChildCount};
export {getHorizontalSuperBlockChild} from "./superBlock/horizontalChild";
