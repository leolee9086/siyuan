import { fetchPost } from "../ai/imports";
import { Dialog } from "../dialog";
import { showMessage } from "../dialog/message";
import { rectElement } from "./anno";
import { getConfig } from "./anno.config";
import { getRelationHTML } from "./anno.getRelationHTML";

export const setRelation = (pdf: any) => {
    const config = getConfig(pdf);
    const configItem = config[rectElement.getAttribute("data-node-id")];
    if (!configItem.ids) {
        configItem.ids = [];
    }
    const dialog = new Dialog({
        title: window.siyuan.languages.relation,
        content: `<div class="b3-dialog__content">
    <div class="fn__flex">
        <input class="b3-text-field fn__flex-1" placeholder="${window.siyuan.languages.fileAnnoRefPlaceholder}">
        <div class="fn__space"></div>
        <button class="b3-button b3-button--text" data-type="add">${window.siyuan.languages.addAttr}</button>
    </div>
    <div class="fn__hr"></div>
    <ul class="b3-list b3-list--background">${getRelationHTML(configItem.ids)}</ul>
</div>`,
        width: "520px",
    });

    const addRelation = () => {
        if (/\d{14}-\w{7}/.test(inputElement.value)) {
            if (!configItem.ids.includes(inputElement.value)) {
                configItem.ids.push(inputElement.value);
                updateRelation(pdf, config);
                rectElement.dataset.relations = configItem.ids;
                dialog.element.querySelector(".b3-list").innerHTML = getRelationHTML(configItem.ids);
            }
            inputElement.value = "";
        } else {
            showMessage("ID " + window.siyuan.languages.invalid);
        }
    };

    const updateRelation = (pdf: any, config: any) => {
        fetchPost("/api/asset/setFileAnnotation", {
            path: pdf.appConfig.file.replace(location.origin, "").substr(1) + ".sya",
            data: JSON.stringify(config),
        });
    };

    const inputElement = dialog.element.querySelector(".b3-text-field") as HTMLInputElement;
    inputElement.focus();
    inputElement.addEventListener("keydown", (event) => {
        if (event.isComposing) {
            return;
        }
        if (event.key === "Enter") {
            addRelation();
        }
    });
    dialog.element.addEventListener("click", (event) => {
        let target = event.target as HTMLElement;
        while (target && !target.classList.contains("b3-dialog__content")) {
            const type = target.getAttribute("data-type");
            if (type === "add") {
                addRelation();
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (type === "clear") {
                configItem.ids.splice(configItem.ids.indexOf(target.parentElement.textContent.trim()), 1);
                updateRelation(pdf, config);
                rectElement.dataset.relations = configItem.ids;
                dialog.element.querySelector(".b3-list").innerHTML = getRelationHTML(configItem.ids);
            }
            target = target.parentElement;
        }
    });
};
