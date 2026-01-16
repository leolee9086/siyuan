import { plugin } from "../asyncModules.js";
import { ref, reactive, computed, watch } from '../../static/vue.esm-browser.js'
export function createReactiveData() {
    plugin.reactiveData = {}; // 初始化reactiveData对象
    Object.keys(plugin.data).forEach(key => {
        plugin.reactiveData[key] = ref(plugin.data[key]); // 为每个属性创建响应式引用
    });
    watch(
        ()=>plugin.reactiveData['customColorPlattes'],(oldValue,newValue)=>{
            localStorage.setItem('customColorPlattes', JSON.stringify(newValue)); 
            plugin.eventBus.emit('localValChange-customColorPlattes',newValue)
        },
        { deep: true }
    )
}
