/** 用途：把 Range 内联 DOM 转换为内核规范文本。使用范围：内容转换请求；解耦评估：直接转发唯一网络实现，不经过其它 imports 网关。 */
import {fetchPost} from "../../../../util/network/fetch";
/** 导出网络请求实现，供内容转换子域使用。 */
export {fetchPost};
