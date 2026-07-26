import {fetchPost} from "./imports";
import { Dialog } from "../../dialog";
import { showMessage } from "../../dialog/message";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getConfig } from "./config";
import { getRelationHTML } from "./anno.getRelationHTML";
import type { IPdfInstance, IPdfAnno, RectElementType } from "./anno.types";

/**
 * @作用: 更新关联列表的HTML显示
 * @意图: 提取公共逻辑,避免嵌套if
 * @调用时机: 在添加或删除关联后调用
 * @问题/改进: 无已知问题
 */
const updateRelationListHTML = (dialog: Dialog, ids: string[]) => {
    const listElement = dialog.element.querySelector(".b3-list");
    if (!listElement) {
        return;
    }
    listElement.innerHTML = getRelationHTML(ids);
};

/**
 * @作用: 向PDF注释添加关联的笔记块ID，并更新界面显示。验证输入的ID格式，将有效ID添加到关联列表中。
 * @意图: 建立PDF注释与思源笔记块之间的双向关联，使用户可以在PDF注释和笔记内容之间快速跳转。
 * @调用时机: 当用户在关联对话框中输入ID并按回车键时（通过handleKeydownEvent），或点击"添加"按钮时（通过handleClickEvent）。
 * @问题/改进: 参数类型使用了any，应该使用更具体的类型定义以提升类型安全性。另外，ID格式验证硬编码了正则表达式，可以考虑提取为常量。
 */
const addRelation = (inputElement: HTMLInputElement, configItem: IPdfAnno, pdf: IPdfInstance, config: Record<string, IPdfAnno>, dialog: Dialog, rectElement: HTMLElement) => {
    if (!/\d{14}-\w{7}/.test(inputElement.value)) {
        showMessage("ID " + siyuanI18n.invalid);
        return;
    }

    const ids = configItem.ids ?? [];
    if (!ids.includes(inputElement.value)) {
        ids.push(inputElement.value);
        configItem.ids = ids;
        updateRelation(pdf, config);
        rectElement.dataset.relations = ids.join(",");
        updateRelationListHTML(dialog, ids);
    }
    inputElement.value = "";
};

/**
 * @作用: 将PDF注释的关联配置保存到后端服务器。通过API调用将配置数据序列化并写入.sya文件。
 * @意图: 持久化PDF注释的关联关系，确保关联数据在关闭应用后仍然保留。
 * @调用时机: 在addRelation添加关联或removeRelation删除关联后立即调用，保持数据同步。
 * @问题/改进: 这是一个异步操作但没有返回Promise，调用方无法知道保存是否成功。建议改为async函数并添加错误处理。
 */
const updateRelation = (pdf: IPdfInstance, config: Record<string, IPdfAnno>) => {
    fetchPost("/api/asset/setFileAnnotation", {
        path: pdf.appConfig.file.replace(location.origin, "").substr(1) + ".sya",
        data: JSON.stringify(config),
    });
};

/**
 * @作用: 从PDF注释的关联列表中删除指定的笔记块ID，并更新界面和数据。
 * @意图: 允许用户取消PDF注释与某个笔记块的关联，提供灵活的关联管理能力。
 * @调用时机: 当用户点击关联列表中某个关联项的删除按钮（data-type="clear"）时，通过handleClickEvent调用。
 * @问题/改进: 依赖父元素的textContent来获取ID可能不够健壮，建议使用data-id等属性存储ID值。
 */
const removeRelation = (target: HTMLElement, configItem: IPdfAnno, pdf: IPdfInstance, config: Record<string, IPdfAnno>, dialog: Dialog, rectElement: HTMLElement) => {
    const parentElement = target.parentElement;
    if (!parentElement || !parentElement.textContent) {
        return;
    }
    const ids = configItem.ids ?? [];
    ids.splice(ids.indexOf(parentElement.textContent.trim()), 1);
    configItem.ids = ids;
    updateRelation(pdf, config);
    rectElement.dataset.relations = ids.join(",");
    updateRelationListHTML(dialog, ids);
};

/**
 * @作用: 处理关联对话框输入框的键盘事件，当用户按下回车键时触发添加关联操作。
 * @意图: 提供便捷的键盘交互方式，让用户无需点击按钮即可添加关联。
 * @调用时机: 在setupDialogEventListeners中绑定到输入框的keydown事件，每次按键都会触发。
 * @问题/改进: 目前只处理了Enter键，可以考虑添加Escape键关闭对话框等其他快捷键支持。
 */
const handleKeydownEvent = (event: Event, inputElement: HTMLInputElement, configItem: IPdfAnno, pdf: IPdfInstance, config: Record<string, IPdfAnno>, dialog: Dialog, rectElement: HTMLElement) => {
    if (!(event instanceof KeyboardEvent)) {
        return;
    }
    if (event.isComposing) {
        return;
    }
    if (event.key === "Enter") {
        addRelation(inputElement, configItem, pdf, config, dialog, rectElement);
    }
};

/**
 * @作用: 处理点击添加按钮时的逻辑，验证输入框元素并调用添加关联函数。
 * @意图: 将添加关联的点击处理逻辑提取为独立函数，避免嵌套 If 语句。
 * @调用时机: 当用户点击对话框中的"添加"按钮（data-type="add"）时调用。
 * @问题/改进: 如果输入框不存在，函数会静默失败，可以考虑添加警告日志。
 */
