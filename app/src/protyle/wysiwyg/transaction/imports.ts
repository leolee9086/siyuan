/** 用途：创建空块。使用范围：删除最后一个顶层块后的编辑器恢复。解耦评估：直达 block element 唯一工厂。 */
import {genEmptyElement} from "../../../block/element.factory";
/** 导出空块工厂。 */
export {genEmptyElement};

/** 用途：访问事务应用 ID 与编辑属性名。使用范围：无编辑器提交和更新标记。解耦评估：常量是稳定基础协议。 */
import {Constants} from "../../../constants";
/** 导出全局常量。 */
export {Constants};

/** 用途：收窄批量事务中的 HTML 元素。使用范围：批量更新回调边界。解耦评估：直达共享 DOM 守卫，避免断言。 */
import {isHTMLElement} from "../../../util/DOM/element.guard";
/** 导出 HTML 元素守卫。 */
export {isHTMLElement};

/** 用途：提交事务网络请求。使用范围：无 Protyle 的直接内核提交。解耦评估：直达网络唯一实现。 */
import {fetchPost} from "../../../util/network/fetch";
/** 导出 POST 请求。 */
export {fetchPost};

/** 用途：定位需要删除的顶层块。使用范围：跨文档移动清理。解耦评估：直达 WYSIWYG 块查询唯一实现。 */
import {getTopAloneElement} from "../getBlock";
/** 导出顶层块查询。 */
export {getTopAloneElement};

/** 用途：执行本地 DOM 同步并排队提交。使用范围：事务命令主流程。解耦评估：当前真实实现，后续按专项 TTT 拆分内部职责。 */
import {promiseTransaction} from "../transaction.promise";
/** 导出本地同步事务实现。 */
export {promiseTransaction};
