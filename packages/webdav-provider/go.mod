module github.com/siyuan-note/siyuan/packages/webdav-provider

go 1.24

require (
	github.com/emersion/go-webdav v0.7.0
	github.com/siyuan-note/siyuan/packages/external-provider-contract v0.0.0
)

replace github.com/siyuan-note/siyuan/packages/external-provider-contract => ../external-provider-contract
