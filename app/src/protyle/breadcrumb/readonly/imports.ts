/** 用途：读取只读配置；使用范围：切换编辑器锁定；解耦评估：直达环境访问器。 */
import {getSiyuanConfig} from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出配置读取。 */
export {getSiyuanConfig};
/** 用途：内核 POST 请求；使用范围：更新文档只读状态；解耦评估：直达唯一网络实现。 */
import {fetchPost} from "../../../util/network/fetch";
/** 导出网络请求。 */
export {fetchPost};
/** 用途：禁用编辑器；使用范围：只读切换完成；解耦评估：直达唯一 Protyle 行为。 */
import {disabledProtyle} from "../../util/onGet";
/** 导出编辑器禁用。 */
export {disabledProtyle};
/** 用途：启用编辑器；使用范围：只读切换完成；解耦评估：直达唯一 Protyle 行为。 */
import {enableProtyle} from "../../util/onGet";
/** 导出编辑器启用。 */
export {enableProtyle};
/** 用途：自定义只读属性常量；使用范围：内核属性写入；解耦评估：静态值属于只读领域协议。 */
import {Constants} from "../../../constants";
/** 导出应用常量。 */
export {Constants};
