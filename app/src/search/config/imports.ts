/** 用途：搜索配置与 Dialog 常量；使用范围：配置持久化及局部搜索判定；解耦评估：稳定静态值。 */
import {Constants} from "../../constants";
/** 导出搜索常量。 */
export {Constants};

/** 用途：搜索路径文案转义；使用范围：配置路径 UI；解耦评估：直达无状态 DOM 工具。 */
import {escapeHtml} from "../../util/DOM/escape";
/** 导出 HTML 转义。 */
export {escapeHtml};

/** 用途：验证搜索输入控件；使用范围：配置写入前；解耦评估：直达共享 DOM 守卫。 */
import {isHTMLInputElement} from "../../util/DOM/element.guard";
/** 导出输入元素守卫。 */
export {isHTMLInputElement};

/** 用途：定位搜索 Dialog；使用范围：局部搜索路径继承；解耦评估：直达 Protyle DOM 查询唯一实现。 */
import {hasClosestByClassName} from "../../protyle/util/hasClosest";
/** 导出祖先查询。 */
export {hasClosestByClassName};

/** 用途：持久化搜索配置；使用范围：配置更新收尾；解耦评估：直达统一存储实现。 */
import {setStorageVal} from "../../util/storage/setStorageVal";
/** 导出存储写入。 */
export {setStorageVal};

/** 用途：读取已初始化的全局搜索存储；使用范围：配置持久化；解耦评估：直达统一环境访问器并在缺失时显式失败。 */
import {getSiyuanStorage} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出严格存储访问器。 */
export {getSiyuanStorage};

/** 用途：关闭当前全局菜单；使用范围：配置应用完成后；解耦评估：直达菜单环境唯一访问器。 */
import {getSiyuanGlobalMenusMenu} from "../../util/siyuanEnvironments/getMenu.environment";
/** 导出严格菜单访问器。 */
export {getSiyuanGlobalMenusMenu};

/** 用途：搜索方法文案；使用范围：语法状态图标；解耦评估：直达 i18n 环境。 */
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出搜索文案。 */
export {siyuanI18n};

/** 用途：完整 Protyle 领域根；使用范围：配置刷新参数；解耦评估：纯类型不加载具体实现。 */
import type {ProtyleDomain} from "../../protyle/protyle.types";
/** 导出 Protyle 领域根。 */
export type {ProtyleDomain};
