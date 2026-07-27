/** 用途：判别完整 Editor 领域模型；使用范围：当前页签定位命令；解耦评估：网关直达厂牌守卫声明。 */
import {isEditorDomain} from "../../../../editor/model/editorDomain.types";
/** 导出 Editor 完整领域守卫。 */
export {isEditorDomain};
/** 用途：判别完整布局页签；使用范围：按 DOM ID 查询活动页签；解耦评估：网关直达布局守卫。 */
import {isLayoutTab} from "../../../layout.types.guard";
/** 导出布局页签守卫。 */
export {isLayoutTab};
/** 用途：按模型类型查找完整 Dock；使用范围：文件树定位命令；解耦评估：网关直达无状态查询实现。 */
import {getDockByType} from "../../../query/dockByType";
/** 导出 Dock 查询能力。 */
export {getDockByType};
/** 用途：按 ID 查询完整布局实例；使用范围：活动页签解析；解耦评估：网关直达布局查询实现。 */
import {getInstanceById} from "../../../query/layoutInstance";
/** 导出布局实例查询能力。 */
export {getInstanceById};
/** 用途：判别并描述父 Files 完整领域；使用范围：focus 子域；解耦评估：网关直达父领域真实声明。 */
import {isFilesDomain} from "../eventHandlers.types";
/** 导出父 Files 完整领域守卫。 */
export {isFilesDomain};
/** 用途：描述父 Files 完整领域；使用范围：活动编辑器定位行为；解耦评估：类型直达真实声明，不加载 class。 */
import type {FilesDomain} from "../eventHandlers.types";
/** 导出父 Files 完整领域类型。 */
export type {FilesDomain};
