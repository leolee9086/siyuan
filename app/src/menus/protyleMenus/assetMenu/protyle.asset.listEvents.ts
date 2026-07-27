/**
 * 用途：查找资源列表项节点
 * 使用范围：列表 hover/click 事件命中 b3-list-item
 * 解耦评估：通过 imports.ts 转发，DOM 工具与事件编排解耦
 */
import { hasClosestByClassName } from "./imports";
/**
 * 用途：渲染资源预览图
 * 使用范围：列表 hover 时即时更新预览图片
 * 解耦评估：通过 imports.ts 转发，渲染实现可独立替换
 */
import { renderAssetsPreview } from "./imports";
/**
 * 用途：访问全局菜单单例
 * 使用范围：点击列表项后关闭菜单
 * 解耦评估：通过 imports.ts 转发，菜单系统依赖入口统一
 */
import { getSiyuanGlobalMenus } from "./imports";
/**
 * 用途：更新素材元数据预览
 * 使用范围：列表 hover 时更新右侧元数据信息
 * 解耦评估：由视图模块提供专职能力，事件模块仅编排调用
 */
import { 更新素材元数据预览 } from "./protyle.asset.view";
/**
 * 用途：区分资源选中结果由编辑器菜单还是外部调用方接管。
 * 使用范围：资源列表点击确认及其菜单关闭生命周期。
 */
import type {AssetMenuDestination} from "./imports";

/**
 * 处理列表悬停事件。
 * @同步豁免: UI构建 - hover 反馈需要在当前事件中同步渲染，避免预览闪烁。
 */
export const 处理列表悬停 = (previewElement: Element) => (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
        return;
    }
    const hoverItemElement = hasClosestByClassName(target, "b3-list-item");
    if (!hoverItemElement) {
        return;
    }
    const dataValue = hoverItemElement.getAttribute("data-value") ?? "";
    const imageContainer = previewElement.querySelector("#preview-image");
    if (imageContainer) {
        imageContainer.innerHTML = renderAssetsPreview(dataValue);
    }
    更新素材元数据预览(previewElement, dataValue);
};

/**
 * 处理列表点击事件。
 * @同步豁免: UI构建 - 点击后需立即执行插入/回调并关闭菜单，保证交互一致性。
 */
export const 处理列表点击 = (
    destination: AssetMenuDestination
) => (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
        return;
    }

    const listItemElement = hasClosestByClassName(target, "b3-list-item");
    if (!listItemElement) {
        return;
    }

    event.stopPropagation();
    const currentURL = listItemElement.getAttribute("data-value") ?? "";
    const textContent = listItemElement.textContent ?? "";

    destination.select(currentURL, textContent);
    // 编辑器模式由资源菜单拥有生命周期，选中后应立即关闭；回调模式由调用方接管。
    if (destination.kind === "editor") {
        getSiyuanGlobalMenus().menu.remove();
    }
};
