package wechat

// iLink Bot API 协议类型定义。

type baseInfo struct {
	ChannelVersion string `json:"channel_version,omitempty"`
}

// --- GetUpdates ---

type getUpdatesReq struct {
	GetUpdatesBuf string   `json:"get_updates_buf"`
	BaseInfo      baseInfo `json:"base_info"`
}

type getUpdatesResp struct {
	Ret                int             `json:"ret"`
	ErrCode            int             `json:"errcode,omitempty"`
	ErrMsg             string          `json:"errmsg,omitempty"`
	Msgs               []weixinMessage `json:"msgs,omitempty"`
	GetUpdatesBuf      string          `json:"get_updates_buf"`
	LongPollingTimeout int             `json:"longpolling_timeout_ms,omitempty"`
}

// --- WeixinMessage ---

type weixinMessage struct {
	Seq          int            `json:"seq,omitempty"`
	MessageID    int            `json:"message_id,omitempty"`
	FromUserID   string         `json:"from_user_id,omitempty"`
	ToUserID     string         `json:"to_user_id,omitempty"`
	ClientID     string         `json:"client_id,omitempty"`
	CreateTimeMs int64          `json:"create_time_ms,omitempty"`
	SessionID    string         `json:"session_id,omitempty"`
	GroupID      string         `json:"group_id,omitempty"`
	MessageType  int            `json:"message_type,omitempty"`
	MessageState int            `json:"message_state,omitempty"`
	ItemList     []messageItem  `json:"item_list,omitempty"`
	ContextToken string         `json:"context_token,omitempty"`
}

type messageItem struct {
	Type      int        `json:"type,omitempty"`
	TextItem  *textItem  `json:"text_item,omitempty"`
	ImageItem *imageItem `json:"image_item,omitempty"`
	VoiceItem *voiceItem `json:"voice_item,omitempty"`
	FileItem  *fileItem  `json:"file_item,omitempty"`
	VideoItem *videoItem `json:"video_item,omitempty"`
}

type textItem struct {
	Text string `json:"text,omitempty"`
}

type cdnMedia struct {
	EncryptQueryParam string `json:"encrypt_query_param,omitempty"`
	AesKey            string `json:"aes_key,omitempty"`
	FullURL           string `json:"full_url,omitempty"`
}

type imageItem struct {
	Media     *cdnMedia `json:"media,omitempty"`
	Thumbnail *cdnMedia `json:"thumb_media,omitempty"`
	AesKey    string    `json:"aeskey,omitempty"`
	URL       string    `json:"url,omitempty"`
	MidSize   int       `json:"mid_size,omitempty"`
	HdSize    int       `json:"hd_size,omitempty"`
}

type voiceItem struct {
	Media       *cdnMedia `json:"media,omitempty"`
	EncodeType  int       `json:"encode_type,omitempty"`
	PlayTime    int       `json:"playtime,omitempty"`
	Text        string    `json:"text,omitempty"`
}

type fileItem struct {
	Media    *cdnMedia `json:"media,omitempty"`
	FileName string    `json:"file_name,omitempty"`
	MD5      string    `json:"md5,omitempty"`
	Len      string    `json:"len,omitempty"`
}

type videoItem struct {
	Media     *cdnMedia `json:"media,omitempty"`
	VideoSize int       `json:"video_size,omitempty"`
	Thumbnail *cdnMedia `json:"thumb_media,omitempty"`
	ThumbSize int       `json:"thumb_size,omitempty"`
}

// --- SendMessage ---

type sendMessageReq struct {
	Msg      sendMessagePayload `json:"msg"`
	BaseInfo baseInfo           `json:"base_info"`
}

type sendMessagePayload struct {
	FromUserID   string         `json:"from_user_id"`
	ToUserID     string         `json:"to_user_id"`
	ClientID     string         `json:"client_id,omitempty"`
	MessageType  int            `json:"message_type"`
	MessageState int            `json:"message_state"`
	ItemList     []messageItem  `json:"item_list"`
	ContextToken string         `json:"context_token,omitempty"`
}

// --- GetUploadUrl ---

type getUploadUrlReq struct {
	FileKey         string   `json:"filekey,omitempty"`
	MediaType       int      `json:"media_type"`
	ToUserID        string   `json:"to_user_id,omitempty"`
	RawSize         int      `json:"rawsize"`
	RawFileMD5      string   `json:"rawfilemd5"`
	FileSize        int      `json:"filesize"`
	ThumbRawSize    int      `json:"thumb_rawsize,omitempty"`
	ThumbRawFileMD5 string   `json:"thumb_rawfilemd5,omitempty"`
	ThumbFileSize   int      `json:"thumb_filesize,omitempty"`
	AesKey          string   `json:"aeskey,omitempty"`
	BaseInfo        baseInfo `json:"base_info"`
}

type getUploadUrlResp struct {
	UploadParam      string `json:"upload_param"`
	ThumbUploadParam string `json:"thumb_upload_param,omitempty"`
	UploadFullURL    string `json:"upload_full_url,omitempty"`
}

// --- GetConfig ---

type getConfigReq struct {
	IlinkUserID  string   `json:"ilink_user_id"`
	ContextToken string   `json:"context_token,omitempty"`
	BaseInfo     baseInfo `json:"base_info"`
}

type getConfigResp struct {
	Ret         int    `json:"ret"`
	TypingTicket string `json:"typing_ticket,omitempty"`
}

// --- SendTyping ---

type sendTypingReq struct {
	IlinkUserID  string   `json:"ilink_user_id"`
	TypingTicket string   `json:"typing_ticket"`
	Status       int      `json:"status"`
	BaseInfo     baseInfo `json:"base_info"`
}

// --- Message constants ---

const (
	messageTypeUser = 1
	messageTypeBot  = 2

	messageStateNew       = 0
	messageStateGenerating = 1
	messageStateFinish    = 2

	messageItemTypeText  = 1
	messageItemTypeImage = 2
	messageItemTypeVoice = 3
	messageItemTypeFile  = 4
	messageItemTypeVideo = 5

	uploadMediaTypeImage = 1
	uploadMediaTypeVideo = 2
	uploadMediaTypeFile  = 3
)

const defaultBaseURL = "https://ilinkai.weixin.qq.com"
