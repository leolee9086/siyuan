/** 用途：搜索布局存储键；使用范围：预览编辑器初始化；解耦评估：直达稳定静态值。 */
import {Constants} from "../../../constants";
/** 导出搜索常量。 */
export {Constants};

/** 用途：完整应用外观；使用范围：创建搜索预览 Protyle；解耦评估：纯类型直达领域根，不加载具体 App。 */
import type {AppFacade} from "../../../app/AppFacade.types";
/** 导出应用外观。 */
export type {AppFacade};

/** 用途：完整 Protyle 领域根；使用范围：搜索编辑器布局；解耦评估：纯类型直达领域根，不加载具体实现。 */
import type {ProtyleDomain} from "../../../protyle/protyle.types";
/** 导出 Protyle 领域根。 */
export type {ProtyleDomain};

/** 用途：读取已初始化的搜索布局状态；使用范围：编辑器尺寸恢复；解耦评估：直达严格环境访问器。 */
import {getSiyuanStorage} from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出严格 storage 访问器。 */
export {getSiyuanStorage};
