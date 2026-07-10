package websearch

import (
	"regexp"
	"strconv"
	"strings"
)

// ── 价格信息 ──────────────────────────────────────────

// PriceInfo 价格信息
type PriceInfo struct {
	Price         *float64
	OriginalPrice *float64
	Source        string
	Title         string
	URL           string
	Snippet       string
}

// PriceStats 价格统计数据
type PriceStats struct {
	Cheapest       CheapEntry
	MostExpensive  CheapEntry
	Spread         float64
	SpreadPercent  float64
	PricedCount    int
	ByPlatform     map[string]PlatformRange
}

// CheapEntry 最便宜/最贵条目
type CheapEntry struct {
	Price  float64
	Source string
	Title  string
	URL    string
}

// PlatformRange 平台价格区间
type PlatformRange struct {
	Min   float64
	Max   float64
	Count int
}

// ── 价格提取 ──────────────────────────────────────────

var (
	cnyRegex   = regexp.MustCompile(`[¥￥]\s*(\d+(?:\.\d{1,2})?)`)
	yuanRegex  = regexp.MustCompile(`(\d+(?:\.\d{1,2})?)\s*元`)
	usdRegex   = regexp.MustCompile(`\$\s*(\d+(?:\.\d{1,2})?)`)
	commaRegex = regexp.MustCompile(`,(\d{3})`)
)

// DetectPrice 从文本中提取价格（元）
// 支持格式：¥123.00 / ¥2,599 / 123元 / $123.45（按 7.2 汇率折算）
func DetectPrice(text string) *float64 {
	if text == "" {
		return nil
	}
	cleaned := strings.TrimSpace(text)
	// 移除千位分隔符
	normalized := commaRegex.ReplaceAllString(cleaned, "$1")

	// 人民币: ¥123.00
	if m := cnyRegex.FindStringSubmatch(normalized); m != nil {
		if v, err := strconv.ParseFloat(m[1], 64); err == nil {
			return &v
		}
	}

	// 数字 + 元
	if m := yuanRegex.FindStringSubmatch(normalized); m != nil {
		if v, err := strconv.ParseFloat(m[1], 64); err == nil {
			return &v
		}
	}

	// 美元: $123.45 → 按 7.2 汇率折算
	if m := usdRegex.FindStringSubmatch(normalized); m != nil {
		if v, err := strconv.ParseFloat(m[1], 64); err == nil {
			v *= 7.2
			return &v
		}
	}

	return nil
}

// FormatPrice 格式化价格为人民币显示字符串
func FormatPrice(price float64) string {
	intPart := int(price)
	decPart := int((price - float64(intPart)) * 100)
	intStr := strconv.Itoa(intPart)
	// 千位分隔符
	var parts []string
	for i, c := range intStr {
		if i > 0 && (len(intStr)-i)%3 == 0 {
			parts = append(parts, ",")
		}
		parts = append(parts, string(c))
	}
	return "¥" + strings.Join(parts, "") + "." + pad2(decPart)
}

// ExtractPrices 从聚合结果中提取价格信息
func ExtractPrices(results []AggregatedResult) []PriceInfo {
	infos := make([]PriceInfo, 0, len(results))
	for _, r := range results {
		fullText := r.Title + " " + r.Snippet
		price := DetectPrice(fullText)
		source := extractSource(r.URL)
		infos = append(infos, PriceInfo{
			Price:   price,
			Title:   priceTitleRegex.ReplaceAllString(r.Title, ""),
			URL:     r.URL,
			Source:  source,
			Snippet: r.Snippet,
		})
	}
	return infos
}

var priceTitleRegex = regexp.MustCompile(`[¥￥]\s*\d+(?:[.,]\d{1,2})?`)

