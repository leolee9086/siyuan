/** 用途：布局模型序列化能力守卫；使用范围：将自描述模型写入布局 JSON；解耦评估：按接口形状分派，不依赖任何具体模型类。 */
import {isLayoutSerializableModel} from "./model.guard";
/** 用途：布局模型最小接口；使用范围：序列化适配器输入；解耦评估：同目录纯类型依赖。 */
import type {ILayoutModel} from "./model.types";

/** 将模型自带的布局序列化数据写入目标对象。 @同步豁免: UI构建 */
export function applyLayoutModelSerialization(
    model: ILayoutModel,
    target: Record<string, unknown>,
) {
    if (!isLayoutSerializableModel(model)) {
        return false;
    }
    Object.assign(target, model.layoutSerialization);
    return true;
}
