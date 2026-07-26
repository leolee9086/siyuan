/** 用途：Search 应用宿主。使用范围：完整 Search 领域根，不加载具体 App。 */
import type {AppFacade} from "../../app/AppFacade.types";
/** 用途：Search 持有的两个编辑器。使用范围：完整公共状态。 */
import type {ProtyleDomain} from "../../protyle/protyle.types";
/** 用途：Search 页签宿主。使用范围：模型父级，不加载具体 Tab。 */
import type {LayoutTab} from "../../layout/layout.types";
/** 用途：Search 继承的完整模型生命周期。使用范围：Search 领域根的公共状态与生命周期方法。 */
import type {ModelDomain} from "../../layout/lifecycle/model.types";

/** Search 模型的稳定运行时身份；布局分类无需加载具体 class。 */
export const searchModelBrand = Symbol("SearchModel");

/** Search class 的完整公共领域表面。 */
export interface SearchDomain<
    TApplication extends object = AppFacade,
    TParent extends LayoutTab = LayoutTab,
> extends ModelDomain<TApplication, TParent> {
    readonly [searchModelBrand]: "Search";
    element: HTMLElement;
    config: Config.IUILayoutTabSearchConfig;
    editors: {edit: ProtyleDomain; unRefEdit: ProtyleDomain};
    updateSearch(text: string, replace: boolean): void;
}

/**
 * @同步豁免: 类型守卫
 * @显式返回类型原因：类型谓词负责把通用布局模型收窄为完整 SearchDomain。
 */
export const isSearchDomain = (model: object): model is SearchDomain =>
    searchModelBrand in model && model[searchModelBrand] === "Search";
