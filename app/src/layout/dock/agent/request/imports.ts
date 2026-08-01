/** 用途：读取当前工作空间 API token；使用范围：Agent 请求头；解耦评估：动态配置必须在请求边界读取。 */
import {getSafeSiyuanConfig} from "../../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 用途：取得当前应用实例标识；使用范围：Agent 广播去重和检查点协议；解耦评估：这是静态协议值，由请求网关集中读取比逐调用注入更明确。 */
import {Constants} from "../../../../constants";

/** 导出工作空间配置读取器。 */
export {getSafeSiyuanConfig};
/** 导出应用常量。 */
export {Constants};
