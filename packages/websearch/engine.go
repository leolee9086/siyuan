package websearch

import (
	"fmt"
	"strings"
	"sync"
)

// EngineRegistry 搜索引擎注册表
type EngineRegistry struct {
	mu      sync.RWMutex
	engines map[string]EngineFactory
}

// GlobalEngineRegistry 全局引擎注册表

// register 是注册引擎工厂的便捷函数（供各分类文件的 init() 使用）
func register(name string, factory EngineFactory) {
	GlobalEngineRegistry.Register(name, factory)
}

var GlobalEngineRegistry = NewEngineRegistry()

// NewEngineRegistry 创建注册表
func NewEngineRegistry() *EngineRegistry {
	return &EngineRegistry{
		engines: make(map[string]EngineFactory),
	}
}

// Register 注册引擎工厂
func (r *EngineRegistry) Register(name string, factory EngineFactory) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.engines[name] = func(config EngineConfig) SearchEngine {
		return &contractSearchEngine{delegate: factory(config)}
	}
}

// contractSearchEngine prevents any registered adapter from exposing a silent
// nil result. Empty slices remain valid no-match responses; nil is always a
// protocol failure because callers cannot distinguish it from a swallowed
// parser error.
type contractSearchEngine struct {
	delegate SearchEngine
}

func (e *contractSearchEngine) Name() string {
	if e == nil || e.delegate == nil {
		return "unknown"
	}
	return e.delegate.Name()
}

func (e *contractSearchEngine) Config() EngineConfig {
	if e == nil || e.delegate == nil {
		return DefaultEngineConfig("unknown")
	}
	return e.delegate.Config()
}

func (e *contractSearchEngine) Search(query string, opts SearchOptions, headers map[string]string) ([]SearchResult, error) {
	if e == nil || e.delegate == nil {
		return nil, &ProtocolError{Engine: "unknown", Message: "engine factory returned nil adapter"}
	}
	results, err := e.delegate.Search(query, opts, headers)
	if err != nil {
		return nil, err
	}
	if results == nil {
		return nil, &ProtocolError{Engine: e.delegate.Name(), Message: "search returned nil results without an error"}
	}
	return results, nil
}

// Get 获取引擎工厂
func (r *EngineRegistry) Get(name string) (EngineFactory, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	f, ok := r.engines[name]
	return f, ok
}

// List 列出所有已注册的引擎名
func (r *EngineRegistry) List() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	names := make([]string, 0, len(r.engines))
	for n := range r.engines {
		names = append(names, n)
	}
	return names
}

