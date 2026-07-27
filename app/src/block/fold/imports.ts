/** 用途：内核 POST 请求；使用范围：块折叠状态查询；解耦评估：直达唯一网络实现。 */
import {fetchPost} from "../../util/network/fetch";
/** 用途：编辑器块导航动作常量；使用范围：折叠状态到打开动作的稳定映射；解耦评估：静态值属于查询结果语义。 */
import {Constants} from "../../constants";

/** 导出块折叠查询依赖的网络实现。 */
export {fetchPost};
/** 导出块导航动作常量。 */
export {Constants};
