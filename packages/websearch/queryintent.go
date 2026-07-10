package websearch

import (
	"regexp"
	"strings"
)

// ── 查询意图检测 ──────────────────────────────────────

// QueryIntent 表示检测到的查询意图
type QueryIntent struct {
	QueryType      string // "general" | "code" | "news" | "academic" | "social" | "video" | "shopping"
	IsTranslation  bool
	IsCurrency     bool
	IsWeather      bool
	IsGitHubRepo   bool
	IsGitHubIssue  bool
	GitHubOwner    string
	GitHubRepo     string
}

// 常量定义
const (
	QueryTypeGeneral  = "general"
	QueryTypeCode     = "code"
	QueryTypeNews     = "news"
	QueryTypeAcademic = "academic"
	QueryTypeSocial   = "social"
	QueryTypeVideo    = "video"
	QueryTypeShopping = "shopping"
)

// ── 正则模式 ───────────────────────────────────────────

var (
	gitHubRepoPattern    = regexp.MustCompile(`^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$`)
	gitHubCodeQualifier  = regexp.MustCompile(`\brepo:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\b`)
	gitHubURLPattern     = regexp.MustCompile(`github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(?:\/.*)?$`)
	codeKeywords         = regexp.MustCompile(`\b(how to|what is|install|npm|pip|cargo|git|api|rest|graphql|sql|query|function|class|interface|type|error|bug|debug|compile|sort|array|list|map|filter|reduce|algorithm|tutorial|guide|documentation|docs|docker|deploy|server|client|frontend|backend|fullstack|leetcode|coding|rust|python|typescript|javascript|go|golang|java|cplusplus|csharp|ruby|swift|kotlin|scala|php|perl|lua|haskell|elixir|clojure|dart|flutter|react|vue|angular|node|deno|bun|nextjs|nuxt|svelte)\b`)
	currencyPattern      = regexp.MustCompile(`\b([A-Z]{3})\s+(?:to|in|=>)\s+([A-Z]{3})\b`)
	weatherPattern       = regexp.MustCompile(`\b(weather|temperature|forecast|°[cf]|humidity|wind|rain|snow)\b`)
	weatherCN            = regexp.MustCompile(`天气|温度|预报|湿度|风力|降雨|下雪|气温`)
	translationPattern   = regexp.MustCompile(`\b(translate|meaning|definition|dictionary)\b`)
	translationCN        = regexp.MustCompile(`翻译|意思|定义|词典|字典|释义`)
	urlPattern           = regexp.MustCompile(`^https?:\/\/`)
	shoppingPattern      = regexp.MustCompile(`\b(price|buy|shop|deal|discount|coupon|cheap|best price|compare|purchase|order)\b`)
	shoppingCN           = regexp.MustCompile(`价格|多少钱|报价|售价|优惠|打折|促销|比价|性价比|购买|商城|旗舰店|值得买|评测|测评`)
	videoPattern         = regexp.MustCompile(`\b(watch|video|episode|trailer|clip)\b`)
	videoCN              = regexp.MustCompile(`视频|观看|电影|电视剧|动漫|番剧|短片|预告|直播`)
	newsPattern          = regexp.MustCompile(`\b(news|latest|breaking|update|today)\b`)
	newsCN               = regexp.MustCompile(`报道|新闻|最新|快讯|头条|时政|国际|国内|社会|热点`)
	academicPattern      = regexp.MustCompile(`\b(paper|thesis|doi|arxiv|semantic scholar|citation|reference|research|journal|proceedings)\b`)
)

var languageNames = []string{
	"rust", "python", "typescript", "javascript", "go", "golang",
	"java", "cplusplus", "csharp", "ruby", "swift", "kotlin", "scala",
	"php", "perl", "lua", "haskell", "elixir", "clojure",
	"dart", "flutter", "react", "vue", "angular", "node",
	"deno", "bun", "nextjs", "nuxt", "svelte",
}

