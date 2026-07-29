/** 用途：读取空标题属性键；使用范围：文档信息响应转为重命名参数；解耦评估：稳定协议常量应直达声明，参数注入会使调用方重复理解内核字段。 */
import {Constants} from "../../../constants";
/** 用途：执行既有重命名命令；使用范围：菜单点击后的唯一业务动作；解耦评估：该子域负责组装命令，事件转发会隐藏调用顺序和错误传播。 */
import {rename} from "../../../editor/rename";
/** 用途：请求文档标题属性；使用范围：文件重命名前的信息读取；解耦评估：沿用当前网络协议实现以保持回调时序，不把基础设施函数暴露为菜单参数。 */
import {fetchPost} from "../../../util/network/fetch";
/** 用途：识别加密笔记本上下文；使用范围：决定文档信息请求是否携带 notebook；解耦评估：当前真实声明承载全局笔记本状态，参数化会把状态判定泄露给全部菜单调用方。 */
import {isEncryptedBox} from "../../../util/pathName";
/** 用途：严格读取应用配置与语言；使用范围：同步菜单描述；解耦评估：现有 getter 读取同一全局状态并在缺失时显式失败，避免调用方注入重复状态。 */
import {getSiyuanConfig, getSiyuanLanguages} from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 用途：生成现有菜单 DOM；使用范围：重命名菜单同步构建；解耦评估：MenuItem 是菜单领域的唯一渲染实现，本子域无需另建渲染接口。 */
import {MenuItem} from "../../Menu";

/** 导出空标题协议键。 */
export {Constants};
/** 导出当前网络请求实现。 */
export {fetchPost};
/** 导出严格配置读取。 */
export {getSiyuanConfig};
/** 导出严格语言读取。 */
export {getSiyuanLanguages};
/** 导出加密笔记本判定。 */
export {isEncryptedBox};
/** 导出菜单项实现。 */
export {MenuItem};
/** 导出重命名命令。 */
export {rename};
