package api

import (
	"net/http"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/fileprovider"
)

func probeFileBrowserProvider(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	provider := fileprovider.ProviderID(c.Query("provider"))
	if provider == "" {
		ret.Code = http.StatusBadRequest
		ret.Msg = fileprovider.ErrInvalidProviderRequest.Error()
		return
	}
	status, err := newFileBrowserProviderRegistry().ProbeProvider(c.Request.Context(), provider)
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = status
}
