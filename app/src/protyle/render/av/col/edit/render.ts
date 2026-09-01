/** 用途：渲染列自定义图标；使用范围：身份区；解耦评估：经本域网关直达 Emoji 唯一实现。 */
import {unicode2Emoji} from "./imports";
/** 用途：绑定 Rollup 数据；使用范围：编辑生命周期末尾；解耦评估：经本域网关直达 Rollup 唯一实现。 */
import {bindRollupData} from "./imports";
/** 用途：转义描述属性；使用范围：身份区；解耦评估：经本域网关直达 DOM 转义实现。 */
import {escapeAriaLabel} from "./imports";
/** 用途：转义 textarea 属性；使用范围：身份区；解耦评估：经本域网关直达 DOM 转义实现。 */
import {escapeAttr} from "./imports";
/** 用途：转义描述文本节点；使用范围：身份区 textarea 内容；解耦评估：经本域网关直达 DOM 转义实现，避免描述中的标签被解析。 */
import {escapeHtml} from "./imports";
/** 用途：获取当前视图字段；使用范围：目标列解析与事件绑定；解耦评估：经本域网关直达元数据实现。 */
import {getFieldsByData} from "./imports";
/** 用途：读取编辑文案；使用范围：所有编辑模板；解耦评估：经本域网关直达 i18n 环境。 */
import {siyuanI18n} from "./imports";
/** 用途：读取列类型名称；使用范围：类型入口；解耦评估：经本域网关直达列映射。 */
import {getColNameByType} from "./imports";
/** 用途：读取列类型图标；使用范围：身份区和类型入口；解耦评估：经本域网关直达列映射。 */
import {getColIconByType} from "./imports";
/** 用途：构建类型选择项；使用范围：类型子视图；解耦评估：经本域网关直达编辑模板实现。 */
import {genUpdateColItem} from "./imports";
/** 用途：构建类型特有配置；使用范围：主编辑视图；解耦评估：经本域网关直达策略实现。 */
import {getTypeSpecificEditHTML} from "./imports";
/** 用途：绑定名称事件；使用范围：编辑生命周期；解耦评估：经本域网关直达唯一行为。 */
import {bindNameEvents} from "./imports";
/** 用途：绑定描述事件；使用范围：编辑生命周期；解耦评估：经本域网关直达唯一行为。 */
import {bindDescEvents} from "./imports";
/** 用途：绑定模板事件；使用范围：编辑生命周期；解耦评估：经本域网关直达唯一行为。 */
import {bindTemplateEvents} from "./imports";
/** 用途：绑定时间开关；使用范围：编辑生命周期；解耦评估：经本域网关直达唯一行为。 */
import {bindIncludeTimeEvent} from "./imports";
/** 用途：绑定换行开关；使用范围：编辑生命周期；解耦评估：经本域网关直达唯一行为。 */
import {bindWrapEvent} from "./imports";
/** 用途：绑定新增选项；使用范围：编辑生命周期；解耦评估：经本域网关直达唯一行为。 */
import {bindAddOptionEvent} from "./imports";
/** 用途：绑定日期开关；使用范围：编辑生命周期；解耦评估：经本域网关直达唯一行为。 */
import {bindDateSwitchEvents} from "./imports";
/** 用途：绑定反向关联；使用范围：编辑生命周期；解耦评估：经本域网关直达唯一行为。 */
import {bindBackRelationEvents} from "./imports";
/** 用途：约束完整编辑生命周期上下文；使用范围：事件装配；解耦评估：纯类型直达编辑领域声明。 */
import type {IBindEditContext} from "./imports";

