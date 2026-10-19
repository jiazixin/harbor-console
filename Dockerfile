FROM docker.io/library/golang:1.27.2-alpine3.23@sha256:9e45f0eb4a63ed37ad6e604950407558b7c738e34e015ae77a5d4ad369cde079 AS build

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

FROM gcr.io/distroless/static-debian12:nonroot@sha256:afa5c872c891853ca7fcf1f12c3edb23f7eeef36189728842dd51042ff57f7ab

COPY --from=build /out/harbor-console /harbor-console
COPY configs/config.example.yaml /etc/harbor-console/config.yaml

ENV CONFIG_FILE=/etc/harbor-console/config.yaml \
    LISTEN=0.0.0.0 \
    PORT=8080

EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/harbor-console"]
