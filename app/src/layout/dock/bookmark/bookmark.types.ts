/** 用途：参数化 Bookmark 应用宿主；使用范围：Bookmark 完整领域根，不加载具体 App。 */
import type {AppFacade} from "../../../app/AppFacade.types";
/** 用途：描述内嵌编辑器完整公共表面；使用范围：Bookmark 编辑器集合。 */
import type {ProtyleDomain} from "../../../protyle/protyle.types";
/** 用途：描述书签树完整公共表面；使用范围：Bookmark 树状态与行为。 */
import type {TreeDomain} from "../../../util/file/tree.types";
/** 用途：参数化 Bookmark 页签宿主；使用范围：Bookmark 模型父级，不加载 Tab class。 */
import type {LayoutTab} from "../../layout.types";
/** 用途：继承模型生命周期完整公共表面；使用范围：Bookmark 领域根。 */
import type {ModelDomain} from "../../lifecycle/model.types";

/** Bookmark 模型的稳定运行时身份；布局分类无需加载具体 class。 */
export const bookmarkModelBrand = Symbol("BookmarkModel");

/** Bookmark class 的完整公共领域表面。 */
export interface BookmarkDomain<
    TApplication extends object = AppFacade,
    TParent extends LayoutTab = LayoutTab,
> extends ModelDomain<TApplication, TParent> {
    readonly [bookmarkModelBrand]: "Bookmark";
    tree: TreeDomain;
    editors: ProtyleDomain[];
    update(data?: IBlockTree[]): void;
}

/**
 * @同步豁免: 类型守卫
 * @显式返回类型原因：类型谓词负责把通用布局模型收窄为完整 BookmarkDomain。
 */
export const isBookmarkDomain = (model: object): model is BookmarkDomain =>
    bookmarkModelBrand in model && model[bookmarkModelBrand] === "Bookmark";
