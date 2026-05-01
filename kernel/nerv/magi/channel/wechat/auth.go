package wechat

import (
	"context"
	"fmt"
	"sync"
	"time"
)

const qrPollInterval = 1 * time.Second
const maxQRRefresh = 3

// LoginSession stores ephemeral state for one QR login attempt.
type LoginSession struct {
	mu        sync.Mutex
	QRCode    string
	QRImgURL  string
	CreatedAt time.Time
	Status    string
}

var (
	loginSessionsMu sync.Mutex
	loginSessions   = map[string]*LoginSession{}
)

// StartLogin fetches a QR code from WeChat iLink API.
// Returns the QR image URL and a session key for polling login status.
// 前端通过后端代理端点 /api/s-forge/magi/v1/channel/qr-image 加载图片，避免跨域拦截。
func StartLogin(ctx context.Context) (qrImgURL, sessionKey string, err error) {
	resp, err := fetchQRCode(ctx)
	if err != nil {
		return "", "", fmt.Errorf("wechat fetch qrcode: %w", err)
	}

	sessionKey = fmt.Sprintf("wx-%x", time.Now().UnixNano())
	session := &LoginSession{
		QRCode:    resp.QRCode,
		QRImgURL:  resp.QRCodeImgContent,
		CreatedAt: time.Now(),
		Status:    "wait",
	}
	loginSessionsMu.Lock()
	loginSessions[sessionKey] = session
	loginSessionsMu.Unlock()
	return resp.QRCodeImgContent, sessionKey, nil
}

// WaitConfirm polls until the QR code scan is confirmed or the operation fails.
func WaitConfirm(ctx context.Context, sessionKey string, onStatus func(string)) (botToken, botID, baseURL, userID string, err error) {
	loginSessionsMu.Lock()
	session, exists := loginSessions[sessionKey]
	loginSessionsMu.Unlock()
	if !exists {
		return "", "", "", "", fmt.Errorf("login session not found: %s", sessionKey)
	}

	deadline := time.Now().Add(480 * time.Second)
	refreshCount := 0

	for time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return "", "", "", "", ctx.Err()
		default:
		}

		session.mu.Lock()
		qrcode := session.QRCode
		session.mu.Unlock()

		statusResp, pollErr := pollQRStatus(ctx, qrcode)
		if pollErr != nil {
			if onStatus != nil {
				onStatus("wait")
			}
			time.Sleep(qrPollInterval)
			continue
		}

		if onStatus != nil {
			onStatus(statusResp.Status)
		}
		session.mu.Lock()
		session.Status = statusResp.Status
		session.mu.Unlock()

		switch statusResp.Status {
		case "confirmed":
			if statusResp.IlinkBotID == "" {
				return "", "", "", "", fmt.Errorf("confirmed but ilink_bot_id missing")
			}
			loginSessionsMu.Lock()
			delete(loginSessions, sessionKey)
			loginSessionsMu.Unlock()
			return statusResp.BotToken, statusResp.IlinkBotID, statusResp.BaseURL, statusResp.UserID, nil

		case "expired":
			refreshCount++
			if refreshCount > maxQRRefresh {
				loginSessionsMu.Lock()
				delete(loginSessions, sessionKey)
				loginSessionsMu.Unlock()
				return "", "", "", "", fmt.Errorf("qrcode expired %d times", maxQRRefresh)
			}
			newResp, qrErr := fetchQRCode(ctx)
			if qrErr != nil {
				loginSessionsMu.Lock()
				delete(loginSessions, sessionKey)
				loginSessionsMu.Unlock()
				return "", "", "", "", fmt.Errorf("refresh qrcode failed: %w", qrErr)
			}
			session.mu.Lock()
			session.QRCode = newResp.QRCode
			session.QRImgURL = newResp.QRCodeImgContent
			session.CreatedAt = time.Now()
			session.mu.Unlock()

		case "scaned_but_redirect":
			if statusResp.RedirectHost != "" {
				// IDC redirect: the monitor will handle the new base URL
			}
		}

		time.Sleep(qrPollInterval)
	}

	loginSessionsMu.Lock()
	delete(loginSessions, sessionKey)
	loginSessionsMu.Unlock()
	return "", "", "", "", fmt.Errorf("login timeout")
}

// GetLoginSession returns the current login session state for frontend polling.
func GetLoginSession(sessionKey string) *LoginSession {
	loginSessionsMu.Lock()
	defer loginSessionsMu.Unlock()
	return loginSessions[sessionKey]
}
