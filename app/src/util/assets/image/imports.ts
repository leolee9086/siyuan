/** 用途：图片资源上传请求。使用范围：base64 图片持久化。解耦评估：直达网络基础设施。 */
import {fetchSyncPost} from "../../network/fetch";
/** 用途：图片上传地址。使用范围：base64 图片持久化。解耦评估：直达公共常量。 */
import {Constants} from "../../../constants";

/** 图片资源同步请求能力。 */
export {fetchSyncPost};
/** 图片上传公共常量。 */
export {Constants};
