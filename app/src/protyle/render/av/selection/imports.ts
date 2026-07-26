/** 用途：定位当前 AV block。使用范围：选择头同步；解耦评估：直达稳定 DOM 查询唯一实现，不经父级网关。 */
import {hasClosestBlock} from "../../../util/hasClosest";
/** 导出 AV block 定位能力。 */
export {hasClosestBlock};

/** 用途：读取虚拟滚动选择统计。使用范围：被裁剪行的真实选择计数；解耦评估：直达统一状态所有者，不加载裁剪引擎或 Row。 */
import {getAVSelectStat} from "../virtualScroll/state";
/** 导出虚拟选择统计。 */
export {getAVSelectStat};

/** 用途：读取稳定国际化文案。使用范围：选择计数器；解耦评估：直达环境访问器，避免子域自行处理可选全局配置。 */
import {siyuanI18n} from "../../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出稳定国际化文案。 */
export {siyuanI18n};
