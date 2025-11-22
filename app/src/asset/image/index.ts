import { createVueComponentLoader } from "../../util/vue/mount";
import { default as ImageViewer } from "../../components/panels/imageEditor.vue";
import { withProps } from "../../util/vue/wrapper";


export const render = (element: HTMLElement, src: string) => {
    // 清空容器
    element.innerHTML = '';
    const ImageViewerBinded = withProps(() => { return { src } })(ImageViewer)
    createVueComponentLoader(
        element,
        {
            components: { ImageViewerBinded },
        }
    );
};

export default {
    render
}
