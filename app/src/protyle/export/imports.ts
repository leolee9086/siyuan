/** 用途：HTML 字符串转义工具；使用范围：导出成功提示中展示路径文本；解耦评估：纯函数工具，可参数注入，但在导出模块中直接复用成本最低。 */
import {escapeHtml} from "../../util/DOM/escape";
/** 用途：隐藏消息提示；使用范围：导出结束或按钮点击后关闭消息；解耦评估：UI 基础能力，可事件化解耦，但当前直接调用更清晰。 */
import {hideMessage} from "../runtime/dialog.port";
/** 用途：展示消息提示；使用范围：导出中、导出失败、导出完成提示；解耦评估：UI 基础能力，可事件化解耦，但当前直接调用更清晰。 */
import {showMessage} from "../runtime/dialog.port";
/** 用途：HTTP POST 请求封装；使用范围：请求导出预览与上传导出文件；解耦评估：网络基础设施，可注入 mock，但业务侧直接依赖可读性更高。 */
import {fetchPost} from "../../util/network/fetch";
/** 用途：对话框组件；使用范围：导出图片弹窗创建与销毁；解耦评估：UI 组件核心依赖，无法通过简单参数完全替代。 */
import {Dialog} from "../runtime/dialog.port";
/** 用途：动态加载脚本；使用范围：按需加载 html-to-image；解耦评估：资源加载基础能力，集中复用优于模块内重复实现。 */
import {addScript} from "../util/addScript";
/** 用途：移动端判断；使用范围：导出弹窗布局与截图区域处理；解耦评估：平台判断工具，可注入但无必要。 */
import {isMobile} from "../../util/platform/functions";
/** 用途：导出模块常量；使用范围：storage key、dialog key；解耦评估：配置常量中心化依赖，难以解耦。 */
import {Constants} from "../../constants";
/** 用途：代码高亮渲染；使用范围：预览刷新后高亮同步；解耦评估：渲染阶段能力，直接调用最稳定。 */
import {highlightRender} from "../render/highlightRender";
/** 用途：批量内容渲染注册表；使用范围：预览内容组件渲染；解耦评估：渲染编排核心，直接依赖是合理边界。 */
import {contentRendererRegistry} from "../../registry/contentRenderer/ContentRendererRegistry";
/** 用途：iPhone 判断；使用范围：截图兼容预热分支；解耦评估：平台判断工具，保持直接调用可读性最佳。 */
import {isIPhone} from "../../util/platform/functions";
/** 用途：Safari 判断；使用范围：截图兼容预热分支；解耦评估：平台判断工具，保持直接调用可读性最佳。 */
import {isSafari} from "../util/compatibility";
/** 用途：移动端打开导出文件；使用范围：导出完成后打开图片结果；解耦评估：平台适配能力，不适合在业务层重复实现。 */
import {openByMobile} from "../../editor/openLink";
/** 用途：写入本地存储；使用范围：保存导出图片选项；解耦评估：存储基础能力，可注入但直接调用更简洁。 */
import {setStorageVal} from "../util/compatibility";
/** 用途：Electron Shell 封装；使用范围：在文件夹中显示导出结果；解耦评估：平台能力封装，直接依赖是正确边界。 */
import {useShell} from "../../util/file/pathName";
/** 用途：i18n 文案访问；使用范围：导出流程 UI 文案；解耦评估：全局文案服务，业务模块直接使用符合项目约定。 */
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 用途：Electron 环境判断；使用范围：导出后“在文件夹中显示”能力开关；解耦评估：平台能力判断，不宜在业务层重写。 */
import {isElectron} from "../../platform";
/** 用途：Electron 导出流程的 Node 模块加载边界；使用范围：仅导出文件定位和本地文件写入分支，浏览器构建由 resolver 替换为 stub；解耦评估：这些能力依赖宿主文件系统，后续可由 ExportPort 注入，但当前通过 imports 网关集中保留。 */
import {nativeRequire} from "../../platform/nativeRequire";
/** 用途：获取 html-to-image 运行时对象；使用范围：截图与水印纹理生成；解耦评估：通过 environment 层避免业务直接访问 window。 */
import {getHtmlToImage} from "../../util/siyuanEnvironments/getHtmlToImage.environment";

// 导出：路径转义工具
export {escapeHtml};
// 导出：消息隐藏
export {hideMessage};
// 导出：消息展示
export {showMessage};
// 导出：网络请求
export {fetchPost};
// 导出：对话框组件
export {Dialog};
// 导出：脚本加载器
export {addScript};
// 导出：移动端判断
export {isMobile};
// 导出：常量集合
export {Constants};
// 导出：高亮渲染
export {highlightRender};
// 导出：内容渲染注册表
export {contentRendererRegistry};
// 导出：iPhone 判断
export {isIPhone};
// 导出：Safari 判断
export {isSafari};
// 导出：移动端打开文件
export {openByMobile};
// 导出：存储写入
export {setStorageVal};
// 导出：Electron shell 封装
export {useShell};
// 导出：i18n 文案
export {siyuanI18n};
// 导出：Electron 判断
export {isElectron};
// 导出：Node 模块加载边界
export {nativeRequire};
// 导出：html-to-image 访问器
export {getHtmlToImage};
