/** 用途：提交 Gallery 卡片尺寸事务；使用范围：本文件菜单动作；解耦评估：经本域网关直达严格命令。 */
import {submitAVGallerySettingTransaction} from "./imports";
/** 用途：读取视图属性名；使用范围：尺寸事务；解耦评估：经本域网关直达协议常量。 */
import {Constants} from "./imports";
/** 用途：读取尺寸文案；使用范围：尺寸菜单；解耦评估：经本域网关直达 i18n。 */
import {siyuanI18n} from "./imports";
/** 用途：创建一次性设置菜单；使用范围：尺寸菜单；解耦评估：无状态 UI 工厂。 */
import {createGallerySettingsMenu} from "./menu.factory";
/** 用途：读取视图身份；使用范围：尺寸事务；解耦评估：同域显式校验。 */
import {requireGalleryAttribute} from "./identity";
/** 用途：构造已校验的完整交互上下文；使用范围：尺寸菜单；解耦评估：同域身份所有者。 */
import {createGallerySettingContext} from "./identity";
/** 用途：标注已校验 Gallery 设置上下文；使用范围：尺寸菜单动作；解耦评估：纯类型依赖。 */
import type {GallerySettingContext} from "./settings.types";
/** 用途：标注完整 Gallery 设置输入；使用范围：尺寸菜单；解耦评估：纯类型依赖。 */
import type {GallerySettingOptions} from "./settings.types";

/** 提交卡片尺寸并同步当前视图对象和菜单标签。 */
const applyCardSize = (
    context: GallerySettingContext,
    viewID: string,
    size: {value: number, label: string},
) => {
    submitAVGallerySettingTransaction(context.options.protyle, [{
        action: "setAttrViewCardSize",
        avID: context.avID,
        blockID: context.blockID,
        data: size.value,
        viewID,
    }], [{
        action: "setAttrViewCardSize",
        avID: context.avID,
        blockID: context.blockID,
        data: context.options.view.cardSize,
        viewID,
    }]);
    context.options.view.cardSize = size.value;
    context.labelElement.textContent = size.label;
};

/** 构建 Gallery 卡片尺寸菜单，保持小、中、大顺序。 */
/** @同步豁免: UI构建 */
export const setGallerySize = (options: GallerySettingOptions) => {
    const context = createGallerySettingContext(options);
    const viewID = requireGalleryAttribute(options.nodeElement, Constants.CUSTOM_SY_AV_VIEW);
    const menu = createGallerySettingsMenu();
    const sizes = [
        {value: 0, label: siyuanI18n.small},
        {value: 1, label: siyuanI18n.medium},
        {value: 2, label: siyuanI18n.large},
    ];
    for (const size of sizes) {
        menu.addItem({
            iconHTML: "",
            checked: options.view.cardSize === size.value,
            label: size.label,
            /** @内联回调 */
            click: () => applyCardSize(context, viewID, size),
        });
    }
    const rect = options.target.getBoundingClientRect();
    menu.open({x: rect.left, y: rect.bottom});
};
