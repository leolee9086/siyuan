/**
 * 自定义列表的基础配置字段
 */
export interface ICustomListBase {
    id: string;
    title: string;
    icon: string;
}

/**
 * 动态列表（基于搜索/SQL 查询）
 * type 固定为 "dynamic"，target 为查询字符串
 */
export interface IDynamicCustomList extends ICustomListBase {
    type: "dynamic";
    target: string;
}

/**
 * 静态列表（基于固定 ID 集合）
 * type 固定为 "static"，target 为块 ID 数组
 */
export interface IStaticCustomList extends ICustomListBase {
    type: "static";
    target: string[];
}

/**
 * 联合类型：动态列表 | 静态列表
 */
export type ICustomList = IDynamicCustomList | IStaticCustomList;

/**
 * SQL 查询返回的块数据结构（前端消费子集）
 */
export interface IBlock {
    id: string;
    content?: string;
    tag?: string;
    box?: string;
    type?: string;
    subType?: string;
    hPath?: string;
    ial?: { icon?: string };
}

/**
 * CustomLists class 的完整公共领域表面。
 * 应用、父宿主、Tree 与编辑器身份均参数化；生产菜单使用抽象默认值，契约测试绑定真实实现做严格比较。
 */
export interface CustomListsDomain<
    TApplication extends object = object,
    TParent extends ILayoutModelHost = ILayoutModelHost,
    TTree extends object = object,
    TEditor extends object = object,
> extends ILayoutModel {
    readonly layoutModel: true;
    ws: WebSocket;
    reqId: number;
    parent: TParent;
    app: TApplication;
    element: HTMLElement;
    tree: TTree;
    listData: ICustomList;
    editors: TEditor[];
    connect(options: IModelConnectOptions): void;
    send(cmd: string, param: Record<string, unknown>, process?: boolean): void;
    dispose(): void;
    update(): void;
    updateTitle(title: string): void;
    handleIconClick(type: string | null, event?: MouseEvent): void;
}
/** 用途：继承布局模型身份；使用范围：CustomLists 领域根；解耦评估：稳定生命周期类型不加载具体模型。 */
import type {ILayoutModel} from "../../lifecycle/model.types";
/** 用途：参数化父宿主；使用范围：CustomLists 领域根；解耦评估：保持抽象宿主身份，不导入 Tab class。 */
import type {ILayoutModelHost} from "../../lifecycle/model.types";
/** 用途：描述公开连接动作；使用范围：CustomLists 领域根；解耦评估：复用模型生命周期请求类型。 */
import type {IModelConnectOptions} from "../../lifecycle/model.types";
