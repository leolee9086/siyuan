/** 用途：继承布局模型身份；使用范围：Graph 领域根；解耦评估：稳定生命周期类型不加载具体模型。 */
import type {ModelDomain} from "../../lifecycle/model.types";
/** 用途：参数化 Graph 父宿主；使用范围：Graph 领域根；解耦评估：保持抽象宿主身份，不导入 Tab class。 */
import type {ILayoutModelHost} from "../../lifecycle/model.types";
/** 用途：描述公开连接动作；使用范围：Graph 领域根；解耦评估：复用模型生命周期完整请求类型。 */

/** Graph 节点与连线的完整公开数据快照。 */
export interface GraphData {
    nodes: {box: string; id: string; path: string; type: string; color: IObject}[];
    links: Record<string, unknown>[];
    box: string;
}

/**
 * Graph class 的完整公共领域表面。
 * 应用和父宿主保持参数化；生产行为依赖抽象默认值，契约测试绑定真实 AppFacade 与 Tab 做严格比较。
 */
export interface GraphDomain<
    TApplication extends object = object,
    TParent extends ILayoutModelHost = ILayoutModelHost,
> extends ModelDomain<TApplication, TParent> {
    inputElement: HTMLInputElement;
    blockId: string;
    rootId: string;
    graphData: GraphData | undefined;
    type: "local" | "pin" | "global";
    searchGraph(focus: boolean, id?: string, refresh?: boolean): void;
    destroy(): void;
    onGraph(highlight: boolean): void;
}
