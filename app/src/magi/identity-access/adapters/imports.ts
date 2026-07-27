/** 用途：思源 Custom Model；使用范围：Dock 和 Tab 适配器；解耦评估：宿主生命周期要求该类型。 */
import {Custom} from "../../../layout/dock/custom/Custom";
/** 用途：Custom 完整领域根；使用范围：适配器参数与查询结果不依赖具体实现。 */
import type {CustomDomain} from "../../../layout/dock/custom/custom.types";
/** 用途：应用外观类型；使用范围：Dock/Tab 创建参数；解耦评估：纯类型依赖，不加载具体 App class。 */
import type {AppFacade} from "../../../app/AppFacade.types";
/** 用途：思源页签类型；使用范围：Dock 模型构造参数；解耦评估：纯类型依赖。 */
import type { Tab } from "../../../layout/Tab";
/** 用途：打开自定义页签；使用范围：Identity Access Tab 入口；解耦评估：复用编辑器公共入口。 */
import { openFile } from "../../../editor/util";
/** 用途：查询已有模型；使用范围：Identity Access Tab 单实例复用；解耦评估：布局查询是必要宿主能力。 */
import { getAllModels } from "../../../layout/getAll";
/** 用途：解析应用上下文；使用范围：调用者未显式传 App 时；解耦评估：环境访问已封装。 */
import { getSiyuanWebSocket } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 用途：自定义 Tab 注册；使用范围：Identity Access 启动注册；解耦评估：使用内部统一扩展点。 */
import { tabRegistry } from "../../../registry";
/** 用途：共享 Vue 挂载器；使用范围：Dock 和 Tab 适配器；解耦评估：容器不接触组件内部状态。 */
import { mountIdentityAccess } from "../components/mount";

/** adapters 域的 Custom Model 构造器。 */
export { Custom };
/** adapters 域的 Custom 完整抽象。 */
export type {CustomDomain};
/** adapters 域的 AppFacade 类型。 */
export type {AppFacade};
/** adapters 域的 Tab 类型。 */
export type { Tab };
/** adapters 域的页签打开能力。 */
export { openFile };
/** adapters 域的模型查询能力。 */
export { getAllModels };
/** adapters 域的应用上下文读取能力。 */
export { getSiyuanWebSocket };
/** adapters 域的 Tab 注册中心。 */
export { tabRegistry };
/** adapters 域的共享 Vue 挂载器。 */
export { mountIdentityAccess };
