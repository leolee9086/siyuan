/** 用途：完整应用宿主；使用范围：Cronjob 模型生命周期。 */
import type {AppFacade} from "../../../app/AppFacade.types";
/** 用途：完整页签宿主；使用范围：Cronjob 模型父级。 */
import type {LayoutTab} from "../../layout.types";
/** 用途：完整模型生命周期；使用范围：Cronjob 领域根继承。 */
import type {ModelDomain} from "../../lifecycle/model.types";
/** 用途：定时任务运行数据；使用范围：Cronjob 公开任务集合。 */
import type {任务运行时信息} from "../../../util/network/types";

/** Cronjob 模型的稳定运行时身份。 */
export const cronjobModelBrand = Symbol("CronjobModel");

/** Cronjob class 的完整公共实例表面。 */
export interface CronjobDomain<
    TApplication extends object = AppFacade,
    TParent extends LayoutTab = LayoutTab,
> extends ModelDomain<TApplication, TParent> {
    readonly [cronjobModelBrand]: "Cronjob";
    element: HTMLElement;
    tasks: 任务运行时信息[];
    refreshTimer: number | null;
    update(): Promise<void>;
    destroy(): void;
}

/** @同步豁免: 类型守卫 */
/** @显式返回类型原因：类型谓词负责将通用模型收窄为完整 CronjobDomain。 */
export const isCronjobDomain = (model: object): model is CronjobDomain =>
    cronjobModelBrand in model && model[cronjobModelBrand] === "Cronjob";
