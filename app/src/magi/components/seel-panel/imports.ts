/**
 * 用途：统一转发 Vue 核心 API，避免组件直接依赖第三方包
 * 使用范围：seel-panel 目录下所有组件
 * 解耦评估：必须保留，Vue 响应式 API 是组件的核心依赖，无法通过依赖注入解耦
 */
export { computed, ref, type PropType } from "vue";
