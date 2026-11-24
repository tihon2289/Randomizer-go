FROM golang:1.27.4-alpine AS build

WORKDIR /src
COPY go.mod *.go ./
COPY web ./web
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/randomizer .

FROM scratch

COPY --from=build /out/randomizer /randomizer
USER 65532:65532
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/randomizer"]
