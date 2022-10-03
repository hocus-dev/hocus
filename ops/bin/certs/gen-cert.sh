#!/bin/bash

export DEVICENAME='localhost'
export IP='127.0.0.1'

# Generate a device private key
openssl ecparam -name prime256v1 -genkey -noout -out device.key

# Generate a certificate signing request
openssl req -new -sha256 -key device.key -out device.csr -subj "/C=AU/ST=A.C.T./L=Canberra/O=Secops/OU=Org/CN=$DEVICENAME" -reqexts SAN -config <(cat /etc/ssl/openssl.cnf && printf "\n[SAN]\nsubjectAltName=DNS:$DEVICENAME,DNS:localhost,DNS:127.0.0.1")

# Sign the certificate with the root CA
openssl x509 -req -in device.csr -CA rootca.pem -CAkey rootca.key -CAcreateserial -out device.pem -days 395 -sha256 -extensions SAN -extfile <(cat /etc/ssl/openssl.cnf && printf "\n[SAN]\nsubjectAltName=DNS:$DEVICENAME,DNS:$IP") 

# Prepare the device certificate for use
cat device.key device.pem rootca.pem > server.pem
