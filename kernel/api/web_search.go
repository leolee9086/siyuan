package api

import (
	"net/http"
	"strings"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	kernelwebsearch "github.com/siyuan-note/siyuan/kernel/websearch"
	shared "github.com/siyuan-note/siyuan/packages/websearch"
)

// webSearchRequest is the human-facing search contract. It intentionally
// mirrors the native web_search options without exposing runtime secrets.
type webSearchRequest struct {
	Query      string   `json:"query"`
	NumResults int      `json:"numResults"`
	QueryType  string   `json:"queryType"`
	TimeRange  string   `json:"timeRange"`
	Lang       string   `json:"lang"`
	Provider   string   `json:"provider"`
	SearchType string   `json:"searchType"`
	Livecrawl  bool     `json:"livecrawl"`
	Engines    []string `json:"engines"`
}

// webSearch serves the regular content-search UI. It is deliberately a
// separate API adapter from the Agent and MAGI executors, while sharing the
// same configured search service and real engine implementations.
func webSearch(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	req := &webSearchRequest{}
	if err := c.ShouldBindJSON(req); err != nil {
		ret.Code = -1
		ret.Msg = "invalid web search request: " + err.Error()
		return
	}
	query := strings.TrimSpace(req.Query)
	if query == "" {
		ret.Code = -1
		ret.Msg = "web search query is empty"
		return
	}

	opts := shared.DefaultSearchOptions()
	if req.NumResults > 0 {
		opts.NumResults = req.NumResults
	}
	if opts.NumResults > 50 {
		opts.NumResults = 50
	}
	opts.QueryType = strings.TrimSpace(req.QueryType)
	opts.TimeRange = strings.TrimSpace(req.TimeRange)
	opts.Lang = strings.TrimSpace(req.Lang)
	opts.Provider = shared.WebSearchProvider(strings.TrimSpace(req.Provider))
	opts.SearchType = strings.TrimSpace(req.SearchType)
	opts.Livecrawl = req.Livecrawl
	opts.Engines = req.Engines

	response, err := kernelwebsearch.NewService().Search(query, opts, nil)
	if err != nil {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}
	ret.Data = response
}
