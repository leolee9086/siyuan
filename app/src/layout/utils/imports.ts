// 跨目录依赖转发

/** 用途：编辑器类。使用范围：newTab 模块创建编辑器页签。解耦评估：通过 imports.ts 转发。 */
import { Editor } from "../../editor";
/** 导出 Editor，供 utils 模块使用 */
export { Editor };

/** 用途：编辑器选项接口。使用范围：newTab 模块编辑器配置类型。解耦评估：通过 imports.ts 转发。 */
import type { IEditorOptions } from "../../editor/types";
/** 导出 IEditorOptions 类型，供 utils 模块使用 */
export type { IEditorOptions };

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
