/** 用途：创建标准解锁对话框；使用范围：加密笔记本访问组合边界；解耦评估：具体类仅在 factory 中实例化。 */
import {Dialog} from "../../../../dialog";
/** 导出具体 Dialog 供访问工厂实例化。 */
export {Dialog};
/** 用途：描述完整对话框实例；使用范围：解锁提交生命周期；解耦评估：完整抽象由双向契约校验。 */
import type {IDialog} from "../../../../dialog/dialog.types";
/** 导出完整 Dialog 抽象供行为依赖。 */
export type {IDialog};
/** 用途：执行原子解锁与挂载请求；使用范围：加密笔记本访问提交；解耦评估：网关直达网络唯一实现。 */
import {fetchSyncPost} from "../../../network/fetch";
/** 导出等待响应的网络请求能力。 */
export {fetchSyncPost};
/** 用途：判定移动布局；使用范围：解锁对话框尺寸；解耦评估：网关直达平台环境入口。 */
import {isMobile} from "../../../platform/functions";
/** 导出移动平台判断。 */
export {isMobile};
/** 用途：严格读取真实语言表；使用范围：解锁对话框文案；解耦评估：网关直达环境唯一入口。 */
import {getSiyuanLanguages} from "../../../siyuanEnvironments/getSiyuanConfig.environment";
/** 导出严格语言表访问器。 */
export {getSiyuanLanguages};
/** 用途：编码对话框标题的动态笔记本名；使用范围：加密笔记本访问。 */
import {escapeHtml} from "../../../DOM/escape";
/** 导出 HTML 文本编码器。 */
export {escapeHtml};
