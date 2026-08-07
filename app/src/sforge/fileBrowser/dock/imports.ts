/** 用途：复用现有 Vue 挂载生命周期；使用范围：原生 Dock 组合根。 */
export {createVueComponentLoader} from "../../../util/vue/mount";
/** 用途：确认 Dock 面板宿主；使用范围：原生 Dock 组合根。 */
export {isHTMLElement} from "../../../util/DOM/element.guard";
/** 用途：复用唯一 Custom 布局模型；使用范围：原生 Dock 组合根。 */
export {Custom} from "../../../layout/dock/custom/Custom";
/** 用途：完整应用宿主类型；使用范围：Dock 工厂参数。 */
export type {AppFacade} from "../../../app/AppFacade.types";
/** 用途：完整 Dock 页签类型；使用范围：Dock 工厂参数。 */
export type {Tab} from "../../../layout/Tab";
/** 用途：Custom 模型领域类型；使用范围：Dock 初始化。 */
export type {CustomDomain} from "../../../layout/dock/custom/custom.types";
