/** 用途：约束完整应用宿主；使用范围：Protyle Composer 挂载入口。 */
import type {AppFacade} from "./imports";
/** 用途：创建每个 Composer 的发送历史；使用范围：Protyle 挂载组合根；解耦评估：状态构造与转换同属历史领域。 */
import {createComposerHistory} from "./composer/AgentComposer.history";
/** 用途：约束内容变化通知；使用范围：Protyle 挂载签名。 */
import type {ComposerChangeCallback} from "./composer/AgentComposer.types";
/** 用途：约束公共句柄；使用范围：Protyle 挂载返回值。 */
import type {ComposerHandle} from "./composer/AgentComposer.types";
/** 用途：创建公共 Composer 句柄；使用范围：Protyle 挂载返回值；解耦评估：句柄投影与编辑器实例化分离。 */
import {createAgentProtyleComposerHandle} from "./composer/protyle/handle";
/** 用途：创建可观察 Protyle 生命周期状态；使用范围：Protyle 挂载组合根；解耦评估：每个 Composer 独占编辑器、观察器和请求版本。 */
import {createAgentProtyleComposerRuntime} from "./composer/protyle/runtime.factory";

/** @同步豁免: UI构建 面板挂载必须同步返回 ComposerHandle，异步化会改变所有宿主初始化协议。 */
/** @参数豁免: 生命周期 */
/** 组装独立 Protyle Composer；编辑器、历史、Hint 请求和监听器均保持实例级生命周期。 @显式返回类型原因: 公开挂载入口必须固定两种编辑器共享的 ComposerHandle 契约。 */
export function mountProtyleComposer(
    app: AppFacade,
    host: HTMLElement,
    onSend: () => void,
    onChange?: ComposerChangeCallback,
): ComposerHandle {
    const history = createComposerHistory();
    const runtime = createAgentProtyleComposerRuntime(app, host, {history, onSend, onChange});
    return createAgentProtyleComposerHandle(runtime);
}
