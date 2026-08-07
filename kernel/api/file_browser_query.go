package api

import (
	"net/http"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/assetmeta"
	"github.com/siyuan-note/siyuan/kernel/filequery"
)

// newFileBrowserQueryService is the API composition seam; authorization and index search remain separate domains.
var newFileBrowserQueryService = func() *filequery.Service {
	browser := newFileBrowserService()
	return filequery.NewService(browser, assetmeta.SearchAssetsAdvanced, browser)
}

// searchSForgeFileBrowserAssets serves tag, keyword, numeric and palette queries scoped by authorized browser roots.
func searchSForgeFileBrowserAssets(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	var request assetmeta.SearchRequest
	if !decodeFileBrowserRequest(c, ret, &request) {
		return
	}
	result, err := newFileBrowserQueryService().Search(c.Request.Context(), request)
	if err != nil {
		ret.Code = fileBrowserErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = result
}

// listSForgeFileBrowserTags returns counts from the authorized file-browser roots.
func listSForgeFileBrowserTags(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	var request filequery.TagRequest
	if !decodeFileBrowserRequest(c, ret, &request) {
		return
	}
	result, err := newFileBrowserQueryService().TagCounts(c.Request.Context(), request)
	if err != nil {
		ret.Code = fileBrowserErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = result
}
