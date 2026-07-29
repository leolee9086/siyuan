/** 用途：继承布局模型身份；使用范围：Graph 领域根；解耦评估：稳定生命周期类型不加载具体模型。 */
import type {ModelDomain} from "../../lifecycle/model.types";
/** 用途：参数化 Graph 父宿主；使用范围：Graph 领域根；解耦评估：保持抽象宿主身份，不导入 Tab class。 */
import type {ILayoutModelHost} from "../../lifecycle/model.types";
import {hasLayoutModelBrand} from "../../lifecycle/modelBrand.guard";
/** 用途：描述公开连接动作；使用范围：Graph 领域根；解耦评估：复用模型生命周期完整请求类型。 */

/** Graph 模型的稳定运行时身份；布局分类无需加载具体 class。 */
export const graphModelBrand = Symbol("GraphModel");

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
    readonly [graphModelBrand]: "Graph";
    parent: TParent;
    inputElement: HTMLInputElement;
    blockId: string;
    rootId: string;
    graphData: GraphData | undefined;
    type: "local" | "pin" | "global";
    searchGraph(focus: boolean, id?: string, refresh?: boolean): void;
    destroy(): void;
    onGraph(highlight: boolean): void;
}

/**
 * @同步豁免: 类型守卫
 * @显式返回类型原因：类型谓词负责把通用布局模型收窄为完整 GraphDomain。
 */
export const isGraphDomain = (model: object | undefined): model is GraphDomain =>
    hasLayoutModelBrand(model, graphModelBrand, "Graph");
