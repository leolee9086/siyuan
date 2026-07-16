/** 用途：发送块属性和工作区导出请求；使用范围：颜色应用持久化与色卡导出；解耦评估：网关隔离请求实现，未来可注入请求适配器。 */
export {fetchPost} from "../../util/network/fetch";
/** 用途：调用编辑器现有文字样式事件；使用范围：文字行内颜色应用与清除；解耦评估：复用宿主编辑器协议，避免复制 selection/transaction 逻辑。 */
export {fontEvent} from "../../protyle/toolbar/Font";
/** 用途：查找当前块；使用范围：颜色应用的块回退路径；解耦评估：通过 DOM 查询网关复用已有实现。 */
export {hasClosestBlock} from "../../protyle/util/hasClosest";
/** 用途：查找当前编辑器及选区；使用范围：颜色操作目标选择；解耦评估：依赖现有注册表接口，颜色模块不持有 Protyle 全局列表。 */
export {查找有选区的Protyle} from "../../registry/TriggerRegistry.protyle";
/** 用途：查找当前编辑器实例；使用范围：颜色操作的单块回退；解耦评估：依赖现有注册表接口，颜色模块不持有 Protyle 全局列表。 */
export {查找Protyle} from "../../registry/TriggerRegistry.protyle";
/** 用途：Vue 组件挂载适配；使用范围：预留给颜色工具宿主挂载；解耦评估：当前对话框直接使用 createVueDialog，保留网关以兼容内建组件边界。 */
export {createVueComponentLoader} from "../../util/vue/mount";
/** 用途：创建原生 Vue 对话框；使用范围：颜色工具打开流程；解耦评估：对话框容器可替换，不让颜色面板依赖插件加载机制。 */
export {createVueDialog} from "../../util/vue/createVueDialog";
/** 用途：对话框实例类型；使用范围：颜色工具生命周期状态；解耦评估：纯类型边界，不增加运行时耦合。 */
export {Dialog} from "../../dialog";
/** 用途：创建宿主菜单项；使用范围：图片和块图标颜色入口；解耦评估：菜单配置与颜色逻辑分离。 */
export {MenuItem} from "../../menus/Menu.Item";
/** 用途：注册状态栏按钮；使用范围：颜色工具启动入口；解耦评估：复用统一注册表，避免颜色模块直接操作状态栏 DOM。 */
export {注册状态栏按钮} from "../../registry/StatusBarRegistry";
/** 用途：显示用户提示；使用范围：颜色应用、导入和导出错误反馈；解耦评估：统一提示层便于未来接入本地化。 */
export {showMessage} from "../../dialog/message";
/** 用途：判断移动端布局；使用范围：颜色对话框尺寸；解耦评估：平台能力集中于基础工具层。 */
export {isMobile} from "../../util/platform/functions";
/** 用途：读取宿主配置；使用范围：颜色功能的运行环境适配；解耦评估：通过环境模块访问配置，避免直接读取不稳定全局结构。 */
export {getSiyuanConfig} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 用途：确认 Dock 容器是 HTMLElement；使用范围：颜色工具原生 Dock 挂载；解耦评估：DOM 类型判断由通用 guard 提供，颜色模块不使用断言。 */
export {isHTMLElement} from "../../util/DOM/element.guard";
