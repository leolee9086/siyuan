/**
 * 用途：访问 Gallery DOM 查询能力。
 * 使用范围：仅用于 Gallery 多选状态同步。
 * 解耦评估：DOM 查询属于既有编辑器状态机，通过目录网关复用可避免宿主参数膨胀。
 */
import {hasClosestByClassName} from "./imports";
/** 用途：同步虚拟选择存储。使用范围：Gallery 行切换。解耦评估：通过目录网关复用唯一状态实现。 */
import {updateAVRowSelect} from "./imports";
/** 用途：刷新表头聚合状态。使用范围：Gallery 单项切换。解耦评估：通过目录网关调用 AV 所有者能力。 */
import {updateHeader} from "./imports";

/** @同步豁免: 需要绝对同步的DOM访问 — mousedown 返回前必须同步 DOM 与虚拟选中状态。 */
export const setGalleryItemSelected = (item: Element, selected: boolean) => {
    item.classList.toggle("av__gallery-item--select", selected);
    const galleryBodyElement = hasClosestByClassName(item, "av__body");
    const rowId = item.getAttribute("data-id");
    // Virtual selection is available only for fully mounted gallery rows.
    if (galleryBodyElement instanceof HTMLElement && rowId) {
        updateAVRowSelect(galleryBodyElement, rowId, selected);
    }
};

/** @同步豁免: 需要绝对同步的DOM访问 — Ctrl/Cmd 点击必须在事件传播前完成切换。 */
export const toggleGalleryItemSelected = (item: HTMLElement) => {
    const selected = !item.classList.contains("av__gallery-item--select");
    setGalleryItemSelected(item, selected);
    updateHeader(item);
};
