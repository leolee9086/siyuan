let modelDestroyCallback: (() => void) | undefined;
type TModelBackCallback = () => false | void;

let modelBackCallback: TModelBackCallback | undefined;
let modelVersion = 0;

export const backModel = () => {
    if (!modelBackCallback) {
        return false;
    }
    const callback = modelBackCallback;
    const version = modelVersion;
    modelBackCallback = undefined;
    const keepCallback = callback() === false;
    if (keepCallback && modelVersion === version && !modelBackCallback) {
        modelBackCallback = callback;
    }
    return true;
};

export const destroyModel = () => {
    const callback = modelDestroyCallback;
    modelDestroyCallback = undefined;
    modelBackCallback = undefined;
    modelVersion++;
    callback?.();
};

export const openModel = (obj: {
    html: string,
    icon?: string,
    title: string,
    bindEvent: (element: HTMLElement) => void,
    destroyCallback?: () => void,
    backCallback?: TModelBackCallback,
    transition?: "forward" | "back",
}) => {
    destroyModel();
    const modelElement = document.getElementById("model");
    if(!modelElement) {
        throw new Error("模型元素未找到");
    }
    const isOpen = modelElement.style.transform === "translateX(0px)";
    modelElement.style.transform = "translateX(0px)";
    modelElement.style.zIndex = (++window.siyuan.zIndex).toString();
    const iconElement = modelElement.querySelector(".toolbar__icon") as HTMLElement;
    if(!iconElement) {
        throw new Error("图标元素未找到");
    }
    if(obj.icon) {
        iconElement.classList.remove("fn__none");
        const useElement = iconElement.querySelector("use");
        if(useElement){
        useElement.setAttribute("xlink:href", "#" + obj.icon);
        }
    } else {
        iconElement.classList.add("fn__none");
    }
    iconElement.onclick = obj.backCallback ? backModel : null;
    const toolbartextElement = modelElement.querySelector(".toolbar__text");
    if(!toolbartextElement) {
        throw new Error("工具栏文本元素未找到");
    }
    toolbartextElement.innerHTML = obj.title;
    const modelMainElement = modelElement.querySelector("#modelMain") as HTMLElement;
    modelMainElement.innerHTML = obj.html;
    obj.bindEvent(modelMainElement);
    if (isOpen && obj.transition) {
        modelMainElement.getAnimations().forEach(animation => animation.cancel());
        modelMainElement.animate([
            {transform: `translateX(${obj.transition === "forward" ? "100%" : "-100%"})`},
            {transform: "translateX(0)"},
        ], {
            duration: 150,
            easing: "cubic-bezier(0, 0, .2, 1)",
        });
    }
    modelDestroyCallback = obj.destroyCallback;
    modelBackCallback = obj.backCallback;
};
