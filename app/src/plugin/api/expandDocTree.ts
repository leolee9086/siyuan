import { fetchSyncPost } from "../../util/network/fetch";
import { Files } from "../../layout/dock/Files";
import { getModelByDockType } from "./getModelByDockType";

export const expandDocTree = async (options: {
    id: string,
    isSetCurrent?: boolean
}) => {
    let isNotebook = false;
    window.siyuan.notebooks.find(item => {
        if (options.id === item.id) {
            isNotebook = true;
            return true;
        }
    });
    let liElement: HTMLElement;
    let notebookId = options.id;
    const file = getModelByDockType("file") as Files;
    if (typeof options.isSetCurrent === "undefined") {
        options.isSetCurrent = true;
    }
    if (isNotebook) {
        liElement = file.element.querySelector(`.b3-list[data-url="${options.id}"]`)?.firstElementChild as HTMLElement;
    } else {
        const response = await fetchSyncPost("api/block/getBlockInfo", { id: options.id });
        if (response.code === -1) {
            return;
        }
        notebookId = response.data.box;
        liElement = await file.selectItem(response.data.box, response.data.path, undefined, undefined, options.isSetCurrent);
    }
    if (!liElement) {
        return;
    }
    if (options.isSetCurrent || typeof options.isSetCurrent === "undefined") {
        file.setCurrent(liElement);
    }
    const toggleElement = liElement.querySelector(".b3-list-item__arrow");
    if (toggleElement.classList.contains("b3-list-item__arrow--open")) {
        return;
    }
    file.getLeaf(liElement, notebookId);
};
