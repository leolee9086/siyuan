/**
 * MagiInputBar 组件类型定义
 */

import type { ComputedRef, WritableComputedRef, Ref } from "vue";

/**
 * MagiInputBar 组件 Props
 */
export interface MagiInputBarProps {
  /** v-model 绑定值 */
  modelValue: string;
  /** 是否处于流式加载中 */
  isLoading: boolean;
  /** 输入框占位文案 */
  placeholder?: string;
}

/**
 * MagiInputBar 组件 Emits
 */
export interface MagiInputBarEmits {
  /** v-model 更新 */
  (e: "update:modelValue", value: string): void;
  /** 提交消息 */
  (e: "submit", value: string): void;
  /** 停止流式响应 */
  (e: "stop"): void;
}

/**
 * MagiInputBar 事件分发函数签名
 *
 * 用途：统一约束输入栏可触发的事件集合。
 * 使用场景：在 `useMagiInputBarContext` 内部发出 update/submit/stop 事件。
 * 关联类型：与 `MagiInputBarEmits` 事件名保持一致。
 */
export type MagiInputBarEmitFn = {
  (e: "update:modelValue", value: string): void;
  (e: "submit", value: string): void;
  (e: "stop"): void;
};

/**
 * useMagiInputBarContext 参数
 *
 * 用途：提供输入栏上下文所需的外部状态与事件分发器。
 * 使用场景：在 `MagiInputBar.vue` setup 阶段装配上下文时传入。
 * 关联类型：`modelValue/isLoading` 为响应式引用，`emit` 使用 `MagiInputBarEmitFn`。
 */
export interface UseMagiInputBarContextParams {
  modelValue: Ref<string>;
  isLoading: Ref<boolean>;
  emit: MagiInputBarEmitFn;
}

/**
 * useMagiInputBarContext 返回值
 */
export interface MagiInputBarContext {
  modelProxy: WritableComputedRef<string>;
  isInputDisabled: ComputedRef<boolean>;
  isButtonDisabled: ComputedRef<boolean>;
  buttonText: ComputedRef<string>;
  buttonAriaLabel: ComputedRef<string>;
  onKeydown: (event: KeyboardEvent) => void;
  onButtonClick: () => void;
}
