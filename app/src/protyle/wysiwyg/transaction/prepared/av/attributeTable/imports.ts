/** 用途：提交已校验的 Prepared Transaction；使用范围：Attribute Table 严格命令；解耦评估：直达 Prepared 内核唯一实现。 */
import {submitPreparedTransaction} from "../../submit";
/** 导出 Prepared Transaction 内核。 */
export {submitPreparedTransaction};
/** 用途：Prepared Transaction 完整提交类型；使用范围：构造可选 undo/回调；解耦评估：直达纯类型声明。 */
import type {PreparedTransactionCommit} from "../../prepared.types";
/** 导出 Prepared Transaction 完整提交类型。 */
export type {PreparedTransactionCommit};