// ComputeStats 计算价格统计信息
func ComputeStats(prices []PriceInfo) *PriceStats {
	var priced []PriceInfoWithPrice
	for _, p := range prices {
		if p.Price != nil {
			priced = append(priced, PriceInfoWithPrice{PriceInfo: p, Price: *p.Price})
		}
	}
	if len(priced) < 1 {
		return nil
	}

	// 按平台分组
	byPlatform := make(map[string]PlatformRange)
	for _, p := range priced {
		pr := byPlatform[p.Source]
		if pr.Min == 0 || p.Price < pr.Min {
			pr.Min = p.Price
		}
		if pr.Max == 0 || p.Price > pr.Max {
			pr.Max = p.Price
		}
		pr.Count++
		byPlatform[p.Source] = pr
	}

	// 排序找极值
	sorted := make([]PriceInfoWithPrice, len(priced))
	copy(sorted, priced)
	for i := 0; i < len(sorted); i++ {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[j].Price < sorted[i].Price {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}

	cheapest := sorted[0]
	mostExpensive := sorted[len(sorted)-1]
	spread := mostExpensive.Price - cheapest.Price
	spreadPercent := 0.0
	if cheapest.Price > 0 {
		spreadPercent = spread / cheapest.Price * 100
	}

	return &PriceStats{
		Cheapest:      CheapEntry{Price: cheapest.Price, Source: cheapest.Source, Title: cheapest.Title, URL: cheapest.URL},
		MostExpensive: CheapEntry{Price: mostExpensive.Price, Source: mostExpensive.Source, Title: mostExpensive.Title, URL: mostExpensive.URL},
		Spread:        spread, SpreadPercent: spreadPercent, PricedCount: len(priced),
		ByPlatform: byPlatform,
	}
}

type PriceInfoWithPrice struct {
	PriceInfo
	Price float64
}

// FormatShoppingReport 生成购物比价结构化报告
func FormatShoppingReport(results []AggregatedResult, query string) string {
	if len(results) == 0 {
		return ""
	}

	var shopping, other []AggregatedResult
	for _, r := range results {
		if r.Category == "shopping" {
			shopping = append(shopping, r)
		} else {
			other = append(other, r)
		}
	}

	var sections []string
	sections = append(sections, "## 比价报告: \""+query+"\"\n")

	priceInfos := ExtractPrices(shopping)
	stats := ComputeStats(priceInfos)

	if stats != nil {
		sections = append(sections,
			"### 价格总览\n"+
				"- **含价格商品**: "+strconv.Itoa(stats.PricedCount)+" 条\n"+
				"- **最低价**: "+FormatPrice(stats.Cheapest.Price)+" — "+stats.Cheapest.Source+"\n"+
				"- **最高价**: "+FormatPrice(stats.MostExpensive.Price)+" — "+stats.MostExpensive.Source+"\n")
		if stats.PricedCount >= 2 {
			sections[len(sections)-1] += "- **价差**: " + FormatPrice(stats.Spread) + " (" +
				strconv.FormatFloat(stats.SpreadPercent, 'f', 1, 64) + "%)\n"
		}

		if len(stats.ByPlatform) > 1 {
			platformLines := "### 各平台价格区间\n"
			for source, pr := range stats.ByPlatform {
				if pr.Min == pr.Max {
					platformLines += "- **" + source + "**: " + FormatPrice(pr.Min) + " (" + strconv.Itoa(pr.Count) + " 条)\n"
				} else {
					platformLines += "- **" + source + "**: " + FormatPrice(pr.Min) + " ~ " + FormatPrice(pr.Max) + " (" + strconv.Itoa(pr.Count) + " 条)\n"
				}
			}
			sections = append(sections, platformLines)
		}

		sections = append(sections,
			"### 🏆 推荐\n"+
				"- **"+stats.Cheapest.Title+"**\n"+
				"- 价格: **"+FormatPrice(stats.Cheapest.Price)+"** — "+stats.Cheapest.Source+"\n"+
				"- 链接: "+stats.Cheapest.URL+"\n")
	} else {
		sections = append(sections, "未从商品信息中提取到明确价格。\n")
	}

	// 全部商品
	itemLines := make([]string, 0, len(priceInfos))
	for i, p := range priceInfos {
		priceStr := "价格待询"
		if p.Price != nil {
			priceStr = FormatPrice(*p.Price)
		}
		itemLines = append(itemLines, strconv.Itoa(i+1)+". ["+p.Source+"] "+p.Title+"\n   💰 "+priceStr+"\n   🔗 "+p.URL)
	}
	sections = append(sections, "### 全部商品 ("+strconv.Itoa(len(shopping))+" 条)\n"+strings.Join(itemLines, "\n\n"))

	if len(other) > 0 {
		otherLines := make([]string, 0, len(other))
		for i, r := range other {
			if i >= 3 {
				break
			}
			otherLines = append(otherLines, strconv.Itoa(i+1)+". "+r.Title+"\n   "+r.URL+"\n   "+r.Snippet)
		}
		sections = append(sections, "\n### 其他相关信息 ("+strconv.Itoa(len(other))+" 条)\n"+strings.Join(otherLines, "\n\n"))
	}

	return strings.Join(sections, "\n\n")
}

// extractSource 从 URL 中提取来源名称
func extractSource(rawURL string) string {
	hostname := ExtractDomain(rawURL)
	mapping := map[string]string{
		"smzdm.com": "什么值得买", "jd.com": "京东", "taobao.com": "淘宝",
		"tmall.com": "天猫", "pinduoduo.com": "拼多多", "yangkeduo.com": "拼多多",
		"suning.com": "苏宁易购", "gome.com.cn": "国美", "amazon.cn": "亚马逊中国",
		"amazon.com": "Amazon.com", "ebay.com": "eBay", "vip.com": "唯品会",
		"1688.com": "1688批发", "dangdang.com": "当当", "kaola.com": "考拉海购",
	}
	if v, ok := mapping[hostname]; ok {
		return v
	}
	return hostname
}
