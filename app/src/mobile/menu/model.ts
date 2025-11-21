export const openModel = (obj: {
    html: string,
    icon?: string,
    title: string,
    bindEvent: (element: HTMLElement) => void
}) => {
    const modelElement = document.getElementById("model");
    if(!modelElement) {
        throw new Error("模型元素未找到");
    }
    modelElement.style.transform = "translateY(0px)";
    modelElement.style.zIndex = (++window.siyuan.zIndex).toString();
    const iconElement  = modelElement.querySelector(".toolbar__icon");
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
    const toolbartextElement = modelElement.querySelector(".toolbar__text");
    if(!toolbartextElement) {
        throw new Error("工具栏文本元素未找到");
    }
    toolbartextElement.innerHTML = obj.title;
    const modelMainElement = modelElement.querySelector("#modelMain") as HTMLElement;
    modelMainElement.innerHTML = obj.html;
    obj.bindEvent(modelMainElement);
};
