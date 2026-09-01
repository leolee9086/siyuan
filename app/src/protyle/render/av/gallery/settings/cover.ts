/** 用途：提交 Gallery 封面设置事务；使用范围：本文件菜单动作；解耦评估：经本域网关直达严格命令。 */
import {submitAVGallerySettingTransaction} from "./imports";
/** 用途：读取资源字段图标；使用范围：资源字段封面项；解耦评估：经本域网关直达列元数据。 */
import {getColIconByType} from "./imports";
/** 用途：渲染资源字段 Emoji；使用范围：资源字段封面项；解耦评估：经本域网关直达 Emoji。 */
import {unicode2Emoji} from "./imports";
/** 用途：读取封面菜单文案；使用范围：菜单标签；解耦评估：经本域网关直达 i18n。 */
import {siyuanI18n} from "./imports";
/** 用途：创建一次性设置菜单；使用范围：封面菜单；解耦评估：无状态 UI 工厂。 */
import {createGallerySettingsMenu} from "./menu.factory";
/** 用途：构造已校验的完整交互上下文；使用范围：封面菜单；解耦评估：同域身份所有者。 */
import {createGallerySettingContext} from "./identity";
/** 用途：标注已校验 Gallery 设置上下文；使用范围：封面菜单动作；解耦评估：纯类型依赖。 */
import type {GallerySettingContext} from "./settings.types";
/** 用途：标注完整 Gallery 设置输入；使用范围：封面菜单；解耦评估：纯类型依赖。 */
import type {GallerySettingOptions} from "./settings.types";

/** 同步宽高比菜单入口的禁用状态；封面来源为「无」时卡片无预览，宽高比随之不可用。 */
/** @同步豁免: 需要绝对同步的DOM访问 */
const updateRatioDisabled = (target: HTMLElement, disabled: boolean) => {
    const ratioButton = target.parentElement?.querySelector<HTMLButtonElement>('[data-type="set-gallery-ratio"]');
    if (ratioButton) {
        ratioButton.disabled = disabled;
    }
};

/** 提交普通封面来源并同步当前视图对象和菜单标签。 */
const applyCoverSource = (
    context: GallerySettingContext,
    source: {value: number, label: string},
) => {
    submitAVGallerySettingTransaction(context.options.protyle, [{
        action: "setAttrViewCoverFrom",
        avID: context.avID,
        blockID: context.blockID,
        data: source.value,
    }], [{
        action: "setAttrViewCoverFrom",
        avID: context.avID,
        blockID: context.blockID,
        data: context.options.view.coverFrom,
    }]);
    context.options.view.coverFrom = source.value;
    context.labelElement.textContent = source.label;
    updateRatioDisabled(context.options.target, source.value === 0);
};

/** 提交资源字段封面来源并同步当前视图对象和菜单标签。 */
const applyAssetCover = (
    context: GallerySettingContext,
    field: IAVColumn,
) => {
    const undoAssetKeyOperation: IOperation = {
        action: "setAttrViewCoverFromAssetKeyID",
        avID: context.avID,
        blockID: context.blockID,
    };
    // 非资源封面可能没有旧字段身份；网络协议沿用原 JSON 省略 undefined 字段的语义。
    if (context.options.view.coverFromAssetKeyID !== undefined) {
        undoAssetKeyOperation.keyID = context.options.view.coverFromAssetKeyID;
    }
    submitAVGallerySettingTransaction(context.options.protyle, [{
        action: "setAttrViewCoverFrom",
        avID: context.avID,
        blockID: context.blockID,
        data: 2,
    }, {
        action: "setAttrViewCoverFromAssetKeyID",
        avID: context.avID,
        blockID: context.blockID,
        keyID: field.id,
    }], [{
        action: "setAttrViewCoverFrom",
        avID: context.avID,
        blockID: context.blockID,
        data: context.options.view.coverFrom,
    }, undoAssetKeyOperation]);
    context.options.view.coverFrom = 2;
    context.options.view.coverFromAssetKeyID = field.id;
    context.labelElement.textContent = field.name;
    updateRatioDisabled(context.options.target, false);
};

/** 构建 Gallery 封面来源菜单，保持内置来源与资源字段的既有顺序。 */
/** @同步豁免: UI构建 */
export const setGalleryCover = (options: GallerySettingOptions) => {
    const context = createGallerySettingContext(options);
    const menu = createGallerySettingsMenu();
    const sources = [
        {value: 0, label: siyuanI18n.calcOperatorNone},
        {value: 3, label: siyuanI18n.contentBlock},
        {value: 1, label: siyuanI18n.contentImage},
    ];
    for (const source of sources) {
        menu.addItem({
            iconHTML: "",
            checked: options.view.coverFrom === source.value,
            label: source.label,
            /** @内联回调 */
            click: () => applyCoverSource(context, source),
        });
    }
    let addedSeparator = false;
    for (const field of options.view.fields) {
        if (field.type !== "mAsset") {
            continue;
        }
        if (!addedSeparator) {
            menu.addSeparator();
            addedSeparator = true;
        }
        menu.addItem({
            iconHTML: field.icon ? unicode2Emoji(field.icon, "b3-menu__icon", true) : `<svg class="b3-menu__icon"><use xlink:href="#${getColIconByType(field.type)}"></use></svg>`,
            checked: options.view.coverFrom === 2 && options.view.coverFromAssetKeyID === field.id,
            label: field.name,
            /** @内联回调 */
            click: () => applyAssetCover(context, field),
        });
    }
    const rect = options.target.getBoundingClientRect();
    menu.open({x: rect.left, y: rect.bottom});
};
