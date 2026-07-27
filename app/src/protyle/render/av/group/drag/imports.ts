/** 用途：提交分组拖拽排序事务；使用范围：Panel drag 分组分支；解耦评估：直达 Groups Prepared 命令，不加载通用事务主图。 */
import {submitAVGroupTransaction} from "../../../../wysiwyg/transaction/prepared/av/group/avGroup";
/** 导出 Groups 严格命令。 */
export {submitAVGroupTransaction};
