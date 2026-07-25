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
 * 应用、父宿主、Tree 与编辑器均使用各自完整领域根，不依赖具体 class。
 */
export interface CustomListsDomain extends ILayoutModel {
    readonly layoutModel: true;
    ws: WebSocket;
    reqId: number;
    parent: LayoutTab;
    app: AppFacade;
    element: HTMLElement;
    tree: TreeDomain;
    listData: ICustomList;
    editors: ProtyleDomain[];
    connect(options: IModelConnectOptions): void;
    send(cmd: string, param: Record<string, unknown>, process?: boolean): void;
    dispose(): void;
    update(): void;
    updateTitle(title: string): void;
    handleIconClick(type: string | null, event?: MouseEvent): void;
}
/** 用途：继承布局模型身份；使用范围：CustomLists 领域根；解耦评估：稳定生命周期类型不加载具体模型。 */
import type {ILayoutModel} from "../../lifecycle/model.types";
/** 用途：描述公开连接动作；使用范围：CustomLists 领域根；解耦评估：复用模型生命周期请求类型。 */
import type {IModelConnectOptions} from "../../lifecycle/model.types";
/** 用途：完整应用外观；使用范围：CustomLists 领域根；解耦评估：稳定应用抽象，不导入 App class。 */
import type {AppFacade} from "../../../app/AppFacade.types";
/** 用途：完整页签领域根；使用范围：CustomLists 父宿主；解耦评估：不导入 Tab class。 */
import type {LayoutTab} from "../../layout.types";
/** 用途：完整树领域根；使用范围：CustomLists 数据树；解耦评估：不导入 Tree class。 */
import type {TreeDomain} from "../../../util/file/tree.types";
/** 用途：完整编辑器领域根；使用范围：CustomLists 内嵌编辑器；解耦评估：不导入 Protyle class。 */
import type {ProtyleDomain} from "../../../protyle/protyle.types";
