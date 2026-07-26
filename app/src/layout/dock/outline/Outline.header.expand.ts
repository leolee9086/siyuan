import { Constants } from "../../../constants";
import { isHTMLElement } from "../../../util/DOM/element.guard";
import { hasClosestBlock, hasClosestByClassName } from "../../../protyle/util/hasClosest";
import { getSafeSiyuanStorage } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { setStorageVal } from "../../../protyle/util/compatibility";
import { getAllModels } from "../../getAll";
import { isMobile } from "../../../platform";
import type {EditorDomain} from "../../../editor/model/editorDomain.types";
import type {OutlineDomain} from "./types";

/**
 * 作用：处理“保持当前展开”按钮的点击逻辑。
 * 意图：切换存储中的 keepCurrentExpand 状态，更新图标样式，并在开启时尝试聚焦当前块。
 * 调用时机：用户点击“保持当前展开”按钮时。
 * @同步豁免: DOM访问
 */
export function handleKeepCurrentExpandClick(outline: OutlineDomain, event: MouseEvent) {
    const target = event.target;
    // 使用类型守卫确保 target 是 Element
    if (!isHTMLElement(target)) {
        return;
    }
    const iconElement = hasClosestByClassName(target, "block__icon");
    if (!iconElement) {
        return;
    }
    const currentStorage = getSafeSiyuanStorage()?.[Constants.LOCAL_OUTLINE];
    /**
     * 作用：检查存储对象是否存在。
     * 意图：如果存储对象不可用，无法进行状态切换，直接返回。
     * 生效场景：local storage 获取失败或相关 key 不存在。
     */
    if (!currentStorage) {
        return;
    }

    /**
     * 作用：处理取消激活逻辑。
     * 意图：如果图标当前是激活状态，移除激活样式并更新配置为 false。
     * 生效场景：iconElement 拥有 block__icon--active 类名。
     */
    if (iconElement.classList.contains("block__icon--active")) {
        iconElement.classList.remove("block__icon--active");
        currentStorage.keepCurrentExpand = false;
        setStorageVal(Constants.LOCAL_OUTLINE, currentStorage);
        return;
    }

    // 激活逻辑
    iconElement.classList.add("block__icon--active");
    currentStorage.keepCurrentExpand = true;
    handleKeepCurrentExpandFocus(outline);
    setStorageVal(Constants.LOCAL_OUTLINE, currentStorage);
}

/**
 * 作用：在开启“保持当前展开”时定位焦点。
 * 意图：遍历编辑器，找到与当前大纲关联的编辑器中的选中块，并让大纲聚焦到该块。
 * 调用时机：handleKeepCurrentExpandClick 中切换为激活状态时。
 */
function handleKeepCurrentExpandFocus(outline: OutlineDomain) {
    let focusElement: HTMLElement | undefined;
    if (!isMobile) {
        getAllModels().editor.find(editItem => {
            return findFocusBlockInEditor(outline, editItem, (found) => {
                focusElement = found;
            });
        });
    }
    if (focusElement) {
        outline.setCurrent(focusElement);
    }
}

/**
 * 作用：在编辑器中查找焦点块。
 * 意图：辅助 handleKeepCurrentExpandFocus，从单个编辑器实例中查找符合条件的块。
 * 调用时机：getAllModels().editor.find 回调中。
 */
function findFocusBlockInEditor(outline: OutlineDomain, editItem: EditorDomain, onFound: (element: HTMLElement) => void): boolean {
    /**
     * 作用：确保编辑器匹配当前大纲根块 ID。
     * 意图：只在与当前大纲内容对应的编辑器中查找焦点。
     * 生效场景：当前遍历到的 editor 的 rootID 等于 outline.blockId。
     */
    if (editItem.editor.protyle.block.rootID !== outline.blockId) {
        return false;
    }
    const selection = getSelection();
    /**
     * 作用：检查是否有有效的选区。
     * 意图：必须有选区才能判断当前聚焦的是哪个块。
     * 生效场景：选区存在且 rangeCount > 0。
     */
    if (!selection || selection.rangeCount === 0) {
        return false;
    }
    const blockElement = hasClosestBlock(selection.getRangeAt(0).startContainer);
    if (blockElement) {
        onFound(blockElement);
        return true;
    }
    return false;
}
