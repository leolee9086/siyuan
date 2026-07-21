<template>
  <div class="magi-workspace-shell">
    <div v-if="isMobileTarget" class="magi-mobile-workspace-tabs" role="tablist" aria-label="MAGI workspace">
      <button
        v-for="tab in mobileWorkspaceTabs"
        :key="tab.id"
        type="button"
        class="magi-mobile-workspace-tab"
        :class="{ active: activeMobileWorkspaceTab === tab.id }"
        :aria-selected="activeMobileWorkspaceTab === tab.id"
        role="tab"
        @click="activeMobileWorkspaceTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>
    <div
      class="magi-workspace"
      :class="{
        'with-seel-cluster': hasSeelCluster && !isMobileTarget,
        'magi-workspace--mobile': isMobileTarget,
      }"
    >
      <div
        v-if="hasSeelCluster && !isMobileTarget"
        class="magi-seel-cluster"
        :class="{
          'svg-layout': useSvgClusterLayout,
          'monitor-only': !showSeels && !!monitorSeelView,
          'sages-only': showSeels && !monitorSeelView,
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
                v-if="node.key !== 'monitor'"
                :key="node.seel.config.name"
                :ai="node.seel"
                :show-messages="showMessages"
                :is-dominant="node.key === dominantNodeKey"
                :show-frame="true"
                :frame-color="resolveNodeFrameColor(node.key)"
                :dismissed-vote-badge-token="dismissedSageVoteBadgeToken"
                @dismiss-vote-badges="dismissSageVoteBadges"
              />
              <MagiMonitorPanel
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

      <div
        v-if="isMobileTarget"
        v-show="activeMobileWorkspaceTab !== 'chat'"
        class="magi-mobile-monitor-pane"
      >
        <div class="magi-mobile-orb-selector" aria-label="MAGI monitor selector">
          <button
            v-for="orb in mobileSageOrbs"
            :key="orb.id"
            type="button"
            class="magi-mobile-orb magi-mobile-orb--sage"
            :class="{
              active: activeMobileMonitorKey === orb.id,
              dominant: dominantNodeKey === orb.id,
            }"
            :data-position="orb.position"
            :aria-label="orb.label"
            :aria-pressed="activeMobileMonitorKey === orb.id"
            :style="{ '--magi-mobile-orb-color': getColor(orb.seel.config.color) }"
            @click="activeMobileMonitorKey = orb.id"
          >
            <span class="magi-mobile-orb-shell" aria-hidden="true">
              <span class="magi-mobile-orb-core" />
            </span>
            <span class="magi-mobile-orb-label">{{ orb.displayLabel }}</span>
            <span class="magi-mobile-orb-focus" aria-hidden="true" />
          </button>
          <button
            v-if="monitorSeelView"
            type="button"
            class="magi-mobile-orb magi-mobile-orb--trinity"
            :class="{ active: activeMobileMonitorKey === 'monitor' }"
            aria-label="TRINITY"
            :aria-pressed="activeMobileMonitorKey === 'monitor'"
            @click="activeMobileMonitorKey = 'monitor'"
          >
            <span class="magi-mobile-orb-shell" aria-hidden="true">
              <span class="magi-mobile-orb-core" />
            </span>
            <span class="magi-mobile-orb-label">TRINITY</span>
            <span class="magi-mobile-orb-focus" aria-hidden="true" />
          </button>
        </div>

        <div class="magi-mobile-monitor-content">
          <SeelPanel
            v-if="balthasarSeelView"
            v-show="activeMobileMonitorKey === 'balthasar'"
            :ai="balthasarSeelView"
            :show-messages="showMessages"
            :is-dominant="dominantNodeKey === 'balthasar'"
            :show-frame="false"
            :dismissed-vote-badge-token="dismissedSageVoteBadgeToken"
            @dismiss-vote-badges="dismissSageVoteBadges"
          />
          <SeelPanel
            v-if="casperSeelView"
            v-show="activeMobileMonitorKey === 'casper'"
            :ai="casperSeelView"
            :show-messages="showMessages"
            :is-dominant="dominantNodeKey === 'casper'"
            :show-frame="false"
            :dismissed-vote-badge-token="dismissedSageVoteBadgeToken"
            @dismiss-vote-badges="dismissSageVoteBadges"
          />
          <SeelPanel
            v-if="melchiorSeelView"
            v-show="activeMobileMonitorKey === 'melchior'"
            :ai="melchiorSeelView"
            :show-messages="showMessages"
            :is-dominant="dominantNodeKey === 'melchior'"
            :show-frame="false"
            :dismissed-vote-badge-token="dismissedSageVoteBadgeToken"
            @dismiss-vote-badges="dismissSageVoteBadges"
          />
          <MagiMonitorPanel
            v-if="monitorSeelView"
            v-show="activeMobileMonitorKey === 'monitor'"
            :ai="monitorSeelView"
            :runtime-status="runtimeStatus"
            :show-messages="showMessages"
            :accent-color="clusterAccentColor"
          />
        </div>
      </div>

      <div v-show="!isMobileTarget || activeMobileWorkspaceTab === 'chat'" class="magi-main-stack">
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
            v-show="activeMainMode === 'channels'"
            class="magi-main-pane magi-main-pane--channels"
          >
            <ExternalChannelsPanel />
          </div>

          <div
            v-show="activeMainMode === 'chat'"
            class="magi-main-pane magi-main-pane--chat"
          >
            <AgentPanelHost />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref } from "vue";
