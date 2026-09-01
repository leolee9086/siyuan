/** 用途：布局页签完整领域根。使用范围：Editor 构造选项统一使用经严格校验的公共表面。 */
import type {LayoutTab} from "../layout/layout.types";
/** 用途：Editor 持有完整 Protyle 领域根；使用范围：模型状态、构造选项和初始化回调。 */
import type {ProtyleDomain} from "../protyle/protyle.types";
/** 用途：完整应用外观类型。使用范围：Editor 构造选项和链接事件的最小应用协议。解耦评估：纯类型依赖，不加载应用组合根。 */
import type {AppFacade} from "../app/AppFacade.types";

/** 编辑引擎创建选项保持完整 Protyle 配置，只参数化初始化回调中的引擎身份。 */
export type EditorEngineOptions<TEditor extends ProtyleDomain> =
    Omit<IProtyleOptions, "after"> & {after: (editor: TEditor) => void};

/**
 * 编辑器构造函数选项接口。
 *
 * 用途：定义创建 Editor 实例时所需的业务参数，并分别保留应用、页签和引擎身份。
 * 使用场景：Editor 模型构造、布局页签创建、复制和恢复。
 * 关联类型：LayoutTab、ProtyleDomain 和具体宿主工厂。
 * 问题/改进：运行时创建与宿主动作由工厂另行注入，不进入业务选项。
 */
export interface IEditorOptions<
    TApplication extends AppFacade,
    TEditor extends ProtyleDomain,
> {
    app: TApplication;
    tab: LayoutTab;
    blockId: string;
    rootId: string;
    notebookId?: string;
    mode?: TEditorMode;
    action?: TProtyleAction[];
    afterInitProtyle?: (editor: TEditor) => void;
    scrollPosition?: ScrollLogicalPosition;
}

/**
 * 页签初始化数据接口
 *
 * 用途：用于描述 Tab 元素上 `data-initdata` 属性解析后的 JSON 对象结构。
 * 使用场景：在 restore 页签或者判定未初始化页签是否可复用时使用。
 * 关联类型：与 ILayoutJSON 有重叠，但 action 字段更为宽松（支持数组）。
 */
export interface ITabInitData {
    instance: string;
    rootId?: string | undefined;
    blockId?: string | undefined;
    mode?: TEditorMode | undefined;
    action?: TProtyleAction | TProtyleAction[] | undefined;
    scrollPosition?: ScrollLogicalPosition | undefined;
    customModelData?: unknown; // Keep any for now as it can be complex, or unknown
    customModelType?: string | undefined;
}

/**
 * 用途：约束链接打开事件需要的最小应用能力。
 * 使用场景：openLinkEvent 向已加载插件派发可取消的 open-link 与 open-asset 事件。
 * 关联类型：IOpenLinkEventDetail、Config.TAssetOpenAction。
 * 问题/改进：该协议刻意不暴露完整应用或插件领域根，避免链接基础层反向依赖 index。
 */
export type OpenLinkEventApp = {
    plugins: Array<{
        eventBus: {
            emit(type: TEventBus, detail: unknown): boolean;
        };
    }>;
};

/**
 * 用途：描述插件可取消的链接打开事件载荷。
 * 使用场景：openLinkEvent 规范化普通链接后向插件事件总线派发。
 * 关联类型：OpenLinkEventApp、Config.TAssetOpenAction。
 * 问题/改进：事件对象保留原始地址，插件应以 href 为最终待打开地址。
 */
export interface IOpenLinkEventDetail {
    href: string;
    originalHref: string;
    event?: MouseEvent | KeyboardEvent;
}
