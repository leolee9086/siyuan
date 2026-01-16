<template>
  <div @click.stop class="fn__flex"
    :style="{ backgroundColor: lastActivedPlatte === lastSelectedPlatte ? 'var(--b3-card-info-background)' : '', color: lastActivedPlatte === lastSelectedPlatte ? 'var(--b3-card-info-color)' : '' }">
    <select v-show="!currentName" ref="selector" id="apiProvider" class="b3-select fn__flex-center fn__size200"
      @change="切换色板">
      <option value="chinese" selected="">中国传统颜色</option>
      <template v-for="(ColorPlatte, i) in customColorPlattes">
        <option :value="i" @selected="切换色板">{{ ColorPlatte.name || "未命名" }}{{ lastActivedPlatte === i ? '(当前编辑目标)' : ''
          }}
        </option>
      </template>
    </select>
    <input v-model="currentName" v-if="currentName" @change="修正名称">
    <div style="max-height:28px;height: 100%;margin:auto 2px" class="block__logo">
      <svg style="display: inline-block;" class="b3-menu__icon " v-if="!currentName" @click.stop.prevent="编辑名称"
        :style="{ color: lastSelectedPlatte !== 'chinese' ? 'black' : 'grey' }">
        <use xlink:href="#iconEdit"></use>
      </svg>
      <svg  style="display: inline-block;" class="b3-menu__icon " v-if="!currentName" @click.stop.prevent="添加色板">
        <use xlink:href="#iconAdd"></use>
      </svg>
      <svg style="display: inline-block;" class="b3-menu__icon " v-if="!currentName" @click.stop.prevent="上传色板">
        <use xlink:href="#iconFolder"></use>
      </svg>
      <svg style="display: inline-block;" class="b3-menu__icon " v-if="!currentName" @click.stop.prevent="下载画板">
        <use xlink:href="#iconDownload"></use>
      </svg>

      <svg  style="display: inline-block;" class="b3-menu__icon " v-if="currentName" @click.stop.prevent="保存名称">
        <use xlink:href="#iconUpload"></use>
      </svg>
      <svg  style="display: inline-block;" class="b3-menu__icon " v-if="currentName" @click.stop.prevent="删除当前画板">
        <use xlink:href="#iconTrashcan"></use>
      </svg>
    </div>
  </div>
  <div>
    <template v-if="lastSelectedPlatte === 'chinese'">
      <div class="grid__container" @wheel="verticalScroll"
        @click.stop="(event) => !event.ctrlKey && 应用颜色到当前块(['backgroundColor'], true, saveToRecent)(event)"
        @click.ctrl.stop="(event) => 计算前景并应用到当前块背景色(event)"
        @click.right.stop="(event) => !event.ctrlKey && 应用到当前块文字色(event)"
        @click.right.ctrl.stop="(event) => 计算背景并应用到当前块文字色(event)" 
        style="max-height:168px;overflow: hidden;">
        <template v-for="(data, i) in currentPalette">
          <button v-if="data" class="color__square ariaLabel" :aria-label="data.name + 提示文本"
            :style="computedString(data)"></button>
        </template>
      </div>
    </template>
    <template v-if="lastSelectedPlatte !== 'chinese'">
      <div class="grid__container" @wheel="verticalScroll"
        @click.stop="(event) => { lastActivedPlatte = lastSelectedPlatte + 0; !event.ctrlKey && 应用颜色到当前块(['backgroundColor'], true, saveToRecent)(event) }"
        @click.ctrl.stop="(event) => { lastActivedPlatte = lastSelectedPlatte + 0; 计算前景并应用到当前块背景色(event) }"
        @click.right.stop="(event) => { lastActivedPlatte = lastSelectedPlatte + 0; !event.ctrlKey && 应用到当前块文字色(event) }"
        @click.right.ctrl.stop="(event) => { lastActivedPlatte = lastSelectedPlatte + 0; 计算背景并应用到当前块文字色(event) }"
        style="max-height:168px;overflow: hidden;">
        <template v-for="(data, i) in customColorPlattes[lastSelectedPlatte].data">
          <button 
          @click.right.alt.stop.prevent="重命名颜色(i)"

          @click.alt.stop.prevent="() => { customColorPlattes[lastSelectedPlatte].data.splice(i, 1) }"
            v-if="data" class="color__square ariaLabel" :aria-label="data.name + 提示文本 + `\n按住alt删除\n右键+alt命名`"
            :style="computedString(data)"></button>
        </template>
      </div>
    </template>
  </div>
