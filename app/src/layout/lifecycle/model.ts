/** 用途：布局模型最小接口；使用范围：通用页签销毁；解耦评估：仅依赖能力契约，不依赖具体 Model 类。 */
import type {ILayoutModel} from "./model.types";
/** 用途：布局模型销毁能力守卫；使用范围：通用页签销毁；解耦评估：按接口形状调用可选业务钩子。 */
import {isLayoutDestroyableModel} from "./model.guard";
/** 用途：布局模型释放能力守卫；使用范围：通用页签销毁；解耦评估：按接口形状调用可选资源释放函数。 */
import {isLayoutDisposableModel} from "./model.guard";

/** 调用模型自己的资源清理钩子，并确保基础 WebSocket 生命周期最终被释放。 */
/** @同步豁免: 生命周期 */
export function disposeModelResources(model: ILayoutModel) {
    try {
        // 先运行具体模型声明的业务清理钩子；错误占位等无资源模型不会进入该分支。
        if (isLayoutDestroyableModel(model)) {
            model.destroy();
        }
    } finally {
        // 无论业务钩子是否成功，具有底层释放能力的模型都必须最终关闭连接。
        if (isLayoutDisposableModel(model)) {
            model.dispose();
        }
    }
}
