/** 用途：提交已完成调用域本地呈现决策的事务；使用范围：严格 AV View 命令；解耦评估：直达 Prepared Transaction 唯一实现。 */
import {submitPreparedTransaction} from "../prepared/submit";
/** 导出 Prepared Transaction 提交。 */
export {submitPreparedTransaction};
