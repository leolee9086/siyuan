/** 用途：测试 DOM 运行时。使用范围：构造 Tab 模型所需的真实 Element；解耦评估：仅位于 test 目录，不进入生产图。 */
import {Window} from "happy-dom";

/** 创建注册表模型测试使用的真实 DOM 面板，避免用对象断言伪造 Element。@同步豁免: UI构建 - 测试装配需同步返回元素。 */
export const createTestPanelElement = () => new Window().document.createElement("div");
