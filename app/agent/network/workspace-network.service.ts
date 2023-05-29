import type { DefaultLogger } from "@temporalio/worker";
import type { A } from "ts-toolbelt";

import { execCmd } from "../utils";

import { MAXIMUM_IP_ID, MINIMUM_IP_ID } from "./storage/constants";
import type { StorageService } from "./storage/storage.service";

import { Token } from "~/token";
import { numericSort } from "~/utils.shared";

export type IpBlockId = A.Type<number, "ip-block-id">;

const IP_PREFIX = "10.231.";
export const VMS_NS_PATH = "/var/run/netns/vms";
const NS_PREFIX = ["ip", "netns", "exec", "vms"] as const;
const TAP_INTERFACE_NAME_PREFIX = "vm";
const TAP_INTERFACE_CIDR = 30;

export class WorkspaceNetworkService {
  static inject = [Token.Logger, Token.StorageService] as const;

  constructor(
    private readonly logger: DefaultLogger,
    private readonly storageService: StorageService,
  ) {}

  private getTapInterfaceName(ipId: IpBlockId): `${typeof TAP_INTERFACE_NAME_PREFIX}${number}` {
    return `${TAP_INTERFACE_NAME_PREFIX}${ipId}`;
  }

  async changeInterfaceVisibility(
    ipBlockId: IpBlockId,
    changeTo: "public" | "private",
  ): Promise<void> {
    this.logger.info(`Changing visibility of ${ipBlockId} to ${changeTo}`);
    const action = changeTo === "public" ? "-A" : "-D";
    const tapName = this.getTapInterfaceName(ipBlockId);
    for (const cmd of [
      `iptables ${action} FORWARD -i vpeer-ssh-vms -o ${tapName} -p tcp --dport 22 -j ACCEPT`,
      `iptables ${action} FORWARD -i ${tapName} -o vpeer-ssh-vms -m state --state ESTABLISHED,RELATED -j ACCEPT`,
    ]) {
      await execCmd(...NS_PREFIX, ...cmd.split(" "));
    }
  }

  async setupInterfaces(ipBlockId: IpBlockId): Promise<{
    tapIfName: string;
    tapIfIp: string;
    vmIp: string;
    tapIfCidr: number;
  }> {
    const tapIfCidr = TAP_INTERFACE_CIDR;
    const tapIfName = this.getTapInterfaceName(ipBlockId);
    const { tapIfIp, vmIp } = this.getIpsFromIpBlockId(ipBlockId);
    try {
      await execCmd(...NS_PREFIX, "ip", "link", "del", tapIfName);
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("Cannot find device"))) {
        throw err;
      }
    }
    await execCmd(...NS_PREFIX, "ip", "tuntap", "add", "dev", tapIfName, "mode", "tap");
    await execCmd(...NS_PREFIX, "sysctl", "-w", `net.ipv4.conf.${tapIfName}.proxy_arp=1`);
    await execCmd(...NS_PREFIX, "sysctl", "-w", `net.ipv6.conf.${tapIfName}.disable_ipv6=1`);
    await execCmd(...NS_PREFIX, "ip", "addr", "add", `${tapIfIp}/${tapIfCidr}`, "dev", tapIfName);
    await execCmd(...NS_PREFIX, "ip", "link", "set", "dev", tapIfName, "up");

    return {
      tapIfName,
      tapIfIp,
      vmIp,
      tapIfCidr,
    };
  }

  private getIpsFromIpBlockId(ipBlockId: IpBlockId): { tapIfIp: string; vmIp: string } {
    const netIpId = 4 * ipBlockId;
    const tapDeviceIpId = netIpId + 1;
    const vmIpId = netIpId + 2;

    const tapFirstIpPart = (tapDeviceIpId & ((2 ** 8 - 1) << 8)) >> 8;
    const tapSecondIpPart = tapDeviceIpId & (2 ** 8 - 1);
    const vmFirstIpPart = (vmIpId & ((2 ** 8 - 1) << 8)) >> 8;
    const vmSecondIpPart = vmIpId & (2 ** 8 - 1);

    return {
      tapIfIp: `${IP_PREFIX}${tapFirstIpPart}.${tapSecondIpPart}`,
      vmIp: `${IP_PREFIX}${vmFirstIpPart}.${vmSecondIpPart}`,
    };
  }

  async allocateIpBlock(): Promise<IpBlockId> {
    const ipId = await this.storageService.withStorage(async (storage) => {
      const container = await storage.readStorage();
      const busyIpBlockIds = container.busyIpBlockIds;
      busyIpBlockIds.sort(numericSort);
      let nextFreeIpId = MINIMUM_IP_ID;
      for (const busyIpBlockId of busyIpBlockIds) {
        if (busyIpBlockId !== nextFreeIpId) {
          break;
        }
        nextFreeIpId++;
      }
      if (nextFreeIpId > MAXIMUM_IP_ID) {
        throw new Error("No free IP addresses");
      }
      busyIpBlockIds.push(nextFreeIpId);
      await storage.writeStorage(container);
      return nextFreeIpId;
    });
    return ipId as IpBlockId;
  }

  async freeIpBlock(ipBlockId: IpBlockId): Promise<void> {
    try {
      await this.changeInterfaceVisibility(ipBlockId, "private");
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("Bad rule"))) {
        throw err;
      }
    }
    await this._freeIpBlock(ipBlockId);
  }

  private async _freeIpBlock(ipBlockId: IpBlockId): Promise<void> {
    await this.storageService.withStorage(async (storage) => {
      const container = await storage.readStorage();
      container.busyIpBlockIds = container.busyIpBlockIds.filter((id) => id !== ipBlockId);
      await storage.writeStorage(container);
    });
  }
}
