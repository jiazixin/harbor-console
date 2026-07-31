FROM golang:1.24-alpine AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY main.go control.go demo.go demo_control.go ./
COPY config.go logging.go ./
COPY web ./web
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/harbor-console .

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=build /out/harbor-console /harbor-console
COPY config.yaml /config.yaml
ENV CONFIG_FILE=/config.yaml \
    LISTEN=0.0.0.0 \
    PORT=8080
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/harbor-console"]
