import {Tab} from "./imports";
import {Model} from "./imports";
import type {App} from "./imports";
import type {Protyle} from "./imports";
import type {BaseJSONSerializableObject} from "./imports";
import type {ICustomTabModel} from "../../registry/TabRegistry.types";

// @允许继承: FrameworkRequired
// @允许类: Custom 是 SiYuan 布局系统的自定义面板类型，必须继承自框架基类 Model 才能被布局引擎识别和序列化。class 关键字用于定义此类继承关系，且其生命周期（构造/销毁/序列化）由布局框架管理，无法替换为纯函数或对象组合模式。Model 基类提供了 ws 连接、reqId 管理、send 方法等内置能力，所有自定义面板共享同一套生命周期契约，这正是 class 继承的适用场景。Custom 本身也作为类型被大量 instanceof 检查使用，这是 class 继承体系的核心用法。
export class Custom<TData = BaseJSONSerializableObject> extends Model<App, Tab> implements ICustomTabModel {
    public element: Element;
    public tab: Tab;
    public data: TData;
    public type: string;
    public init: (custom: Custom<TData>) => void;
    public destroy: (() => void) | undefined;
    public beforeDestroy: (() => void) | undefined;
    public resize: (() => void) | undefined;
    public update: (() => void) | undefined;
    public editors: Protyle[] = [];

    constructor(options: {
        app: App,
        type: string,
        tab: Tab,
        data: TData,
        destroy?: () => void,
        beforeDestroy?: () => void,
        resize?: () => void,
        update?: () => void,
        init: (custom: Custom<TData>) => void
    }) {
        super({app: options.app});
        if (window.siyuan.config?.fileTree.openFilesUseCurrentTab) {
            options.tab.headElement?.classList.add("item--unupdate");
        }

        this.element = options.tab.panelElement;
        this.tab = options.tab;
        this.data = options.data;
        this.type = options.type;
        this.init = options.init;
        this.destroy = options.destroy;
        this.beforeDestroy = options.beforeDestroy;
        this.resize = options.resize;
        this.update = options.update;
        this.init(this);
    }
}
