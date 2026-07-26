/** 用途：Unicode 图标渲染。使用范围：属性视图表头图标刷新。解耦评估：经 cell 领域网关复用唯一实现。 */
import {unicode2Emoji} from "./imports";
/** 用途：列类型默认图标映射。使用范围：表头未配置 Emoji 时生成 SVG。解耦评估：经 cell 网关直达 col 类型实现。 */
import {getColIconByType} from "./imports";
/** 用途：拖拽填充国际化文案。使用范围：拖拽手柄 aria-label。解耦评估：经 cell 网关读取统一环境文案。 */
import {siyuanI18n} from "./imports";
/** 用途：验证 DOM 中的列类型字符串。使用范围：默认图标与拖拽排除规则。解耦评估：复用 col 领域穷举守卫，不使用断言。 */
import {toTAVCol} from "./imports";

/** 获取装饰协议要求存在的子节点；DOM 结构损坏时显式失败。 */
const getRequiredDecorationElement = (cellElement: HTMLElement, selector: string) => {
    const element = cellElement.querySelector(selector);
    if (!element) {
        throw new Error(`AV cell decoration requires ${selector}`);
    }
    return element;
};

/** 同步增删表头固定标记，保持标记紧随文字节点。 */
const updateHeaderPin = (cellElement: HTMLElement, pin: boolean) => {
    if (!pin) {
        const pinElement = cellElement.querySelector(".av__cellheadericon--pin");
        pinElement?.remove();
        return;
    }
    if (cellElement.querySelector(".av__cellheadericon--pin")) {
        return;
    }
    const textElement = getRequiredDecorationElement(cellElement, ".av__celltext");
    textElement.insertAdjacentHTML("afterend", '<svg class="av__cellheadericon av__cellheadericon--pin"><use xlink:href="#iconPin"></use></svg>');
};

/** 同步刷新表头图标、名称和固定标记。 @同步豁免: 需要绝对同步的DOM访问 */
export const updateHeaderCell = (cellElement: HTMLElement, headerValue: {
    icon?: string,
    name?: string,
    pin?: boolean,
}) => {
    // icon 字段显式出现时才替换现有表头图标，缺省表示保持当前 DOM。
    if (typeof headerValue.icon !== "undefined") {
        cellElement.dataset.icon = headerValue.icon;
        const iconElement = getRequiredDecorationElement(cellElement, ".av__cellheadericon");
        iconElement.outerHTML = headerValue.icon ? unicode2Emoji(headerValue.icon, "av__cellheadericon", true) : `<svg class="av__cellheadericon"><use xlink:href="#${getColIconByType(toTAVCol(cellElement.dataset.dtype))}"></use></svg>`;
    }
    // name 字段显式出现时同步文字，允许空字符串清空标题。
    if (typeof headerValue.name !== "undefined") {
        const textElement = getRequiredDecorationElement(cellElement, ".av__celltext");
        textElement.textContent = headerValue.name;
    }
    // pin 字段显式出现时增删固定标记，缺省不改变现有状态。
    if (typeof headerValue.pin !== "undefined") {
        updateHeaderPin(cellElement, headerValue.pin);
    }
};

/** 激活单元格并按列类型补充拖拽填充手柄。 @同步豁免: 需要绝对同步的DOM访问 */
export const addDragFill = (cellElement: Element) => {
    if (!cellElement) {
        return;
    }
    cellElement.classList.add("av__cell--active");
    if (cellElement.querySelector(".av__drag-fill")) {
        return;
    }
    const cellType = toTAVCol(cellElement.getAttribute("data-dtype"));
    if (cellType === "template" || cellType === "rollup" || cellType === "lineNumber" ||
        cellType === "created" || cellType === "updated") {
        return;
    }
    cellElement.insertAdjacentHTML("beforeend", `<div aria-label="${siyuanI18n.dragFill}" class="av__drag-fill ariaLabel"></div>`);
};
