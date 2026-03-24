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
                v-if="node.key !== 'trinity'"
                :key="node.seel.config.name"
                :ai="node.seel"
                :show-messages="showMessages"
                :show-frame="true"
                :frame-color="clusterAccentColor"
              />
              <TrinityMonitorPanel
                v-else
                :key="node.seel.config.name"
                :ai="node.seel"
                :runtime-status="runtimeStatus"
                :show-messages="showMessages"
                :accent-color="clusterAccentColor"
              />
            </div>
          </foreignObject>

          <path
            :d="connectionPath"
            :stroke="clusterAccentColor"
            stroke-width="2"
            fill="none"
            filter="url(#magi-seel-stage-glow)"
          />
        </svg>
      </div>

      <div class="magi-main-stack">
        <div class="magi-main-modebar">
          <button
            v-for="mode in magiMainModes"
            :key="mode.id"
            type="button"
            class="magi-main-mode-button"
            :class="{ active: activeMainMode === mode.id }"
            :aria-pressed="activeMainMode === mode.id"
            @click="setMainMode(mode.id)"
          >
            {{ mode.label }}
          </button>
        </div>

        <div class="magi-main-mode-content">
          <div
            v-show="activeMainMode === 'identity'"
            class="magi-main-pane magi-main-pane--identity"
          >
            <MagiIdentityPanel />
          </div>

          <div
            v-show="activeMainMode === 'source'"
            class="magi-main-pane magi-main-pane--source"
          >
            <SourceSimulationPanels
              :panels="sourceSimulationPanels"
              :profiles="sourceSimulationProfiles"
              @create-panel="onCreateSourceSimulationPanel"
              @remove-panel="onRemoveSourceSimulationPanel"
              @update-input="onUpdateSourceSimulationInput"
              @update-profile="onUpdateSourceSimulationProfile"
              @update-request-field="onUpdateSourceSimulationRequestField"
              @submit-panel="onSubmitSourceSimulationPanel"
            />
          </div>

          <div
            v-show="activeMainMode === 'chat'"
            class="magi-main-pane magi-main-pane--chat"
          >
            <MagiMainPanel
              :messages="displayMessages"
              :seels="mainPanelSeels"
              :input-value="inputValue"
              :is-request-pending="isMainPanelRequestPending"
              @update:inputValue="inputValue = $event"
              @submit-input="onSubmitInput"
              @stop-input="onStopInput"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref } from "vue";
import MagiIdentityPanel from "../components/magi-identity-panel/MagiIdentityPanel.vue";
import MagiMainPanel from "../components/magi-main-panel/MagiMainPanel.vue";
import SourceSimulationPanels from "../components/source-sim-panels/SourceSimulationPanels.vue";
import SeelPanel from "../components/seel-panel/SeelPanel.vue";
import TrinityMonitorPanel from "../components/trinity-monitor-panel/TrinityMonitorPanel.vue";
import { getColor } from "../components/seel-panel/SeelPanel.ctx";
import { MAGI_IDENTITY_REQUIRED_EVENT } from "../service/magiIdentitySession";
import { MAGI_ROOT_CTX_KEY } from "./MagiRoot.types";

/**
 * 作用：定义 MAGI Seel 集群的 SVG 布局配置。
 * 意图：集中管理所有节点的位置和尺寸，避免硬编码重复。
 */
const SAGE_CARD_WIDTH = 330;
const SAGE_CARD_HEIGHT = 420;
const TRINITY_CARD_WIDTH = 330;
const TRINITY_CARD_HEIGHT = 480;

const LAYOUT_CONFIG = {
    // 外围三贤人使用统一尺寸，避免视觉不一致。
    balthasar: { x: 335, y: 20, width: SAGE_CARD_WIDTH, height: SAGE_CARD_HEIGHT, key: "balthasar" },
    trinity: { x: 335, y: 450, width: TRINITY_CARD_WIDTH, height: TRINITY_CARD_HEIGHT, key: "trinity" },
    casper: { x: 0, y: 580, width: SAGE_CARD_WIDTH, height: SAGE_CARD_HEIGHT, key: "casper" },
    melchior: { x: 670, y: 580, width: SAGE_CARD_WIDTH, height: SAGE_CARD_HEIGHT, key: "melchior" },
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
    isMainPanelRequestPending,
    runtimeStatus,
    onSubmitInput,
    onStopInput,
    onCreateSourceSimulationPanel,
    onRemoveSourceSimulationPanel,
    onUpdateSourceSimulationInput,
    onUpdateSourceSimulationProfile,
    onUpdateSourceSimulationRequestField,
    onSubmitSourceSimulationPanel,
} = ctx;

type MagiMainMode = "chat" | "source" | "identity";

