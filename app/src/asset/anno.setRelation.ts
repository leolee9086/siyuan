import { fetchPost } from "../ai/imports";
import { Dialog } from "../dialog";
import { showMessage } from "../dialog/message";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n";
import { rectElement } from "./anno";
import { getConfig } from "./anno.config";
import { getRelationHTML } from "./anno.getRelationHTML";

const addRelation = (inputElement: HTMLInputElement, configItem: any, pdf: any, config: any, dialog: any, rectElement: any) => {
    if (/\d{14}-\w{7}/.test(inputElement.value)) {
        if (!configItem.ids.includes(inputElement.value)) {
            configItem.ids.push(inputElement.value);
            updateRelation(pdf, config);
            rectElement.dataset.relations = configItem.ids;
            dialog.element.querySelector(".b3-list").innerHTML = getRelationHTML(configItem.ids);
        }
        inputElement.value = "";
    } else {
        showMessage("ID " + siyuanI18n.invalid);
    }
};

const updateRelation = (pdf: any, config: any) => {
    fetchPost("/api/asset/setFileAnnotation", {
        path: pdf.appConfig.file.replace(location.origin, "").substr(1) + ".sya",
        data: JSON.stringify(config),
    });
};

const handleKeydownEvent = (event: KeyboardEvent, inputElement: HTMLInputElement, configItem: any, pdf: any, config: any, dialog: any, rectElement: any) => {
    if (event.isComposing) {
        return;
    }
    if (event.key === "Enter") {
        addRelation(inputElement, configItem, pdf, config, dialog, rectElement);
    }
};

const handleClickEvent = (event: Event, configItem: any, pdf: any, config: any, dialog: any, rectElement: any) => {
    let target = event.target as HTMLElement;
    while (target && !target.classList.contains("b3-dialog__content")) {
        const type = target.getAttribute("data-type");
        if (type === "add") {
            addRelation(dialog.element.querySelector(".b3-text-field") as HTMLInputElement, configItem, pdf, config, dialog, rectElement);
            event.preventDefault();
            event.stopPropagation();
            break;
        } else if (type === "clear") {
            const parentElement = target.parentElement;
            if (parentElement && parentElement.textContent) {
                configItem.ids.splice(configItem.ids.indexOf(parentElement.textContent.trim()), 1);
                updateRelation(pdf, config);
                rectElement.dataset.relations = configItem.ids;
                const listElement = dialog.element.querySelector(".b3-list");
                if (listElement) {
                    listElement.innerHTML = getRelationHTML(configItem.ids);
                }
            }
        }
        const nextParent = target.parentElement;
        if (nextParent) {
            target = nextParent;
        } else {
            break;
        }
    }
};

const createRelationDialog = (configItem: any) => {
    return new Dialog({
        title: siyuanI18n.relation,
        content: /*html */`<div class="b3-dialog__content">
    <div class="fn__flex">
        <input class="b3-text-field fn__flex-1" placeholder="${siyuanI18n.fileAnnoRefPlaceholder}">
        <div class="fn__space"></div>
        <button class="b3-button b3-button--text" data-type="add">${siyuanI18n.addAttr}</button>
    </div>
    <div class="fn__hr"></div>
    <ul class="b3-list b3-list--background">${getRelationHTML(configItem.ids)}</ul>
</div>`,
        width: "520px",
    });
};

const setupDialogEventListeners = (inputElement: HTMLInputElement, configItem: any, pdf: any, config: any, dialog: any, rectElement: any) => {
    inputElement.focus();
    inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
        handleKeydownEvent(event, inputElement, configItem, pdf, config, dialog, rectElement);
    });
    dialog.element.addEventListener("click", (event: Event) => {
        handleClickEvent(event, configItem, pdf, config, dialog, rectElement);
    });
};

export const setRelation = (pdf: any) => {
    const config = getConfig(pdf);
    if (!rectElement) {
        return;
    }
    const nodeId = rectElement.getAttribute("data-node-id");
    if (!nodeId) {
        return;
    }
    const configItem = config[nodeId];
    if (!configItem.ids) {
        configItem.ids = [];
    }
    
    const dialog = createRelationDialog(configItem);
    const inputElement = dialog.element.querySelector(".b3-text-field") as HTMLInputElement;
    
    setupDialogEventListeners(inputElement, configItem, pdf, config, dialog, rectElement);
};
