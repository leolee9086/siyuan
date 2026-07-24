/** 用途：Profile 文件读写。使用范围：ProfileManager 持久化命名空间配置。解耦评估：直达网络基础设施。 */
import {fetchSyncPost, fetchSyncPostRaw} from "../../util/network/fetch";
/** 用途：Profile 身份生成。使用范围：创建新的 Profile。解耦评估：直达 ID 基础设施。 */
import {genUUID} from "../../util/platform/genID";

/** Profile 标准存储请求能力。 */
export {fetchSyncPost};
/** Profile 原始响应读取能力。 */
export {fetchSyncPostRaw};
/** Profile 身份生成能力。 */
export {genUUID};
