# Ansible — IaC et remédiation

## Rôle dans le dispositif
- `bootstrap.yml` : dépose les secrets dans Vault et vérifie la publication des services.
- `remediation/block_ip.yml` et `remediation/restart_service.yml` : **équivalent déclaratif**
  des actions du catalogue de remédiation (dossier §5).

## Choix d'architecture (à défendre devant le jury)
Pendant la démonstration en direct, le `remediation-engine` exécute les actions
**directement via l'API Docker** (à travers `docker-socket-proxy`), pour un délai de
reprise déterministe et court. Les playbooks Ansible ci-dessus décrivent les mêmes
opérations de façon reproductible et servent aux actions manuelles, au bootstrap et à
la documentation d'exploitation. On sépare ainsi la **boucle temps réel** (Python) de
l'**automatisation d'infrastructure** (Ansible), sans dupliquer la logique de décision.

## Prérequis
```bash
pip install ansible
ansible-galaxy collection install community.docker
```

## Exemples
```bash
ansible-playbook bootstrap.yml
ansible-playbook remediation/block_ip.yml -e ip=203.0.113.10
ansible-playbook remediation/restart_service.yml -e service=payment-api
```
