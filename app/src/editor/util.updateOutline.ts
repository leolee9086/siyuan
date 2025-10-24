import { hasClosestByAttribute } from "../protyle/util/hasClosest";
import { fetchPost } from "../util/fetch";
import { isCurrentEditor } from "./util.isCurrentEditor";


export const updateOutline = (models: IModels, protyle: IProtyle, reload = false) => {
    models.outline.find(item => {
        if (reload ||
            (item.type === "pin" &&
                (!protyle || item.blockId !== protyle.block?.rootID ||
                    item.isPreview === protyle.preview.element.classList.contains("fn__none"))
            )) {
            let blockId = "";
            if (protyle && protyle.block) {
                blockId = protyle.block.rootID;
            }
            if (blockId === item.blockId && !reload && item.isPreview !== protyle.preview.element.classList.contains("fn__none")) {
                return;
            }

            fetchPost("/api/outline/getDocOutline", {
                id: blockId,
                preview: !protyle.preview.element.classList.contains("fn__none")
            }, response => {
                if (!reload && (!isCurrentEditor(blockId) || item.blockId === blockId) &&
                    item.isPreview !== protyle.preview.element.classList.contains("fn__none")) {
                    return;
                }
                item.isPreview = !protyle.preview.element.classList.contains("fn__none");
                item.update(response, blockId);
                if (protyle) {
                    item.updateDocTitle(protyle.background.ial);
                    if (getSelection().rangeCount > 0) {
                        const startContainer = getSelection().getRangeAt(0).startContainer;
                        if (protyle.wysiwyg.element.contains(startContainer)) {
                            const currentElement = hasClosestByAttribute(startContainer, "data-node-id", null);
                            if (currentElement) {
                                item.setCurrent(currentElement);
                            }
                        }
                    }
                } else {
                    item.updateDocTitle();
                }
            });
        }
    });
};
