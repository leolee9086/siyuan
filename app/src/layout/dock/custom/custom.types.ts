/** 用途：参数化 Custom 应用宿主；使用范围：Custom 完整领域根，不加载具体 App。 */
import type {AppFacade} from "../../../app/AppFacade.types";
/** 用途：描述 Custom 内嵌编辑器的完整公共表面；使用范围：Custom 编辑器集合。 */
import type {ProtyleDomain} from "../../../protyle/protyle.types";
/** 用途：参数化 Custom 页签宿主；使用范围：Custom 模型父级和公开 tab。 */
import type {LayoutTab} from "../../layout.types";
/** 用途：继承模型生命周期完整公共表面；使用范围：Custom 领域根。 */
import type {ModelDomain} from "../../lifecycle/model.types";
import {hasLayoutModelBrand} from "../../lifecycle/modelBrand.guard";

/** Custom 模型的稳定运行时身份；布局分类无需加载具体 class。 */
export const customModelBrand = Symbol("CustomModel");

/** Custom class 的完整公共领域表面。 */
export interface CustomDomain<
    TData = unknown,
    TApplication extends object = AppFacade,
    TParent extends LayoutTab = LayoutTab,
> extends ModelDomain<TApplication, TParent> {
    readonly [customModelBrand]: "Custom";
    parent: TParent;
    element: Element;
    tab: TParent;
    data: TData;
    type: string;
    init: CustomInit<TData, TApplication, TParent>;
    destroy: (() => void) | undefined;
    beforeDestroy: (() => void) | undefined;
    resize: (() => void) | undefined;
    update: (() => void) | undefined;
    editors: ProtyleDomain[];
}

/** 异构 Tab 注册需要保留具体数据类型，同时允许只消费公共 Custom 数据的回调。 */
export type CustomInit<
    TData = unknown,
    TApplication extends object = AppFacade,
    TParent extends LayoutTab = LayoutTab,
> = {
    bivarianceHack(
        custom: CustomDomain<TData, TApplication, TParent>,
    ): void;
}["bivarianceHack"];

/**
 * @同步豁免: 类型守卫
 * @显式返回类型原因：类型谓词负责把通用布局模型收窄为完整 CustomDomain。
 */
export const isCustomDomain = (model: object | undefined): model is CustomDomain =>
    hasLayoutModelBrand(model, customModelBrand, "Custom");