import ExternalChannelsPanel from "../components/external-channels/ExternalChannelsPanel.vue";
import AgentPanelHost from "../components/agent-panel-host/AgentPanelHost.vue";
import SourceSimulationPanels from "../components/source-sim-panels/SourceSimulationPanels.vue";
import SeelPanel from "../components/seel-panel/SeelPanel.vue";
import MagiMonitorPanel from "../components/trinity-monitor-panel/TrinityMonitorPanel.vue";
import { getColor } from "../components/seel-panel/SeelPanel.ctx";
import { openIdentityAccessStandalone } from "../identity-access/adapters/open";
import { MAGI_IDENTITY_REQUIRED_EVENT, MAGI_WRITE_AVATAR_EVENT } from "../service/magiIdentitySession";
import { MAGI_ROOT_CTX_KEY } from "./MagiRoot.types";

/**
 * 作用：定义 MAGI Seel 集群的 SVG 布局配置。
 * 意图：集中管理所有节点的位置和尺寸，避免硬编码重复。
 */
const SAGE_CARD_WIDTH = 330;
const SAGE_CARD_HEIGHT = 420;
const MONITOR_CARD_WIDTH = 330;
const MONITOR_CARD_HEIGHT = 480;
const DOMINANT_FRAME_COLOR = "#ff8a1f";

const LAYOUT_CONFIG = {
    // 外围三贤人使用统一尺寸，避免视觉不一致。
    balthasar: { x: 335, y: 20, width: SAGE_CARD_WIDTH, height: SAGE_CARD_HEIGHT, key: "balthasar" },
    monitor: { x: 335, y: 450, width: MONITOR_CARD_WIDTH, height: MONITOR_CARD_HEIGHT, key: "monitor" },
    casper: { x: 0, y: 580, width: SAGE_CARD_WIDTH, height: SAGE_CARD_HEIGHT, key: "casper" },
    melchior: { x: 670, y: 580, width: SAGE_CARD_WIDTH, height: SAGE_CARD_HEIGHT, key: "melchior" },
} as const;

type LayoutRect = {
    x: number;
    y: number;
    width: number;
    height: number;
    key: string;
};
type ConnectionEdge = "top" | "right" | "bottom" | "left";

interface ConnectionPoint {
    x: number;
    y: number;
    angle: number;
    rect: LayoutRect;
    edge: ConnectionEdge;
}

interface RectEdgeDescriptor {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    edge: ConnectionEdge;
}

const GOLDEN_SECTION_RATIO = 0.38196601125;
const DOUBLE_GOLDEN_SECTION_NEAR_ENDPOINT_RATIO = GOLDEN_SECTION_RATIO * GOLDEN_SECTION_RATIO;
const MIN_CONNECTOR_STUB_LENGTH = 12;
const SVG_PATH_PRECISION = 2;

/**
 * 作用：计算矩形区域的中心点坐标。
 * 意图：为三角形连接线计算提供统一的中心点计算逻辑。
 */
