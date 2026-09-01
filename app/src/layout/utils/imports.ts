// 跨目录依赖转发

/** 用途：资源模型类。使用范围：newTab 模块创建资源页签。解耦评估：通过 imports.ts 转发。 */
import { Asset } from "../../asset";
/** 导出 Asset，供 utils 模块使用 */
export { Asset };

/** 用途：创建卡片页签模型。使用范围：newTab 模块创建卡片页签。解耦评估：通过 imports.ts 转发。 */
import { newCardModel } from "../../card/newCardTab";
/** 导出 newCardModel，供 utils 模块使用 */
export { newCardModel };

/** 用途：创建数据库行页签模型。使用范围：newTab 模块创建数据库行页签。解耦评估：通过 imports.ts 转发。 */
import { newDatabaseRowModel } from "../../editor/databaseRow";
/** 导出 newDatabaseRowModel，供 utils 模块使用 */
export { newDatabaseRowModel };

/** 用途：应用常量定义。使用范围：newTab 模块使用常量配置。解耦评估：通过 imports.ts 转发。 */
import { Constants } from "../../constants";
/** 导出 Constants，供 utils 模块使用 */
export { Constants };

/** 用途：页签类。使用范围：newTab 模块创建页签实例。解耦评估：通过 imports.ts 转发。 */
import { Tab } from "../Tab";
/** 导出 Tab，供 utils 模块使用 */
export { Tab };

/** 用途：页签注册表。使用范围：newTab 模块查找自定义页签模型。解耦评估：通过 imports.ts 转发。 */
import { tabRegistry } from "../../registry";
/** 导出 tabRegistry，供 utils 模块使用 */
export { tabRegistry };
/** 用途：创建注册表声明的 Custom 模型。使用范围：newTab 自定义页签装配。解耦评估：复用 Dock 唯一组合工厂。 */
import {createCustomTabModel} from "../dock/custom/factory";
/** 导出 Custom 模型组合工厂。 */
export {createCustomTabModel};

/** 用途：搜索模型类。使用范围：newTab 模块创建搜索页签。解耦评估：通过 imports.ts 转发。 */
import { Search } from "../../search";
/** 导出 Search，供 utils 模块使用 */
export { Search };

/** 用途：路径处理工具（POSIX 风格）。使用范围：newTab 模块解析文件扩展名。解耦评估：通过 imports.ts 转发。 */
import { pathPosix } from "../../util/file/pathName";
/** 导出 pathPosix，供 utils 模块使用 */
export { pathPosix };

/** 用途：获取显示名称。使用范围：newTab 模块显示资源标题。解耦评估：通过 imports.ts 转发。 */
import { getDisplayName } from "../../util/file/pathName";
/** 导出 getDisplayName，供 utils 模块使用 */
export { getDisplayName };

/** 用途：获取文档显示名称。使用范围：newTab 模块显示文档标题。解耦评估：通过 imports.ts 转发。 */
import { getDocDisplayName } from "../../util/file/pathName";
/** 导出 getDocDisplayName，供 utils 模块使用 */
export { getDocDisplayName };

/** 用途：国际化文案。使用范围：newTab 模块搜索页签标题。解耦评估：通过 imports.ts 转发。 */
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 siyuanI18n，供 utils 模块使用 */
export { siyuanI18n };
/** 用途：创建已注入宿主能力的编辑器；使用范围：newTab 编辑器页签；解耦评估：创建逻辑集中在 Editor 工厂。 */
import {createEditor} from "../../editor/factory/createEditor.factory";
/** 导出编辑器创建工厂，供布局页签装配使用。 */
export {createEditor};

/** 用途：恢复浏览器选区。使用范围：布局尺寸调整结束；解耦评估：稳定 Protyle 选区实现。 */
import {focusByRange} from "../../protyle/util/selection";
/** 导出选区恢复能力。 */
export {focusByRange};