</template>
<script setup>
import { dict } from '../../../Data/defaultColors/chinese.js'
import { ref, onMounted, watch } from 'vue'
import { 应用颜色到当前块, 计算背景并应用到当前块文字色, 计算前景并应用到当前块背景色, 应用到当前块文字色 } from '../../../utils/DOM/blockStyle.js'
import { 按照相似度排序颜色 } from '../../../utils/color/colorSorter.js'
import { plugin,clientApi } from "runtime"
import { readAcoFile, createAcoFile } from '../../../../static/adobe-aco.js'
const customColorPlattes = plugin.reactiveData.customColorPlattes
const lastActivedPlatte = plugin.reactiveData.lastActivedPlatte
const lastSelectedPlatte = ref('chinese')
watch(
  () => lastSelectedPlatte, (o, v) => {

  }
)
const 提示文本 = ref(
  `\n左键背景,右键前景\n按住crtl自动计算`
)
const currentPalette = ref([])
const readonly = ref(true)
const selector = ref(null)
const currentName = ref('')
const fileInput = ref(null)
function 重命名颜色(i){
  const color = customColorPlattes.value[lastSelectedPlatte.value].data[i]
  clientApi.confirm(
    '重命名',
    `<input style='width:100%' value=${color.name}>`,
    (dialog)=>{
      console.log(dialog.element.querySelector('input').value)
      color.name=dialog.element.querySelector('input').value.replace(/[\p{P}\p{S}]/gu, '');
    }
  )
}
function 编辑名称() {
  currentName.value = plugin.reactiveData.customColorPlattes.value[lastSelectedPlatte.value] ? plugin.reactiveData.customColorPlattes.value[lastSelectedPlatte.value].name : ''
}
function 添加色板() {
  customColorPlattes.value.push({ name: '未命名', data: [], id: Lute.NewNodeID() })
}
function 修正名称() {
  currentName.value === '' ? currentName.value = '未命名' : null
}
function 保存名称() {
  currentName.value && plugin.reactiveData.customColorPlattes.value[lastSelectedPlatte.value] ? plugin.reactiveData.customColorPlattes.value[lastSelectedPlatte.value].name = currentName.value : null
  currentName.value = ''
}
function 上传色板(event) {
  fileInput.value = document.createElement('input');
  fileInput.value.type = 'file'; // Corrected attribute name
  fileInput.value.style.display = 'none'; // Hide the input element
  fileInput.value.addEventListener('change', fn); // Add event listener for file upload
  fileInput.value.click(); // Programmatically click the file input

  function fn(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const buffer = e.target.result;
        const swatches = readAcoFile(buffer);
        console.log(swatches)
        customColorPlattes.value.push({ name: file.name, data: swatches.map(swatch => ({ name: swatch[2], rgb: swatch[0] })), id: Lute.NewNodeID() });
      };
      reader.readAsArrayBuffer(file);
    }
  }
}
function 下载画板() {
  const Platte = plugin.reactiveData.customColorPlattes.value[lastSelectedPlatte.value] ? plugin.reactiveData.customColorPlattes.value[lastSelectedPlatte.value].data : chineseColors.value
  console.log(Platte)
  Platte.forEach(
    item => {
      item.rgb = item.RGB || item.rgb
    }
  )
  const acoArrayBuffer = createAcoFile(Platte.map(item => [[item.rgb[0], item.rgb[1], item.rgb[2]], 'rgb', item.name || 'noTitle']))
  const acoFileBlob = new Blob([acoArrayBuffer], { type: 'application/octet-stream' });

  const url = URL.createObjectURL(acoFileBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'MySwatches.aco'; // Ensure the file name is legal and descriptive
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url); // Clean up the object URL

}
function 删除当前画板() {
  plugin.reactiveData.customColorPlattes.value[lastSelectedPlatte.value] ? plugin.reactiveData.customColorPlattes.value.splice(lastSelectedPlatte.value, 1) : null
  lastSelectedPlatte.value = (lastSelectedPlatte.value - 1 >= 0 ? lastSelectedPlatte.value - 1 : 'chinese')
  currentName.value = ''
}
function computedString(data) {
  let css = `background-color:${data.hex ? data.hex : `rgb(${data.rgb[0]},${data.rgb[1]},${data.rgb[2]})`}`
  return css
}
function 切换色板(e) {
  if (e.target.value !== "chinese") {
    lastActivedPlatte.value = parseInt(e.target.value)
    lastSelectedPlatte.value = parseInt(e.target.value)
    readonly.value = false
  } else {
    currentPalette.value = chineseColors.value
    lastSelectedPlatte.value = e.target.value
    readonly.value = true
  }
}


function verticalScroll(event) {
  const container = event.currentTarget;
  const maxScrollTop = container.scrollHeight - container.clientHeight; // 计算最大滚动高度

  // 更新滚动位置
  const newScrollTop = container.scrollTop + event.deltaY + event.deltaX;

  // 检查是否滚动到顶部或底部
  if ((newScrollTop <= 0 && event.deltaY < 0) || (newScrollTop >= maxScrollTop && event.deltaY > 0)) {
    // 如果在顶部向上滚或在底部向下滚，不阻止默认行为
    if (newScrollTop <= 0 && event.deltaY < 0) {
      container.scrollTop = 0
    }
    if (newScrollTop >= maxScrollTop && event.deltaY > 0) {
      container.scrollTop = maxScrollTop
    }
  } else {
    // 在其他情况下，阻止默认滚动行为
    event.preventDefault();
    container.scrollTop = newScrollTop; // 应用新的滚动位置
  }
}
const chineseColors = ref([])

function saveToRecent(css) {
  plugin.reactiveData.recentColors.value.push(css)
}




onMounted(() => {
  const grouped = dict.reduce((acc, color) => {
    const groupKey = color.name[color.name.length - 1]; // 获取name字段的最后一个字符
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(color);
    return acc;
  }, {});

  const sorted = Object.values(grouped).map(group => {
    return 按照相似度排序颜色(group); // 在每个分组内部排序
  });

  chineseColors.value = sorted.flat(); // 将分组后的数组扁平化
  currentPalette.value = chineseColors.value
})
</script>
<style scoped>
button.color__square {
  width: 24px;
  height: 24px;
  margin-right: 4px;
  min-width: 24px;
  min-height: 24px;
}

.grid__container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(24px, 1fr));
  /* Adjust the size as needed */
  gap: 0px 0px;
  /* Adjust the spacing between buttons */
}
</style>