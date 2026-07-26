/** 用途：构建目标平台常量；使用范围：事务开始时判断移动端同步指示器；解耦评估：直达平台真实声明。 */
import {isMobile} from "../../../../platform";
/** 导出移动端构建标记。 */
export {isMobile};

/** 用途：读取付费与订阅状态；使用范围：判断当前同步提供方是否具备运行条件；解耦评估：直达账号能力唯一实现。 */
import {isPaidUser, needSubscribe} from "../../../../util/platform/needSubscribe";
/** 导出付费状态判断。 */
export {isPaidUser};
/** 导出订阅需求判断。 */
export {needSubscribe};
