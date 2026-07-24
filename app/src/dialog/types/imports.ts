/** 用途：为 Dialog 公共选项转发 Vue 挂载配置契约；使用范围：仅限 dialog.types.ts；解耦评估：指向纯类型所有者，不经过 Vue 挂载实现。 */
import type {VueComponentLoaderContext, VueComponentMountConfig} from "../../util/vue/mount.types";

/** Dialog 标题组件的挂载配置。 */
export type {VueComponentMountConfig};
/** Dialog 标题组件的状态访问上下文。 */
export type {VueComponentLoaderContext};
