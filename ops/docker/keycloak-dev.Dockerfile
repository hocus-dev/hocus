# this Dockerfile is used to optimize the startup time of Keycloak
# in the development environment
FROM quay.io/keycloak/keycloak:19.0.2

ENV KC_HEALTH_ENABLED=true
ENV KC_DB=postgres
ENV KC_DB_URL=jdbc:postgresql://db:5432/keycloak
ENV KC_DB_USERNAME=postgres
ENV KC_DB_PASSWORD=pass
ENV KC_HOSTNAME=localhost:4200
ENV KC_HTTP_ENABLED=true
ENV KC_PROXY=edge
ENV KC_SPI_THEME_CACHE_THEMES=false
ENV KC_SPI_THEME_CACHE_TEMPLATES=false
ENV KC_SPI_THEME_STATIC_MAX_AGE=-1
ENV KC_CACHE=local
ENV KC_HOSTNAME_STRICT=false
ENV KC_HOSTNAME_STRICT_HTTPS=false
WORKDIR /opt/keycloak

RUN /opt/keycloak/bin/kc.sh build
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
