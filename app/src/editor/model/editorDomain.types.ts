/** 用途：Editor 应用宿主。使用范围：完整 Editor 领域根，不加载具体 App。 */
import type {AppFacade} from "../../app/AppFacade.types";
/** 用途：Editor 持有的完整编辑器引擎。使用范围：公开 editor 状态。 */
import type {ProtyleDomain} from "../../protyle/protyle.types";
/** 用途：Editor 所属页签。使用范围：既有布局挂载过程写入的公开 parent 状态。 */
import type {LayoutTab} from "../../layout/layout.types";
/** 用途：布局模型身份。使用范围：Editor 作为 Tab 模型参与挂载和分类。 */
import type {ILayoutModel} from "../../layout/lifecycle/model.types";
import {hasLayoutModelBrand} from "../../layout/lifecycle/modelBrand.guard";
import type {BacklinkDomain} from "../../layout/dock/backlink/backlink.types";

/** Editor 模型的稳定运行时身份；消费方无需加载具体 class。 */
export const editorModelBrand = Symbol("EditorModel");

/** Editor class 的完整公共领域表面。 */
export interface EditorDomain<
    TApplication extends AppFacade = AppFacade,
    TEditor extends ProtyleDomain = ProtyleDomain,
> extends ILayoutModel {
    readonly layoutModel: true;
    readonly [editorModelBrand]: "Editor";
    parent: LayoutTab;
    element: HTMLElement;
    editor: TEditor;
    headElement: HTMLElement;
    app: TApplication;
    backlink: BacklinkDomain<AppFacade, LayoutTab> | undefined;
    readonly windowHashIdentity: {
        readonly kind: "document-root";
        readonly value: string | undefined;
    };
    updateBacklinkPanel(reset?: boolean): void;
    refreshBottomBacklinkPanel(): void;
    destroy(): void;
    getCurrentProtyle(range?: Range): IProtyle;
}

/**
 * @同步豁免: 类型守卫
 * @显式返回类型原因：类型谓词负责把通用布局模型收窄为完整 EditorDomain。
 */
export const isEditorDomain = (model: object | undefined): model is EditorDomain =>
    hasLayoutModelBrand(model, editorModelBrand, "Editor");
