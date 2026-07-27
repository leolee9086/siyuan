/** 用途：创建标准对话框；使用范围：加密笔记本创建组合边界；解耦评估：具体类只在初始化边界使用。 */
import {Dialog} from "../../../../dialog";
/** 导出具体 Dialog 供创建组合边界实例化。 */
export {Dialog};
/** 用途：描述完整对话框实例；使用范围：加密提交生命周期；解耦评估：完整抽象由双向契约校验。 */
import type {IDialog} from "../../../../dialog/dialog.types";
/** 导出完整 Dialog 抽象供内部行为依赖。 */
export type {IDialog};
/** 用途：显示加密能力及口令错误提示；使用范围：加密笔记本创建流程；解耦评估：网关直达通知唯一实现。 */
import {showMessage} from "../../../../dialog/message";
/** 导出通知能力。 */
export {showMessage};
/** 用途：校验并规范笔记本名称；使用范围：提交加密创建请求；解耦评估：网关直达名称规则唯一实现。 */
import {replaceFileName, validateName} from "../../../../editor/rename";
/** 导出名称规则能力。 */
export {replaceFileName};
/** 导出名称合法性校验。 */
export {validateName};
/** 用途：发送状态检查与原子创建请求；使用范围：加密笔记本创建流程；解耦评估：网关直达网络唯一实现。 */
import {fetchPost, fetchSyncPost} from "../../../network/fetch";
/** 导出状态检查与原子创建请求能力。 */
export {fetchPost};
/** 导出等待响应的原子创建请求能力。 */
export {fetchSyncPost};
/** 用途：判断移动布局；使用范围：创建对话框宽度；解耦评估：网关直达平台环境入口。 */
import {isMobile} from "../../../platform/functions";
/** 导出移动平台判断。 */
export {isMobile};
/** 用途：严格读取当前语言表；使用范围：加密笔记本创建流程；解耦评估：网关直达环境唯一入口。 */
import {getSiyuanLanguages} from "../../../siyuanEnvironments/getSiyuanConfig.environment";
/** 导出严格语言表访问器。 */
export {getSiyuanLanguages};
