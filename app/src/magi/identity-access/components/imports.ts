/** 用途：共享面板控制器；使用范围：IdentityAccessPanel；解耦评估：组件通过组合式控制器隔离后端动作。 */
import { useIdentityAccessPanel } from "../controller/useIdentityAccessPanel";
/** 用途：Vue 应用工厂；使用范围：共享挂载器；解耦评估：Identity Access 视图基于 Vue。 */
import { createApp } from "vue";

/** components 域的共享面板控制器。 */
export { useIdentityAccessPanel };
/** components 域的 Vue 应用工厂。 */
export { createApp };
