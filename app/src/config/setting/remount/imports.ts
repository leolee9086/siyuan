/** 用途：读取设置对话框搜索词；使用范围：重挂载当前设置页签时复用搜索过滤；解耦评估：纯 DOM 读取唯一实现，不加载设置装配模块。 */
import {getSearchKeywordsLower} from "../../search/normalize";
/** 导出设置搜索词读取实现，供重挂载子域使用。 */
export {getSearchKeywordsLower};
/** 用途：定位设置对话框身份；使用范围：重挂载流程识别目标 Dialog；解耦评估：稳定常量不依赖 Dialog class。 */
import {Constants} from "../../../constants";
/** 导出设置 Dialog 身份常量，供重挂载子域使用。 */
export {Constants};
/** 用途：读取 SForge 注册表；使用范围：重挂载流程获取完整页签注册表；解耦评估：状态基础设施不反向加载 tabs.ts。 */
import {getSForgeState} from "../../sforge.global";
/** 导出 SForge 状态读取实现，供重挂载子域使用。 */
export {getSForgeState};
/** 用途：定位设置页签注册表状态；使用范围：读取完整 SettingTab 领域对象；解耦评估：Symbol 提供跨模块稳定身份。 */
import {SETTING_TAB_REGISTRY} from "../../sforge.symbols";
/** 导出设置页签注册表键，供重挂载子域使用。 */
export {SETTING_TAB_REGISTRY};
