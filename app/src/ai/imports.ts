/**
 * AI模块的跨文件夹导入统一管理文件
 * 根据ts文件规则，所有跨文件夹的导入都应该通过此文件进行
 */

// 常量导入
export { Constants } from "../constants";

// 对话框相关导入
export { Dialog } from "../dialog";

// Vue工具相关导入
export type { VueComponentMountConfig } from "../util/vue/mount.types";
export { createVueDialog } from "../util/vue/createVueDialog";

// 组件导入
export { default as AiCustomDialog } from "../components/aiCustomDialog.panel.vue";
export { default as AiEditDialog } from "../components/aiEditDialog.vue";

// 数据存储相关导入
export { saveCustomAIAction } from "../data/localStorage";
export { kernelClient } from "../data/kernelSDK";

// 存储工具相关导入
export { setStorageVal } from "../protyle/util/compatibility";
// 功能开关：判断特性是否被禁用（上游 v3.8.0 引入，供 AI 菜单入口守卫使用）
export { isDisabledFeature } from "../protyle/util/compatibility";

/**
 * 用途：获取siyuan存储对象，用于操作本地存储中的AI动作配置
 * 使用范围：AI动作配置的读取、写入和持久化
 * 解耦评估：通过imports.ts统一转发，避免直接依赖siyuan环境
 */
export { getSiyuanStorage } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
/**
 * 用途：获取siyuan国际化文本，用于对话框标题等UI文本
 * 使用范围：AI对话框的UI标题
 * 解耦评估：通过imports.ts统一转发，避免直接依赖siyuan环境
 */
export { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";

// 渲染相关导入
export { blockRender } from "../protyle/render/blockRender";
export { highlightRender } from "../protyle/render/highlightRender";
export { insertHTML } from "../protyle/util/insertHTML";
export { contentRendererRegistry } from "../registry/contentRenderer/ContentRendererRegistry";
export { setLastNodeRange } from "../protyle/util/selection";
export { getContenteditableElement } from "../protyle/wysiwyg/getBlock";

// DOM工具相关导入
export { switchFnNoneByFlag } from "../util/DOM/helpers/fnClasses";
export { createBlockMasks } from "../util/DOM/helpers/blockDecorations";

// 工具函数相关导入
export { isMobile } from "../util/platform/functions";
export { genUUID } from "../util/platform/genID";
export { genRandomColor } from "../util/assets/color";

// 组件相关导入
export { default as AIChatDialog } from "../components/StreamChat.panel.vue";

// 业务逻辑相关导入
export { selectRecentDoc } from "../business/selectRecentDoc";

// 对话框相关导入
export { showMessage } from "../dialog/message";

// 插件相关导入
export { Menu } from "../plugin/Menu";

// 网络请求相关导入
export { fetchPost } from "../util/network/fetch";

// 编辑器工具相关导入
export { focusByRange } from "../protyle/util/selection";
export { escapeAriaLabel, escapeAttr, escapeHtml } from "../util/DOM/escape";
export { upDownHint } from "../util/DOM/upDownHint";
export { getElementsBlockId } from "../util/DOM/helpers/blockLikeElements";

/**
 * 用途：提交ModelScope文生图任务
 * 使用范围：AI图片生成功能
 * 解耦评估：直接使用API客户端，无需解耦
 */
import { 提交生成任务 } from "../apis/modelscope/client";
// 导出ModelScope任务提交函数
export { 提交生成任务 };

/**
 * 用途：轮询ModelScope任务状态
 * 使用范围：AI图片生成功能
 * 解耦评估：直接使用API客户端，无需解耦
 */
import { 轮询任务直到完成 } from "../apis/modelscope/client";
// 导出ModelScope任务轮询函数
export { 轮询任务直到完成 };

/**
 * 用途：获取ModelScope生成的图片
 * 使用范围：AI图片生成功能
 * 解耦评估：直接使用API客户端，无需解耦
 */
import { 获取图片 } from "../apis/modelscope/client";
// 导出ModelScope图片获取函数
export { 获取图片 };

/**
 * 用途：从ModelScope响应提取图片URL
 * 使用范围：AI图片生成功能
 * 解耦评估：直接使用API客户端，无需解耦
 */
import { 提取图片URL } from "../apis/modelscope/client";
// 导出ModelScope图片URL提取函数
export { 提取图片URL };

/**
 * 用途：ModelScope认证数据类型
 * 使用范围：AI图片生成的认证参数
 * 解耦评估：类型定义，无需解耦
 */
import type { ModelScopeAuthData } from "../apis/modelscope/types";
// 导出ModelScope认证数据类型
export type { ModelScopeAuthData };

/**
 * 用途：生成块内容图片的参数类型
 * 使用范围：AI图片生成函数参数
 * 解耦评估：类型定义，从调用方模块导入
 */
import type { 生成块内容图片参数 } from "../protyle/gutter/gutter.types";
// 导出生成块内容图片参数类型
export type { 生成块内容图片参数 };
