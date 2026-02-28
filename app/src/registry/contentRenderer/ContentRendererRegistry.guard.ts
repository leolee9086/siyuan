/**
 * ContentRendererRegistry.guard.ts - 内容块渲染器注册表类型守卫
 */

import type { ContentRendererRegistration } from "./ContentRendererRegistry.types";

/**
 * 判断是否为内容渲染器注册表 Map
 *
 * 注意：此处仅做运行时 Map 类型检查，泛型类型通过逻辑保证
 * 用于在从全局状态获取时进行类型收窄
 */
export function isContentRendererRegistryMap(target: unknown): target is Map<string, ContentRendererRegistration> {
    return target instanceof Map;
}
