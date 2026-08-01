/** 用途：约束宿主创建的标准对话框；使用范围：提示词文档选择；解耦评估：纯类型契约，不加载具体 UI 类。 */
import type {IDialog} from "../../../../../dialog/dialog.types";
/** 用途：转义搜索结果；使用范围：提示词文档选择；解耦评估：纯字符串能力在本子领域网关集中暴露。 */
import {escapeHtml} from "../../../../../util/DOM/escape";
/** 用途：装配统一键盘导航；使用范围：提示词文档选择；解耦评估：复用搜索领域的公开交互函数。 */
import {bindSearchListNavigation} from "../../../../../search/blockPicker/bindSearchListNavigation";
/** 用途：渲染统一文档结果；使用范围：提示词文档选择；解耦评估：复用搜索领域的公开结果视图。 */
import {renderBlockSearchResultItem} from "../../../../../search/blockPicker/renderBlockSearchResultItem";
/** 用途：约束提示词文档；使用范围：对话框选择结果与运行上下文；解耦评估：只依赖父领域数据契约。 */
import type {AgentPromptSourceDocument} from "../AgentPromptSource.types";
/** 用途：约束提示词候选；使用范围：对话框结果投影；解耦评估：只依赖父领域数据契约。 */
import type {AgentPromptSourceDocumentCandidate} from "../AgentPromptSource.types";
/** 用途：调用提示词仓储；使用范围：搜索与候选解析；解耦评估：只依赖父领域完整仓储接口。 */
import type {AgentPromptSourceRepository} from "../AgentPromptSource.types";
/** 用途：复用宿主 Dialog 创建能力；使用范围：提示词选择入口；解耦评估：依赖完整能力聚合，不创建零碎端口。 */
import type {AgentPanelCapabilities} from "../../runtime/agentPanel.ports.types";

/** 导出标准对话框公共契约。 */
export type {IDialog};
/** 导出 HTML 转义能力。 */
export {escapeHtml};
/** 导出搜索键盘导航。 */
export {bindSearchListNavigation};
/** 导出文档结果渲染器。 */
export {renderBlockSearchResultItem};
/** 导出提示词文档契约。 */
export type {AgentPromptSourceDocument};
/** 导出提示词候选契约。 */
export type {AgentPromptSourceDocumentCandidate};
/** 导出提示词仓储契约。 */
export type {AgentPromptSourceRepository};
/** 导出面板完整能力聚合。 */
export type {AgentPanelCapabilities};
