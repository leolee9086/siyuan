import {submitAVColumnEditTransaction} from "../../../wysiwyg/transaction/prepared/av/avColumnEdit";
import {updateAttrViewColAnimation} from "../action/animation";
import {escapeHtml} from "../../../../util/DOM/escape";
import {siyuanI18n} from "../../../../util/siyuanEnvironments/i18n.getI18n.environment";
import type {IBindEditContext} from "./col.editPanel.bind.types";

/** @同步豁免: UI构建 — 绑定列名称输入框的 blur/keydown/keyup 事件 */
export const bindNameEvents = (ctx: IBindEditContext): void => {
    const {nameElement, colId, colData, menuElement, avID} = ctx;
    // @内联回调
    nameElement.addEventListener("blur", () => {
        const newValue = nameElement.value;
        // 值未变化时跳过事务
        if (newValue === colData.name) {
            return;
        }
        submitAVColumnEditTransaction(ctx.protyle, [{
            action: "updateAttrViewCol",
            id: colId, avID, name: newValue, type: colData.type,
        }], [{
            action: "updateAttrViewCol",
            id: colId, avID, name: colData.name, type: colData.type,
        }]);
        colData.name = newValue;
        updateAttrViewColAnimation(ctx.protyle, avID, colId, {name: newValue});
    });
    // @内联回调
    nameElement.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.isComposing) {
            return;
        }
        // Escape 关闭编辑面板
        if (event.key === "Escape") {
            menuElement.parentElement?.remove();
            return;
        }
        // Enter 提交并关闭
        if (event.key === "Enter") {
            nameElement.dispatchEvent(new CustomEvent("blur"));
            menuElement.parentElement?.remove();
        }
    });
    // @内联回调
    nameElement.addEventListener("keyup", (event: KeyboardEvent) => {
        if (event.isComposing) {
            return;
        }
        const inputElement = menuElement.querySelector('[data-type="colName"]');
        // 同步更新关联列名占位符
        if (inputElement instanceof HTMLInputElement) {
            inputElement.setAttribute("placeholder", `${ctx.data.name} ${nameElement.value}`);
        }
    });
    nameElement.select();
    nameElement.value = colData.name;
};

/** @同步豁免: UI构建 — 绑定描述文本域的展开/折叠、blur、keydown、input 事件 */
export const bindDescEvents = (ctx: IBindEditContext): void => {
    const {nameElement, colId, colData, menuElement, avID} = ctx;
    const descElement = menuElement.querySelector('.b3-text-field[data-type="desc"]');
    // 描述文本域不存在时跳过
    if (!(descElement instanceof HTMLTextAreaElement)) {
        return;
    }
    const infoIcon = nameElement.nextElementSibling;
    // @内联回调
    infoIcon?.addEventListener("click", () => {
        const descPanelElement = descElement.parentElement;
        // 面板不存在时跳过
        if (!descPanelElement) {
            return;
        }
        descPanelElement.classList.toggle("fn__none");
        // 面板展开后自动聚焦描述输入框
        if (!descPanelElement.classList.contains("fn__none")) {
            descElement.focus();
        }
    });
    // @内联回调
    descElement.addEventListener("blur", () => {
        const newValue = descElement.value;
        // 值未变化时跳过事务
        if (newValue === colData.desc) {
            return;
        }
        submitAVColumnEditTransaction(ctx.protyle, [{
            action: "setAttrViewColDesc",
            id: colId, avID, data: newValue,
        }], [{
            action: "setAttrViewColDesc",
            id: colId, avID, data: colData.desc,
        }]);
        colData.desc = newValue;
    });
    // @内联回调
    descElement.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.isComposing) {
            return;
        }
        // Escape 关闭编辑面板
        if (event.key === "Escape") {
            menuElement.parentElement?.remove();
            return;
        }
        // Enter 提交并关闭
        if (event.key === "Enter") {
            descElement.dispatchEvent(new CustomEvent("blur"));
            menuElement.parentElement?.remove();
        }
    });
    descElement.addEventListener("input", () => {
        infoIcon?.setAttribute("aria-label", descElement.value ? escapeHtml(descElement.value) : siyuanI18n.addDesc);
    });
};

/** @同步豁免: UI构建 — 绑定模板文本域的 blur/keydown 事件 */
export const bindTemplateEvents = (ctx: IBindEditContext): void => {
    const {colId, colData, menuElement, avID} = ctx;
    const tplElement = menuElement.querySelector('[data-type="updateTemplate"]');
    // 模板文本域不存在时跳过（非 template 类型列）
    if (!(tplElement instanceof HTMLTextAreaElement)) {
        return;
    }
    // @内联回调
    tplElement.addEventListener("blur", () => {
        const newValue = tplElement.value;
        // 值未变化时跳过事务
        if (newValue === colData.template) {
            return;
        }
        submitAVColumnEditTransaction(ctx.protyle, [{
            action: "updateAttrViewColTemplate",
            id: colId, avID, data: newValue, type: colData.type,
        }], [{
            action: "updateAttrViewColTemplate",
            id: colId, avID, data: colData.template, type: colData.type,
        }]);
        colData.template = newValue;
    });
    // @内联回调
    tplElement.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.isComposing) {
            return;
        }
        // Escape 关闭编辑面板
        if (event.key === "Escape") {
            menuElement.parentElement?.remove();
            return;
        }
        // Enter（非 Shift）提交并关闭
        if (event.key === "Enter" && !event.shiftKey) {
            tplElement.dispatchEvent(new CustomEvent("blur"));
            menuElement.parentElement?.remove();
        }
    });
};

