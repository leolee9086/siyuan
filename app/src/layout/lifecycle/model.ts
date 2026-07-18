/** 用途：模型基类；使用范围：通用页签销毁；解耦评估：布局生命周期域内类型依赖。 */
import type {Model} from "../Model";

/** 调用模型自己的资源清理钩子，并确保基础 WebSocket 生命周期最终被释放。 */
/** @同步豁免: 生命周期 */
export function disposeModelResources(model: Model) {
    const destroy = Reflect.get(model, "destroy");
    try {
        if (typeof destroy === "function") {
            destroy.call(model);
        }
    } finally {
        model.dispose();
    }
}
