/** 用途：标注设置菜单原始输入；使用范围：上下文构造器；解耦评估：纯类型依赖。 */
import type {GallerySettingOptions} from "./settings.types";

/** 读取 Gallery 宿主必需属性，缺失时在构造事务前显式失败。 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export const requireGalleryAttribute = (nodeElement: Element, attribute: string) => {
    const value = nodeElement.getAttribute(attribute);
    if (!value) {
        throw new Error(`Gallery setting requires ${attribute}`);
    }
    return value;
};

/** 读取设置菜单当前标签节点，DOM 契约失配时显式失败。 */
const requireGallerySettingLabel = (target: HTMLElement) => {
    const labelElement = target.querySelector(".b3-menu__accelerator");
    if (!labelElement) {
        throw new Error("Gallery setting target requires a label element");
    }
    return labelElement;
};

/** 为一次 Gallery 设置菜单同步构造完整且已校验的交互上下文。 */
/** @同步豁免: UI构建 */
export const createGallerySettingContext = (options: GallerySettingOptions) => ({
    options,
    avID: requireGalleryAttribute(options.nodeElement, "data-av-id"),
    blockID: requireGalleryAttribute(options.nodeElement, "data-node-id"),
    labelElement: requireGallerySettingLabel(options.target),
});
