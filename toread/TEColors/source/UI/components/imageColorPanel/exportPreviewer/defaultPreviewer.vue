<template>
    <div clss="fn__flex fn__flex-column ">

        <div class="b3-dialog__action fn__flex-1" style="flex-direction: row-reverse;">
            <select value="1" v-model="currentExportMethod">
                <option value="0">使用html2canvas导出</option>
                <option value="1">使用dom2image导出</option>

            </select>

            <select value="1" v-model="currentPreviewerIndex"
                @change="(e) => currentPreviewer = components[e.target.value].component ? components[e.target.value].component() : null">
                <template v-for="(componentDefine, i) in components">
                    <option :value="i" v-if="componentDefine">{{ componentDefine.name }}</option>
                </template>
            </select>
            <button class="b3-button b3-button--cancel" @click="关闭弹窗">取消</button>
            <div class="fn__space"></div>
            <button class="b3-button b3-button--text" id="confirmDialogConfirmBtn" @click="renderImage">确定渲染</button>
        </div>
        <div clss="fn__flex fn__flex-column" style="max-height:90%;background-color: var(--b3-theme-background);"
            ref="_previewElement">
            <img v-if="!currentPreviewer" :src="appData.imageURLs[0]">

            <component v-if="currentPreviewer" :is="_currentPreviewer()"></component>
        </div>

    </div>

</template>
<script setup>
import { inject, ref, shallowRef } from 'vue'
import fs from '../../../../polyfills/fs.js';
import { initVueApp } from '../../../utils/componentsLoader.js';
import { clientApi } from 'runtime';
import _domtoimage from '../../../../../static/dom-to-image-more.js'
const domtoimage = _domtoimage.default
const _previewElement = ref(null)
const components = ref([{ name: '原始色卡' }])
const currentPreviewer = shallowRef(null)
const appData = inject('appData')
const currentPreviewerIndex = ref(0)
const currentExportMethod = ref(1)
const _currentPreviewer = () => {
    return currentPreviewer.value
}
const openByMobile = (uri) => {
    if (!uri) {
        return;
    }
    if (window.siyuan.config.system.container === "ios") {
        window.location.href = uri;
    } else if (window.siyuan.config.system.container === "android" && window.JSAndroid) {
        window.JSAndroid.openExternal(uri);
    } else {
        window.open(uri);
    }
};
async function renderImage() {
    let previewElement = appData.$dialog.element.querySelector('#previewer') || _previewElement.value
    if (currentExportMethod.value) {
        domtoimage.toBlob(previewElement, {
        }).then(saveBlob)
    } else {
        let canvas = await html2canvas(previewElement, {
            useCORS: true,
            scale: 4, //按比例增加分辨率 (2=双倍).  
            dpi: window.devicePixelRatio * 4, //设备像素比
        })
        canvas.toBlob(saveBlob)
    }
}
function saveBlob(blob) {
    try {
        const formData = new FormData();
        formData.append("file", blob, `colors-${Date.now()}.png`);
        formData.append("type", "image/png");
        clientApi.fetchPost("/api/export/exportAsFile", formData, (response) => {
            openByMobile(response.data.file)
        });
    } catch (e) {
        const url = URL.createObjectURL(blob.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `colors-${Date.now()}.png`; // 修正下载文件名

        a.click()
        a.remove()
    }
}
const addScript = (path, id) => {
    return new Promise((resolve) => {
        if (document.getElementById(id)) {
            // 脚本加载后再次调用直接返回
            loadPreviewers()

            resolve(false);
            return false;
        }
        const scriptElement = document.createElement("script");
        scriptElement.src = path;
        scriptElement.async = true;
        // 循环调用时 Chrome 不会重复请求 js
        document.head.appendChild(scriptElement);
        scriptElement.onload = () => {
            if (document.getElementById(id)) {
                // 循环调用需清除 DOM 中的 script 标签
                scriptElement.remove();
                resolve(false);
                return false;
            }
            scriptElement.id = id;
            loadPreviewers()

            resolve(true);
        };
    });
};
addScript("/stage/protyle/js/html2canvas.min.js?v=1.4.1", "protyleHtml2canvas")

async function loadPreviewers() {
    const data = await fs.readDir('/data/plugins/TEColors/source/UI/components/imageColorPanel/exportPreviewer/exportPreviewers/')
    data.forEach(
        (item) => {
            try {
                components.value.push(
                    {
                        name: item.name,
                        component: () => { return initVueApp('/plugins/TEColors/source/UI/components/imageColorPanel/exportPreviewer/exportPreviewers/' + item.name, '$component')._component.components.$component }
                    }
                )
                currentPreviewer.value = components.value[1].component()
                currentPreviewerIndex.value = 1
            } catch (e) {
                console.warn(e)
            }
        }
    )
    const data1 = await fs.readDir('/data/public/themeEditor/teColors/exportPreviewers/')
    data1.forEach(
        (item) => {
            try {
                components.value.push(
                    {
                        name: item.name,
                        component: () => { return initVueApp('/public/themeEditor/teColors/exportPreviewers/' + item.name, '$component')._component.components.$component }
                    }
                )
            } catch (e) {
                console.warn(e)
            }
        }
    )
}

function 关闭弹窗() {
    appData.$dialog.destroy()
}
</script>