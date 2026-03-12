<template>
  <div class="magi-workspace-shell">
    <div
      class="magi-workspace"
      :class="{ 'with-seel-cluster': hasSeelCluster }"
    >
      <div
        v-if="hasSeelCluster"
        class="magi-seel-cluster"
        :class="{
          'svg-layout': useSvgClusterLayout,
          'trinity-only': !showSeels && !!trinitySeelView,
          'sages-only': showSeels && !trinitySeelView,
        }"
      >
        <svg
          v-if="useSvgClusterLayout"
          class="magi-seel-cluster-stage"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <filter id="magi-seel-stage-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="magi-seel-stage-glow-blur" />
              <feMerge>
                <feMergeNode in="magi-seel-stage-glow-blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <foreignObject
            v-for="node in svgNodes"
            :key="node.key"
            :class="['magi-seel-node', `magi-seel-node--${node.key}`]"
            :x="node.layout.x"
            :y="node.layout.y"
            :width="node.layout.width"
            :height="node.layout.height"
          >
            <div xmlns="http://www.w3.org/1999/xhtml" class="magi-seel-node-content">
              <SeelPanel
                :key="node.seel.config.name"
                :ai="node.seel"
                :show-messages="showMessages"
                :show-frame="node.key !== 'trinity'"
              />
            </div>
          </foreignObject>

          <circle
            :cx="circleConnection.cx"
            :cy="circleConnection.cy"
            :r="circleConnection.r"
            stroke="rgba(255, 110, 58, 0.9)"
            stroke-width="6.2"
            fill="none"
            filter="url(#magi-seel-stage-glow)"
          />
        </svg>
      </div>

      <div class="magi-main-stack">
        <SourceSimulationPanels
          :panels="sourceSimulationPanels"
          :profiles="sourceSimulationProfiles"
          @create-panel="onCreateSourceSimulationPanel"
          @remove-panel="onRemoveSourceSimulationPanel"
          @update-input="onUpdateSourceSimulationInput"
          @update-profile="onUpdateSourceSimulationProfile"
          @submit-panel="onSubmitSourceSimulationPanel"
        />

        <MagiMainPanel
          :messages="displayMessages"
          :seels="mainPanelSeels"
          :input-value="inputValue"
          :is-any-seel-loading="isAnySeelLoading"
          @update:inputValue="inputValue = $event"
          @submit-input="onSubmitInput"
          @stop-input="onStopInput"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import MagiMainPanel from "../components/magi-main-panel/MagiMainPanel.vue";
import SourceSimulationPanels from "../components/source-sim-panels/SourceSimulationPanels.vue";
import SeelPanel from "../components/seel-panel/SeelPanel.vue";
import { MAGI_ROOT_CTX_KEY } from "./MagiRoot.types";

/**
 * 作用：定义 MAGI Seel 集群的 SVG 布局配置。
 * 意图：集中管理所有节点的位置和尺寸，避免硬编码重复。
 */
const LAYOUT_CONFIG = {
    balthasar: { x: 320, y: 20, width: 360, height: 260, key: "balthasar" },
    trinity: { x: 340, y: 350, width: 320, height: 310, key: "trinity" },
    casper: { x: 0, y: 480, width: 330, height: 520, key: "casper" },
    melchior: { x: 670, y: 480, width: 330, height: 520, key: "melchior" },
} as const;

/**
 * 作用：计算矩形区域的中心点坐标。
 * 意图：为三角形连接线计算提供统一的中心点计算逻辑。
 */
function getCenter(rect: { x: number; y: number; width: number; height: number }) {
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

const ctx = inject(MAGI_ROOT_CTX_KEY);
if (!ctx) {
    throw new Error("MagiWorkspace must be used inside MagiRoot");
}
const {
    inputValue,
    showMessages,
    showSeels,
    sourceSimulationProfiles,
    sourceSimulationPanels,
    mainPanelSeels,
    sageSeelViews,
    trinitySeelView,
    displayMessages,
    isAnySeelLoading,
    onSubmitInput,
    onStopInput,
    onCreateSourceSimulationPanel,
    onRemoveSourceSimulationPanel,
    onUpdateSourceSimulationInput,
    onUpdateSourceSimulationProfile,
    onSubmitSourceSimulationPanel,
} = ctx;

const hasSeelCluster = computed<boolean>(() =>
    (showSeels.value && sageSeelViews.value.length > 0)
    || !!trinitySeelView.value,
);

const balthasarLayout = LAYOUT_CONFIG.balthasar;
const trinityLayout = LAYOUT_CONFIG.trinity;
const casperLayout = LAYOUT_CONFIG.casper;
const melchiorLayout = LAYOUT_CONFIG.melchior;

const balthasarSeelView = computed(() =>
    findSageByKeywords(["BALTHASAR", "BALTHAZAR"]),
);
const casperSeelView = computed(() =>
    findSageByKeywords(["CASPER"]),
);
const melchiorSeelView = computed(() =>
    findSageByKeywords(["MELCHIOR"]),
);

const svgNodes = computed(() => {
    const nodes = [];
    if (balthasarSeelView.value) {
        nodes.push({ key: "balthasar", seel: balthasarSeelView.value, layout: balthasarLayout });
    }
    if (trinitySeelView.value) {
        nodes.push({ key: "trinity", seel: trinitySeelView.value, layout: trinityLayout });
    }
    if (casperSeelView.value) {
        nodes.push({ key: "casper", seel: casperSeelView.value, layout: casperLayout });
    }
    if (melchiorSeelView.value) {
        nodes.push({ key: "melchior", seel: melchiorSeelView.value, layout: melchiorLayout });
    }
    return nodes;
});

const useSvgClusterLayout = computed<boolean>(() =>
    !!trinitySeelView.value
    && !!balthasarSeelView.value
    && !!casperSeelView.value
    && !!melchiorSeelView.value
    && showSeels.value,
);

// @内联回调
const circleConnection = computed(() => {
    const balthasarCenter = getCenter(balthasarLayout);
    const casperCenter = getCenter(casperLayout);
    const melchiorCenter = getCenter(melchiorLayout);
    
    const centroidX = (balthasarCenter.x + casperCenter.x + melchiorCenter.x) / 3;
    const centroidY = (balthasarCenter.y + casperCenter.y + melchiorCenter.y) / 3;
    
    const radius = Math.sqrt(
        Math.pow(balthasarCenter.x - centroidX, 2) + Math.pow(balthasarCenter.y - centroidY, 2),
    );
    
    return { cx: centroidX, cy: centroidY, r: radius };
});

/**
 * 作用：根据关键字在贤者列表中查找匹配的贤者。
 * 意图：通过名称关键字定位特定贤者（BALTHASAR/CASPER/MELCHIOR）。
 * 调用时机：计算属性中用于识别特定贤者视图。
 * 问题/改进：当前按名称关键字匹配，若后续更名可改为由后端直接提供标识信息。
 */
function findSageByKeywords(keywords: readonly string[]) {
    return sageSeelViews.value.find((seel) => {
        const normalized = seel.config.name.toUpperCase();
        return keywords.some((keyword) => normalized.includes(keyword));
    }) ?? null;
}
</script>
