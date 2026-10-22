FROM eclipse-mosquitto:2
COPY entrypoint.sh /entrypoint.sh
USER root
RUN chmod +x /entrypoint.sh
USER mosquitto
ENTRYPOINT ["/entrypoint.sh"]
