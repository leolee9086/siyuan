# plantumlRender.ts 修复调查报告

## 1. render 目录结构

`app/src/protyle/render/` 目录条目（不含 av/ 子目录内容）：

| 文件 | 说明 |
|------|------|
| .plan.md | 计划文档 |
| abcRender.environment.ts | ABC渲染 environment 封装 |
| abcRender.guard.ts | ABC渲染类型守卫 |
| abcRender.ts | ABC渲染主文件 |
| abcRender.types.ts | ABC渲染类型定义 |
| blockRender.ts | 块渲染 |
| blockRender.types.ts | 块渲染类型 |
| chartRender.ts | 图表渲染 |
| flowchartRender.ts | 流程图渲染 |
| graphvizRender.ts | Graphviz渲染 |
| highlightRender.ts | 高亮渲染 |
| htmlRender.ts | HTML渲染 |
| mathRender.environment.ts | 数学公式 environment 封装 |
| mathRender.guard.ts | 数学公式类型守卫 |
| mathRender.helpers.ts | 数学公式辅助函数 |
| mathRender.ts | 数学公式渲染主文件 |
| mermaidRender.environment.ts | Mermaid environment 封装 |
| mermaidRender.ts | Mermaid渲染 |
| mermaidRender.types.ts | Mermaid类型定义 |
| mindmapRender.ts | 脑图渲染 |
| plantumlRender.ts | PlantUML渲染（待修复） |
| README.md | 说明文档 |
| searchMarkRender.ts | 搜索标记渲染 |
| setLute.ts | Lute设置 |
| speechRender.ts | 语音渲染 |
| util.ts | 工具函数 |
| av/ | 属性视图子目录（含大量文件） |

顶层条目数：27（含 av/ 目录）

## 2. environment 文件模式

### 模式说明

environment 文件封装 `window` 全局对象访问，避免业务代码直接访问 window。

### abcRender.environment.ts 示例

```ts
/** @同步豁免: 遗留代码 - 访问动态加载到 window 上的第三方库对象 */
export function getAbcjsInstance(): Window["ABCJS"] {
    return window.ABCJS;
}
```

### mathRender.environment.ts 示例

```ts
/** @同步豁免: 遗留代码 - 访问动态加载到 window 上的第三方库对象 */
export function getKatexRenderer(): Window["katex"] {
    return window.katex;
}

/** @同步豁免: 遗留代码 - 读取已加载的配置对象，无异步需求 */
export function getKatexMacrosString(): string {
    return window.siyuan?.config?.editor?.katexMacros || "";
}
```

### plantumlEncoder 封装情况

**尚未存在**。`window.plantumlEncoder` 目前在 `plantumlRender.ts` 中直接访问，未经 environment 封装。

类型定义位于 `app/src/types/index.d.ts:233`：
```ts
plantumlEncoder: {
    encode(options: string): string,
};
```

### plantUMLServePath 访问

`window.siyuan.config.editor.plantUMLServePath` 也在 plantumlRender.ts 中直接访问，可通过已有的 `getSiyuanConfig()` 间接获取。

## 3. guard 文件模式

### 项目中已有的 guard 文件

- `app/src/protyle/render/abcRender.guard.ts`
- `app/src/protyle/render/mathRender.guard.ts`
- `app/src/layout/layout.guard.ts`
- `app/src/layout/dock/dock.guard.ts`
- `app/src/config/search.guard.ts`
- `app/src/config/sforge.guard.ts`
- `app/src/registry/TriggerRegistry.guard.ts`
- `app/src/registry/TabRegistry.guard.ts`
- `app/src/util/lib/zodMethodDefinedClass/modeRouter.guard.ts`

### HTMLElement 相关守卫（mathRender.guard.ts）

```ts
export function isHTMLElement(element: Element | null | undefined): element is HTMLElement {
    return element instanceof HTMLElement;
}

export function isHTMLElementNode(node: Node | false | null | undefined): node is HTMLElement {
    return node instanceof HTMLElement;
}
```

