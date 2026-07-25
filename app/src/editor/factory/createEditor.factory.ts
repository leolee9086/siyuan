/** 用途：编辑器具体实现；使用范围：本工厂唯一实例化边界；解耦评估：工厂职责就是绑定具体 class。 */
import {Editor} from "./imports";
/** 用途：编辑器构造契约；使用范围：本工厂公开参数；解耦评估：参数保持原有完整领域选项。 */
import type {IEditorOptions} from "./imports";
/** 用途：应用实现身份；使用范围：本工厂参数绑定；解耦评估：具体宿主身份停留在装配边界。 */
import type { AppFacade } from "./imports";
/** 用途：Protyle 实现身份；使用范围：本工厂回调类型绑定；解耦评估：具体编辑器身份停留在装配边界。 */
import {Protyle} from "./imports";
/** 用途：窗口 hash 同步实现；使用范围：注入每个 Editor 实例；解耦评估：宿主能力在此绑定，避免 Editor 反向导入窗口模块。 */
import {setModelsHash} from "./imports";
/** 用途：全屏 UI 同步实现；使用范围：注入 Editor 模型；解耦评估：具体宿主行为集中在工厂边界。 */
import {fullscreen} from "./imports";
/** 用途：参数化引擎创建选项；使用范围：Protyle 工厂参数；解耦评估：完整配置映射保持静态类型。 */
import type {EditorEngineOptions} from "./imports";

/** 创建 Editor 所持有的 Protyle 引擎实例。 */
function createEditorEngine(app: AppFacade, element: HTMLElement, options: EditorEngineOptions<Protyle>) {
    return new Protyle(app, element, options);
}

/** 创建应用编辑器并注入独立窗口 hash 同步能力。 @同步豁免: UI构建 */
export function createEditor(options: IEditorOptions<AppFacade, Protyle>) {
    return new Editor({
        ...options,
        syncWindowModelHash: setModelsHash,
        createEditorEngine,
        enterFullscreen: fullscreen,
    });
}
