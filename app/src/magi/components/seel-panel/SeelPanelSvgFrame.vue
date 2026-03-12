<template>
    <svg v-if="showFrame" class="panel-frame" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
            <pattern
                :id="`grid-${configName}`"
                width="20" height="20"
                patternUnits="userSpaceOnUse"
            >
                <path
                    :stroke="color"
                    stroke-width="0.5" stroke-opacity="0.05"
                    fill="none" d="M 20 0 L 0 0 0 20"
                />
            </pattern>
            <linearGradient
                :id="`bg-gradient-${configName}`"
                x1="0%" y1="0%" x2="0%" y2="100%"
            >
                <stop offset="0%" style="stop-color: rgba(0, 0, 0, 0.8)" />
                <stop offset="50%" style="stop-color: rgba(0, 30, 30, 0.9)" />
                <stop offset="100%" style="stop-color: rgba(0, 0, 0, 0.8)" />
            </linearGradient>
            <clipPath :id="`panel-clip-${configName}`">
                <path d="M5,0 H95 L100,5 V95 L95,100 H5 L0,95 V5 L5,0 Z" />
            </clipPath>
        </defs>
        <rect
            x="0" y="0" width="100" height="100"
            :fill="`url(#bg-gradient-${configName})`"
            :clip-path="`url(#panel-clip-${configName})`"
        />
        <rect
            x="0" y="0" width="100" height="100"
            :fill="`url(#grid-${configName})`"
            :clip-path="`url(#panel-clip-${configName})`"
        />
        <path
            :stroke="color" stroke-width="1" fill="none"
            d="M 5,0 H 95 L 100,5 V 95 L 95,100 H 5 L 0,95 V 5 Z"
        />
        <path
            :stroke="color" stroke-width="1.5" fill="none"
            stroke-opacity="0.8"
            d="M 94,0 L 100,6 M 0,6 L 6,0 M 0,94 L 6,100 M 94,100 L 100,94"
        />
        <line
            x1="0" y1="28" x2="100" y2="28"
            :stroke="color" stroke-width="0.5" stroke-opacity="0.3"
        />
    </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
    /** 贤者配置名称，用于SVG元素ID去重 */
    configName: string;
    /** CSS颜色值 */
    color: string;
    /** 是否显示边框 */
    showFrame?: boolean;
}>(), {
    showFrame: true,
});
</script>
