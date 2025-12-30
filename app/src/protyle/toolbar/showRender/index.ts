/**
 * showRender 模块统一导出
 */

// 类型导出
export type {
    渲染面板配置,
    渲染面板上下文,
    自动高度上下文
} from "./showRender.types";

// 辅助函数
export {
    确定渲染标题,
    获取文本框初始值,
    检查固定状态
} from "./showRender.utils";

// 模板生成
export { 生成渲染面板HTML } from "./showRender.template";

// 事件处理
export {
    处理头部按钮点击,
    处理文本输入,
    处理键盘事件,
    发射插件打开事件
} from "./showRender.handlers";

// 导出功能
export { 导出为图片 } from "./showRender.export";

// 关闭回调
export { 创建关闭回调 } from "./showRender.closeCB";

// 自动高度
export { 创建自动高度函数 } from "./showRender.autoHeight";
