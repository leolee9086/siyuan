package api

import (
	"net/http"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/llm"
)

func listAIProfiles(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	store := model.GetProfileStore()
	if store == nil {
		ret.Data = map[string]interface{}{
			"profiles": []*model.Profile{},
			"active":   "",
		}
		return
	}

	profiles, err := store.List()
	if err != nil {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}

	activeID := llm.GetActiveProfileID()
	var activeProfile *model.Profile
	if activeID != "" {
		for _, p := range profiles {
			if p.ID == activeID {
				activeProfile = p
				break
			}
		}
	}

	for _, p := range profiles {
		models, err := store.ListModels(p.ID)
		if err == nil {
			for _, m := range models {
				if m != nil {
					p.Models = append(p.Models, *m)
				}
			}
		}
	}

	ret.Data = map[string]interface{}{
		"profiles":      profiles,
		"active":        activeID,
		"activeProfile": activeProfile,
	}
}

func upsertAIProfile(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	store := model.GetProfileStore()
	if store == nil {
		ret.Code = -1
		ret.Msg = "profile store not initialized"
		return
	}

	var p model.Profile
	if err := c.ShouldBindJSON(&p); err != nil {
		ret.Code = -1
		ret.Msg = "invalid request: " + err.Error()
		return
	}

	if p.Name == "" {
		ret.Code = -1
		ret.Msg = "name is required"
		return
	}

	if err := store.Upsert(&p); err != nil {
		ret.Code = -1
		ret.Msg = "upsert failed: " + err.Error()
		return
	}

	ret.Data = map[string]interface{}{
		"profile": &p,
	}
}

func deleteAIProfile(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	store := model.GetProfileStore()
	if store == nil {
		ret.Code = -1
		ret.Msg = "profile store not initialized"
		return
	}

	var req struct {
		ID string `json:"id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		ret.Code = -1
		ret.Msg = "invalid request: " + err.Error()
		return
	}

	activeID := llm.GetActiveProfileID()
	if req.ID == activeID {
		ret.Code = -1
		ret.Msg = "cannot delete active profile"
		return
	}

	if err := store.Delete(req.ID); err != nil {
		ret.Code = -1
		ret.Msg = "delete failed: " + err.Error()
		return
	}
}

func switchAIProfile(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	var req struct {
		ID string `json:"id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		ret.Code = -1
		ret.Msg = "invalid request: " + err.Error()
		return
	}

	if err := llm.SwitchProfile(req.ID); err != nil {
		ret.Code = -1
		ret.Msg = "switch failed: " + err.Error()
		return
	}

	ret.Data = map[string]interface{}{
		"active": llm.GetActiveProfileID(),
	}
}
