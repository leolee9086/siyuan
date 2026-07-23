/** 用途：转义源码测量镜像的 HTML。使用范围：仅 showRender 行号渲染。解耦评估：纯函数工具适合通过本依赖入口复用，无需运行时注入。 */
import {escapeHtml} from "../../../util/DOM/escape";
/** 用途：定位源码浮层。使用范围：仅 showRender 桌面和移动端布局。解耦评估：无状态 DOM 工具适合通过本依赖入口复用，无需宿主 Port。 */
import {setPosition} from "../../../util/DOM/setPosition";
/** 用途：区分移动端全屏布局。使用范围：仅 showRender 面板布局。解耦评估：统一平台查询是既有运行时能力，经依赖入口复用比逐层传参更细。 */
import {isMobile} from "../../../util/platform/functions";
/** 用途：读取源码浮层的视口高度边界。使用范围：仅 showRender 自动定位。解耦评估：既有环境访问器已隔离 window，直接复用可避免重复环境适配。 */
import {getWindowInnerHeight} from "../../../util/siyuanEnvironments/getWindowInnerHeight.environment";
/** 用途：生成源码面板按钮文案。使用范围：仅 showRender 模板。解耦评估：既有语言环境访问器已隔离全局对象，继续复用可避免传递整份宿主上下文。 */
import {siyuanI18n} from "../../../util/siyuanEnvironments/i18n.getI18n.environment";

/** 源码测量镜像的 HTML 转义能力。 */
export {escapeHtml};
/** 源码浮层的视口高度能力。 */
export {getWindowInnerHeight};
/** 源码面板的平台判定能力。 */
export {isMobile};
/** 源码浮层的 DOM 定位能力。 */
export {setPosition};
/** 源码面板的本地化文案能力。 */
export {siyuanI18n};
