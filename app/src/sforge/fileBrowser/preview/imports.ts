/** 用途：内建自定义页签注册；使用范围：只读文件预览页签。 */
export {tabRegistry} from "../../../registry";
/** 用途：复用 Vue 挂载生命周期；使用范围：预览页签组合根。 */
export {createVueComponentLoader} from "../../../util/vue/mount";
/** 用途：校验页签面板宿主；使用范围：预览页签组合根。 */
export {isHTMLElement} from "../../../util/DOM/element.guard";
/** 用途：完整 Custom 页签领域；使用范围：预览页签初始化。 */
export type {CustomDomain} from "../../../layout/dock/custom/custom.types";
