/** 用途：编辑器具体实现；使用范围：本工厂唯一实例化边界；解耦评估：工厂职责就是绑定具体 class。 */
import {Editor} from "./imports";
/** 用途：编辑器构造契约；使用范围：本工厂公开参数；解耦评估：参数保持原有完整领域选项。 */
import type {IEditorOptions} from "./imports";
/** 用途：应用实现身份；使用范围：本工厂参数绑定；解耦评估：具体宿主身份停留在装配边界。 */
import type { AppFacade } from "./imports";
/** 用途：完整 Protyle 领域身份；使用范围：本工厂回调类型绑定；解耦评估：类型不加载具体编辑器实现。 */
import type {ProtyleDomain} from "./imports";
/** 用途：窗口 hash 同步实现；使用范围：注入每个 Editor 实例；解耦评估：宿主能力在此绑定，避免 Editor 反向导入窗口模块。 */
import {setModelsHash} from "./imports";
/** 用途：参数化引擎创建选项；使用范围：Protyle 工厂参数；解耦评估：完整配置映射保持静态类型。 */
import type {EditorEngineOptions} from "./imports";

/** 创建 Editor 所持有的 Protyle 引擎实例。 */
function createEditorEngine(app: AppFacade, element: HTMLElement, options: EditorEngineOptions<ProtyleDomain>) {
    return app.createProtyle(element, options);
}

/** 创建应用编辑器并注入独立窗口 hash 同步能力。 @同步豁免: UI构建 */
export function createEditor(options: IEditorOptions<AppFacade, ProtyleDomain>) {
    return new Editor({
        ...options,
        syncWindowModelHash: setModelsHash,
        createEditorEngine,
    });
}
