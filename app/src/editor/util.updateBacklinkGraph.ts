import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { fetchPost } from "../util/fetch";
import { isCurrentEditor } from "./util.isCurrentEditor";
import { getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig";
/**
 * 更新相关的反链和关系图
 * @param models 
 * @param protyle 
 * @returns 
 */
export const updateBacklinkGraph = (models: IModels, protyle: IProtyle) => {
    // https://ld246.com/article/1637636106054/comment/1641485541929#comments
    if (protyle && protyle.element.classList.contains("fn__none") ||
        (protyle && !hasClosestByClassName(protyle.element, "layout__wnd--active") &&
            document.querySelector(".layout__wnd--active")  // https://github.com/siyuan-note/siyuan/issues/4414
        )
    ) {
        return;
    }
    models.graph.forEach(item => {
        if (item.type !== "global" && (!protyle || item.blockId !== protyle.block?.id)) {
            if (item.type === "local" && item.rootId !== protyle?.block?.rootID) {
                return;
            }
            let blockId = "";
            if (protyle && protyle.block) {
                if (protyle.block.id && protyle.block.parentID) {
                    blockId = protyle.block.showAll ? protyle.block.id : protyle.block.parentID;
                } else {
                    console.error(protyle)
                    throw ("protyle 结构错误")
                }
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
            if (protyle.block.id && protyle.block.parentID) {
                blockId = protyle.block.showAll ? protyle.block.id : protyle.block.parentID;
            } else {
                console.error(protyle)
                throw ("protyle 结构错误")
            }
        }
        if (blockId === item.blockId) {
            return;
        }
        item.element.querySelector('.block__icon[data-type="refresh"] svg')?.classList.add("fn__rotate");
        const getBacklink2Payload = {
                        sort: item.status[blockId] ? item.status[blockId]?.sort.toString() : getSiyuanConfig().editor.backlinkSort.toString(),
            mSort: item.status[blockId] ? item.status[blockId]?.mSort.toString() : getSiyuanConfig()?.editor.backmentionSort.toString(),
            id: blockId || "",
            k: item.inputsElement[0]?.value,
            mk: item.inputsElement[1]?.value,

        }
        fetchPost("/api/ref/getBacklink2", getBacklink2Payload, response => {
            if (!isCurrentEditor(blockId) || item.blockId === blockId) {
                item.element.querySelector('.block__icon[data-type="refresh"] svg')?.classList.remove("fn__rotate");
                return;
            }
            item.saveStatus();
            item.blockId = blockId;
            item.render(response.data);
        });
    });
};
