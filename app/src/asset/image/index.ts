import { createVueComponentLoader } from "../../util/vue/mount";
import { default as ImageViewer } from "../../components/imageEditor.vue";

export const render = (element: HTMLElement, urlOrPath: string) => {
    // 清空容器
    element.innerHTML = '';
    createVueComponentLoader(
        element,
        {
            components: { ImageViewer },
            data: { src: urlOrPath },
            template: `<ImageViewer :src="src" />`
        }
    );
};

export  default {
    render
}