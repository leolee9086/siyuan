/** 用途：移动文件树所属的完整应用外观；使用范围：移动文件树模型生命周期；解耦评估：纯类型直达应用抽象。 */
import type {AppFacade} from "../../../app/AppFacade.types";
/** 用途：Model class 的完整公共领域根；使用范围：移动文件树继承的连接与资源生命周期；解耦评估：不加载具体 Model。 */
import type {ModelDomain} from "../../../layout/lifecycle/model.types";

/** 移动文件树稳定身份；只用于完整领域根的运行时判别，不保存状态。 */
export const mobileFilesModelBrand = Symbol("MobileFilesModel");

/** MobileFiles class 的完整公共实例表面。 */
export interface MobileFilesDomain extends ModelDomain<AppFacade> {
    readonly [mobileFilesModelBrand]: "MobileFiles";
    element: HTMLElement;
    actionsElement: HTMLElement;
    closeElement: HTMLElement;
    init(init?: boolean): void;
    setCurrent(target: HTMLElement, isScroll?: boolean): void;
    getLeaf(liElement: Element, notebookId: string, focusUpdate?: boolean): void;
    selectItem(
        notebookId: string,
        filePath: string,
        data?: {files: IFile[]; box: string; path: string},
        setStorage?: boolean,
        isSetCurrent?: boolean,
    ): Promise<HTMLElement | null | undefined>;
    persistOpenPaths(): void;
    refreshPublishAccessSwitch(): void;
    onFiletreeSortChanged(data: {notebook: string; parentPath: string}): void;
    onNotebookSortChanged(): void;
}

/** @同步豁免: 类型守卫 */
/** 按稳定厂牌收窄为完整移动文件树领域根。 @显式返回类型原因：类型谓词必须显式声明才能向调用方提供领域收窄。 */
export const isMobileFilesDomain = (model: object): model is MobileFilesDomain =>
    mobileFilesModelBrand in model && model[mobileFilesModelBrand] === "MobileFiles";
