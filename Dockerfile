FROM docker.io/library/golang:1.26.9-alpine3.23@sha256:6750308561953d451210ed1a8086d36c8c8bdcbf672d38d9d0d424b8a7a0216c AS build

WORKDIR /src
RUN apk add --no-cache nodejs npm
COPY go.mod go.sum ./
COPY web/package.json web/package-lock.json ./web/
RUN go mod download && npm --prefix web ci --ignore-scripts
COPY web ./web
COPY cmd ./cmd
COPY internal ./internal

ARG VERSION=dev
ARG COMMIT=unknown
ARG BUILD_DATE=unknown

RUN npm --prefix web run build && \
    CGO_ENABLED=0 go build -trimpath \
    -ldflags="-s -w -X harbor-console/internal/buildinfo.Version=${VERSION} -X harbor-console/internal/buildinfo.Commit=${COMMIT} -X harbor-console/internal/buildinfo.BuildDate=${BUILD_DATE}" \
    -o /out/harbor-console ./cmd/harbor-console

FROM gcr.io/distroless/static-debian12:nonroot@sha256:f5b485ea962d9bd1186b2f6b3a061191539b905b82ec395de78cbfae51f20e35

COPY --from=build /out/harbor-console /harbor-console
COPY configs/config.example.yaml /etc/harbor-console/config.yaml

ENV CONFIG_FILE=/etc/harbor-console/config.yaml \
    LISTEN=0.0.0.0 \
    PORT=8080

EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/harbor-console"]