/** 查找编辑目标列；缺失目标属于协议错误，显式抛出而不静默渲染空面板。 */
const resolveEditColumn = (data: IAV, colId: string) => {
    const colData = getFieldsByData(data).find((item) => item.id === colId);
    if (!colData) {
        throw new Error(`AV column edit expected column ${colId}`);
    }
    return colData;
};
/** 构建列编辑主面板的身份、名称、描述和类型入口。 */
const buildColumnIdentityHTML = (colData: IAVColumn, colId: string, isCustomAttr: boolean) => `<button class="b3-menu__item" data-type="nobg" data-col-id="${colId}">
    <span class="block__icon${isCustomAttr ? " fn__none" : ""}" style="padding: 8px;margin-left: -4px;" data-type="go-properties">
        <svg><use xlink:href="#iconLeft"></use></svg>
    </span>
    <span class="b3-menu__label ft__center">${siyuanI18n.edit}</span>
</button>
<button class="b3-menu__separator" data-id="separator_1"></button>
<button class="b3-menu__item" data-type="nobg">
    <div class="fn__block">
        <div class="fn__flex">
            <span class="b3-menu__avemoji" data-col-type="${colData.type}" data-icon="${escapeAttr(colData.icon)}" data-type="update-icon">${colData.icon ? unicode2Emoji(colData.icon) : `<svg style="width: 14px;height: 14px"><use xlink:href="#${getColIconByType(colData.type)}"></use></svg>`}</span>
            <div class="b3-form__icona fn__block">
                <input data-type="name" class="b3-text-field b3-form__icona-input" type="text">
                <svg data-position="north" class="b3-form__icona-icon ariaLabel" aria-label="${colData.desc ? escapeAriaLabel(colData.desc) : siyuanI18n.addDesc}"><use xlink:href="#iconInfo"></use></svg>
            </div>
        </div>
        <div class="fn__none">
            <div class="fn__hr"></div>
            <textarea placeholder="${siyuanI18n.addDesc}" rows="1" data-type="desc" class="b3-text-field fn__block" type="text" data-value="${escapeAttr(colData.desc)}">${escapeHtml(colData.desc)}</textarea>
        </div>
        <div class="fn__hr--small"></div>
    </div>
</button>
<button class="b3-menu__item" data-type="goUpdateColType" ${colData.type === "block" ? "disabled" : ""}>
    <span class="b3-menu__label">${siyuanI18n.type}</span>
    <span class="fn__space"></span>
    <svg class="b3-menu__icon"><use xlink:href="#${getColIconByType(colData.type)}"></use></svg>
    <span class="b3-menu__accelerator" style="margin-left: 0">${getColNameByType(colData.type)}</span>
    <svg class="b3-menu__icon b3-menu__icon--small"><use xlink:href="#iconRight"></use></svg>
</button>`;

/** 构建换行开关以及允许类型的复制、删除操作。 */
const buildColumnActionsHTML = (colData: IAVColumn) => {
    let html = `<button class="b3-menu__separator" data-id="separator_3"></button>
<label class="b3-menu__item">
    <svg class="b3-menu__icon" style=""><use xlink:href="#iconSoftWrap"></use></svg>
    <span class="fn__flex-center">${siyuanI18n.wrap}</span>
    <span class="fn__space fn__flex-1"></span>
    <input type="checkbox" data-type="wrap" class="b3-switch b3-switch--menu"${colData.wrap ? " checked" : ""}>
</label>`;
    // 主键 block 列不允许复制或删除，其余列保持既有操作入口。
    if (colData.type !== "block") {
        html += `<button class="b3-menu__item${colData.type === "relation" ? " fn__none" : ""}" data-type="duplicateCol">
    <svg class="b3-menu__icon" style=""><use xlink:href="#iconCopy"></use></svg>
    <span class="b3-menu__label">${siyuanI18n.duplicate}</span>
</button>
<button class="b3-menu__item  b3-menu__item--warning" data-type="removeCol">
    <svg class="b3-menu__icon" style=""><use xlink:href="#iconTrashcan"></use></svg>
    <span class="b3-menu__label">${siyuanI18n.delete}</span>
</button>`;
    }
    return html;
};
/** 构建列类型选择器的全部协议类型项。 */
const buildColumnTypeChooserHTML = (colData: IAVColumn) => `<div class="b3-menu__items fn__none">
    <button class="b3-menu__item" data-type="nobg" data-col-id="${colData.id}">
        <span class="block__icon" style="padding: 8px;margin-left: -4px;" data-type="goEditCol">
            <svg><use xlink:href="#iconLeft"></use></svg>
        </span>
        <span class="b3-menu__label ft__center">${siyuanI18n.edit}</span>
    </button>
    <button class="b3-menu__separator"></button>
    ${genUpdateColItem("text", colData.type)}
    ${genUpdateColItem("number", colData.type)}
    ${genUpdateColItem("select", colData.type)}
    ${genUpdateColItem("mSelect", colData.type)}
    ${genUpdateColItem("date", colData.type)}
    ${genUpdateColItem("mAsset", colData.type)}
    ${genUpdateColItem("checkbox", colData.type)}
    ${genUpdateColItem("url", colData.type)}
    ${genUpdateColItem("email", colData.type)}
    ${genUpdateColItem("phone", colData.type)}
    ${genUpdateColItem("template", colData.type)}
    ${genUpdateColItem("relation", colData.type)}
    ${genUpdateColItem("rollup", colData.type)}
    ${genUpdateColItem("lineNumber", colData.type)}
    ${genUpdateColItem("created", colData.type)}
    ${genUpdateColItem("updated", colData.type)}
</div>`;

