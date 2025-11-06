import { Outline } from "../layout/dock/Outline";
import { hasClosestByAttribute } from "../protyle/util/hasClosest";
import { fetchPost } from "../util/fetch";
import { isCurrentEditor } from "./util.isCurrentEditor";


const handleOutlineUpdateResponse = (
    response: any,
    item: Outline,
    protyle: IProtyle,
    blockId: string,
    reload: boolean
) => {
    if (!protyle.preview) {
        console.error('protyle 结构错误');
        throw ('protyle 结构错误');
    }
    
    if (!reload && (!isCurrentEditor(blockId) || item.blockId === blockId) &&
        item.isPreview !== protyle.preview.element.classList.contains("fn__none")) {
        return;
    }
    
    item.isPreview = !protyle.preview.element.classList.contains("fn__none");
    item.update(response, blockId);
    
    if (protyle) {
        item.updateDocTitle(protyle.background?.ial);
        const currentSelection = getSelection();
        if (currentSelection && currentSelection.rangeCount > 0) {
            const startContainer = currentSelection.getRangeAt(0).startContainer;
            if (protyle.wysiwyg?.element.contains(startContainer)) {
                const currentElement = hasClosestByAttribute(startContainer, "data-node-id", null);
                if (currentElement) {
                    item.setCurrent(currentElement);
                }
            }
        }
    } else {
        item.updateDocTitle();
    }
};


export const updateOutline = (models: IModels, protyle: IProtyle, reload = false) => {

    models.outline.find(item => {
        if (!protyle.preview||!protyle.block.rootID) {
            console.error(models, protyle, reload)
            throw ('protyle 结构错误')
        }
        if (reload ||
            (item.type === "pin" &&
                (!protyle || item.blockId !== protyle.block?.rootID ||
                    item.isPreview === protyle.preview.element.classList.contains("fn__none"))
            )
        ) {
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
                handleOutlineUpdateResponse(response, item, protyle, blockId, reload);
            });
        }
    });
};

