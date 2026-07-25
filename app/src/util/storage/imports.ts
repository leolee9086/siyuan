/** 用途：提供应用 ID。使用范围：storage 子域的本地配置请求。解耦评估：协议常量是稳定请求字段，不适合由每个调用方重复传入。 */
import {Constants} from "../../constants";
/** 导出协议常量，供 storage 子域使用。 */
export {Constants};

/** 用途：发送存储请求。使用范围：storage 子域的唯一持久化实现。解耦评估：网络基础设施属于存储实现的必要依赖，调用方只依赖存储动作。 */
import {fetchPost} from "../network/fetch";
/** 导出网络请求实现，供 storage 子域使用。 */
export {fetchPost};
