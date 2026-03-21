(() => {
  const WIDGET_GUTTER_MENU_EVENT = "siyuan-widget-block-gutter-menu";

  const modeLabel = document.getElementById("modeLabel");
  const dateLabel = document.getElementById("dateLabel");
  const timeLabel = document.getElementById("timeLabel");
  const widgetIdLabel = document.getElementById("widgetIdLabel");
  const sourceLabel = document.getElementById("sourceLabel");
  const copyNowButton = document.getElementById("copyNowButton");
  const openStandaloneButton = document.getElementById("openStandaloneButton");

  const resolveQueryWidgetID = () => {
    try {
      return new URLSearchParams(window.location.search).get("id") || "";
    } catch (error) {
      return "";
    }
  };

  const resolveEmbeddedWidgetID = () => {
    try {
      if (!window.frameElement) {
        return "";
      }
      const blockElement = window.frameElement.closest("[data-node-id]");
      if (!blockElement) {
        return "";
      }
      return blockElement.getAttribute("data-node-id") || "";
    } catch (error) {
      return "";
    }
  };

  const resolveWidgetID = () => {
    return resolveQueryWidgetID() || resolveEmbeddedWidgetID();
  };

  const resolveModeLabel = () => {
    return window.frameElement ? "笔记内模式" : "独立网页模式";
  };

  const formatDate = (now) => {
    return now.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long"
    });
  };

  const formatClock = (now) => {
    return now.toLocaleTimeString("zh-CN", {
      hour12: false
    });
  };

  const copyText = async (text) => {
    if (!text) {
      return false;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      // fallback below
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  };

  let currentWidgetID = "";

  const render = () => {
    const now = new Date();
    currentWidgetID = resolveWidgetID();

    openStandaloneButton.hidden = !window.frameElement;
    modeLabel.textContent = resolveModeLabel();
    dateLabel.textContent = formatDate(now);
    timeLabel.textContent = formatClock(now);
    widgetIdLabel.textContent = currentWidgetID || "(未检测到，打开菜单时会自动回填)";

    try {
      const sourceURL = new URL(window.location.href);
      sourceLabel.textContent = sourceURL.pathname + sourceURL.search;
    } catch (error) {
      sourceLabel.textContent = window.location.href;
    }
  };

  const copyCurrentTime = async () => {
    const now = new Date();
    const text = `${formatDate(now)} ${formatClock(now)}`;
    const ok = await copyText(text);
    copyNowButton.textContent = ok ? "已复制" : "复制失败";
    setTimeout(() => {
      copyNowButton.textContent = "复制当前时间";
    }, 1200);
  };

  const openStandalone = () => {
    const url = new URL(window.location.href);
    if (currentWidgetID) {
      url.searchParams.set("id", currentWidgetID);
    }
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  const appendWidgetMenus = (event) => {
    const detail = event && event.detail;
    if (!detail || typeof detail.append !== "function") {
      return;
    }

    if (detail.widgetId && currentWidgetID && detail.widgetId !== currentWidgetID) {
      return;
    }

    detail.append({
      id: "clockWidgetCopyTime",
      icon: "iconCopy",
      label: "复制当前时间",
      click: () => {
        void copyCurrentTime();
      }
    });

    detail.append({
      id: "clockWidgetCopyID",
      icon: "iconRef",
      label: "复制挂件 ID",
      disabled: !currentWidgetID,
      click: () => {
        if (!currentWidgetID) {
          return;
        }
        void copyText(currentWidgetID);
      }
    });
  };

  copyNowButton.addEventListener("click", () => {
    void copyCurrentTime();
  });

  openStandaloneButton.addEventListener("click", () => {
    openStandalone();
  });

  window.addEventListener(WIDGET_GUTTER_MENU_EVENT, appendWidgetMenus);

  render();
  setInterval(render, 1000);
})();
