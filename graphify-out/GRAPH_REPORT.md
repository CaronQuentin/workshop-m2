# Graph Report - workshop m2  (2026-10-22)

## Corpus Check
- 64 files · ~23,025 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 30 file(s) not represented in the graph (top: (none) 13, .bat 5, .conf 3)

## Summary
- 527 nodes · 955 edges · 41 communities (22 shown, 19 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Frontend App (React Pages)
- Payment API Service
- Auth Service & Back-office 2FA
- ML Training & Face Recognition
- Anomaly Detection & Remediation
- Deployment & Ops Topology
- Frontend Build & Dependencies
- ESP8266 LED 2FA Firmware
- RAG Assistant Service
- Project Framing & Deliverables
- DoS Attack Scripts (k6)
- Workshop Timeline & Scoring
- Dev & Security Stack (Subject)
- Attack Kit Docs & Configs
- Infra & Observability (Subject)
- Demo Setup & Evaluation
- Governance & Risk (EBIOS/NIS2)
- Détails et preuves
- Local AI Assistant (RAG)
- conftest.py
- Smoke Test Script
- Attacker Kit Orchestrator
- SQLi Attack (Kit)
- SQLi Attack Script
- Log Pipeline Config
- Control Transaction Script
- Demo Script
- Mosquitto Entrypoint
- Auth Service Deps
- Face Auth Deps
- RAG Assistant Deps
- CLAUDE.md
- incident_report.py
- rapport-incident.sh
- backup_restore.sh
- run_tests.sh

## God Nodes (most connected - your core abstractions)
1. `PageTitle()` - 19 edges
2. `Alert()` - 17 edges
3. `react` - 16 edges
4. `api` - 15 edges
5. `Project Resilience-Alpha` - 13 edges
6. `WAF (ModSecurity/CRS)` - 12 edges
7. `react-router-dom` - 11 edges
8. `Spinner()` - 11 edges
9. `euros()` - 10 edges
10. `Login()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Attacker Kit README (LISEZMOI)` --conceptually_related_to--> `Prometheus Scrape Config`  [INFERRED]
  kit-attaquant/LISEZMOI.txt → Workshop2026-M2-Gn-Code/observability/prometheus/prometheus.yml
- `SWAP Front Index HTML` --conceptually_related_to--> `SWAP Payment Platform`  [INFERRED]
  Workshop2026-M2-Gn-Code/services/front/index.html → kit-attaquant/LISEZMOI.txt
- `SWAP Payment Platform` --conceptually_related_to--> `Payment API Requirements`  [INFERRED]
  kit-attaquant/LISEZMOI.txt → Workshop2026-M2-Gn-Code/services/payment-api/requirements.txt
- `Attacker Kit README (LISEZMOI)` --conceptually_related_to--> `Remediation Engine Requirements`  [INFERRED]
  kit-attaquant/LISEZMOI.txt → Workshop2026-M2-Gn-Code/services/remediation-engine/requirements.txt
- `Attacker Kit README (LISEZMOI)` --conceptually_related_to--> `WAF Rules README`  [INFERRED]
  kit-attaquant/LISEZMOI.txt → Workshop2026-M2-Gn-Code/services/waf/rules/README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Parcours 2FA back-office (face-auth + MQTT + LED ESP8266)** — workshop2026_m2_gn_code_docker_compose_auth_service, workshop2026_m2_gn_code_docker_compose_face_auth, workshop2026_m2_gn_code_docker_compose_mosquitto, workshop2026_m2_gn_code_esp8266_led_readme_esp8266_led, workshop2026_m2_gn_code_esp8266_led_readme_topic_backoffice_led [EXTRACTED 0.85]
- **Boucle de reprise autonome (détection → remédiation → preuve)** — workshop2026_m2_gn_code_docker_compose_anomaly_detector, workshop2026_m2_gn_code_docker_compose_remediation_engine, workshop2026_m2_gn_code_docker_compose_docker_socket_proxy, workshop2026_m2_gn_code_docker_compose_waf, workshop2026_m2_gn_code_readme_control_transaction [EXTRACTED 0.90]
- **Stack d'observabilité (Prometheus + Loki + Promtail + Grafana)** — workshop2026_m2_gn_code_docker_compose_prometheus, workshop2026_m2_gn_code_docker_compose_loki, workshop2026_m2_gn_code_docker_compose_promtail, workshop2026_m2_gn_code_docker_compose_grafana [EXTRACTED 0.90]
- **Chaîne de reprise autonome (détection -> décision -> action -> vérification)** — 2627_workshop_bac_5___sujet_project_resilience_alpha_1_attack_scenario, 2627_workshop_bac_5___sujet_project_resilience_alpha_1_detection_ml, 2627_workshop_bac_5___sujet_project_resilience_alpha_1_remediation_engine, 2627_workshop_bac_5___sujet_project_resilience_alpha_1_supervision_dashboard [EXTRACTED 1.00]
- **Cinq piliers obligatoires d'une plateforme unique** — 2627_workshop_bac_5___sujet_project_resilience_alpha_1_domain_development, 2627_workshop_bac_5___sujet_project_resilience_alpha_1_domain_infrastructure, 2627_workshop_bac_5___sujet_project_resilience_alpha_1_domain_ia_data, 2627_workshop_bac_5___sujet_project_resilience_alpha_1_domain_cybersecurity, 2627_workshop_bac_5___sujet_project_resilience_alpha_1_domain_transformation [EXTRACTED 1.00]
- **Déroulé du sprint (lundi à vendredi)** — 2627_workshop_bac_5___sujet_project_resilience_alpha_1_lundi_kickoff, 2627_workshop_bac_5___sujet_project_resilience_alpha_1_mardi_production, 2627_workshop_bac_5___sujet_project_resilience_alpha_1_mercredi_integration, 2627_workshop_bac_5___sujet_project_resilience_alpha_1_jeudi_recette, 2627_workshop_bac_5___sujet_project_resilience_alpha_1_vendredi_jury [EXTRACTED 1.00]
- **Attack / Detection / Remediation Resilience Flow** — kit_attaquant_lisezmoi, workshop2026_m2_gn_code_services_anomaly_detector_requirements, workshop2026_m2_gn_code_services_remediation_engine_requirements, workshop2026_m2_gn_code_tests_results_readme [INFERRED 0.75]
- **Observability Stack (Loki/Prometheus/Promtail)** — workshop2026_m2_gn_code_observability_loki_loki_config, workshop2026_m2_gn_code_observability_prometheus_prometheus, workshop2026_m2_gn_code_observability_promtail_promtail_config [INFERRED 0.85]

## Communities (41 total, 19 thin omitted)

### Community 0 - "Frontend App (React Pages)"
Cohesion: 0.07
Nodes (60): react, react-router-dom, api, euros(), FIELD_FR, formatDetail(), getToken(), request() (+52 more)

### Community 1 - "Payment API Service"
Cohesion: 0.08
Nodes (22): Base, Beneficiary, init_db(), Payment, account(), add_beneficiary(), BeneficiaryIn, create_payment() (+14 more)

### Community 2 - "Auth Service & Back-office 2FA"
Cohesion: 0.09
Nodes (22): backoffice_enroll(), backoffice_face(), backoffice_login(), backoffice_status(), BackofficeLoginIn, Base, _blocked_remaining(), _bo_state() (+14 more)

### Community 3 - "ML Training & Face Recognition"
Cohesion: 0.10
Nodes (14): collect_from_prometheus(), main(), simulate_attack(), simulate_normal(), decode_image(), encode_face(), enroll(), EnrollIn (+6 more)

### Community 4 - "Anomaly Detection & Remediation"
Cohesion: 0.06
Nodes (39): collect_features(), dominant_ip(), load_or_bootstrap(), main(), prom(), alert(), Alert, _attack_start() (+31 more)

### Community 5 - "Deployment & Ops Topology"
Cohesion: 0.09
Nodes (33): Bootstrap Playbook, Block IP Playbook, Restart Service Playbook, anomaly-detector (Isolation Forest), auth-service, docker-socket-proxy, face-auth (Facial Recognition), Front (SPA React/Tailwind) (+25 more)

### Community 6 - "Frontend Build & Dependencies"
Cohesion: 0.07
Nodes (26): autoprefixer, postcss, react-dom, recharts, tailwindcss, vite, @vitejs/plugin-react, dependencies (+18 more)

### Community 7 - "ESP8266 LED 2FA Firmware"
Cohesion: 0.18
Nodes (12): connectMqtt(), LedState, GREEN_30S, GREEN_BLINK, OFF, RED_30S, RED_BLINK_10, loop() (+4 more)

### Community 8 - "RAG Assistant Service"
Cohesion: 0.16
Nodes (8): ask(), Ask, build_index(), health(), live_context(), load_documents(), _prom(), tfidf_search()

### Community 9 - "Project Framing & Deliverables"
Cohesion: 0.15
Nodes (12): Consortium (équipe de 5), Cyber-résilience et reprise autonome, Code.zip (sources et déploiement), Dossier.pdf (ingénierie et gouvernance), Pres.pptx (support de présentation), Direction Nationale de la Sûreté Numérique, EPSI - Direction Pédagogique Nationale, Formations EPSI (ECSI, EID, ECDPIA, EISI, MSM) (+4 more)

### Community 10 - "DoS Attack Scripts (k6)"
Cohesion: 0.15
Nodes (4): options, options, options, options

### Community 11 - "Workshop Timeline & Scoring"
Cohesion: 0.18
Nodes (12): AIOps, Scénario d'attaque contrôlé, Chaos engineering / injection de défaillances, Clip Chrono (VidChrono.mp4), Détection d'anomalies par Machine Learning, Finale nationale, Jeudi - Recette, chaos engineering et rendus, Mercredi - Intégration et premiers essais (+4 more)

### Community 12 - "Dev & Security Stack (Subject)"
Cohesion: 0.22
Nodes (11): Node.js / Python FastAPI / Go, Domaine Cybersécurité, Domaine Développement, Microservices conteneurisés, React / Tailwind CSS, Red Team / Blue Team, Moteur de rémediation, SIEM / SOC (+3 more)

### Community 13 - "Attack Kit Docs & Configs"
Cohesion: 0.22
Nodes (10): Attacker Kit README (LISEZMOI), OWASP CRS ModSecurity WAF, SWAP Payment Platform, Prometheus Scrape Config, Anomaly Detector Requirements, SWAP Front Index HTML, Payment API Requirements, Remediation Engine Requirements (+2 more)

### Community 14 - "Infra & Observability (Subject)"
Cohesion: 0.29
Nodes (7): Ansible, Docker Compose, Domaine Infrastructure, Grafana, Loki, Mardi - Production, IaC et modèles IA, Prometheus

### Community 15 - "Demo Setup & Evaluation"
Cohesion: 0.29
Nodes (7): Démonstrateur, Cadre d'évaluation, Grille jury local (5 axes, 20 pts, coef 2), Suivi individuel (20 pts, coef 1), PC Attaquant, PC Hôte, Point d'accès Wi-Fi RESILIENCE-G<n>

### Community 16 - "Governance & Risk (EBIOS/NIS2)"
Cohesion: 0.29
Nodes (7): Domaine IA / Data, Domaine Gouvernance et Transformation, EBIOS Risk Manager, Cinq domaines obligatoires, Lundi - Kick-off (architecture et EBIOS), NIS2 / DORA, PCA / PRA

### Community 17 - "Détails et preuves"
Cohesion: 0.18
Nodes (10): 1 — Tests unitaires API et auth ✅, 2 — Parcours de paiement bout en bout ✅, 3 — Faux positifs du modèle 🟡, 4 — Reprise après flood 🟡 (RTO conforme mesuré), 5 — Arrêt brutal de `payment-api` ⏳, 6 — Injection SQL ✅, 7 — Redéploiement à neuf 🟡, 8 — Sauvegarde et restauration 🟡 (+2 more)

### Community 18 - "Local AI Assistant (RAG)"
Cohesion: 0.33
Nodes (5): PC de délestage IA (facultatif), LangChain, Assistant IA local (RAG), Ollama, RAG (Retrieval-Augmented Generation)

### Community 19 - "conftest.py"
Cohesion: 0.38
Nodes (3): auth_headers(), base(), token()

### Community 37 - "incident_report.py"
Cohesion: 0.23
Nodes (8): attack_start(), find_incident(), fmt(), _get(), main(), parse_ts(), prom_range(), prom_scalar()

### Community 39 - "backup_restore.sh"
Cohesion: 1.00
Nodes (3): ex(), fingerprint(), backup_restore.sh script

## Knowledge Gaps
- **55 isolated node(s):** `OFF`, `GREEN_BLINK`, `GREEN_30S`, `RED_BLINK_10`, `RED_30S` (+50 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 200 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Frontend App (React Pages)` to `Frontend Build & Dependencies`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `OFF`, `GREEN_BLINK`, `GREEN_30S` to the rest of the system?**
  _55 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend App (React Pages)` be split into smaller, more focused modules?**
  _Cohesion score 0.06639427987742594 - nodes in this community are weakly interconnected._
- **Why does `Cinq domaines obligatoires` connect `Governance & Risk (EBIOS/NIS2)` to `Project Framing & Deliverables`, `Dev & Security Stack (Subject)`, `Infra & Observability (Subject)`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Should `Payment API Service` be split into smaller, more focused modules?**
  _Cohesion score 0.08478513356562137 - nodes in this community are weakly interconnected._
- **Why does `Project Resilience-Alpha` connect `Project Framing & Deliverables` to `Governance & Risk (EBIOS/NIS2)`, `Workshop Timeline & Scoring`, `Demo Setup & Evaluation`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Should `Auth Service & Back-office 2FA` be split into smaller, more focused modules?**
  _Cohesion score 0.08826945412311266 - nodes in this community are weakly interconnected._