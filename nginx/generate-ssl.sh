#!/bin/bash
# Generate self-signed SSL certificates for local development mapping

mkdir -p ssl
cd ssl || exit

echo "Generating self-signed SSL certificates for HTTPS (Localhost)"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout server.key \
  -out server.crt \
  -subj "/C=IN/ST=MUMBAI/O=PharmaCentral/OU=IT/CN=localhost"

echo "✅ Certificates Generated:"
ls -l server.key server.crt

echo "Done! The API Gateway will now securely serve HTTPS."
