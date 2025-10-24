import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { fetchPost } from "../util/fetch";
import { isCurrentEditor } from "./util";


export const updateBacklinkGraph = (models: IModels, protyle: IProtyle) => {
    // https://ld246.com/article/1637636106054/comment/1641485541929#comments
    if (protyle && protyle.element.classList.contains("fn__none") ||
        (protyle && !hasClosestByClassName(protyle.element, "layout__wnd--active") &&
            document.querySelector(".layout__wnd--active") // https://github.com/siyuan-note/siyuan/issues/4414
        )) {
        return;
    }
    models.graph.forEach(item => {
        if (item.type !== "global" && (!protyle || item.blockId !== protyle.block?.id)) {
            if (item.type === "local" && item.rootId !== protyle?.block?.rootID) {
                return;
            }
            let blockId = "";
            if (protyle && protyle.block) {
                blockId = protyle.block.showAll ? protyle.block.id : protyle.block.parentID;
            }
            if (blockId === item.blockId) {
                return;
            }
            item.searchGraph(true, blockId);
        }
    });
    models.backlink.forEach(item => {
        if (item.type === "local" && item.rootId !== protyle?.block?.rootID) {
            return;
        }
        let blockId = "";
        if (protyle && protyle.block) {
            blockId = protyle.block.showAll ? protyle.block.id : protyle.block.parentID;
        }
        if (blockId === item.blockId) {
            return;
        }
        item.element.querySelector('.block__icon[data-type="refresh"] svg').classList.add("fn__rotate");
        fetchPost("/api/ref/getBacklink2", {
            sort: item.status[blockId] ? item.status[blockId].sort : "3",
            mSort: item.status[blockId] ? item.status[blockId].mSort : "3",
            id: blockId || "",
            k: item.inputsElement[0].value,
            mk: item.inputsElement[1].value,
        }, response => {
            if (!isCurrentEditor(blockId) || item.blockId === blockId) {
                item.element.querySelector('.block__icon[data-type="refresh"] svg').classList.remove("fn__rotate");
                return;
            }
            item.saveStatus();
            item.blockId = blockId;
            item.render(response.data);
        });
    });
};