const magiMainModes: Array<{ id: MagiMainMode; label: string }> = [
    { id: "chat", label: "MAIN CHAT" },
    { id: "source", label: "SOURCE SIMULATION" },
    { id: "identity", label: "IDENTITY ACCESS" },
];

const activeMainMode = ref<MagiMainMode>("chat");

function setMainMode(mode: MagiMainMode): void {
    activeMainMode.value = mode;
}

function handleIdentityRequiredEvent(): void {
    activeMainMode.value = "identity";
}

onMounted(() => {
    if (typeof window === "undefined") {
        return;
    }
    window.addEventListener(MAGI_IDENTITY_REQUIRED_EVENT, handleIdentityRequiredEvent);
});

onBeforeUnmount(() => {
    if (typeof window === "undefined") {
        return;
    }
    window.removeEventListener(MAGI_IDENTITY_REQUIRED_EVENT, handleIdentityRequiredEvent);
});

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

/**
 * 作用：统一集群视觉主色。
 * 意图：所有卡片边框与连接线使用 BALTHASAR 当前颜色，保证配色一致。
 */
const clusterAccentColor = computed<string>(() =>
    getColor(balthasarSeelView.value?.config.color ?? "blue"),
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

// @内联回调
const connectionPath = computed(() => {
    const { cx, cy, r } = circleConnection.value;
    const rects = [balthasarLayout, casperLayout, melchiorLayout];
    const allPoints: Array<{ x: number; y: number; angle: number }> = [];
    
    for (const rect of rects) {
        // @内联数组
        const edges = [
            { x1: rect.x, y1: rect.y, x2: rect.x + rect.width, y2: rect.y },
            { x1: rect.x + rect.width, y1: rect.y, x2: rect.x + rect.width, y2: rect.y + rect.height },
            { x1: rect.x + rect.width, y1: rect.y + rect.height, x2: rect.x, y2: rect.y + rect.height },
            { x1: rect.x, y1: rect.y + rect.height, x2: rect.x, y2: rect.y },
        ];
        
        for (const edge of edges) {
            const points = getCircleLineIntersections(cx, cy, r, edge.x1, edge.y1, edge.x2, edge.y2);
            for (const p of points) {
                const angle = Math.atan2(p.y - cy, p.x - cx);
                allPoints.push({ ...p, angle });
            }
        }
    }
    
    allPoints.sort((a, b) => a.angle - b.angle);
    
    if (allPoints.length === 0) {
        return "";
    }
    
    const pathSegments: string[] = [];
    for (let i = 0; i < allPoints.length; i++) {
        const p1 = allPoints[i];
        const p2 = allPoints[(i + 1) % allPoints.length];
        if (!p1 || !p2) {
            continue;
        }
        
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        
        // 检查线段中点是否在矩形内部，跳过穿过矩形的线段
        if (isPointInRect(midX, midY, rects)) {
            continue;
        }
        
        pathSegments.push(`M${p1.x},${p1.y}`);
        pathSegments.push(`L${p2.x},${p2.y}`);
    }
    
    return pathSegments.join(" ");
});

/**
 * 作用：检查点是否在任意矩形内部。
 * 意图：用于过滤掉穿过矩形内部的连接线段，只保留圆上不被遮挡的部分。
 * 调用时机：在 connectionPath 计算属性中，对每条候选线段的中点进行检查。
 * 问题/改进：当前使用简单的矩形包含判断，未考虑边界情况。
 */
function isPointInRect(x: number, y: number, rects: Array<{ x: number; y: number; width: number; height: number }>) {
    for (const rect of rects) {
        if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
            return true;
        }
    }
    return false;
}

/**
 * 作用：计算圆与线段的交点。
 * 意图：用于确定圆形与矩形边框的相交位置，以便绘制连接线段。
 * 调用时机：在 connectionPath 计算属性中，对每个矩形的每条边调用。
 * 问题/改进：使用标准的圆与线段相交算法，基于参数方程求解二次方程。
 */
function getCircleLineIntersections(cx: number, cy: number, r: number, x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = x1 - cx;
    const fy = y1 - cy;
    
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;
    
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) {
        return [];
    }
    
    const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
    const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);
    
    const points = [];
    // 检查第一个交点是否在线段范围内（参数t在[0,1]之间）
    if (t1 >= 0 && t1 <= 1) {
        points.push({ x: x1 + t1 * dx, y: y1 + t1 * dy });
    }
    // 检查第二个交点是否在线段范围内且与第一个交点不重合
    if (t2 >= 0 && t2 <= 1 && Math.abs(t2 - t1) > 0.001) {
        points.push({ x: x1 + t2 * dx, y: y1 + t2 * dy });
    }
    
    return points;
}

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
