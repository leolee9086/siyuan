import { plugin } from '../../asyncModules.js';
import { openDialog } from '../dialogs/index.js';
async function openImagePalatte(imgElement) {
    // 创建并添加颜色块
    openDialog(
        '/plugins/TEColors/source/UI/components/imageColorPanel.vue',
        'ImagePalatte',
        {},
        '',
        { imgElement },
        '图片色彩分析'
    )
}
plugin.eventBus.on(
    'open-imageColors-palatte', (e) => {
        openImagePalatte(e.detail)
    }
)
