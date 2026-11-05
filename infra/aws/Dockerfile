ARG CREW_BASE_IMAGE
FROM ${CREW_BASE_IMAGE}
USER root
RUN curl --fail --silent --show-error --proto '=https' --tlsv1.2 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o /etc/ssl/certs/crew-rds-global.pem
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/crew-rds-global.pem
USER node