// SelectEngines 根据 SelectFlags 选择可用引擎
// 对应 s-code selector.ts 的 selectEngines()
func SelectEngines(flags *SelectFlags) []SearchEngine {
	engines := make([]SearchEngine, 0, 150)

	// DuckDuckGo 始终可用
	if f, ok := GlobalEngineRegistry.Get("duckduckgo"); ok {
		engines = append(engines, f(EngineConfig{Name: "duckduckgo", Weight: 1.0, Timeout: 15000, MaxResults: 50}))
	}

	// Bing
	if f, ok := GlobalEngineRegistry.Get("bing"); ok {
		engines = append(engines, f(EngineConfig{Name: "bing", Weight: 0.9, Timeout: 15000, MaxResults: 50, Priority: 1}))
	}

	// Brave
	if flags == nil || flags.Brave || (!flags.HasAny()) {
		if f, ok := GlobalEngineRegistry.Get("brave"); ok {
			engines = append(engines, f(EngineConfig{Name: "brave", Weight: 1.2, Timeout: 15000, MaxResults: 50, Priority: 1}))
		}
	}

	// Startpage
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("startpage"); ok {
			engines = append(engines, f(EngineConfig{Name: "startpage", Weight: 1.1, Timeout: 15000, MaxResults: 50, Priority: 1}))
		}
	}

	// Mwmbl
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("mwmbl"); ok {
			engines = append(engines, f(EngineConfig{Name: "mwmbl", Weight: 0.7, Timeout: 15000, MaxResults: 5}))
		}
	}

	// Seznam
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("seznam"); ok {
			engines = append(engines, f(EngineConfig{Name: "seznam", Weight: 0.7, Timeout: 15000, MaxResults: 5}))
		}
	}

	// AOL
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("aol"); ok {
			engines = append(engines, f(EngineConfig{Name: "aol", Weight: 0.7, Timeout: 15000, MaxResults: 5}))
		}
	}

	// GMX
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("gmx"); ok {
			engines = append(engines, f(EngineConfig{Name: "gmx", Weight: 0.7, Timeout: 15000, MaxResults: 5}))
		}
	}

	// Yep
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("yep"); ok {
			engines = append(engines, f(EngineConfig{Name: "yep", Weight: 0.7, Timeout: 15000, MaxResults: 5}))
		}
	}

	// Mojeek
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("mojeek"); ok {
			engines = append(engines, f(EngineConfig{Name: "mojeek", Weight: 0.6, Timeout: 15000, MaxResults: 5}))
		}
	}

	// Grokipedia
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("grokipedia"); ok {
			engines = append(engines, f(EngineConfig{Name: "grokipedia", Weight: 0.5, Timeout: 15000, MaxResults: 5}))
		}
	}

	// Bilibili 视频
	if (flags != nil && flags.Bilibili) || flags == nil || (flags != nil && flags.QueryType == "video") {
		if f, ok := GlobalEngineRegistry.Get("bilibili"); ok {
			engines = append(engines, f(EngineConfig{Name: "bilibili", Weight: 1.0, Timeout: 15000, MaxResults: 5}))
		}
	}

	// YouTube
	if flags == nil || flags.QueryType == "video" {
		if f, ok := GlobalEngineRegistry.Get("youtube"); ok {
			engines = append(engines, f(EngineConfig{Name: "youtube", Weight: 1.2, Timeout: 20000, MaxResults: 50, Priority: 2}))
		}
	}

	// Piped
	if flags == nil || flags.QueryType == "video" {
		if f, ok := GlobalEngineRegistry.Get("piped"); ok {
			engines = append(engines, f(EngineConfig{Name: "piped", Weight: 0.9, Timeout: 20000, MaxResults: 5, Priority: 1}))
		}
	}

	// Invidious
	if flags == nil || flags.QueryType == "video" {
		if f, ok := GlobalEngineRegistry.Get("invidious"); ok {
			engines = append(engines, f(EngineConfig{Name: "invidious", Weight: 0.8, Timeout: 20000, MaxResults: 5}))
		}
	}

	// Odysee
	if flags == nil || flags.QueryType == "video" {
		if f, ok := GlobalEngineRegistry.Get("odysee"); ok {
			engines = append(engines, f(EngineConfig{Name: "odysee", Weight: 0.7, Timeout: 20000, MaxResults: 5}))
		}
	}

	// BitChute
	if flags == nil || flags.QueryType == "video" {
		if f, ok := GlobalEngineRegistry.Get("bitchute"); ok {
			engines = append(engines, f(EngineConfig{Name: "bitchute", Weight: 0.5, Timeout: 15000, MaxResults: 5}))
		}
	}

	// AcFun
	if flags == nil || flags.QueryType == "video" {
		if f, ok := GlobalEngineRegistry.Get("acfun"); ok {
			engines = append(engines, f(EngineConfig{Name: "acfun", Weight: 0.5, Timeout: 15000, MaxResults: 5}))
		}
	}

	// iQiyi
	if flags == nil || flags.QueryType == "video" {
		if f, ok := GlobalEngineRegistry.Get("iqiyi"); ok {
			engines = append(engines, f(EngineConfig{Name: "iqiyi", Weight: 0.5, Timeout: 15000, MaxResults: 5}))
		}
	}

	// 搜狗视频
	if flags == nil || flags.QueryType == "video" {
		if f, ok := GlobalEngineRegistry.Get("sogou-videos"); ok {
			engines = append(engines, f(EngineConfig{Name: "sogou-videos", Weight: 0.5, Timeout: 15000, MaxResults: 5}))
		}
	}

	// 搜狗微信
	if flags == nil || flags.QueryType == "news" || flags.QueryType == "social" {
		if f, ok := GlobalEngineRegistry.Get("sogou-wechat"); ok {
			engines = append(engines, f(EngineConfig{Name: "sogou-wechat", Weight: 0.9, Timeout: 15000, MaxResults: 5}))
		}
	}

	// 百度
	if flags == nil || strings.HasPrefix(flags.Lang, "zh") {
		if f, ok := GlobalEngineRegistry.Get("baidu"); ok {
			engines = append(engines, f(EngineConfig{Name: "baidu", Weight: 0.9, Timeout: 15000, MaxResults: 50, Priority: 1}))
		}
	}

	// ChinaSo
	if flags == nil || strings.HasPrefix(flags.Lang, "zh") {
		if f, ok := GlobalEngineRegistry.Get("chinaso"); ok {
			engines = append(engines, f(EngineConfig{Name: "chinaso", Weight: 0.8, Timeout: 15000, MaxResults: 5}))
		}
	}

	// Quark
	if flags == nil || strings.HasPrefix(flags.Lang, "zh") {
		if f, ok := GlobalEngineRegistry.Get("quark"); ok {
			engines = append(engines, f(EngineConfig{Name: "quark", Weight: 0.7, Timeout: 15000, MaxResults: 5}))
		}
	}

	// Google
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("google"); ok {
			engines = append(engines, f(EngineConfig{Name: "google", Weight: 1.3, Timeout: 20000, MaxResults: 50, Priority: 2}))
		}
	}

	// Yandex
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("yandex"); ok {
			engines = append(engines, f(EngineConfig{Name: "yandex", Weight: 0.7, Timeout: 15000, MaxResults: 5}))
		}
	}

	// Naver
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("naver"); ok {
			engines = append(engines, f(EngineConfig{Name: "naver", Weight: 0.7, Timeout: 15000, MaxResults: 5}))
		}
	}

	// 搜狗
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("sogou"); ok {
			engines = append(engines, f(EngineConfig{Name: "sogou", Weight: 0.8, Timeout: 15000, MaxResults: 5}))
		}
	}

	// 360搜索
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("360search"); ok {
			engines = append(engines, f(EngineConfig{Name: "360search", Weight: 0.7, Timeout: 15000, MaxResults: 5}))
		}
	}

	// Bing Images
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("bing-images"); ok {
			engines = append(engines, f(EngineConfig{Name: "bing-images", Weight: 0.9, Timeout: 15000, MaxResults: 5}))
		}
	}

	// 搜狗图片
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("sogou-images"); ok {
			engines = append(engines, f(EngineConfig{Name: "sogou-images", Weight: 0.6, Timeout: 15000, MaxResults: 5}))
		}
	}

	// Bing Videos
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("bing-videos"); ok {
			engines = append(engines, f(EngineConfig{Name: "bing-videos", Weight: 0.9, Timeout: 15000, MaxResults: 5}))
		}
	}

	// Dailymotion
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("dailymotion"); ok {
			engines = append(engines, f(EngineConfig{Name: "dailymotion", Weight: 0.8, Timeout: 15000, MaxResults: 5}))
		}
	}

	// Vimeo
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("vimeo"); ok {
			engines = append(engines, f(EngineConfig{Name: "vimeo", Weight: 0.7, Timeout: 15000, MaxResults: 5}))
		}
	}

	// APKMirror
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("apkmirror"); ok {
			engines = append(engines, f(EngineConfig{Name: "apkmirror", Weight: 0.5, Timeout: 15000, MaxResults: 5}))
		}
	}

	// SoundCloud
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("soundcloud"); ok {
			engines = append(engines, f(EngineConfig{Name: "soundcloud", Weight: 0.7, Timeout: 15000, MaxResults: 5}))
		}
	}

	// Flickr
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("flickr"); ok {
			engines = append(engines, f(EngineConfig{Name: "flickr", Weight: 0.7, Timeout: 15000, MaxResults: 5}))
		}
	}

	// 豆瓣
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("douban"); ok {
			engines = append(engines, f(EngineConfig{Name: "douban", Weight: 0.8, Timeout: 15000, MaxResults: 5}))
		}
	}

	// 微博
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("weibo"); ok {
			engines = append(engines, f(EngineConfig{Name: "weibo", Weight: 0.8, Timeout: 15000, MaxResults: 5}))
		}
	}

	// 知乎
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("zhihu"); ok {
			engines = append(engines, f(EngineConfig{Name: "zhihu", Weight: 0.8, Timeout: 15000, MaxResults: 5, Priority: 1}))
		}
	}

	// 小红书
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("xiaohongshu"); ok {
			engines = append(engines, f(EngineConfig{Name: "xiaohongshu", Weight: 0.7, Timeout: 15000, MaxResults: 5, Priority: 1}))
		}
	}

	// Reddit
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("reddit"); ok {
			engines = append(engines, f(EngineConfig{Name: "reddit", Weight: 0.7, Timeout: 15000, MaxResults: 5}))
		}
	}

	// Twitter/X
	if flags == nil || flags.QueryType == "social" {
		if f, ok := GlobalEngineRegistry.Get("twitter"); ok {
			engines = append(engines, f(EngineConfig{Name: "twitter", Weight: 0.8, Timeout: 20000, MaxResults: 5}))
		}
	}

	// Google Images
	if flags == nil || !flags.HasAny() {
		if f, ok := GlobalEngineRegistry.Get("google-images"); ok {
			engines = append(engines, f(EngineConfig{Name: "google-images", Weight: 1.0, Timeout: 20000, MaxResults: 5, Priority: 1}))
		}
	}

	// 学术：Arxiv + Semantic Scholar + Google Scholar
	if flags == nil || flags.QueryType == "academic" {
		for _, name := range []string{"arxiv", "semantic-scholar", "google-scholar"} {
			if f, ok := GlobalEngineRegistry.Get(name); ok {
				engines = append(engines, f(EngineConfig{Name: name, Weight: 1.0, Timeout: 15000, MaxResults: 5, Priority: 1}))
			}
		}
	}

	// 代码：GitHub + GitLab + HuggingFace 等
	if flags == nil || flags.QueryType == "code" {
		codeEngines := []struct {
			name     string
			weight   float64
			priority int
		}{
			{"github", 1.0, 1}, {"github-code", 1.1, 2}, {"github-issues", 0.9, 1},
			{"github-repo-files", 0.8, 1}, {"mdn", 0.8, 0}, {"docsrs", 0.8, 0},
			{"react-docs", 0.8, 0}, {"vue-docs", 0.8, 0}, {"python-docs", 0.8, 0},
			{"gitlab", 0.9, 1}, {"huggingface", 1.0, 1}, {"gitea", 0.8, 0},
			{"sourcehut", 0.6, 0}, {"pkg-go-dev", 0.8, 0}, {"crates", 0.8, 0},
			{"hex", 0.7, 0}, {"microsoft-learn", 0.6, 0}, {"pypi-html", 0.8, 0},
			{"lib-rs", 0.7, 0}, {"nvd", 0.5, 0}, {"repology", 0.5, 0},
		}
		for _, ce := range codeEngines {
			if f, ok := GlobalEngineRegistry.Get(ce.name); ok {
				engines = append(engines, f(EngineConfig{Name: ce.name, Weight: ce.weight, Timeout: 15000, MaxResults: 5, Priority: ce.priority}))
			}
		}
	}

	// Wikipedia
	if flags == nil || flags.QueryType == "academic" {
		if f, ok := GlobalEngineRegistry.Get("wikipedia"); ok {
			engines = append(engines, f(EngineConfig{Name: "wikipedia", Weight: 0.9, Timeout: 15000, MaxResults: 5}))
		}
	}

	// 开放 API 引擎族
	openAPIEngines := []struct {
		name     string
		weight   float64
		category string
	}{
		{"unsplash", 0.7, "image"}, {"hackernews", 0.8, "news"},
		{"pubmed", 0.8, "academic"}, {"npm", 0.7, "code"},
		{"dockerhub", 0.6, "code"}, {"coingecko", 0.7, "general"},
		{"nominatim", 0.6, "general"}, {"core", 0.7, "academic"},
		{"marginalia", 0.5, "general"}, {"podchaser", 0.5, "general"},
		{"9gag", 0.4, "general"}, {"frinkiac", 0.3, "general"},
		{"z-library", 0.5, "academic"}, {"apple-app-store", 0.5, "general"},
		{"stackexchange", 0.8, "general"}, {"pixabay", 0.7, "image"},
	}
	for _, oe := range openAPIEngines {
		if f, ok := GlobalEngineRegistry.Get(oe.name); ok {
			engines = append(engines, f(EngineConfig{Name: oe.name, Weight: oe.weight, Timeout: 10000, MaxResults: 5}))
		}
	}

	// 百科/媒体
	if f, ok := GlobalEngineRegistry.Get("wikicommons"); ok {
		engines = append(engines, f(EngineConfig{Name: "wikicommons", Weight: 0.7, Timeout: 15000, MaxResults: 5}))
	}
	if f, ok := GlobalEngineRegistry.Get("wikidata"); ok {
		engines = append(engines, f(EngineConfig{Name: "wikidata", Weight: 0.8, Timeout: 15000, MaxResults: 5}))
	}

	// 电影/娱乐
	if flags == nil || flags.QueryType == "video" {
		if f, ok := GlobalEngineRegistry.Get("imdb"); ok {
			engines = append(engines, f(EngineConfig{Name: "imdb", Weight: 0.8, Timeout: 15000, MaxResults: 5}))
		}
		if f, ok := GlobalEngineRegistry.Get("rottentomatoes"); ok {
			engines = append(engines, f(EngineConfig{Name: "rottentomatoes", Weight: 0.7, Timeout: 15000, MaxResults: 5}))
		}
	}

	// Steam
	if f, ok := GlobalEngineRegistry.Get("steam"); ok {
		engines = append(engines, f(EngineConfig{Name: "steam", Weight: 0.7, Timeout: 15000, MaxResults: 5}))
	}

	// 图片
	for _, name := range []string{"pexels", "pinterest", "deviantart", "imgur", "pixiv"} {
		if f, ok := GlobalEngineRegistry.Get(name); ok {
			engines = append(engines, f(EngineConfig{Name: name, Weight: 0.7, Timeout: 15000, MaxResults: 5}))
		}
	}

	// 购物
	if flags == nil || flags.QueryType == "shopping" {
		shoppingEngines := []string{"smzdm", "jd", "taobao", "pdd", "amazon-cn", "suning", "gome", "amazon-us", "vip", "yipin", "dangdang", "kaola", "ebay"}
		for _, name := range shoppingEngines {
			if f, ok := GlobalEngineRegistry.Get(name); ok {
				engines = append(engines, f(EngineConfig{Name: name, Weight: 0.7, Timeout: 15000, MaxResults: 5, Priority: 1}))
			}
		}
	}

	// 音乐/社交
	for _, name := range []string{"bandcamp", "genius", "deezer", "mixcloud", "mastodon", "lemmy", "discourse", "boardreader", "tootfinder"} {
		if flags == nil || flags.QueryType == "social" {
			if f, ok := GlobalEngineRegistry.Get(name); ok {
				engines = append(engines, f(EngineConfig{Name: name, Weight: 0.7, Timeout: 15000, MaxResults: 5}))
			}
		}
	}

	// 新闻
	if flags == nil || flags.QueryType == "news" || !flags.HasAny() {
		for _, name := range []string{"bbc-news", "theguardian", "techcrunch", "theverge", "arstechnica", "reuters", "yahoo-news", "tagesschau", "ansa"} {
			if f, ok := GlobalEngineRegistry.Get(name); ok {
				engines = append(engines, f(EngineConfig{Name: name, Weight: 0.7, Timeout: 15000, MaxResults: 5}))
			}
		}
	}

	// 学术扩展
	if flags == nil || flags.QueryType == "academic" {
		for _, name := range []string{"crossref", "openalex", "openlibrary", "goodreads", "zenodo", "ads", "scanr", "pdbe", "openaire"} {
			if f, ok := GlobalEngineRegistry.Get(name); ok {
				engines = append(engines, f(EngineConfig{Name: name, Weight: 0.7, Timeout: 15000, MaxResults: 5}))
			}
		}
	}

	// 其它
	for _, name := range []string{"qwant", "yahoo", "wttr", "currency-convert", "dictzone", "duden", "emojipedia", "jisho", "tineye", "yandex-music", "lingva", "libretranslate"} {
		if f, ok := GlobalEngineRegistry.Get(name); ok {
			engines = append(engines, f(EngineConfig{Name: name, Weight: 0.6, Timeout: 15000, MaxResults: 5}))
		}
	}

	// 包管理
	for _, name := range []string{"packagist", "rubygems", "pub-dev", "mankier", "hoogle", "metacpan", "archlinux", "alpinelinux", "voidlinux"} {
		if f, ok := GlobalEngineRegistry.Get(name); ok {
			engines = append(engines, f(EngineConfig{Name: name, Weight: 0.6, Timeout: 10000, MaxResults: 5}))
		}
	}

	return engines
}

// SelectFlags 引擎选择标志
type SelectFlags struct {
	Exa         bool
	Parallel    bool
	Brave       bool
	Xiaohongshu bool
	Zhihu       bool
	Bilibili    bool
	QueryType   string // "general" | "code" | "news" | "academic" | "social" | "video" | "shopping"
	TimeRange   string
	Lang        string
}

// HasAny 检查是否有任何标志被设置
func (f *SelectFlags) HasAny() bool {
	return f.Exa || f.Parallel || f.Brave || f.Xiaohongshu || f.Zhihu || f.Bilibili || f.QueryType != ""
}

// EngineSummary 返回引擎摘要字符串
func EngineSummary(engines []SearchEngine) string {
	names := make([]string, len(engines))
	for i, e := range engines {
		names[i] = fmt.Sprintf("%s(weight=%.1f)", e.Name(), e.Config().Weight)
	}
	return "已启用引擎: " + strings.Join(names, ", ")
}