**注意**：plantumlRender.ts 第19行将 `Element` 断言为 `HTMLDivElement`（`forEach((e: HTMLDivElement) => ...)`），需要类型守卫替代。`isHTMLElement` 已在 mathRender.guard.ts 中存在，可复用或在 plantumlRender.guard.ts 中创建专用版本。

## 4. plantumlRender.ts 当前完整内容

```ts
import {addScript} from "../util/addScript";
import {Constants} from "../../constants";
import {genIconHTML} from "./util";
import {hasClosestByClassName} from "../util/hasClosest";

export const plantumlRender = (element: Element, cdn = Constants.PROTYLE_CDN) => {
    let plantumlElements: Element[] = [];
    if (element.getAttribute("data-subtype") === "plantuml") {
        plantumlElements = [element];
    } else {
        plantumlElements = Array.from(element.querySelectorAll('[data-subtype="plantuml"]'));
    }
    if (plantumlElements.length === 0) {
        return;
    }
    addScript(`${cdn}/js/plantuml/plantuml-encoder.min.js?v=0.0.0`, "protylePlantumlScript").then(() => {
        const wysiswgElement = hasClosestByClassName(element, "protyle-wysiwyg", true);
        plantumlElements.forEach((e: HTMLDivElement) => {
            if (e.getAttribute("data-render") === "true") {
                return;
            }
            if (!e.firstElementChild.classList.contains("protyle-icons")) {
                e.insertAdjacentHTML("afterbegin", genIconHTML(wysiswgElement));
            }
            const renderElement = e.firstElementChild.nextElementSibling as HTMLElement;
            if (!e.getAttribute("data-content")) {
                renderElement.innerHTML = `<span style="position: absolute;left:0;top:0;width: 1px;">${Constants.ZWSP}</span>`;
                return;
            }
            try {
                const url = `${window.siyuan.config.editor.plantUMLServePath}${window.plantumlEncoder.encode(Lute.UnEscapeHTMLStr(e.getAttribute("data-content")))}`;
                renderElement.innerHTML = `<object type="image/svg+xml" data="${url}"/>`;
                renderElement.classList.remove("ft__error");
                renderElement.firstElementChild.addEventListener("error", () => {
                    renderElement.innerHTML = `<img src=${url}">`;
                });
            } catch (error) {
                renderElement.classList.add("ft__error");
                renderElement.innerHTML = `plantuml render error: <br>${error}`;
            }
            e.setAttribute("data-render", "true");
        });
    });
};
```

### 需修复的问题清单

| 行号 | 问题 | 类别 |
|------|------|------|
| 19 | `(e: HTMLDivElement)` — Element 直接标注为 HTMLDivElement，无运行时检查 | 类型断言 |
| 26 | `as HTMLElement` — firstElementChild.nextElementSibling 断言 | 类型断言 |
| 32 | `window.siyuan.config.editor.plantUMLServePath` — 直接访问 window | window 访问 |
| 32 | `window.plantumlEncoder.encode(...)` — 直接访问 window | window 访问 |
| 23 | `e.firstElementChild.classList` — firstElementChild 可能为 null，无空值检查 | 空值安全 |

## 5. 调用方

| 调用位置 | 文件 | 调用方式 |
|----------|------|----------|
| processCode.ts:52 | `app/src/protyle/util/processCode.ts` | `plantumlRender(previewPanel)` |
| processCode.ts:64 | `app/src/protyle/util/processCode.ts` | `plantumlRender(previewPanel)` |
| method.ts:31 | `app/src/protyle/method.ts` | 静态方法 `Protyle.plantumlRender = plantumlRender` |
| export/index.ts:505 | `app/src/protyle/export/index.ts` | `Protyle.plantumlRender(wysElement, "${servePath}stage/protyle")` |
| export/index.ts:836 | `app/src/protyle/export/index.ts` | `Protyle.plantumlRender(previewElement, "stage/protyle")` |
| ProtyleMethod.ts:31 | `app/src/plugin/ProtyleMethod.ts` | 静态方法 `ProtyleMethod.plantumlRender = plantumlRender` |

所有调用方均传入 `Element` 类型参数，函数签名 `(element: Element, cdn?)` 无需变更。
