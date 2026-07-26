/** 用途：对话框构造器。使用范围：资产重命名 UI 组合边界；解耦评估：具体 class 仅在创建边界加载。 */
import {Dialog} from "../../dialog";
/** 导出对话框构造器。 */
export {Dialog};

/** 用途：移动宿主判断。使用范围：对话框宽度与桌面 Asset 模型更新；解耦评估：稳定平台事实。 */
import {isMobile} from "../../util/platform/functions";
/** 导出移动宿主判断。 */
export {isMobile};

/** 用途：资产路径名称。使用范围：重命名初始值；解耦评估：直达稳定 path 唯一实现。 */
import {getAssetName} from "../../util/file/path/operations";
/** 导出资产路径名称实现。 */
export {getAssetName};

/** 用途：网络请求。使用范围：提交资产重命名；解耦评估：稳定基础设施。 */
import {fetchPost} from "../../util/network/fetch";
/** 导出网络请求。 */
export {fetchPost};

/** 用途：应用常量。使用范围：资产重命名 Dialog 身份；解耦评估：稳定配置值。 */
import {Constants} from "../../constants";
/** 导出应用常量。 */
export {Constants};

/** 用途：完整布局模型查询。使用范围：更新已打开 Asset 模型；解耦评估：返回既有完整领域集合。 */
import {getAllModels} from "../../layout/getAll";
/** 导出完整布局模型查询。 */
export {getAllModels};

/** 用途：完整编辑器查询。使用范围：资产重命名后刷新编辑器；解耦评估：返回既有 EditorDomain 集合。 */
import {getAllEditor} from "../../layout/getAll";
/** 导出完整编辑器查询。 */
export {getAllEditor};

/** 用途：国际化文案。使用范围：重命名对话框；解耦评估：稳定环境读取。 */
import {getSiyuanLanguages} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出国际化文案读取。 */
export {getSiyuanLanguages};

/** 用途：类型安全的表单元素查询。使用范围：资产重命名表单；解耦评估：共享唯一 DOM 收窄实现。 */
import {getButtonElement, getInputElement} from "../../util/DOM/queryFormElements";
/** 导出按钮查询。 */
export {getButtonElement};
/** 导出输入框查询。 */
export {getInputElement};
