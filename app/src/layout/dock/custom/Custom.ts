/** 用途：完整页签宿主；使用范围：Custom 父级、面板 DOM 与模型泛型；解耦评估：纯类型依赖不加载具体 Tab。 */
import type {LayoutTab} from "./imports";
/** 用途：布局模型基类；使用范围：Custom 唯一实现的连接与生命周期；解耦评估：框架继承要求具体基类留在模型实现边界。 */
import {Model} from "./imports";
/** 用途：完整应用宿主；使用范围：模型基类与 Custom 初始化；解耦评估：依赖稳定完整外观，不加载具体 App。 */
import type { AppFacade } from "./imports";
/** 用途：完整编辑器领域表面；使用范围：Custom 内嵌编辑器集合；解耦评估：纯类型保持编辑器实现可替换。 */
import type {ProtyleDomain} from "./imports";
/** 用途：Custom 稳定运行时厂牌；使用范围：布局模型分类；解耦评估：对象身份必须随实例存在，参数传递无法替代。 */
import {customModelBrand} from "./custom.types";
/** 用途：完整 Custom 领域表面；使用范围：初始化回调的 ThisType；解耦评估：本域真实声明不经网关转发。 */
import type {CustomDomain} from "./custom.types";
/** 用途：完整 Custom 初始化签名；使用范围：class 公开 init 字段与构造参数；解耦评估：本域真实声明不加载实现。 */
import type {CustomInit} from "./custom.types";

/* @允许类: Custom 是布局系统既有的有状态领域模型和公开运行时身份。布局反序列化、页签复制、
 * 插件自定义页签、MAGI 身份面板、颜色工具和卡片页签均构造同一个 Custom class，并依赖同一
 * 实例在整个页签生命周期内持有 app、tab、element、data、type、init、destroy、beforeDestroy、
 * resize、update 与 editors。构造过程必须先建立 Model 的连接状态，再读取页签 DOM、应用
 * “始终在当前页签打开”标记，最后以该实例作为 this 执行初始化回调；销毁、更新和尺寸变化
 * 继续由布局引擎沿原对象身份调用。仓库还通过 instanceof Custom、稳定厂牌和布局序列化数据
 * 判别该模型。改为对象字面量、闭包工厂或临时代理会改变原型身份、引用相等性、初始化次序、
 * WebSocket 生命周期以及插件可观察行为。该 class 的完整公共表面已经由 CustomDomain 描述，
 * 并在独立契约测试中使用 PublicInstanceLooksLike 与具体实现双向校验；依赖方可使用抽象领域
 * 类型而无需加载实现。具体 class 只保留在构造、运行时判别和契约校验边界，跨调用状态仍由
 * 模型实例统一持有，没有增加服务定位器、状态闭包或碎片接口。因此保留唯一 class 是维持现有
 * 布局模型身份和生命周期语义的必要实现边界，而不是为无状态工具引入面向对象包装。
 * @允许继承: 框架要求 (FrameworkRequired) */
export class Custom<TData = unknown> extends Model<AppFacade, LayoutTab> {
    public override parent: LayoutTab;

    public get [customModelBrand]() {
        return "Custom" as const;
    }

    public element: Element;
    public tab: LayoutTab;
    public data: TData;
    public type: string;
    public init: CustomInit<TData>;
    public destroy: (() => void) | undefined;
    public beforeDestroy: (() => void) | undefined;
    public resize: (() => void) | undefined;
    public update: (() => void) | undefined;
    public editors: ProtyleDomain[] = [];

    constructor(options: {
        app: AppFacade,
        type: string,
        tab: LayoutTab,
        data: TData,
        destroy?: () => void,
        beforeDestroy?: () => void,
        resize?: () => void,
        update?: () => void,
        init: CustomInit<TData>
    } & ThisType<CustomDomain<TData>>) {
        super({app: options.app});
        this.parent = options.tab;
        // 始终复用当前页签时，标记新模型尚未完成内容更新，避免布局误用旧页签状态。
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
