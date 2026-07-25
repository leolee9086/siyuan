import type {AppFacade} from "../app/AppFacade.types";
import type {LayoutTab} from "../layout/layout.types";
import type {ModelDomain} from "../layout/lifecycle/model.types";

/** Asset 模型的稳定运行时身份；分类器据此识别领域，不加载具体 class。 */
export const assetModelBrand = Symbol("AssetModel");

/** Asset class 的完整公共领域表面。 */
export interface AssetDomain<
    TApplication extends object = AppFacade,
    TParent extends LayoutTab = LayoutTab,
> extends ModelDomain<TApplication, TParent> {
    readonly [assetModelBrand]: "Asset";
    path: string;
    element: HTMLElement;
    // PDF.js viewer.js 仍是无声明的 JavaScript 边界；保持具体 Asset 的既有公共类型，避免本次解耦改变调用语义。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfObject: any;
    readonly windowHashIdentity: {
        readonly kind: "asset-path";
        readonly value: string;
    };
    update(path: string): void;
    goToPage(pdfId: string | number): void;
}

/** 通过领域厂牌收窄 Asset；厂牌由具体 class 原型提供，普通布局模型不会命中。 */
/**
 * @同步豁免: 类型守卫
 * @显式返回类型原因：类型谓词是分类器从通用布局模型收窄到完整 AssetDomain 的公开契约。
 */
export const isAssetDomain = (model: object): model is AssetDomain =>
    assetModelBrand in model && model[assetModelBrand] === "Asset";
