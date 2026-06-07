#!/bin/sh
set -e

if [ -n "$BITBUCKET_SERVER_HOST" ]; then
  HOST=$(echo "$BITBUCKET_SERVER_HOST" | sed 's|^https\?://||' | sed 's|/.*||')
  PORT="${BITBUCKET_HTTPS_PORT:-443}"

  echo "Fetching SSL certificate from $HOST:$PORT..."
  CERT=$(echo | openssl s_client -connect "$HOST:$PORT" -showcerts 2>/dev/null \
    | awk '/BEGIN CERTIFICATE/{c++} c==2{print} /END CERTIFICATE/ && c==2{exit}')

  if [ -z "$CERT" ]; then
    CERT=$(echo | openssl s_client -connect "$HOST:$PORT" -showcerts 2>/dev/null \
      | awk '/BEGIN CERTIFICATE/{p=1} p{print} /END CERTIFICATE/{p=0}' | head -30)
  fi

  if [ -n "$CERT" ]; then
    echo "$CERT" > /usr/local/share/ca-certificates/bitbucket-ca.crt
    update-ca-certificates
    echo "SSL certificate installed."
  else
    echo "Warning: Could not fetch SSL certificate from $HOST:$PORT"
  fi

  if [ "${GIT_CLONE_PROTOCOL:-ssh}" = "ssh" ]; then
    SSH_PORT="${BITBUCKET_SSH_PORT:-7999}"
    mkdir -p /root/.ssh
    ssh-keyscan -p "$SSH_PORT" "$HOST" >> /root/.ssh/known_hosts 2>/dev/null || true
    chmod 600 /root/.ssh/known_hosts
    echo "SSH known_hosts updated for $HOST:$SSH_PORT"
  fi
fi

exec "$@"
