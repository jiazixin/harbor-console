// Package buildinfo holds the running binary's version metadata for the API
// and logs; cmd/harbor-console fills it at startup.
package buildinfo

var (
	Version   = "dev"
	Commit    = "unknown"
	BuildDate = "unknown"
)
