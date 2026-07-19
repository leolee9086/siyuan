/** 用途：布局模型最小接口；使用范围：将模型挂载到宿主；解耦评估：仅操作抽象 parent 契约。 */
import type {ILayoutModel} from "./model.types";
/** 用途：布局模型宿主接口；使用范围：模型挂载目标；解耦评估：不依赖具体 Tab 类。 */
import type {ILayoutModelHost} from "./model.types";

/** 将布局模型绑定到宿主并返回同一模型。 @同步豁免: 生命周期 */
export function attachLayoutModel(host: ILayoutModelHost, model: ILayoutModel) {
    model.parent = host;
    return model;
}
