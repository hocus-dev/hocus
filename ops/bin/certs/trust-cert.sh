#!/bin/bash

cp /etc/ssl/cert.pem.backup local.pem
cat rootca.pem >> local.pem
sudo cp local.pem /etc/ssl/cert.pem
