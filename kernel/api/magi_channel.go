package api

import (
	"context"
	"net/http"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel/trust"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel/wechat"
	"github.com/siyuan-note/siyuan/kernel/util"
)

var globalTrustMgr = trust.NewManagerWithPath("") // 延迟加载路径，在 initMagiComponents 中调用 EnsureConfigDir

// wechat state dir for account persistence
var (
	wxLoginSessionsMu sync.Mutex
	wxLoginSessions   = map[string]string{} // sessionKey → callback status (for frontend polling)
)



// channelCreate 阶段一：获取二维码，返回 qrImgUrl + sessionKey。
// 后台 goroutine 自动轮询 WaitConfirm。
func channelCreate(c *gin.Context) {
	var req struct {
		ChannelType string `json:"channelType"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: " + err.Error()})
		return
	}
	if strings.TrimSpace(strings.ToLower(req.ChannelType)) != "wechat" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported channel type"})
		return
	}

	qrImgURL, sessionKey, err := wechat.StartLogin(c.Request.Context())
	if err != nil {
		logging.LogErrorf("wechat start login failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "login start failed: " + err.Error()})
		return
	}

	wxLoginSessionsMu.Lock()
	wxLoginSessions[sessionKey] = "wait"
	wxLoginSessionsMu.Unlock()

	// 后台异步轮询扫码结果
	go func(sk string) {
		pollCtx := context.Background()
		botToken, botID, baseURL, userID, waitErr := wechat.WaitConfirm(pollCtx, sk, func(status string) {
			wxLoginSessionsMu.Lock()
			wxLoginSessions[sk] = status
			wxLoginSessionsMu.Unlock()
			logging.LogInfof("wechat login status: %s session=%s", status, sk[len(sk)-8:])
		})
		if waitErr != nil {
			logging.LogWarnf("wechat login failed: %v session=%s", waitErr, sk[len(sk)-8:])
			wxLoginSessionsMu.Lock()
			wxLoginSessions[sk] = "failed: " + waitErr.Error()
			wxLoginSessionsMu.Unlock()
			return
		}

		logging.LogInfof("wechat login confirmed: botID=%s userID=%s", botID, userID)
		wxLoginSessionsMu.Lock()
		wxLoginSessions[sk] = "confirmed"
		wxLoginSessionsMu.Unlock()

		// 创建适配器并注入凭证（持久化到磁盘）
		adapter := wechat.NewAdapter(botID)
		adapter.ApplyCredentials(botToken, baseURL, botID, userID)

		// 注册到全局通道注册表
		channel.Register(adapter)

		// 保存信任配置
		cfg := globalTrustMgr.GetConfig()
		if cfg.Channels == nil {
			cfg.Channels = map[string]trust.ChannelConfig{}
		}
		cc, hasChan := cfg.Channels["wechat"]
		if !hasChan {
			cc = trust.ChannelConfig{Enabled: true, DefaultTrust: "low", DefaultRisk: "high"}
		}
		if cc.PerAccount == nil {
			cc.PerAccount = map[string]trust.AccountConfig{}
		}
		cc.PerAccount[botID] = trust.AccountConfig{AllowList: []string{userID}}
		cfg.Channels["wechat"] = cc
		_ = globalTrustMgr.SaveConfig(cfg)

		// 启动消息接收
		if startErr := adapter.Start(context.Background()); startErr != nil {
			logging.LogErrorf("wechat adapter start failed: %v", startErr)
		}
	}(sessionKey)

	c.JSON(http.StatusOK, gin.H{
		"channelId":  "wechat",
		"sessionKey": sessionKey,
		"qrImgUrl":   qrImgURL,
	})
}

// channelPollLogin 查询登录状态（供前端轮询）。
func channelPollLogin(c *gin.Context) {
	sessionKey := strings.TrimSpace(c.Query("sessionKey"))
	if sessionKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sessionKey required"})
		return
	}

	wxLoginSessionsMu.Lock()
	status, exists := wxLoginSessions[sessionKey]
	if !exists {
		// session 已清理：登录已完成或已过期
		wxLoginSessionsMu.Unlock()
		c.JSON(http.StatusOK, gin.H{"status": "done"})
		return
	}
	// 终态清理
	if status == "confirmed" || strings.HasPrefix(status, "failed") {
		delete(wxLoginSessions, sessionKey)
	}
	wxLoginSessionsMu.Unlock()

	c.JSON(http.StatusOK, gin.H{"status": status})
}

// channelListStatus 返回所有已注册通道的运行状态。
func channelListStatus(c *gin.Context) {
	adapters := channel.All()
	type channelView struct {
		ID            string `json:"id"`
		Connected     bool   `json:"connected"`
		AccountID     string `json:"accountId"`
		UserCount     int    `json:"userCount"`
		LastMessageAt string `json:"lastMessageAt,omitempty"`
		Error         string `json:"error,omitempty"`
	}
	views := make([]channelView, 0, len(adapters))
	for _, a := range adapters {
		s := a.Status()
		lastMsg := ""
		if !s.LastMessageAt.IsZero() {
			lastMsg = s.LastMessageAt.Format("2006-01-02T15:04:05Z07:00")
		}
		views = append(views, channelView{
			ID:            s.ID,
			Connected:     s.Connected,
			AccountID:     s.AccountID,
			UserCount:     s.UserCount,
			LastMessageAt: lastMsg,
			Error:         s.Error,
		})
	}
	if views == nil {
		views = []channelView{}
	}
	c.JSON(http.StatusOK, gin.H{"channels": views})
}

// channelListAccounts 列出磁盘上所有已持久化的微信账号。
func channelListAccounts(c *gin.Context) {
	ids := wechat.ListIndexedAccountIDs(util.ConfDir)
	type acctView struct {
		AccountID string `json:"accountId"`
		UserID    string `json:"userId,omitempty"`
		SavedAt   string `json:"savedAt,omitempty"`
	}
	views := make([]acctView, 0, len(ids))
	for _, id := range ids {
		data := wechat.LoadAccount(util.ConfDir, id)
		v := acctView{AccountID: id}
		if data != nil {
			v.UserID = data.UserID
			v.SavedAt = data.SavedAt
		}
		views = append(views, v)
	}
	c.JSON(http.StatusOK, gin.H{"accounts": views})
}

// channelGetTrustConfig 返回当前可信度配置。
func channelGetTrustConfig(c *gin.Context) {
	cfg := globalTrustMgr.GetConfig()
	c.JSON(http.StatusOK, cfg)
}

// channelPutTrustConfig 更新可信度配置。
func channelPutTrustConfig(c *gin.Context) {
	var cfg trust.Config
	if err := c.ShouldBindJSON(&cfg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid config: " + err.Error()})
		return
	}
	if cfg.Channels == nil {
		cfg.Channels = map[string]trust.ChannelConfig{}
	}
	if err := globalTrustMgr.SaveConfig(&cfg); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "save failed: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// channelReLogin 为指定 WeChat 账号重新触发二维码登录。
// 先停止旧适配器，然后发起全新的两阶段登录流程。
func channelReLogin(c *gin.Context) {
	channelID := strings.TrimSpace(c.Param("channelId"))
	if channelID != "wechat" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "only wechat channel supports re-login"})
		return
	}
	var req struct {
		AccountID string `json:"accountId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.AccountID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "accountId is required"})
		return
	}

	accountID := strings.TrimSpace(req.AccountID)

	// 停止旧适配器（如果正在运行）
	instanceID := "wechat-" + accountID
	if existing, ok := channel.Get(instanceID); ok {
		_ = existing.Stop(c.Request.Context())
		channel.Unregister(instanceID)
	}

	qrImgURL, sessionKey, err := wechat.StartLogin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "login start failed: " + err.Error()})
		return
	}

	wxLoginSessionsMu.Lock()
	wxLoginSessions[sessionKey] = "wait"
	wxLoginSessionsMu.Unlock()

	go func(sk, aid string) {
		pollCtx := context.Background()
		botToken, botID, baseURL, userID, waitErr := wechat.WaitConfirm(pollCtx, sk, func(status string) {
			wxLoginSessionsMu.Lock()
			wxLoginSessions[sk] = status
			wxLoginSessionsMu.Unlock()
		})
		if waitErr != nil {
			logging.LogWarnf("wechat re-login failed: %v account=%s", waitErr, aid)
			wxLoginSessionsMu.Lock()
			wxLoginSessions[sk] = "failed: " + waitErr.Error()
			wxLoginSessionsMu.Unlock()
			return
		}

		logging.LogInfof("wechat re-login confirmed: botID=%s account=%s", botID, aid)
		wxLoginSessionsMu.Lock()
		wxLoginSessions[sk] = "confirmed"
		wxLoginSessionsMu.Unlock()

		adapter := wechat.NewAdapter(aid)
		adapter.ApplyCredentials(botToken, baseURL, botID, userID)
		channel.Register(adapter)
		if startErr := adapter.Start(context.Background()); startErr != nil {
			logging.LogErrorf("wechat adapter restart failed: %v", startErr)
		}
	}(sessionKey, accountID)

	c.JSON(http.StatusOK, gin.H{
		"sessionKey": sessionKey,
		"qrImgUrl":   qrImgURL,
	})
}
