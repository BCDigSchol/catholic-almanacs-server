# Catholic Almanacs map tiles: two images from one Dockerfile.
#
#   builder  downloads the open data and builds the tiles into /data
#            (docker compose run --rm tiles-build [base|detail|history])
#   server   Martin, serving whatever .pmtiles files are in /data, the label
#            fonts and the map styles (docker compose up -d tiles)
#
# The tiles live in a volume shared by the two, so rebuilding or restarting the
# server never rebuilds the tiles, and later layers (city detail, historical
# boundaries) are just more files in the same volume.

ARG MARTIN_VERSION=1.16.1

# ── builder ─────────────────────────────────────────────────────────────────
FROM ubuntu:24.04 AS builder
ARG TIPPECANOE_VERSION=2.79.0
ENV DEBIAN_FRONTEND=noninteractive

# gdal-bin: ogr2ogr clips the base map's sources to North America;
# osmium-tool, python3-shapely and the MySQL client cut the street detail out
# of OpenStreetMap around the places the database records
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential git ca-certificates curl jq unzip gdal-bin libsqlite3-dev zlib1g-dev \
      osmium-tool python3 python3-shapely default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch "${TIPPECANOE_VERSION}" https://github.com/felt/tippecanoe.git /tmp/tippecanoe \
    && make -C /tmp/tippecanoe -j"$(nproc)" \
    && make -C /tmp/tippecanoe install \
    && rm -rf /tmp/tippecanoe

COPY build.sh build-tiles.sh build-detail.sh build-history.sh make-area.py pick-regions.py history-features.py /tiles/
# /work keeps the downloads between runs (mount a volume there to reuse them)
ENV MAX_ZOOM=10 DETAIL_ZOOM=7
ENTRYPOINT ["bash", "/tiles/build.sh"]
CMD ["all"]

# ── fonts (Old Standard TT, OFL: the site's display face) ───────────────────
FROM ubuntu:24.04 AS fonts
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /fonts && for style in Regular Italic Bold; do \
      curl -fsSL --retry 3 -o "/fonts/OldStandard-${style}.ttf" \
        "https://raw.githubusercontent.com/google/fonts/main/ofl/oldstandardtt/OldStandard-${style}.ttf"; \
    done

# ── server ──────────────────────────────────────────────────────────────────
FROM ghcr.io/maplibre/martin:${MARTIN_VERSION} AS server
LABEL org.opencontainers.image.title="catholic-almanacs-tiles" \
      org.opencontainers.image.description="North American base map for the Catholic Almanacs, served by Martin" \
      org.opencontainers.image.source="https://github.com/BCDigSchol/catholic-almanacs"

# curl for the health check (the Martin image ships without one)
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=fonts /fonts /fonts
COPY styles /styles-src
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV TILES_PUBLIC_URL=http://localhost:8092 \
    ROUTE_PREFIX= \
    CACHE_SIZE_MB=128
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD curl -fsS "http://localhost:3000${ROUTE_PREFIX}/health" || exit 1
ENTRYPOINT ["/entrypoint.sh"]
