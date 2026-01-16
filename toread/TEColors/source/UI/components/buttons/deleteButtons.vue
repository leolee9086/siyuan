<template>
    <div class="fn__flex fn_full_width" >
        <button @click.stop.prevent.capture="(保持选区执行操作(清除选中块样式))(['color'])" class="b3-button b3-button--cancel"
            data-type="clear">
            <svg>
                <use xlink:href="#iconTrashcan"></use>
            </svg>清除选中前景色
        </button>
        <button @click.stop.prevent.capture="(保持选区执行操作(清除选中块样式))(['backgroundColor'])"
            class="b3-button b3-button--cancel" data-type="clear">
            <svg>
                <use xlink:href="#iconTrashcan"></use>
            </svg>清除选中背景色
        </button>
        <button @click.stop.prevent.capture="(保持选区执行操作(清除可见块样式))(['color'])" 
        class="b3-button b3-button--cancel" data-type="clear">
            <svg>
                <use xlink:href="#iconTrashcan"></use>
            </svg>清除所有可见块前景色
        </button>
        <button @click.stop.prevent.capture="(保持选区执行操作(清除可见块样式))(['backgroundColor'])"
            class="b3-button b3-button--cancel" data-type="clear">
            <svg>
                <use xlink:href="#iconTrashcan"></use>
            </svg>清除所有可见块背景色
        </button>
        <button @click.stop.prevent.capture="(保持选区执行操作(清除所有已加载块元素样式))(['color'])"
         class="b3-button b3-button--cancel"
            data-type="clear">
            <svg>
                <use xlink:href="#iconTrashcan"></use>
            </svg>清除所有已加载块前景色
        </button>
        <button @click.stop.prevent.capture="(保持选区执行操作(清除所有已加载块元素样式))(['backgroundColor'])"
            class="b3-button b3-button--cancel" data-type="clear">
            <svg>
                <use xlink:href="#iconTrashcan"></use>
            </svg>清除所有已加载块背景色
        </button>
    </div>
</template>
<script setup>
import { 保持选区执行操作 } from '../../../utils/FunctionTools/tools.js';
import {
    清除所有已加载块元素样式,
    清除可见块样式,
    清除选中块样式
} from '../../../utils/DOM/blockStyle.js'
import {ref} from 'vue'
const id  = ref(Lute.NewNodeID().replace('-',"_"))

</script>