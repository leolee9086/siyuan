/** 用途：提交 Gallery 宽高比事务；使用范围：本文件菜单动作；解耦评估：经本域网关直达严格命令。 */
import {submitAVGallerySettingTransaction} from "./imports";
/** 用途：读取视图属性名；使用范围：宽高比事务；解耦评估：经本域网关直达协议常量。 */
import {Constants} from "./imports";
/** 用途：创建一次性设置菜单；使用范围：宽高比菜单；解耦评估：无状态 UI 工厂。 */
import {createGallerySettingsMenu} from "./menu.factory";
/** 用途：读取视图身份；使用范围：宽高比事务；解耦评估：同域显式校验。 */
import {requireGalleryAttribute} from "./identity";
/** 用途：构造已校验的完整交互上下文；使用范围：宽高比菜单；解耦评估：同域身份所有者。 */
import {createGallerySettingContext} from "./identity";
/** 用途：标注已校验 Gallery 设置上下文；使用范围：宽高比动作；解耦评估：纯类型依赖。 */
import type {GallerySettingContext} from "./settings.types";
/** 用途：标注完整 Gallery 设置输入；使用范围：宽高比菜单；解耦评估：纯类型依赖。 */
import type {GallerySettingOptions} from "./settings.types";

const CARD_ASPECT_RATIO_COUNT = 7;

/** 返回一次性宽高比标签序列，避免共享可变数组状态。 */
const getCardAspectRatioLabels = () => "16:9|9:16|4:3|3:4|3:2|2:3|1:1".split("|");

/** 将宽高比协议编号映射为菜单标签，未知值沿用 16:9 回退。 */
/** @同步豁免: UI构建 */
export const getCardAspectRatio = (ratio: number) => {
    return getCardAspectRatioLabels()[ratio] ?? "16:9";
};

/** 提交卡片宽高比并同步当前视图对象和菜单标签。 */
const applyCardAspectRatio = (
    context: GallerySettingContext,
    viewID: string,
    ratio: number,
) => {
    submitAVGallerySettingTransaction(context.options.protyle, [{
        action: "setAttrViewCardAspectRatio",
        avID: context.avID,
        blockID: context.blockID,
        data: ratio,
        viewID,
    }], [{
        action: "setAttrViewCardAspectRatio",
        avID: context.avID,
        blockID: context.blockID,
        data: context.options.view.cardAspectRatio,
        viewID,
    }]);
    context.options.view.cardAspectRatio = ratio;
    context.labelElement.textContent = getCardAspectRatio(ratio);
};

/** 构建 Gallery 卡片宽高比菜单，保持协议编号顺序。 */
/** @同步豁免: UI构建 */
export const setGalleryRatio = (options: GallerySettingOptions) => {
    const context = createGallerySettingContext(options);
    const viewID = requireGalleryAttribute(options.nodeElement, Constants.CUSTOM_SY_AV_VIEW);
    const menu = createGallerySettingsMenu();
    for (let ratio = 0; ratio < CARD_ASPECT_RATIO_COUNT; ratio++) {
        menu.addItem({
            iconHTML: "",
            checked: options.view.cardAspectRatio === ratio,
            label: getCardAspectRatio(ratio),
            /** @内联回调 */
            click: () => applyCardAspectRatio(context, viewID, ratio),
        });
    }
    const rect = options.target.getBoundingClientRect();
    menu.open({x: rect.left, y: rect.bottom});
};
