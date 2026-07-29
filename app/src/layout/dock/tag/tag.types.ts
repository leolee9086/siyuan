/** 用途：参数化 Tag 应用宿主；使用范围：Tag 完整领域根，不加载具体 App。 */
import type {AppFacade} from "../../../app/AppFacade.types";
/** 用途：描述 Tag 内嵌编辑器完整公共表面；使用范围：Tag 编辑器集合。 */
import type {ProtyleDomain} from "../../../protyle/protyle.types";
/** 用途：描述标签树完整公共表面；使用范围：Tag 树状态与行为。 */
import type {TreeDomain} from "../../../util/file/tree.types";
/** 用途：参数化 Tag 页签宿主；使用范围：Tag 模型父级，不加载 Tab class。 */
import type {LayoutTab} from "../../layout.types";
/** 用途：继承模型生命周期完整公共表面；使用范围：Tag 领域根。 */
import type {ModelDomain} from "../../lifecycle/model.types";
import {hasLayoutModelBrand} from "../../lifecycle/modelBrand.guard";

/** Tag 模型的稳定运行时身份；布局分类无需加载具体 class。 */
export const tagModelBrand = Symbol("TagModel");

/** Tag class 的完整公共领域表面。 */
export interface TagDomain<
    TApplication extends object = AppFacade,
    TParent extends LayoutTab = LayoutTab,
> extends ModelDomain<TApplication, TParent> {
    readonly [tagModelBrand]: "Tag";
    parent: TParent;
    tree: TreeDomain;
    editors: ProtyleDomain[];
    update(ignoreMaxListHint?: boolean): void;
}

/**
 * @同步豁免: 类型守卫
 * @显式返回类型原因：类型谓词负责把通用布局模型收窄为完整 TagDomain。
 */
export const isTagDomain = (model: object | undefined): model is TagDomain =>
    hasLayoutModelBrand(model, tagModelBrand, "Tag");
