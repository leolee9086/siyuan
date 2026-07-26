/** 用途：校验 AV 标题长度；使用范围：标题输入提交前；解耦评估：直达稳定全局常量。 */
import {Constants} from "../../../../../constants";
/** 用途：生成块更新时间；使用范围：标题事务与 DOM 属性；解耦评估：直接使用共享时间格式实现。 */
import * as dayjs from "dayjs";
/** 用途：提示标题超长；使用范围：标题校验失败分支；解耦评估：直达 Protyle 消息端口。 */
import {showMessage} from "../../../../runtime/dialog.port";
/** 用途：读取标题长度错误文案；使用范围：校验反馈；解耦评估：直达运行时 i18n 访问器。 */
import {siyuanI18n} from "../../../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 用途：收窄标题和同页实例节点；使用范围：标题 DOM 同步；解耦评估：直达通用元素守卫。 */
import {isHTMLElement} from "../../../../../util/DOM/element.guard";
/** 用途：提交封闭标题事务；使用范围：标题实际变化分支；解耦评估：直达 AV Name Prepared 命令。 */
import {submitAVNameTransaction} from "../../../../wysiwyg/transaction/prepared/avName";

/** 导出标题长度常量。 */
export {Constants};
/** 导出时间格式实现。 */
export {dayjs};
/** 导出消息端口。 */
export {showMessage};
/** 导出运行时文案。 */
export {siyuanI18n};
/** 导出 HTMLElement 守卫。 */
export {isHTMLElement};
/** 导出严格 AV 标题命令。 */
export {submitAVNameTransaction};
