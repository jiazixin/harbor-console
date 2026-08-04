APP_NAME := harbor-console
COMMAND := ./cmd/harbor-console
BIN_DIR := bin
GO_VERSION := $(shell sed -n 's/^go //p' go.mod)
VERSION ?= dev
COMMIT ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)
BUILD_DATE ?= $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
LDFLAGS := -s -w \
	-X harbor-console/internal/buildinfo.Version=$(VERSION) \
	-X harbor-console/internal/buildinfo.Commit=$(COMMIT) \
	-X harbor-console/internal/buildinfo.BuildDate=$(BUILD_DATE)
GO_FILES := $(shell find . -type f -name '*.go' \
	-not -path './vendor/*' \
	-not -path './node_modules/*' \
	-not -path './frontend/node_modules/*')
GO_PACKAGES := $(shell go list ./... | grep -v '/node_modules/')

.PHONY: all build run format format-check whitespace-check deployment-check mod-check test test-race coverage vet frontend-build frontend-check frontend-test browser-test security-check check docker-build clean

all: check

build: frontend-build
	mkdir -p $(BIN_DIR)
	CGO_ENABLED=0 go build -trimpath -ldflags="$(LDFLAGS)" -o $(BIN_DIR)/$(APP_NAME) $(COMMAND)

run:
	go run $(COMMAND)

format:
	gofmt -w $(GO_FILES)

format-check:
	@test -z "$$(gofmt -l $(GO_FILES))" || { \
		echo "Go files require formatting:"; \
		gofmt -l $(GO_FILES); \
		exit 1; \
	}

whitespace-check:
	node scripts/check-whitespace.mjs

deployment-check:
	node scripts/check-deployment-pins.mjs

mod-check:
	go mod tidy -diff

test:
	go test $(GO_PACKAGES) -count=1

test-race:
	go test -race $(GO_PACKAGES) -count=1

coverage:
	go test $(GO_PACKAGES) -coverprofile=coverage.out -count=1
	go tool cover -func=coverage.out

vet:
	go vet $(GO_PACKAGES)

frontend-check:
	npm run check

frontend-test:
	npm test

browser-test: frontend-build
	npm run test:browser

security-check:
	npm run audit
	GOTOOLCHAIN=go$(GO_VERSION) go run golang.org/x/vuln/cmd/govulncheck@v1.6.0 $(GO_PACKAGES)

frontend-build:
	npm run build

check: format-check whitespace-check deployment-check mod-check vet test-race frontend-check frontend-test frontend-build build

docker-build:
	docker build \
		--build-arg VERSION=$(VERSION) \
		--build-arg COMMIT=$(COMMIT) \
		--build-arg BUILD_DATE=$(BUILD_DATE) \
		--tag $(APP_NAME):$(VERSION) .

clean:
	rm -rf $(BIN_DIR) coverage.out
