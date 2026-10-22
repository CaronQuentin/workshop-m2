# Règles WAF

L'image `owasp/modsecurity-crs:nginx-alpine` embarque déjà ModSecurity + OWASP CRS
(chargés via `/etc/modsecurity.d/setup.conf`), en mode blocage avec les variables
`PARANOIA`, `ANOMALY_INBOUND` et `ANOMALY_OUTBOUND` définies dans `docker-compose.yml`.

`custom.conf` contient nos règles additionnelles spécifiques au contexte paiement.
Pour les activer, montez ce fichier dans l'image :

```yaml
    volumes:
      - ./services/waf/rules/custom.conf:/etc/modsecurity.d/rules/RESPONSE-999-CUSTOM.conf:ro
```

(laissé optionnel pour ne pas interférer avec le réglage par défaut de l'image).
