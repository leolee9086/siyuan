/** 用途：定位 Gallery 卡片祖先；使用范围：菜单与字段编辑；解耦评估：通过同域网关复用唯一 DOM 查询实现。 */
import {hasClosestByClassName} from "./imports";
/** 用途：打开 AV 右键菜单；使用范围：Gallery 更多菜单；解耦评估：通过同域网关复用唯一 contextmenu 实现。 */
import {avContextmenu} from "./imports";
/** 用途：读取字段切换文案；使用范围：Gallery 字段 aria-label；解耦评估：通过同域网关复用唯一国际化环境。 */
import {siyuanI18n} from "./imports";

/** 打开 Gallery 卡片的 AV 上下文菜单；调用时机：用户点击卡片更多动作时。 @同步豁免: 需要绝对同步的DOM访问 */
export const openGalleryItemMenu = (options: {
    target: HTMLElement,
    protyle: IProtyle,
    position: {
        x:number,
        y:number
    }
}) => {
    const cardElement = hasClosestByClassName(options.target, "av__gallery-item");
    if (!cardElement) {
        return;
    }
    avContextmenu(options.protyle, cardElement, options.position);
};

/** 切换 Gallery 卡片空字段显示状态并更新可访问性文案；调用时机：用户点击字段编辑动作时。 @同步豁免: 需要绝对同步的DOM访问 */
export const editGalleryItem = (target: Element) => {
    const itemElement = hasClosestByClassName(target, "av__gallery-item");
    if (!itemElement) {
        return;
    }
    const fieldsElement = itemElement.querySelector(".av__gallery-fields");
    if (!fieldsElement) {
        return;
    }
    target.setAttribute("aria-label", siyuanI18n[fieldsElement.classList.contains("av__gallery-fields--edit") ? "displayEmptyFields" : "hideEmptyFields"]);
    fieldsElement.classList.toggle("av__gallery-fields--edit");
};
