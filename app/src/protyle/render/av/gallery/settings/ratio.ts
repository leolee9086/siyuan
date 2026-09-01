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
/** 用途：读取宽高比档位、边界与标签并解析当前数值；使用范围：宽高比菜单构建；解耦评估：复用画廊样式唯一实现。 */
import {
    CARD_ASPECT_RATIO_MAX,
    CARD_ASPECT_RATIO_MIN,
    CARD_ASPECT_RATIO_PRESETS,
    getCardAspectRatio,
    getCardAspectRatioLabel,
    getCardAspectRatioValue,
} from "../style";
/** 用途：拖动滑杆时实时更新卡片预览；使用范围：宽高比滑杆；解耦评估：同域唯一预览实现。 */
import {updateCardPreview} from "./cardPreview";

/** 提交卡片宽高比数值并同步当前视图对象和菜单标签。 */
const applyCardAspectRatioValue = (
    context: GallerySettingContext,
    viewID: string,
    ratioValue: number,
    previousRatio: number,
) => {
    submitAVGallerySettingTransaction(context.options.protyle, [{
        action: "setAttrViewCardAspectRatioValue",
        avID: context.avID,
        blockID: context.blockID,
        data: ratioValue,
        viewID,
    }], [{
        action: "setAttrViewCardAspectRatioValue",
        avID: context.avID,
        blockID: context.blockID,
        data: previousRatio,
        viewID,
    }]);
    context.options.view.cardAspectRatioValue = ratioValue;
    context.labelElement.textContent = getCardAspectRatioLabel(ratioValue);
};

/** 构建 Gallery 卡片宽高比菜单：内置档位加自由比例滑杆，保持协议档位顺序。 */
/** @同步豁免: UI构建 */
export const setGalleryRatio = (options: GallerySettingOptions) => {
    const context = createGallerySettingContext(options);
    const viewID = requireGalleryAttribute(options.nodeElement, Constants.CUSTOM_SY_AV_VIEW);
    const menu = createGallerySettingsMenu();
    const previousRatio = getCardAspectRatioValue(options.view);
    CARD_ASPECT_RATIO_PRESETS.forEach((ratioValue, ratio) => {
        menu.addItem({
            iconHTML: "",
            checked: Math.abs(previousRatio - ratioValue) < 0.0001,
            label: getCardAspectRatio(ratio),
            /** @内联回调 */
            click: () => applyCardAspectRatioValue(context, viewID, ratioValue, previousRatio),
        });
    });
    menu.addSeparator();
    menu.addItem({
        iconHTML: "",
        type: "readonly",
        label: `<div class="b3-tooltips b3-tooltips__n" aria-label="${getCardAspectRatioLabel(previousRatio)}" style="margin: 4px 0;">
    <input class="b3-slider fn__block" max="${CARD_ASPECT_RATIO_MAX}" min="${CARD_ASPECT_RATIO_MIN}" step="0.05" type="range" value="${previousRatio}">
</div>`,
        bind(element) {
            const rangeElement = element.querySelector("input") as HTMLInputElement;
            rangeElement.addEventListener("input", () => {
                const ratio = parseFloat(rangeElement.value);
                updateCardPreview(options.nodeElement, "--b3-av-card-aspect-ratio", rangeElement.value);
                rangeElement.parentElement.setAttribute("aria-label", getCardAspectRatioLabel(ratio));
            });
            rangeElement.addEventListener("change", () => {
                const ratio = parseFloat(rangeElement.value);
                if (ratio !== previousRatio) {
                    applyCardAspectRatioValue(context, viewID, ratio, previousRatio);
                }
                menu.close();
            });
        }
    });
    const rect = options.target.getBoundingClientRect();
    menu.open({x: rect.left, y: rect.bottom});
};