/** 构建字段编辑主视图和类型选择子视图，保持原 DOM 顺序与 data-type 协议。 */
/** @同步豁免: UI构建 — Panel 在当前渲染阶段需要立即取得完整 HTML 字符串。 */
export const getEditHTML = (options: {
    protyle: IProtyle,
    colId: string,
    data: IAV,
    isCustomAttr: boolean
}) => {
    const colData = resolveEditColumn(options.data, options.colId);
    const mainHTML = buildColumnIdentityHTML(colData, options.colId, options.isCustomAttr) +
        getTypeSpecificEditHTML(colData, options.data) + buildColumnActionsHTML(colData);
    return `<div class="b3-menu__items">
    ${mainHTML}
</div>
${buildColumnTypeChooserHTML(colData)}`;
};

/** 绑定字段名称、描述、类型特有配置和 Rollup 数据事件。 */
/** @同步豁免: UI构建 — 事件监听必须在 Panel DOM 挂载完成后立即绑定。 */
export const bindEditEvent = (options: {
    protyle: IProtyle,
    data: IAV,
    blockID: string,
    menuElement: HTMLElement,
    isCustomAttr: boolean
}) => {
    const avID = options.data.id;
    const firstMenuItem = options.menuElement.querySelector(".b3-menu__item");
    const colId = firstMenuItem?.getAttribute("data-col-id") ?? "";
    const colData = getFieldsByData(options.data).find((item: IAVColumn) => item.id === colId);
    const nameEl = options.menuElement.querySelector('[data-type="name"]');
    // nameElement 或 colData 不存在时跳过所有事件绑定
    if (!(nameEl instanceof HTMLInputElement) || !colData) {
        return;
    }
    const ctx: IBindEditContext = {
        protyle: options.protyle,
        data: options.data,
        blockID: options.blockID,
        menuElement: options.menuElement,
        isCustomAttr: options.isCustomAttr,
        colId,
        colData,
        avID,
        nameElement: nameEl,
        /** 选项或日期配置变化后使用同一编辑实现重建并重新绑定当前 Panel。 */
        refreshEditPanel: () => {
            options.menuElement.innerHTML = getEditHTML({
                protyle: options.protyle,
                colId,
                data: options.data,
                isCustomAttr: options.isCustomAttr,
            });
            bindEditEvent(options);
        },
    };
    bindNameEvents(ctx);
    bindDescEvents(ctx);
    bindTemplateEvents(ctx);
    bindIncludeTimeEvent(ctx);
    bindWrapEvent(ctx);
    bindAddOptionEvent(ctx);
    bindDateSwitchEvents(ctx);
    bindBackRelationEvents(ctx);
    bindRollupData(options);
};
