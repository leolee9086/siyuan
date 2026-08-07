/** 用途：页签 Vue 生命周期；使用范围：瀑布流页签注册边界。 */
export {createVueComponentLoader} from "../../../util/vue/mount";
/** 用途：宿主 DOM 守卫；使用范围：瀑布流页签注册边界。 */
export {isHTMLElement} from "../../../util/DOM/element.guard";
/** 用途：TabRegistry 注册表；使用范围：布局恢复和新建页签。 */
export {tabRegistry} from "../../../registry";
/** 用途：注册回调的 Custom 类型；使用范围：瀑布流页签初始化。 */
export type {CustomDomain} from "../../../layout/dock/custom/custom.types";
