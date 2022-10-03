#!/bin/bash

openssl ecparam -name prime256v1 -genkey -noout -out rootca.key
openssl req -new -x509 -key rootca.key -sha256 -out rootca.pem -days 3650 -nodes -subj "/C=AU/ST=A.C.T./L=Canberra/O=Secops/OU=Org/CN=RootCA"
