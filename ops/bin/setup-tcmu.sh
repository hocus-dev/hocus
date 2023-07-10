#!/bin/bash
# Sets up tcmu on the system

set -o errexit
set -o nounset
set -o pipefail

if [ "$(id -u)" != "0" ]; then
  echo "Please run this as root"
  exit 1
fi

# First check whether we need to load target_core_user
if ! [ -d /sys/kernel/config/target ] ; then
  if [ -f /proc/modules ] ; then
    echo "Trying to load target_core_user";
    modprobe target_core_user;
  fi;
  # Check if loading target_core_user worked
  if ! [ -d /sys/kernel/config/target ] ; then
    echo "Kernel module target_core_user is not available";
    exit 1
  fi;
fi;

# Secondly check whether we need to load tcm_loop
if ! [ -d /sys/kernel/config/target/loopback/ ] ; then
  echo "Trying to load tcm_loop";
  # Oh perhaps the module is there but not started?
  mkdir /sys/kernel/config/target/loopback/ || true
  # If the directory is not there then the kernel doesn't have tcm_loop
  if ! [ -d /sys/kernel/config/target/loopback/ ] ; then
    echo "Kernel module tcm_loop is not available";
    exit 1
  fi
fi

# Check for scsi disk support
if ! [ -d /sys/bus/scsi/drivers/sd ] ; then
  # TODO: try to load the module
  #       please note that 99% of kernels should have this available
  #       cause otherwise one cannot boot from an hdd ;)
  echo "No scsi disk support detected";
  exit 1
fi

# Ensure scsi sync mode is enabled
if ! [ -f /sys/module/scsi_mod/parameters/scan ] ; then
  echo "Unable to veryfy scsi scan mode. /sys/module/scsi_mod/parameters/scan not found";
  exit 1
fi;

SCSI_SCAN_MODE=$(cat /sys/module/scsi_mod/parameters/scan)
if ! [ "$SCSI_SCAN_MODE" = "sync" ] ; then
  echo "SCSI scan mode not in sync mode, enabling sync mode";
  echo -n "sync" > /sys/module/scsi_mod/parameters/scan;
fi;