/** @同步豁免: UI构建 — 绑定 includeTime 开关事件 */
export const bindIncludeTimeEvent = (ctx: IBindEditContext): void => {
    const {colId, colData, menuElement, avID} = ctx;
    const includeTimeElement = menuElement.querySelector('.b3-switch[data-type="includeTime"]');
    // 非 created/updated 类型列无此开关
    if (!(includeTimeElement instanceof HTMLInputElement)) {
        return;
    }
    // @内联回调
    includeTimeElement.addEventListener("change", () => {
        const action = colData.type === "updated" ? "setAttrViewUpdatedIncludeTime" : "setAttrViewCreatedIncludeTime";
        submitAVColumnEditTransaction(ctx.protyle, [{
            action, id: colId, avID, data: includeTimeElement.checked,
        }], [{
            action, id: colId, avID, data: !includeTimeElement.checked,
        }]);
        // 更新本地时间戳数据（updated/created 共用同一结构）
        const existing = colData.type === "updated" ? colData.updated : colData.created;
        if (existing) {
            existing.includeTime = includeTimeElement.checked;
            return;
        }
        // 首次设置时初始化对象
        if (colData.type === "updated") {
            colData.updated = {includeTime: includeTimeElement.checked};
        }
        // created 类型列首次设置时初始化
        if (colData.type === "created") {
            colData.created = {includeTime: includeTimeElement.checked};
        }
    });
};

/** @同步豁免: UI构建 — 绑定 wrap 开关事件 */
export const bindWrapEvent = (ctx: IBindEditContext): void => {
    const {colId, colData, menuElement, avID} = ctx;
    const wrapElement = menuElement.querySelector('.b3-switch[data-type="wrap"]');
    // wrap 开关不存在时跳过
    if (!(wrapElement instanceof HTMLInputElement)) {
        return;
    }
    // @内联回调
    wrapElement.addEventListener("change", () => {
        submitAVColumnEditTransaction(ctx.protyle, [{
            action: "setAttrViewColWrap",
            id: colId, avID, data: wrapElement.checked,
            blockID: ctx.blockID, viewID: ctx.data.viewID,
        }], [{
            action: "setAttrViewColWrap",
            id: colId, avID, data: !wrapElement.checked,
            viewID: ctx.data.viewID, blockID: ctx.blockID,
        }]);
        colData.wrap = wrapElement.checked;
        ctx.data.view.wrapField = ctx.data.view.wrapField && wrapElement.checked;
    });
};

/** @同步豁免: UI构建 — 绑定选项添加输入框的 keydown 事件 */
export const bindAddOptionEvent = (ctx: IBindEditContext): void => {
    const {colId, colData, menuElement, avID} = ctx;
    const addOptionElement = menuElement.querySelector('[data-type="addOption"]');
    // 非 select/mSelect 类型列无此输入框
    if (!(addOptionElement instanceof HTMLInputElement)) {
        return;
    }
    // @内联回调
    addOptionElement.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.isComposing) {
            return;
        }
        // Escape 关闭编辑面板
        if (event.key === "Escape") {
            menuElement.parentElement?.remove();
            return;
        }
        // 非 Enter 键不处理
        if (event.key !== "Enter") {
            return;
        }
        const isDuplicate = colData.options?.some((item) => addOptionElement.value === item.name);
        // 重复或空值时跳过
        if (isDuplicate || !addOptionElement.value) {
            return;
        }
        colData.options = colData.options ?? [];
        colData.options.push({
            color: ((colData.options.length || 0) % 14 + 1).toString(),
            name: addOptionElement.value,
        });
        submitAVColumnEditTransaction(ctx.protyle, [{
            action: "updateAttrViewColOptions",
            id: colId, avID, data: colData.options,
        }], [{
            action: "removeAttrViewColOption",
            id: colId, avID, data: addOptionElement.value,
        }]);
        // 刷新编辑面板并聚焦添加输入框
        ctx.refreshEditPanel();
        const newAddOption = menuElement.querySelector('[data-type="addOption"]');
        // 刷新后重新查找添加输入框元素
        if (newAddOption instanceof HTMLInputElement) {
            newAddOption.focus();
        }
    });
};

/** @同步豁免: UI构建 — 绑定日期列的 fillCreated 和 fillSpecificTime 开关事件 */
export const bindDateSwitchEvents = (ctx: IBindEditContext): void => {
    const {colId, menuElement, avID} = ctx;
    const fillCreatedElement = menuElement.querySelector('[data-type="fillCreated"]');
    // fillCreated 开关存在时绑定事件
    if (fillCreatedElement instanceof HTMLInputElement) {
        // @内联回调
        fillCreatedElement.addEventListener("change", () => {
            submitAVColumnEditTransaction(ctx.protyle, [{
                avID, action: "setAttrViewColDateFillCreated",
                id: colId, data: fillCreatedElement.checked,
            }], [{
                avID, action: "setAttrViewColDateFillCreated",
                id: colId, data: !fillCreatedElement.checked,
            }]);
        });
    }
    const fillSpecificTimeElement = menuElement.querySelector('[data-type="fillSpecificTime"]');
    // fillSpecificTime 开关存在时绑定事件
    if (fillSpecificTimeElement instanceof HTMLInputElement) {
        // @内联回调
        fillSpecificTimeElement.addEventListener("change", () => {
            submitAVColumnEditTransaction(ctx.protyle, [{
                avID, action: "setAttrViewColDateFillSpecificTime",
                id: colId, data: fillSpecificTimeElement.checked,
            }], [{
                avID, action: "setAttrViewColDateFillSpecificTime",
                id: colId, data: !fillSpecificTimeElement.checked,
            }]);
        });
    }
};

