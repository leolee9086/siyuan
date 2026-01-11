/**
 * TabRegistry.types.ts - Tab 注册表类型定义
 */

import { Custom } from "../dock/Custom";

/**
 * Tab 注册信息
 */
export interface TabRegistration {
    /** 唯一类型标识 */
    type: string;
    /** 初始化函数 */
    init: (model: Custom) => void;
    /** 销毁回调 */
    destroy?: () => void;
    /** 销毁前回调 */
    beforeDestroy?: () => void;
    /** 调整大小回调 */
    resize?: () => void;
    /** 更新回调 */
    update?: () => void;
}
