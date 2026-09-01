/** 用途：约束完整应用宿主；使用范围：Protyle 实例类型投影。 */
import type {AppFacade} from "./imports";
/** 用途：约束 Composer 历史状态；使用范围：Protyle 实例键盘与句柄。 */
import type {ComposerHistoryState} from "./imports";

/** 聚合一个 Protyle Composer 从创建到销毁的可观察资源与交互状态。 */
export interface AgentProtyleComposerRuntime {
    editor: ReturnType<AppFacade["createProtyle"]>;
    protyle: IProtyle;
    wysiwyg: NonNullable<IProtyle["wysiwyg"]>;
    hint: NonNullable<IProtyle["hint"]>;
    history: ComposerHistoryState;
    onSend: () => void;
    /** 上游编辑态交互配置：占位覆盖、Escape 取消与历史翻阅开关。 */
    interaction: {
        placeholder: string | undefined;
        onCancel: (() => void) | undefined;
        enableHistory: boolean;
    };
    suggestion: {
        destroyed: boolean;
        requestRevision: number;
    };
    contentObserver: MutationObserver | null;
    keydownHandler: ((event: KeyboardEvent) => void) | null;
    blurHandler: (() => void) | null;
}