function getCenter(rect: { x: number; y: number; width: number; height: number }) {
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function buildRectEdges(rect: LayoutRect): RectEdgeDescriptor[] {
    return [
        { x1: rect.x, y1: rect.y, x2: rect.x + rect.width, y2: rect.y, edge: "top" },
        {
            x1: rect.x + rect.width,
            y1: rect.y,
            x2: rect.x + rect.width,
            y2: rect.y + rect.height,
            edge: "right",
        },
        {
            x1: rect.x + rect.width,
            y1: rect.y + rect.height,
            x2: rect.x,
            y2: rect.y + rect.height,
            edge: "bottom",
        },
        { x1: rect.x, y1: rect.y + rect.height, x2: rect.x, y2: rect.y, edge: "left" },
    ];
}

function formatSvgCoord(value: number): string {
    return value.toFixed(SVG_PATH_PRECISION);
}

function formatSvgPoint(x: number, y: number): string {
    return `${formatSvgCoord(x)},${formatSvgCoord(y)}`;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function buildDiagonalBreakpoint(
    endpoint: ConnectionPoint,
    oppositePoint: ConnectionPoint,
    totalLength: number,
): { x: number; y: number } | null {
    const breakpointDistance = totalLength * DOUBLE_GOLDEN_SECTION_NEAR_ENDPOINT_RATIO;
    if (breakpointDistance <= MIN_CONNECTOR_STUB_LENGTH) {
        return null;
    }

    const distanceRatio = breakpointDistance / totalLength;
    return {
        x: endpoint.x + (oppositePoint.x - endpoint.x) * distanceRatio,
        y: endpoint.y + (oppositePoint.y - endpoint.y) * distanceRatio,
    };
}

function projectPointToRectEdge(
    point: { x: number; y: number },
    endpoint: ConnectionPoint,
): { x: number; y: number } {
    switch (endpoint.edge) {
        case "top":
            return {
                x: clamp(point.x, endpoint.rect.x, endpoint.rect.x + endpoint.rect.width),
                y: endpoint.rect.y,
            };
        case "right":
            return {
                x: endpoint.rect.x + endpoint.rect.width,
                y: clamp(point.y, endpoint.rect.y, endpoint.rect.y + endpoint.rect.height),
            };
        case "bottom":
            return {
                x: clamp(point.x, endpoint.rect.x, endpoint.rect.x + endpoint.rect.width),
                y: endpoint.rect.y + endpoint.rect.height,
            };
        case "left":
            return {
                x: endpoint.rect.x,
                y: clamp(point.y, endpoint.rect.y, endpoint.rect.y + endpoint.rect.height),
            };
    }
}

function buildConnectionSegmentPath(
    startPoint: ConnectionPoint,
    endPoint: ConnectionPoint,
): string {
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const totalLength = Math.hypot(dx, dy);
    if (totalLength <= 0.001) {
        return "";
    }

    const startBreakpoint = buildDiagonalBreakpoint(startPoint, endPoint, totalLength);
    const endBreakpoint = buildDiagonalBreakpoint(endPoint, startPoint, totalLength);
    if (!startBreakpoint || !endBreakpoint) {
        return `M${formatSvgPoint(startPoint.x, startPoint.y)} L${formatSvgPoint(endPoint.x, endPoint.y)}`;
    }

    const startEdgePoint = projectPointToRectEdge(startBreakpoint, startPoint);
    const endEdgePoint = projectPointToRectEdge(endBreakpoint, endPoint);

    const rawPoints = [
        startEdgePoint,
        startBreakpoint,
        endBreakpoint,
        endEdgePoint,
    ];

    const points = rawPoints.filter((point, index) => {
        if (index === 0) {
            return true;
        }
        const previousPoint = rawPoints[index - 1];
        return !!previousPoint && Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y) > 0.001;
    });

    if (points.length < 2) {
        return "";
    }

    return points
        .map((point, index) => `${index === 0 ? "M" : "L"}${formatSvgPoint(point.x, point.y)}`)
        .join(" ");
}

const ctx = inject(MAGI_ROOT_CTX_KEY);
if (!ctx) {
    throw new Error("MagiWorkspace must be used inside MagiRoot");
}
const {
    showMessages,
    showSeels,
    sourceSimulationProfiles,
    sourceSimulationPanels,
    sageSeelViews,
    monitorSeelView,
    runtimeStatus,
    onCreateSourceSimulationPanel,
    onRemoveSourceSimulationPanel,
    onUpdateSourceSimulationInput,
    onUpdateSourceSimulationProfile,
    onUpdateSourceSimulationRequestField,
    onSubmitSourceSimulationPanel,
} = ctx;

type MagiMainMode = "chat" | "source" | "channels";

const magiMainModes: Array<{ id: MagiMainMode; label: string }> = [
    { id: "chat", label: "MAIN CHAT" },
    { id: "source", label: "SOURCE SIMULATION" },
    { id: "channels", label: "CHANNELS" },
];

const activeMainMode = ref<MagiMainMode>("chat");
const isMobileTarget = typeof document !== "undefined" && document.documentElement.dataset.magiTarget === "magi-mobile";
const activeMobileWorkspaceTab = ref("chat");
const activeMobileMonitorKey = ref("monitor");
const dismissedSageVoteBadgeToken = ref("");

function setMainMode(mode: MagiMainMode): void {
    activeMainMode.value = mode;
}

function dismissSageVoteBadges(token: string): void {
    dismissedSageVoteBadgeToken.value = token;
}

function handleIdentityRequiredEvent(): void {
    openIdentityAccessStandalone();
}

function handleWriteAvatarModeEvent(): void {
    activeMainMode.value = "chat";
    activeMobileWorkspaceTab.value = "chat";
}

onMounted(() => {
    if (typeof window === "undefined") {
        return;
    }
    window.addEventListener(MAGI_IDENTITY_REQUIRED_EVENT, handleIdentityRequiredEvent);
    window.addEventListener(MAGI_WRITE_AVATAR_EVENT, handleWriteAvatarModeEvent);
});

onBeforeUnmount(() => {
    if (typeof window === "undefined") {
        return;
    }
    window.removeEventListener(MAGI_IDENTITY_REQUIRED_EVENT, handleIdentityRequiredEvent);
    window.removeEventListener(MAGI_WRITE_AVATAR_EVENT, handleWriteAvatarModeEvent);
});

const hasSeelCluster = computed<boolean>(() =>
    (showSeels.value && sageSeelViews.value.length > 0)
    || !!monitorSeelView.value,
);

const balthasarLayout = LAYOUT_CONFIG.balthasar;
const monitorLayout = LAYOUT_CONFIG.monitor;
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

const mobileWorkspaceTabs = computed(() => [
    {id: "chat", label: "CHAT"},
    {id: "monitor", label: "MONITOR"},
]);

const mobileSageOrbs = computed(() => {
    const sages = [
        balthasarSeelView.value ? {id: "balthasar", label: "BALTHASAR", displayLabel: balthasarSeelView.value.config.name, seel: balthasarSeelView.value} : null,
        casperSeelView.value ? {id: "casper", label: "CASPER", displayLabel: casperSeelView.value.config.name, seel: casperSeelView.value} : null,
        melchiorSeelView.value ? {id: "melchior", label: "MELCHIOR", displayLabel: melchiorSeelView.value.config.name, seel: melchiorSeelView.value} : null,
    ].filter((sage) => sage !== null);
    const dominantIndex = sages.findIndex((sage) => sage.id === dominantNodeKey.value);
    const ordered = dominantIndex > 0
        ? [sages[dominantIndex], ...sages.slice(0, dominantIndex), ...sages.slice(dominantIndex + 1)]
        : sages;
    const positions = ["top", "left", "right"];
    return ordered.map((sage, index) => ({...sage, position: positions[index] || "right"}));
});

/**
 * 作用：统一集群视觉主色。
 * 意图：所有卡片边框与连接线使用 BALTHASAR 当前颜色，保证配色一致。
 */
const clusterAccentColor = computed<string>(() =>
    getColor(balthasarSeelView.value?.config.color ?? "blue"),
);

const dominantNodeKey = computed<string | null>(() => {
    const normalized = String(runtimeStatus.value?.dominantSeel ?? "").trim().toLowerCase();
    switch (normalized) {
    case "melchior":
        return "melchior";
    case "balthazar":
    case "balthasar":
        return "balthasar";
    case "casper":
        return "casper";
    default:
        return null;
    }
});

const svgNodes = computed(() => {
    const nodes = [];
    if (balthasarSeelView.value) {
        nodes.push({ key: "balthasar", seel: balthasarSeelView.value, layout: balthasarLayout });
    }
    if (monitorSeelView.value) {
        nodes.push({ key: "monitor", seel: monitorSeelView.value, layout: monitorLayout });
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
    !!monitorSeelView.value
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
    const allPoints: ConnectionPoint[] = [];
    
    for (const rect of rects) {
        const edges = buildRectEdges(rect);
        
        for (const edge of edges) {
            const points = getCircleLineIntersections(cx, cy, r, edge.x1, edge.y1, edge.x2, edge.y2);
            for (const p of points) {
                const angle = Math.atan2(p.y - cy, p.x - cx);
                allPoints.push({
                    ...p,
                    angle,
                    rect,
                    edge: edge.edge,
                });
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
        
        const segmentPath = buildConnectionSegmentPath(p1, p2);
        if (!segmentPath) {
            continue;
        }
        pathSegments.push(segmentPath);
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

function resolveNodeFrameColor(nodeKey: string): string {
    if (nodeKey === dominantNodeKey.value) {
        return DOMINANT_FRAME_COLOR;
    }
    return clusterAccentColor.value;
}
</script>
