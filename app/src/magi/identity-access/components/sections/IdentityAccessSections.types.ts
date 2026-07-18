/** 用途：共享面板控制器；使用范围：推导章节 prop 类型；解耦评估：通过同目录网关访问控制器。 */
import { useIdentityAccessPanel } from "./imports";

/** Identity Access 章节组件共享的已解包控制器视图类型。 */
export type IdentityAccessPanelView = ReturnType<typeof useIdentityAccessPanel>;
/** Identity Access 列表条目使用的身份视图类型。 */
export type IdentityAccessIdentityView = IdentityAccessPanelView["state"]["identities"][number];
