/** 加载并按元素 ID 去重独立入口脚本。 */
export const loadStandaloneScript = async (src: string, id: string) => {
    await new Promise<void>((resolve, reject) => {
        const candidate = document.getElementById(id);
        const existing = candidate instanceof HTMLScriptElement ? candidate : null;
        // 由本加载器完成的脚本带有已加载标记，重复调用可以立即复用其全局副作用。
        if (existing?.dataset.loaded === "true") {
            resolve();
            return;
        }
        if (existing) {
            existing.addEventListener("load", () => resolve(), {once: true});
            existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), {once: true});
            return;
        }
        const script = document.createElement("script");
        script.id = id;
        script.src = src;
        script.addEventListener("load", () => {
            script.dataset.loaded = "true";
            resolve();
        }, {once: true});
        script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), {once: true});
        document.head.appendChild(script);
    });
};

/** 加载并按元素 ID 去重独立入口样式表。 */
export const loadStandaloneStyle = async (href: string, id: string) => {
    await new Promise<void>((resolve, reject) => {
        const candidate = document.getElementById(id);
        // 固定 ID 已存在表示该入口已注册同一职责的样式表，无需追加重复 link。
        if (candidate instanceof HTMLLinkElement) {
            resolve();
            return;
        }
        const style = document.createElement("link");
        style.id = id;
        style.rel = "stylesheet";
        style.href = href;
        style.addEventListener("load", () => resolve(), {once: true});
        style.addEventListener("error", () => reject(new Error(`Failed to load ${href}`)), {once: true});
        document.head.appendChild(style);
    });
};
