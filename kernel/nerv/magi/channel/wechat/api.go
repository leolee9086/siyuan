package wechat

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const ilinkAPIBase = "https://ilinkai.weixin.qq.com"
const channelVersion = "2.0.0"
const ilinkAppID = "bot"
const ilinkAppClientVersion = 0x00010000 // 1.0.0 → 65536

type apiClient struct {
	baseURL    string
	token      string
	httpClient *http.Client
}

func newAPIClient(baseURL, token string) *apiClient {
	if baseURL == "" {
		baseURL = ilinkAPIBase
	}
	return &apiClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		token:   token,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

func wechatUIN() string {
	n, _ := rand.Int(rand.Reader, big.NewInt(1<<32))
	uin := n.Uint64()
	return base64.RawStdEncoding.EncodeToString([]byte(fmt.Sprintf("%d", uin)))
}

func (c *apiClient) buildCommonHeaders() map[string]string {
	h := map[string]string{
		"Content-Type":              "application/json",
		"AuthorizationType":         "ilink_bot_token",
		"X-WECHAT-UIN":             wechatUIN(),
		"iLink-App-Id":             ilinkAppID,
		"iLink-App-ClientVersion":  strconv.Itoa(ilinkAppClientVersion),
	}
	if c.token != "" {
		h["Authorization"] = "Bearer " + c.token
	}
	return h
}

func (c *apiClient) getText(ctx context.Context, url string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", fmt.Errorf("wechat new request: %w", err)
	}
	for k, v := range c.buildCommonHeaders() {
		req.Header.Set(k, v)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("wechat get: %w", err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("wechat read body: %w", err)
	}
	return strings.TrimSpace(string(raw)), nil
}

func (c *apiClient) postJSON(ctx context.Context, path string, reqBody, respBody interface{}) error {
	raw, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("wechat marshal: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/"+path, bytes.NewReader(raw))
	if err != nil {
		return fmt.Errorf("wechat new request: %w", err)
	}
	for k, v := range c.buildCommonHeaders() {
		req.Header.Set(k, v)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("wechat post: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("wechat read: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("wechat post status=%d body=%s", resp.StatusCode, string(body))
	}
	if respBody != nil {
		if err := json.Unmarshal(body, respBody); err != nil {
			return fmt.Errorf("wechat unmarshal: %w (body=%s)", err, string(body))
		}
	}
	return nil
}

// --- iLink Bot API methods ---

func (c *apiClient) getUpdates(ctx context.Context, buf string, timeoutMs int) (*getUpdatesResp, error) {
	if timeoutMs <= 0 {
		timeoutMs = 35000
	}
	client := &http.Client{Timeout: time.Duration(timeoutMs+5000) * time.Millisecond}
	bodyRaw, _ := json.Marshal(getUpdatesReq{
		GetUpdatesBuf: buf,
		BaseInfo:      baseInfo{ChannelVersion: channelVersion},
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/ilink/bot/getupdates", bytes.NewReader(bodyRaw))
	if err != nil {
		return nil, err
	}
	for k, v := range c.buildCommonHeaders() {
		req.Header.Set(k, v)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("getUpdates HTTP %d: %s", resp.StatusCode, string(raw))
	}
	var result getUpdatesResp
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c *apiClient) sendMessage(ctx context.Context, toUserID, text, contextToken string) error {
	req := sendMessageReq{
		Msg: sendMessagePayload{
			FromUserID:   "",
			ToUserID:     toUserID,
			ClientID:     generateClientID(),
			MessageType:  messageTypeBot,
			MessageState: messageStateFinish,
			ItemList:     []messageItem{{Type: messageItemTypeText, TextItem: &textItem{Text: text}}},
			ContextToken: contextToken,
		},
		BaseInfo: baseInfo{ChannelVersion: channelVersion},
	}
	return c.postJSON(ctx, "ilink/bot/sendmessage", req, nil)
}

func (c *apiClient) getUploadUrl(ctx context.Context, req getUploadUrlReq) (*getUploadUrlResp, error) {
	req.BaseInfo = baseInfo{ChannelVersion: channelVersion}
	resp := &getUploadUrlResp{}
	if err := c.postJSON(ctx, "ilink/bot/getuploadurl", req, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

func (c *apiClient) getConfig(ctx context.Context, userID, contextToken string) (*getConfigResp, error) {
	req := getConfigReq{
		IlinkUserID:  userID,
		ContextToken: contextToken,
		BaseInfo:     baseInfo{ChannelVersion: channelVersion},
	}
	resp := &getConfigResp{}
	if err := c.postJSON(ctx, "ilink/bot/getconfig", req, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

func (c *apiClient) sendTyping(ctx context.Context, userID, ticket string, status int) error {
	req := sendTypingReq{
		IlinkUserID:  userID,
		TypingTicket: ticket,
		Status:       status,
		BaseInfo:     baseInfo{ChannelVersion: channelVersion},
	}
	return c.postJSON(ctx, "ilink/bot/sendtyping", req, nil)
}

// --- QR code login (anonymous, no auth token needed) ---

type qrCodeResponse struct {
	QRCode         string `json:"qrcode"`
	QRCodeImgContent string `json:"qrcode_img_content"`
}

type qrStatusResponse struct {
	Status      string `json:"status"`
	BotToken    string `json:"bot_token,omitempty"`
	IlinkBotID  string `json:"ilink_bot_id,omitempty"`
	BaseURL     string `json:"baseurl,omitempty"`
	UserID      string `json:"ilink_user_id,omitempty"`
	RedirectHost string `json:"redirect_host,omitempty"`
}

func wechatAnonHeaders() http.Header {
	h := http.Header{}
	h.Set("Content-Type", "application/json")
	h.Set("AuthorizationType", "ilink_bot_token")
	h.Set("X-WECHAT-UIN", wechatUIN())
	return h
}

// fetchQRCode 调用 get_bot_qrcode 获取二维码。
// 即使没有 token 也发送 AuthorizationType 头（与 openclaw-weixin 一致）。
func fetchQRCode(ctx context.Context) (*qrCodeResponse, error) {
	url := ilinkAPIBase + "/ilink/bot/get_bot_qrcode?bot_type=3"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("qrcode new request: %w", err)
	}
	req.Header = wechatAnonHeaders()
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("qrcode get: %w", err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("qrcode read: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("qrcode HTTP %d: %s", resp.StatusCode, string(raw))
	}
	var result qrCodeResponse
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("qrcode unmarshal: %w (body=%s)", err, string(raw))
	}
	return &result, nil
}

// pollQRStatus 轮询 get_qrcode_status。
func pollQRStatus(ctx context.Context, qrcode string) (*qrStatusResponse, error) {
	url := ilinkAPIBase + "/ilink/bot/get_qrcode_status?qrcode=" + qrcode
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("qrstatus new request: %w", err)
	}
	req.Header = wechatAnonHeaders()
	client := &http.Client{Timeout: 40 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("qrstatus get: %w", err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("qrstatus read: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("qrstatus HTTP %d: %s", resp.StatusCode, string(raw))
	}
	var result qrStatusResponse
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("qrstatus unmarshal: %w (body=%s)", err, string(raw))
	}
	return &result, nil
}



// --- helpers ---

func generateClientID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return "s-forge-magi-" + hex.EncodeToString(b)
}

func computeFileKey() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func computeAESKey() []byte {
	k := make([]byte, 16)
	rand.Read(k)
	return k
}

func hmacSHA256(key, data []byte) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write(data)
	return mac.Sum(nil)
}
