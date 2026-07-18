package api

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestMagiIdentityStorePasswordStoredAsHash(t *testing.T) {
	oldConf := model.Conf
	oldConfDir := util.ConfDir
	oldStore := globalMagiIdentityStore
	defer func() {
		model.Conf = oldConf
		util.ConfDir = oldConfDir
		globalMagiIdentityStore = oldStore
	}()

	tempDir := t.TempDir()
	util.ConfDir = tempDir
	model.Conf = model.NewAppConf()
	model.Conf.Api = &conf.API{Token: "workspace-token"}
	globalMagiIdentityStore = &magiIdentityStore{}

	const rawPassword = "Family@12345"
	record, err := globalMagiIdentityStore.upsert(
		"alice",
		"Alice",
		"",
		rawPassword,
		magiRouteClassGuardian,
		true,
		0,
		nil,
	)
	if err != nil {
		t.Fatalf("upsert identity failed: %v", err)
	}
	if record.PasswordHash == "" {
		t.Fatal("password hash should not be empty")
	}
	if record.PasswordHash == rawPassword {
		t.Fatal("password must not be stored in plaintext")
	}

	storePath := filepath.Join(tempDir, "magi-identities.json")
	rawFile, readErr := os.ReadFile(storePath)
	if readErr != nil {
		t.Fatalf("read store file failed: %v", readErr)
	}
	if strings.Contains(string(rawFile), rawPassword) {
		t.Fatal("store file must not contain plaintext password")
	}
}
