/** 用途：提交已校验的 Groups Prepared Transaction；使用范围：Groups 严格命令；解耦评估：直达 Prepared 内核唯一实现，不经其它 imports 网关。 */
import {submitPreparedTransaction} from "../../submit";
/** 导出 Prepared Transaction 内核。 */
export {submitPreparedTransaction};
