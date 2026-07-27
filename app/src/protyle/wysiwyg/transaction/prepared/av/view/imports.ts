/** 用途：提交已完成本地视图条件状态更新的事务；使用范围：Filter/Sort 严格命令；解耦评估：直达 Prepared 唯一提交内核，不经过其他 imports.ts。 */
import {submitPreparedTransaction} from "../../submit";
/** 导出 Prepared 唯一提交内核 */
export {submitPreparedTransaction};