const handleAddRelationClick = (dialog: Dialog, configItem: IPdfAnno, pdf: IPdfInstance, config: Record<string, IPdfAnno>, rectElement: HTMLElement, event: Event) => {
    const inputElement = dialog.element.querySelector(".b3-text-field");
    if (!(inputElement instanceof HTMLInputElement)) {
        return;
    }
    addRelation(inputElement, configItem, pdf, config, dialog, rectElement);
    event.preventDefault();
    event.stopPropagation();
};

/**
 * @作用: 处理关联对话框内的点击事件，根据点击目标的data-type属性分发到对应的处理函数。
 * @意图: 使用事件委托模式统一处理对话框内的所有点击操作，包括添加关联和删除关联。
 * @调用时机: 在setupDialogEventListeners中绑定到对话框根元素的click事件，对话框内任何点击都会触发。
 * @问题/改进: 当前实现通过向上遍历DOM查找目标元素，在复杂DOM结构下可能有性能问题，可以考虑使用closest方法简化。
 */
const handleClickEvent = (event: Event, configItem: IPdfAnno, pdf: IPdfInstance, config: Record<string, IPdfAnno>, dialog: Dialog, rectElement: HTMLElement) => {
    if (!(event.target instanceof HTMLElement)) {
        return;
    }
    let target = event.target;
    while (target && !target.classList.contains("b3-dialog__content")) {
        const type = target.getAttribute("data-type");
        if (type === "add") {
            handleAddRelationClick(dialog, configItem, pdf, config, rectElement, event);
            break;
        }

        if (type === "clear") {
            removeRelation(target, configItem, pdf, config, dialog, rectElement);
        }
        const nextParent = target.parentElement;
        if (!nextParent) {
            break;
        }
        target = nextParent;
    }
};

/**
 * @作用: 创建并返回一个用于管理PDF注释关联的对话框，包含输入框、添加按钮和关联列表。
 * @意图: 封装对话框的创建逻辑，提供统一的UI组件来展示和管理关联关系。
 * @调用时机: 在setRelation函数中，当用户触发设置关联操作时调用，每次都创建新的对话框实例。
 * @问题/改进: 每次都创建新对话框可能造成资源浪费，可以考虑复用对话框实例并更新内容。
 */
const createRelationDialog = (configItem: IPdfAnno) => {
    return new Dialog({
        title: siyuanI18n.relation,
        content: /*html */`<div class="b3-dialog__content">
    <div class="fn__flex">
        <input class="b3-text-field fn__flex-1" placeholder="${siyuanI18n.fileAnnoRefPlaceholder}">
        <div class="fn__space"></div>
        <button class="b3-button b3-button--text" data-type="add">${siyuanI18n.addAttr}</button>
    </div>
    <div class="fn__hr"></div>
    <ul class="b3-list b3-list--background">${getRelationHTML(configItem.ids ?? [])}</ul>
</div>`,
        width: "520px",
    });
};

/**
 * @作用: 为关联对话框设置事件监听器，包括输入框的键盘事件和对话框的点击事件，并将焦点设置到输入框。
 * @意图: 集中管理对话框的交互逻辑，使用Dialog.listen方法统一管理监听器生命周期，在对话框销毁时自动清理。
 * @调用时机: 在setRelation函数中创建对话框后立即调用，完成对话框的交互初始化。
 * @问题/改进: 无已知问题。
 */
const setupDialogEventListeners = (inputElement: HTMLInputElement, configItem: IPdfAnno, pdf: IPdfInstance, config: Record<string, IPdfAnno>, dialog: Dialog, rectElement: HTMLElement) => {
    inputElement.focus();
    dialog.listen(inputElement, "keydown", (event) => {
        handleKeydownEvent(event, inputElement, configItem, pdf, config, dialog, rectElement);
    });
    dialog.listen(dialog.element, "click", (event) => {
        handleClickEvent(event, configItem, pdf, config, dialog, rectElement);
    });
};

/**
 * @作用: 打开PDF注释的关联管理对话框，允许用户为当前选中的PDF注释添加或删除与思源笔记块的关联。
 * @意图: 提供一个统一的入口函数来初始化和展示关联管理界面，整合配置获取、对话框创建和事件绑定等步骤。
 * @调用时机: 当用户在PDF注释上触发"设置关联"操作时调用，通常由工具栏按钮或右键菜单触发。
 * @问题/改进: 无已知问题。
 */
export const setRelation = (pdf: IPdfInstance, rectElement: RectElementType) => {
    const config = getConfig(pdf);
    if (!rectElement) {
        return;
    }
    const nodeId = rectElement.getAttribute("data-node-id");
    if (!nodeId) {
        return;
    }
    const configItem = config[nodeId];
    if (!configItem) {
        return;
    }
    if (!configItem.ids) {
        configItem.ids = [];
    }

    const dialog = createRelationDialog(configItem);
    const inputElement = dialog.element.querySelector(".b3-text-field");

    if (!inputElement || !(inputElement instanceof HTMLInputElement)) {
        return;
    }

    setupDialogEventListeners(inputElement, configItem, pdf, config, dialog, rectElement);
};

