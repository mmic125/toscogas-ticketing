#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Setup server Hetzner — Ubuntu 24.04
# NIS2 compliant: firewall, fail2ban, TLS, Docker, audit
# Eseguire come root sul server: bash setup-hetzner.sh
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Uso: $0 <dominio> <email-letsencrypt>"
  echo "Es:  $0 ticketing.toscogas.it admin@toscogas.it"
  exit 1
fi

echo "▶ Aggiornamento sistema..."
apt-get update -qq
apt-get upgrade -y -qq

echo "▶ Pacchetti essenziali..."
apt-get install -y -qq \
  ufw fail2ban curl wget git unzip \
  ca-certificates gnupg lsb-release \
  certbot python3-certbot-nginx

# ── Firewall UFW ──────────────────────────────────────────────
echo "▶ Configurazione UFW..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

# ── SSH hardening ─────────────────────────────────────────────
echo "▶ Hardening SSH..."
sed -i 's/#PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication.*/PasswordAuthentication no/'  /etc/ssh/sshd_config
sed -i 's/#MaxAuthTries.*/MaxAuthTries 3/'                       /etc/ssh/sshd_config
systemctl reload ssh

# ── Fail2ban (NIS2: protezione brute force) ───────────────────
echo "▶ Configurazione Fail2ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5
backend  = systemd

[sshd]
enabled  = true
port     = ssh
maxretry = 3
bantime  = 86400

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled  = true
filter   = nginx-limit-req
logpath  = /var/log/nginx/error.log
maxretry = 10
EOF
systemctl enable --now fail2ban

# ── Sysctl hardening (NIS2: sicurezza rete) ───────────────────
echo "▶ Hardening kernel..."
cat >> /etc/sysctl.d/99-nis2.conf << 'EOF'
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.log_martians = 1
kernel.dmesg_restrict = 1
EOF
sysctl --system -q

# ── Docker ────────────────────────────────────────────────────
echo "▶ Installazione Docker..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin

systemctl enable --now docker

# Hardening daemon Docker
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "12" },
  "no-new-privileges": true,
  "userland-proxy": false
}
EOF
systemctl restart docker

# ── Struttura directory ───────────────────────────────────────
echo "▶ Creazione struttura..."
mkdir -p /opt/toscogas/{secrets,database,nginx,backend,scripts,frontend}
chmod 700 /opt/toscogas/secrets

# ── Certificato TLS (Let's Encrypt) ──────────────────────────
echo "▶ Certificato TLS per $DOMAIN..."
certbot certonly --standalone \
  --non-interactive --agree-tos \
  --email "$EMAIL" \
  -d "$DOMAIN"

# Rinnovo automatico
echo "0 3 * * * root certbot renew --quiet --deploy-hook 'docker compose -f /opt/toscogas/docker-compose.yml restart nginx'" \
  > /etc/cron.d/certbot-renew

# ── Genera chiavi RSA 2048 (JWT RS256 — SHA-256) ─────────────
echo "▶ Generazione chiavi JWT RSA-2048..."
openssl genrsa -out /opt/toscogas/secrets/jwt_private.pem 2048
openssl rsa -in /opt/toscogas/secrets/jwt_private.pem \
            -pubout -out /opt/toscogas/secrets/jwt_public.pem
chmod 600 /opt/toscogas/secrets/jwt_private.pem
chmod 644 /opt/toscogas/secrets/jwt_public.pem

# ── Aggiorna nginx.conf con il dominio reale ──────────────────
# (dopo aver copiato i file del progetto in /opt/toscogas)

# ── Backup schedulato ─────────────────────────────────────────
echo "0 2 * * * root /opt/toscogas/scripts/backup.sh >> /var/log/toscogas-backup.log 2>&1" \
  > /etc/cron.d/toscogas-backup

echo ""
echo "══════════════════════════════════════════════════════"
echo "  Setup completato!"
echo ""
echo "  Passi successivi:"
echo "  1. Copia il progetto in /opt/toscogas/"
echo "  2. Copia .env.example → .env e configura le variabili"
echo "  3. Aggiorna nginx/nginx.conf: sostituisci DOMAIN con $DOMAIN"
echo "  4. cd /opt/toscogas && docker compose up -d"
echo ""
echo "  Chiavi JWT:"
echo "  Private: /opt/toscogas/secrets/jwt_private.pem"
echo "  Public:  /opt/toscogas/secrets/jwt_public.pem"
echo "══════════════════════════════════════════════════════"
