// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package util

import (
	"net/http"
	"strings"
	"testing"
)

func TestIsWebFetchRetryable(t *testing.T) {
	cases := []struct {
		statusCode  int
		cfMitigated string
		want        bool
	}{
		{http.StatusOK, "", false},
		{http.StatusNotFound, "", false},
		{http.StatusForbidden, "", false},
		{http.StatusForbidden, "challenge", true},
		{http.StatusTooManyRequests, "", true},
		{http.StatusInternalServerError, "", true},
		{http.StatusBadGateway, "", true},
	}
	for _, c := range cases {
		if got := isWebFetchRetryable(c.statusCode, c.cfMitigated); got != c.want {
			t.Errorf("isWebFetchRetryable(%d, %q) = %v, want %v", c.statusCode, c.cfMitigated, got, c.want)
		}
	}
}

func TestConvertWebFetchHTML(t *testing.T) {
	engine := NewLute()
	htmlStr := "<html><body><h1>标题</h1><p>第一段</p></body></html>"

	md := convertWebFetchHTML(engine, htmlStr, "markdown")
	if !strings.Contains(md, "标题") || !strings.Contains(md, "第一段") {
		t.Errorf("markdown 转换结果异常: %q", md)
	}

	txt := convertWebFetchHTML(engine, htmlStr, "text")
	if !strings.Contains(txt, "标题") || !strings.Contains(txt, "第一段") {
		t.Errorf("text 转换结果异常: %q", txt)
	}

	// 畸形 HTML 不应 panic，且降级返回原始 HTML
	broken := "<html><div><span>未闭合"
	if got := convertWebFetchHTML(engine, broken, "markdown"); !strings.Contains(got, "未闭合") {
		t.Errorf("畸形 HTML 降级结果异常: %q", got)
	}
}

func TestExtractFallbackText(t *testing.T) {
	t.Run("noscript", func(t *testing.T) {
		htmlStr := `<html><body><noscript><div>请启用JavaScript或查看降级内容</div></noscript></body></html>`
		got := extractFallbackText(htmlStr)
		if !strings.Contains(got, "降级内容") {
			t.Errorf("noscript 提取失败: %q", got)
		}
	})

	t.Run("title_and_meta", func(t *testing.T) {
		htmlStr := `<html><head><title>页面标题</title><meta name="description" content="页面描述内容"></head></html>`
		got := extractFallbackText(htmlStr)
		if !strings.Contains(got, "页面标题") || !strings.Contains(got, "页面描述内容") {
			t.Errorf("title/meta 提取失败: %q", got)
		}
	})

	t.Run("json_ld", func(t *testing.T) {
		htmlStr := `<script type="application/ld+json">{"@type":"NewsArticle","headline":"测试标题","description":"一段描述","articleBody":"<p>正文第一段</p><p>正文第二段</p>"}</script>`
		got := extractFallbackText(htmlStr)
		for _, want := range []string{"测试标题", "一段描述", "正文第一段", "正文第二段"} {
			if !strings.Contains(got, want) {
				t.Errorf("JSON-LD 提取缺少 %q: %q", want, got)
			}
		}
	})

	t.Run("next_data", func(t *testing.T) {
		// 模拟 Next.js 站点（如澎湃新闻）正文位于 __NEXT_DATA__ 的 content 字段
		htmlStr := `<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"contentDetail":{"name":"标题","content":"\u003cp\u003e澎湃正文内容\u003c/p\u003e"}}}}</script>`
		got := extractFallbackText(htmlStr)
		if !strings.Contains(got, "澎湃正文内容") {
			t.Errorf("__NEXT_DATA__ 提取失败: %q", got)
		}
	})

	t.Run("empty", func(t *testing.T) {
		if got := extractFallbackText(`<html><body></body></html>`); got != "" {
			t.Errorf("空页面应返回空字符串, got %q", got)
		}
	})
}

func TestStripTagsAndEntities(t *testing.T) {
	got := stripTagsAndEntities(`<p>a &amp; b</p><script>var x=1;</script><style>.c{}</style><span>c</span>`)
	// 标签替换可能产生连续空白，只断言关键内容与实体解码结果
	for _, want := range []string{"a & b", "c"} {
		if !strings.Contains(got, want) {
			t.Errorf("stripTagsAndEntities 结果 %q 缺少 %q", got, want)
		}
	}
}

func TestTruncateRunes(t *testing.T) {
	got := truncateRunes("你好世界", 2)
	if !strings.Contains(got, "你好") || !strings.Contains(got, "truncated") {
		t.Errorf("truncateRunes 结果异常: %q", got)
	}
	if truncateRunes("short", 100) != "short" {
		t.Errorf("未超长时不应截断")
	}
}
