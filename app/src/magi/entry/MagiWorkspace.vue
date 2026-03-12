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

          <line
            v-for="(conn, idx) in triangleConnections"
            :key="idx"
            :x1="conn.x1"
            :y1="conn.y1"
            :x2="conn.x2"
            :y2="conn.y2"
            stroke="rgba(255, 110, 58, 0.9)"
            stroke-width="6.2"
            :filter="Math.abs(conn.y1 - conn.y2) < 1 ? 'none' : 'url(#magi-seel-stage-glow)'"
          />
        </svg>

        <template v-else>
          <svg
            v-if="showConnectorOverlay"
            class="magi-seel-cluster-connectors"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <filter id="magi-seel-cluster-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="0.5" result="magi-seel-cluster-glow-blur" />
                <feMerge>
                  <feMergeNode in="magi-seel-cluster-glow-blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path
              d="M39 27.5 L44.5 34 L55.5 34 L61 27.5"
              fill="none"
              stroke="rgba(255, 110, 58, 0.86)"
              stroke-width="0.58"
              filter="url(#magi-seel-cluster-glow)"
            />
            <line
              x1="44.5"
              y1="34"
              x2="31"
              y2="47"
              stroke="rgba(255, 110, 58, 0.86)"
              stroke-width="0.58"
              filter="url(#magi-seel-cluster-glow)"
            />
            <line
              x1="55.5"
              y1="34"
              x2="69"
              y2="47"
              stroke="rgba(255, 110, 58, 0.86)"
              stroke-width="0.58"
              filter="url(#magi-seel-cluster-glow)"
            />
            <line
              x1="31"
              y1="82"
              x2="44.5"
              y2="82"
              stroke="rgba(255, 110, 58, 0.86)"
              stroke-width="0.58"
              filter="url(#magi-seel-cluster-glow)"
            />
            <line
              x1="55.5"
              y1="82"
              x2="69"
              y2="82"
              stroke="rgba(255, 110, 58, 0.86)"
              stroke-width="0.58"
              filter="url(#magi-seel-cluster-glow)"
            />
          </svg>

          <div
            v-for="seel in showSeels ? sageSeelViews : []"
            :key="seel.config.name"
            class="magi-seel-slot"
            :class="resolveSageSlotClass(seel.config.name)"
          >
            <SeelPanel
              :ai="seel"
              :show-messages="showMessages"
              :show-frame="true"
            />
          </div>

          <div v-if="trinitySeelView" class="magi-trinity">
            <SeelPanel
              :key="`${trinitySeelView.config.name}:frameless`"
              :ai="trinitySeelView"
              :show-messages="showMessages"
              :show-frame="false"
            />
          </div>
        </template>
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

const showConnectorOverlay = computed<boolean>(() =>
    showSeels.value
    && !!trinitySeelView.value
    && sageSeelViews.value.length >= 3,
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

const triangleConnections = computed(() => {
    const balthasarCenter = getCenter(balthasarLayout);
    const casperCenter = getCenter(casperLayout);
    const melchiorCenter = getCenter(melchiorLayout);
    
    const centroidX = (balthasarCenter.x + casperCenter.x + melchiorCenter.x) / 3;
    const centroidY = (balthasarCenter.y + casperCenter.y + melchiorCenter.y) / 3;
    
    const radius = Math.sqrt(
        Math.pow(balthasarCenter.x - centroidX, 2) + Math.pow(balthasarCenter.y - centroidY, 2),
    );
    
    const angle1 = Math.atan2(balthasarCenter.y - centroidY, balthasarCenter.x - centroidX);
    const angle2 = angle1 + (2 * Math.PI / 3);
    const angle3 = angle1 + (4 * Math.PI / 3);
    
    const vertex1 = { x: centroidX + radius * Math.cos(angle1), y: centroidY + radius * Math.sin(angle1) };
    const vertex2 = { x: centroidX + radius * Math.cos(angle2), y: centroidY + radius * Math.sin(angle2) };
    const vertex3 = { x: centroidX + radius * Math.cos(angle3), y: centroidY + radius * Math.sin(angle3) };
    
    return [
        { x1: vertex1.x, y1: vertex1.y, x2: vertex2.x, y2: vertex2.y },
        { x1: vertex2.x, y1: vertex2.y, x2: vertex3.x, y2: vertex3.y },
        { x1: vertex3.x, y1: vertex3.y, x2: vertex1.x, y2: vertex1.y },
    ];
});

function findSageByKeywords(keywords: readonly string[]) {
    return sageSeelViews.value.find((seel) => {
        const normalized = seel.config.name.toUpperCase();
        return keywords.some((keyword) => normalized.includes(keyword));
    }) ?? null;
}

/**
 * 作用：根据贤者配置名返回布局槽位类名。
 * 意图：将 MELCHIOR/BALTHASAR/CASPER 固定到图2所需的三角布局位置。
 * 调用时机：模板 `v-for` 渲染每个贤者卡片时调用。
 * 问题/改进：当前按名称关键字匹配，若后续更名可改为由后端直接提供布局位置信息。
 */
function resolveSageSlotClass(name: string): string {
    const normalized = name.toUpperCase();
    if (normalized.includes("BALTHASAR") || normalized.includes("BALTHAZAR")) {
        return "magi-seel-slot--balthasar";
    }
    if (normalized.includes("CASPER")) {
        return "magi-seel-slot--casper";
    }
    if (normalized.includes("MELCHIOR")) {
        return "magi-seel-slot--melchior";
    }
    return "magi-seel-slot--generic";
}
</script>
