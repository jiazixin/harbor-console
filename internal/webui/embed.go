package webui

import (
	"embed"
	"io/fs"
)

//go:embed assets
var embeddedAssets embed.FS

func Files() (fs.FS, error) {
	return fs.Sub(embeddedAssets, "assets")
}

func ReadFile(name string) ([]byte, error) {
	return embeddedAssets.ReadFile("assets/" + name)
}