// DetectQueryIntent 检测查询意图
// 规则优先级从高到低，匹配即返回
func DetectQueryIntent(query string) QueryIntent {
	trimmed := strings.TrimSpace(query)
	if trimmed == "" {
		return QueryIntent{}
	}

	// 1. URL → 通用搜索
	if urlPattern.MatchString(trimmed) {
		return QueryIntent{QueryType: QueryTypeGeneral}
	}

	// 2. 货币转换
	if currencyPattern.MatchString(trimmed) {
		return QueryIntent{QueryType: QueryTypeGeneral, IsCurrency: true}
	}

	// 3. 天气
	if weatherPattern.MatchString(trimmed) || weatherCN.MatchString(trimmed) {
		return QueryIntent{QueryType: QueryTypeGeneral, IsWeather: true}
	}

	// 4. 翻译
	if translationPattern.MatchString(trimmed) || translationCN.MatchString(trimmed) {
		return QueryIntent{QueryType: QueryTypeGeneral, IsTranslation: true}
	}

	// 5. GitHub 仓库/代码搜索
	gh := detectGitHubQuery(trimmed)
	if gh.QueryType != "" {
		return gh
	}

	// 6. 代码/技术
	langPattern := regexp.MustCompile(`\b(` + strings.Join(languageNames, "|") + `)\b`)
	if codeKeywords.MatchString(trimmed) || langPattern.MatchString(trimmed) {
		return QueryIntent{QueryType: QueryTypeCode}
	}

	// 7. 学术
	if academicPattern.MatchString(trimmed) {
		return QueryIntent{QueryType: QueryTypeAcademic}
	}

	// 8. 购物/比价
	if shoppingPattern.MatchString(trimmed) || shoppingCN.MatchString(trimmed) {
		return QueryIntent{QueryType: QueryTypeShopping}
	}

	// 9. 视频（在新闻前检测）
	if videoPattern.MatchString(trimmed) || videoCN.MatchString(trimmed) {
		return QueryIntent{QueryType: QueryTypeVideo}
	}

	// 10. 新闻
	if newsPattern.MatchString(trimmed) || newsCN.MatchString(trimmed) {
		return QueryIntent{QueryType: QueryTypeNews}
	}

	// 默认：通用
	return QueryIntent{QueryType: QueryTypeGeneral}
}

func detectGitHubQuery(query string) QueryIntent {
	trimmed := strings.TrimSpace(query)
	if trimmed == "" {
		return QueryIntent{}
	}

	// GitHub URL
	if m := gitHubURLPattern.FindStringSubmatch(trimmed); m != nil {
		owner, repo := m[1], m[2]
		if strings.Contains(trimmed, "/issues") || strings.Contains(trimmed, "/pull") ||
			strings.Contains(trimmed, "issue") || strings.Contains(trimmed, "PR") {
			return QueryIntent{
				QueryType: QueryTypeCode, IsGitHubRepo: true, IsGitHubIssue: true,
				GitHubOwner: owner, GitHubRepo: repo,
			}
		}
		return QueryIntent{
			QueryType: QueryTypeCode, IsGitHubRepo: true,
			GitHubOwner: owner, GitHubRepo: repo,
		}
	}

	// repo: 限定符
	if m := gitHubCodeQualifier.FindStringSubmatch(trimmed); m != nil {
		return QueryIntent{
			QueryType: QueryTypeCode, IsGitHubRepo: true,
			GitHubOwner: m[1], GitHubRepo: m[2],
		}
	}

	// owner/repo 格式
	if m := gitHubRepoPattern.FindStringSubmatch(trimmed); m != nil {
		parts := strings.Split(trimmed, "/")
		owner, repo := parts[0], parts[1]
		if len(owner) >= 2 && len(repo) >= 2 && !strings.Contains(owner, ".") &&
			!strings.HasPrefix(trimmed, "http") {
			return QueryIntent{
				QueryType: QueryTypeCode, IsGitHubRepo: true,
				GitHubOwner: owner, GitHubRepo: repo,
			}
		}
	}

	return QueryIntent{}
}
