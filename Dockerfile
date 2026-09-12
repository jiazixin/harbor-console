FROM docker.io/library/golang:1.26.6-alpine3.23@sha256:e57c41c1d5864341031181b0db34b9a537bb5773eb6428e4e5bdaea0f9135406 AS build

WORKDIR /src
RUN apk add --no-cache nodejs npm
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY frontend ./frontend
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal

RUN npm run build

ARG VERSION=dev
ARG COMMIT=unknown
ARG BUILD_DATE=unknown

RUN CGO_ENABLED=0 go build -trimpath \
    -ldflags="-s -w \
      -X harbor-console/internal/buildinfo.Version=${VERSION} \
      -X harbor-console/internal/buildinfo.Commit=${COMMIT} \
      -X harbor-console/internal/buildinfo.BuildDate=${BUILD_DATE}" \
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
