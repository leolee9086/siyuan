import { createVueComponentLoader } from "../../util/vue/mount";
import { default as ImageViewer } from "../../components/imageViewer.vue";

export const initImagePanel = (element: HTMLElement, urlOrPath: string) => {
    // 清空容器
    element.innerHTML = '';
    
    // 计算图片源地址
    
    // 使用Vue组件加载器创建图片查看器
    createVueComponentLoader(
        element,
        {
            components: { ImageViewer },
            data: { src: urlOrPath },
            template: `<ImageViewer :src="src" />`
        }
    );
};