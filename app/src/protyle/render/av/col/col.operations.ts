import {transaction} from "../../../wysiwyg/transaction/submit";
import * as dayjs from "dayjs";
import {getPropertiesHTML} from "./properties/render";
import {removeAttrViewColAnimation} from "../action";
import {addAttrViewColAnimation} from "./col.addAttrViewColAnimation";
import {duplicateNameAddOne} from "../../../../util/platform/functions";
import {setPosition} from "../../../../util/DOM/positioning/setPosition";
import {getFieldsByData} from "../view/metadata";

/**
 * 在字段列表中查找并移除指定列，返回列数据和前一列 ID
 *
 * 作用：遍历字段列表，找到目标列后记录前一列 ID 并从列表中移除
 * 意图：从 removeCol 中提取，消除内联回调和隐式上下文切换
 * 调用时机：removeCol 执行列删除前调用
 *
 * @param fields - 字段列表
 * @param colId - 要移除的列 ID
 * @returns 被移除的列数据和前一列 ID
 */
/** @同步豁免: UI构建 — 纯数据操作 */
const findAndSpliceCol = (
    fields: IAVColumn[], colId: string,
): { colData: IAVColumn | undefined; previousID: string } => {
    let previousID = "";
    let colData: IAVColumn | undefined;
    for (let index = 0; index < fields.length; index++) {
        const field: IAVColumn | undefined = fields[index];
        if (!field || field.id !== colId) {
            continue;
        }
        const prevField = fields[index - 1];
        previousID = prevField?.id ?? "";
        colData = field;
        fields.splice(index, 1);
        break;
    }
    return {colData, previousID};
};

/**
 * 在字段列表中查找目标列并深拷贝插入到其后
 *
 * 作用：遍历字段列表，找到目标列后深拷贝并插入到原列之后
 * 意图：从 duplicateCol 中提取，消除 find 内联回调和赋值前使用变量的 TS 错误
 * 调用时机：duplicateCol 执行列复制前调用
 *
 * @param fields - 字段列表
 * @param colId - 要复制的列 ID
 * @returns 深拷贝的列数据，未找到时返回 undefined
 */
/** @同步豁免: UI构建 — 纯数据操作 */
const findAndDuplicateCol = (
    fields: IAVColumn[], colId: string,
): IAVColumn | undefined => {
    for (let index = 0; index < fields.length; index++) {
        const field: IAVColumn | undefined = fields[index];
        if (!field || field.id !== colId) {
            continue;
        }
        const copy: IAVColumn = JSON.parse(JSON.stringify(field));
        fields.splice(index + 1, 0, copy);
        return copy;
    }
    return undefined;
};

/**
 * 复制数据视图中的一列。
 *
 * 作用：深拷贝指定列的数据并插入到原列之后，生成新的列 ID 和名称
 * 意图：允许用户快速创建结构相同的列，避免重复配置
 * 调用时机：表头右键菜单"复制列"、属性面板"复制列"按钮
 *
 * @param options - 包含 protyle、colId、viewID、blockElement、data 的配置对象
 */
/** @同步豁免: UI构建 — 同步执行事务和动画，无异步数据源 */
export const duplicateCol = (options: {
    protyle: IProtyle,
    colId: string,
    viewID: string,
    blockElement: Element,
    data: IAV,
}) => {
    const newColData = findAndDuplicateCol(getFieldsByData(options.data), options.colId);
    // 未找到目标列时跳过
    if (!newColData) {
        return;
    }
    newColData.name = duplicateNameAddOne(newColData.name);
    newColData.id = Lute.NewNodeID();
    const newUpdated = dayjs().format("YYYYMMDDHHmmss");
    const blockId = options.blockElement.getAttribute("data-node-id") ?? "";
    transaction(options.protyle, [{
        action: "duplicateAttrViewKey",
        keyID: options.colId,
        nextID: newColData.id,
        avID: options.data.id,
    }, {
        action: "doUpdateUpdated",
        id: blockId,
        data: newUpdated,
    }], [{
        action: "removeAttrViewCol",
        id: newColData.id,
        avID: options.data.id,
    }, {
        action: "doUpdateUpdated",
        id: blockId,
        data: options.blockElement.getAttribute("updated")
    }]);
    addAttrViewColAnimation({
        blockElement: options.blockElement,
        protyle: options.protyle,
        type: newColData.type,
        name: newColData.name,
        icon: newColData.icon,
        previousID: options.colId,
        data: options.data,
        id: newColData.id,
    });
    options.blockElement.setAttribute("updated", newUpdated);
};

/**
 * 列删除后更新面板 UI
 *
 * 作用：自定义属性面板直接移除，普通面板刷新属性列表并重新定位
 * 意图：从 removeCol 中提取以降低函数行数
 * 调用时机：removeCol 执行事务和动画后调用
 *
 * @param options - removeCol 的配置对象
 */
/** @同步豁免: UI构建 — 同步 DOM 操作 */
const updateRemoveColPanel = (options: {
    fields: IAVColumn[],
    isCustomAttr: boolean,
    menuElement: HTMLElement,
    avPanelElement: Element,
    tabRect: DOMRect,
}): void => {
    // 自定义属性面板直接移除
    if (options.isCustomAttr) {
        options.avPanelElement.remove();
        return;
    }
    // 普通面板刷新属性列表
    options.menuElement.innerHTML = getPropertiesHTML(options.fields);
    setPosition(options.menuElement,
        options.tabRect.right - options.menuElement.clientWidth, options.tabRect.bottom,
        options.tabRect.height);
};

/**
 * 从数据视图面板中移除一列。
 *
 * 作用：删除指定列并更新面板 UI（自定义属性面板直接移除，普通面板刷新属性列表）
 * 意图：提供列删除功能，同时处理两种面板类型的 UI 更新差异
 * 调用时机：属性面板中点击"删除列"按钮
 *
 * @param options - 包含 protyle、fields、avID、blockID 等的配置对象
 */
/** @同步豁免: UI构建 — 同步执行事务和 DOM 操作 */
export const removeCol = (options: {
    protyle: IProtyle,
    fields: IAVColumn[],
    avID: string,
    blockID: string,
    isCustomAttr: boolean
    menuElement: HTMLElement,
    blockElement: Element
    avPanelElement: Element
    tabRect: DOMRect,
    isTwoWay: boolean
}) => {
    const menuItem = options.menuElement.querySelector(".b3-menu__item");
    const colId = menuItem?.getAttribute("data-col-id") ?? "";
    const {colData, previousID} = findAndSpliceCol(options.fields, colId);
    const newUpdated = dayjs().format("YYYYMMDDHHmmss");
    transaction(options.protyle, [{
        action: "removeAttrViewCol",
        id: colId,
        avID: options.avID,
        removeDest: options.isTwoWay
    }, {
        action: "doUpdateUpdated",
        id: options.blockID,
        data: newUpdated,
    }], [{
        action: "addAttrViewCol",
        name: colData?.name ?? "",
        avID: options.avID,
        type: colData?.type ?? "text",
        id: colId,
        previousID: previousID
    }, {
        action: "doUpdateUpdated",
        id: options.blockID,
        data: options.blockElement.getAttribute("updated")
    }]);
    removeAttrViewColAnimation(options.blockElement, colId);
    options.blockElement.setAttribute("updated", newUpdated);
    updateRemoveColPanel(options);
};
