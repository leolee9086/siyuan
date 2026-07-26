/** 用途：创建空块。使用范围：删除最后一个顶层块后的恢复。解耦评估：直达 block element 唯一工厂。 */
import {genEmptyElement} from "../../../../block/element.factory";
/** 导出空块工厂。 */
export {genEmptyElement};

/** 用途：定位顶层块。使用范围：跨文档移动清理。解耦评估：直达 WYSIWYG 块查询唯一实现。 */
import {getTopAloneElement} from "../../getBlock";
/** 导出顶层块查询。 */
export {getTopAloneElement};

/** 用途：验证块与操作身份。使用范围：空编辑器恢复和顶层删除。解耦评估：直达事务身份唯一规则。 */
import {requireTransactionIdentity} from "../identity";
/** 导出事务身份验证。 */
export {requireTransactionIdentity};
