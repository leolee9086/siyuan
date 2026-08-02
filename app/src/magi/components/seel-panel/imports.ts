/**
 * 用途：统一转发 Vue 核心 API，避免组件直接依赖第三方包
 * 使用范围：seel-panel 目录下所有组件
 * 解耦评估：必须保留，Vue 响应式 API 是组件的核心依赖，无法通过依赖注入解耦
 */
/** 用途：创建派生状态。使用范围：seel-panel 全部逻辑文件的 computed 计算。解耦评估：Vue 核心响应式 API，组件运行基础，无法解耦。 */
import { computed } from "vue";
/** 用途：注册挂载生命周期。使用范围：卡片高度观察器注册。解耦评估：Vue 核心响应式 API，组件运行基础，无法解耦。 */
import { onMounted } from "vue";
/** 用途：注册清理生命周期。使用范围：观察器和计时器释放。解耦评估：Vue 核心响应式 API，组件运行基础，无法解耦。 */
import { onUnmounted } from "vue";
/** 用途：创建响应式引用。使用范围：容器、列表和脉冲状态。解耦评估：Vue 核心响应式 API，组件运行基础，无法解耦。 */
import { ref } from "vue";
/** 用途：响应值变化。使用范围：滚动和脉冲副作用。解耦评估：Vue 核心响应式 API，组件运行基础，无法解耦。 */
import { watch } from "vue";
/** 用途：计算引用类型。使用范围：滚动 watcher 契约。解耦评估：仅用于静态类型标注，无运行时耦合。 */
import type { ComputedRef } from "vue";
/** 用途：响应式引用类型。使用范围：DOM 和列表端口。解耦评估：仅用于静态类型标注，无运行时耦合。 */
import type { Ref } from "vue";
/** 用途：富内容渲染子组件。使用范围：消息气泡模板中的 Web 内容展示。解耦评估：组件直接组合关系，非可注入服务。 */
import MagiWebContent from "../message-bubble/MagiWebContent.vue";
/** 用途：消息气泡子组件。使用范围：活动列表模板中的消息渲染。解耦评估：组件直接组合关系，非可注入服务。 */
import MessageBubble from "../message-bubble/MessageBubble.vue";
/** 用途：虚拟瀑布流栅格组件。使用范围：活动列表虚拟化渲染。解耦评估：组件直接组合关系，非可注入服务。 */
import VirtualMasonryGrid from "../../../components/masonry/components/VirtualMasonryGrid.vue";
/** 用途：DOM 尺寸观察器工厂。使用范围：卡片高度测量。解耦评估：浏览器 API 实例化统一走工厂，遵守工厂模式 lint。 */
import { createResizeObserver } from "../../../util/DOM/observers.factory";

/** 用途：创建派生状态。使用范围：seel-panel 全部逻辑文件。解耦评估：组件核心依赖，统一出口便于替换。 */
export { computed };
/** 用途：注册挂载生命周期。使用范围：观察器注册。解耦评估：组件核心依赖，统一出口便于替换。 */
export { onMounted };
/** 用途：注册清理生命周期。使用范围：观察器和计时器释放。解耦评估：组件核心依赖，统一出口便于替换。 */
export { onUnmounted };
/** 用途：创建响应式引用。使用范围：容器、列表和脉冲状态。解耦评估：组件核心依赖，统一出口便于替换。 */
export { ref };
/** 用途：响应值变化。使用范围：滚动和脉冲副作用。解耦评估：组件核心依赖，统一出口便于替换。 */
export { watch };
/** 用途：计算引用类型。使用范围：滚动 watcher 契约。解耦评估：仅用于静态类型。 */
export type { ComputedRef };
/** 用途：响应式引用类型。使用范围：DOM 和列表端口。解耦评估：仅用于静态类型。 */
export type { Ref };
/** 用途：富内容渲染子组件转发。使用范围：消息气泡模板。解耦评估：组件直接组合关系。 */
export { MagiWebContent };
/** 用途：消息气泡子组件转发。使用范围：活动列表模板。解耦评估：组件直接组合关系。 */
export { MessageBubble };
/** 用途：虚拟瀑布流栅格组件转发。使用范围：活动列表虚拟化。解耦评估：组件直接组合关系。 */
export { VirtualMasonryGrid };
/** 用途：DOM 尺寸观察器工厂转发。使用范围：卡片高度测量。解耦评估：浏览器 API 实例化统一走工厂，遵守工厂模式 lint。 */
export { createResizeObserver };
