/** 用途：对象块图完整模型集合。使用范围：重置算法输入。 */
import type {ObjectBlockGraphModels} from "./obg.types";
/** 用途：当前布局模型查询；使用范围：生产调用省略显式集合时的默认输入；解耦评估：经本领域网关直达 Layout 查询，测试仍可参数化。 */
import {getAllModels} from "./imports";

/** 重置首个绑定对象的固定大纲。 */
function clearPinnedOutline(item: ObjectBlockGraphModels["outline"][number]) {
    if (item.type !== "pin" || item.blockId === "") {
        return false;
    }
    item.isPreview = false;
    item.update({data: [], msg: "", code: 0}, "");
    item.updateDocTitle();
    return true;
}

/** 清除固定大纲、固定关系图和固定反链的当前对象状态。 @同步豁免: 生命周期 */
export function clearObjectBlockGraphs(models: ObjectBlockGraphModels = getAllModels()) {
    models.outline.find(clearPinnedOutline);
    for (const item of models.graph) {
        if (item.type === "global" || item.type === "local" || item.blockId === "") {
            continue;
        }
        item.blockId = "";
        item.graphData = undefined;
        item.onGraph(false);
    }
    for (const item of models.backlink) {
        if (item.type === "local" || item.blockId === "") {
            continue;
        }
        item.saveStatus();
        item.blockId = "";
        item.render(undefined);
    }
}
