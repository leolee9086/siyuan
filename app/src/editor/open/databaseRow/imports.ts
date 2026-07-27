/** 用途：数据库行导航数据契约。使用范围：桌面数据库行子域；解耦评估：直达完整 AppFacade 声明。 */
import type {AppDatabaseRowNavigation} from "../../../app/AppFacade.types";
/** 导出数据库行导航数据契约。 */
export type {AppDatabaseRowNavigation};
/** 用途：块导航数据契约。使用范围：数据库行预览页签；解耦评估：直达完整 AppFacade 声明。 */
import type {AppBlockNavigation} from "../../../app/AppFacade.types";
/** 导出块导航数据契约。 */
export type {AppBlockNavigation};
/** 用途：完整应用领域根。使用范围：桌面数据库行子域；解耦评估：直达抽象声明，不加载具体 App。 */
import type {AppFacade} from "../../../app/AppFacade.types";
/** 导出完整应用领域根。 */
export type {AppFacade};
/** 用途：块打开动作协议。使用范围：绑定数据库行；解耦评估：直达无状态协议常量。 */
import {Constants} from "../../../constants";
/** 导出块打开动作协议。 */
export {Constants};
/** 用途：全部页签查询。使用范围：复用数据库行预览；解耦评估：导航子域需要观察完整布局页签集合，直达唯一查询实现。 */
import {getAllTabs} from "../../../layout/getAll";
/** 导出全部页签查询。 */
export {getAllTabs};
/** 用途：完整 Editor 领域根。使用范围：数据库行属性面板投影；解耦评估：type-only 直达稳定领域抽象，不加载具体 Editor class。 */
import type {EditorDomain} from "../../model/editorDomain.types";
/** 导出完整 Editor 领域根。 */
export type {EditorDomain};
/** 用途：Editor 厂牌守卫。使用范围：收窄页签模型；解耦评估：直达完整领域守卫，不依赖具体 class。 */
import {isEditorDomain} from "../../model/editorDomain.types";
/** 导出 Editor 厂牌守卫。 */
export {isEditorDomain};
/** 用途：桌面文件打开组合根。使用范围：分离数据库行自定义页签；解耦评估：仅导航子域依赖具体打开实现，AV 调用方依赖 AppFacade。 */
import {openFile} from "../openFile";
/** 导出桌面文件打开组合根。 */
export {openFile};
/** 用途：按块 ID 打开 Editor。使用范围：创建数据库行预览；解耦评估：仅导航子域依赖具体打开实现，AV 调用方依赖 AppFacade。 */
import {openFileById} from "../../utils.openFileById";
/** 导出按块 ID 打开实现。 */
export {openFileById};
