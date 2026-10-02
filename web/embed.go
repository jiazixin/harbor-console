package webui

import (
	"embed"
	"io/fs"
)

//go:embed dist
var embeddedAssets embed.FS

func Files() (fs.FS, error) {
	return fs.Sub(embeddedAssets, "dist")
}

func ReadFile(name string) ([]byte, error) {
	return embeddedAssets.ReadFile("dist/" + name)
}
