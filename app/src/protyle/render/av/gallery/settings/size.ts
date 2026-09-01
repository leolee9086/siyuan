/** 用途：提交 Gallery 卡片宽度事务；使用范围：本文件菜单动作；解耦评估：经本域网关直达严格命令。 */
import {submitAVGallerySettingTransaction} from "./imports";
/** 用途：读取视图属性名；使用范围：宽度事务；解耦评估：经本域网关直达协议常量。 */
import {Constants} from "./imports";
/** 用途：读取尺寸文案；使用范围：尺寸菜单；解耦评估：经本域网关直达 i18n。 */
import {siyuanI18n} from "./imports";
/** 用途：创建一次性设置菜单；使用范围：尺寸菜单；解耦评估：无状态 UI 工厂。 */
import {createGallerySettingsMenu} from "./menu.factory";
/** 用途：读取视图身份；使用范围：宽度事务；解耦评估：同域显式校验。 */
import {requireGalleryAttribute} from "./identity";
/** 用途：构造已校验的完整交互上下文；使用范围：尺寸菜单；解耦评估：同域身份所有者。 */
import {createGallerySettingContext} from "./identity";
/** 用途：标注已校验 Gallery 设置上下文；使用范围：尺寸菜单动作；解耦评估：纯类型依赖。 */
import type {GallerySettingContext} from "./settings.types";
/** 用途：标注完整 Gallery 设置输入；使用范围：尺寸菜单；解耦评估：纯类型依赖。 */
import type {GallerySettingOptions} from "./settings.types";
/** 用途：读取卡片宽度档位与边界并解析当前宽度；使用范围：尺寸菜单构建；解耦评估：复用画廊样式唯一实现。 */
import {CARD_WIDTH_MAX, CARD_WIDTH_MIN, CARD_WIDTH_PRESETS, getCardWidth} from "../style";
/** 用途：拖动滑杆时实时更新卡片预览；使用范围：宽度滑杆；解耦评估：同域唯一预览实现。 */
import {updateCardPreview} from "./cardPreview";

/** 提交卡片宽度并同步当前视图对象和菜单标签。 */
const applyCardWidth = (
    context: GallerySettingContext,
    viewID: string,
    width: number,
    previousWidth: number,
) => {
    submitAVGallerySettingTransaction(context.options.protyle, [{
        action: "setAttrViewCardWidth",
        avID: context.avID,
        blockID: context.blockID,
        data: width,
        viewID,
    }], [{
        action: "setAttrViewCardWidth",
        avID: context.avID,
        blockID: context.blockID,
        data: previousWidth,
        viewID,
    }]);
    context.options.view.cardWidth = width;
    context.labelElement.textContent = `${width}px`;
};

/** 构建 Gallery 卡片尺寸菜单：内置档位加自由宽度滑杆，保持小、中、大顺序。 */
/** @同步豁免: UI构建 */
export const setGallerySize = (options: GallerySettingOptions) => {
    const context = createGallerySettingContext(options);
    const viewID = requireGalleryAttribute(options.nodeElement, Constants.CUSTOM_SY_AV_VIEW);
    const menu = createGallerySettingsMenu();
    const previousWidth = getCardWidth(options.view);
    [siyuanI18n.small, siyuanI18n.medium, siyuanI18n.large].forEach((label, index) => {
        const width = CARD_WIDTH_PRESETS[index];
        menu.addItem({
            iconHTML: "",
            checked: previousWidth === width,
            label,
            /** @内联回调 */
            click: () => applyCardWidth(context, viewID, width, previousWidth),
        });
    });
    menu.addSeparator();
    menu.addItem({
        iconHTML: "",
        type: "readonly",
        label: `<div class="b3-tooltips b3-tooltips__n" aria-label="${previousWidth}px" style="margin: 4px 0;">
    <input class="b3-slider fn__block" max="${CARD_WIDTH_MAX}" min="${CARD_WIDTH_MIN}" step="10" type="range" value="${previousWidth}">
</div>`,
        bind(element) {
            const rangeElement = element.querySelector("input") as HTMLInputElement;
            rangeElement.addEventListener("input", () => {
                updateCardPreview(options.nodeElement, "--b3-av-card-width", `${rangeElement.value}px`);
                rangeElement.parentElement.setAttribute("aria-label", `${rangeElement.value}px`);
            });
            rangeElement.addEventListener("change", () => {
                const width = parseInt(rangeElement.value);
                if (width !== previousWidth) {
                    applyCardWidth(context, viewID, width, previousWidth);
                }
                menu.close();
            });
        }
    });
    const rect = options.target.getBoundingClientRect();
    menu.open({x: rect.left, y: rect.bottom});
};
