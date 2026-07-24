/** 用途：读取弹层边界裁剪使用的工具栏高度；使用范围：positioning/setPosition.ts；解耦评估：稳定布局常量，不依赖编辑器实现。 */
import {Constants} from "../../../constants";
/** 用途：读取当前视口尺寸；使用范围：positioning/setPosition.ts；解耦评估：浏览器环境访问已封装为纯查询函数。 */
import {getWindowHeight, getWindowWidth} from "../../siyuanEnvironments/getWindowSize.environment";

/** 弹层边界使用的共享常量。 */
export {Constants};
/** 当前视口高度读取器。 */
export {getWindowHeight};
/** 当前视口宽度读取器。 */
export {getWindowWidth};
