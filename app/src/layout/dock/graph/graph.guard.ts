/** 用途：读取完整 Graph 抽象；使用范围：Dock 模型分派；解耦评估：纯类型依赖不加载具体 Graph class。 */
import type {GraphDomain} from "./graph.types";
/** 用途：约束 Dock 数据入口；使用范围：Graph 守卫；解耦评估：稳定布局模型身份不加载具体实现。 */
import type {ILayoutModel} from "../../lifecycle/model.types";

/** 以 Graph 的完整公开行为和稳定类型判别布局模型，不依赖具体 class 身份。 */
export const isGraphDomain = (model: ILayoutModel | boolean | undefined): model is GraphDomain => {
    if (!model || typeof model === "boolean") {
        return false;
    }
    if (!("type" in model) || typeof model.type !== "string" || !["local", "pin", "global"].includes(model.type)) {
        return false;
    }
    return "onGraph" in model && typeof model.onGraph === "function" &&
        "searchGraph" in model && typeof model.searchGraph === "function" &&
        "destroy" in model && typeof model.destroy === "function";
};
