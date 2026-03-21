/** 用途：复用统一的内核 POST 请求封装；使用范围：MAGI service 层访问工作空间接口时使用；解耦评估：这是 service 层和内核通信的底层基础设施，当前无法通过参数注入在不增加样板代码的前提下合理解耦。 */
import { fetchSyncPost } from "../../util/network/fetch";

/** 用途：为同目录 service 文件集中转发 fetchSyncPost，避免跨层级直接导入。 */
export { fetchSyncPost };
