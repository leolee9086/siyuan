/**
 * MagiMainPanel 组件类型定义
 *
 * 为主面板组件提供 props、emits 和内部状态的类型约束。
 */

// [TASK] T3.2 迁移主面板组件 - MagiMainPanel类型

import type { ComputedRef, Ref } from "vue";
import type { WrappedSeel } from "../../composables/useMagi.types";
import type { MagiMessage } from "../../utils/messageFactory.types";

/**
 * MagiMainPanel 组件 Props
 *
 * 用途：定义主面板组件的全部输入属性
 * 使用场景：上层容器（如 MagiChat）传入贤者列表和消息
 * 关联类型：WrappedSeel 用于 seels 属性，MagiMessage 用于 messages 属性
 */
export interface MagiMainPanelProps {
    /** 共识消息列表 */
    messages: MagiMessage[];
    /** 所有贤者实例列表 */
    seels: WrappedSeel[];
    /** 是否显示消息面板 */
    showMessages?: boolean;
    /** 是否显示贤者面板 */
    showSeels?: boolean;
    /** 是否显示 Trinity 面板 */
    showTrinity?: boolean;
    /** 面板层输入框绑定值（v-model） */
    inputValue?: string;
    /** 外部汇总的任一贤者加载态（可选，未传时回退本地计算） */
    isAnySeelLoading?: boolean;
}

/**
 * MagiMainPanel 组件 Emits
 *
 * 用途：定义主面板组件的事件类型
 * 使用场景：用户点击面板控制按钮时通知父组件切换显示状态
 */
export interface MagiMainPanelEmits {
    /** 切换消息面板显示 */
    (e: "toggle-messages"): void;
    /** 切换贤者面板显示 */
    (e: "toggle-seels"): void;
    /** 切换 Trinity 面板显示 */
    (e: "toggle-trinity"): void;
    /** 显示适格者问卷 */
    (e: "show-questionnaire"): void;
    /** 输入框绑定值更新 */
    (e: "update:inputValue", value: string): void;
    /** 输入栏提交 */
    (e: "submit-input", value: string): void;
    /** 输入栏停止 */
    (e: "stop-input"): void;
}

/**
 * 连接状态项（用于全局状态显示）
 */
export interface ConnectionStatusItem {
    name: string;
    class: "connected" | "loading" | "disconnected";
}

/**
 * 主面板文案集合
 */
export interface MagiMainPanelTexts {
    realtimePrefixText: string;
    progressPrefixText: string;
    voteStatusPrefixText: string;
    weightText: string;
}

/**
 * useMagiMainPanelContext 参数
 */
export interface UseMagiMainPanelContextParams {
    seels: Ref<WrappedSeel[]>;
    messages: Ref<MagiMessage[]>;
    container: Ref<HTMLElement | null>;
    texts: MagiMainPanelTexts;
}

/**
 * useMagiMainPanelContext 返回值
 */
export interface MagiMainPanelContext {
    connectionStatuses: ComputedRef<ConnectionStatusItem[]>;
    syncRate: ComputedRef<number>;
    getMessageAlign: (type: string) => string;
    getTypeLabel: (type: string) => string;
    formatContent: (msg: MagiMessage) => string;
    hasSystemProgress: (msg: MagiMessage) => boolean;
    getSystemProgress: (msg: MagiMessage) => number;
}

/**
 * 主面板头部组件 Props
 */
export interface MagiMainPanelHeaderProps {
    showMessages: boolean;
    showSeels: boolean;
    showTrinity: boolean;
    personaEntryText: string;
    syncRateText: string;
    syncRate: number;
    connectionStatuses: ConnectionStatusItem[];
}

/**
 * 主面板头部组件 Emits
 */
export interface MagiMainPanelHeaderEmits {
    (e: "show-questionnaire"): void;
    (e: "toggle-messages"): void;
    (e: "toggle-seels"): void;
    (e: "toggle-trinity"): void;
}

/**
 * 消息格式化选项
 */
export interface FormatMessageOptions {
    /** 是否为流式消息 */
    isStream?: boolean;
    /** 进度百分比 */
    progress?: number;
    /** 投票详情 */
    voteDetails?: Array<{
        name: string;
        decision: string;
    }>;
}
