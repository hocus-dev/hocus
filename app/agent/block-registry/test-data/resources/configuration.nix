{ config, lib, pkgs, ... }:

{
  # Try to build a minimal system
  imports =
    [
    ];
  
  # x86_64
  nixpkgs.hostPlatform = lib.mkDefault "x86_64-linux";

  # Ensure the install is slim
  services.xserver.enable = false;
  environment.noXlibs = true;
  documentation.enable = false;
  documentation.doc.enable = false;
  documentation.info.enable = false;
  documentation.man.enable = false;
  documentation.nixos.enable = false;
  programs.command-not-found.enable = false;
  services.logrotate.enable = false;
  services.udisks2.enable = false;
  xdg.autostart.enable = false;
  xdg.icons.enable = false;
  xdg.mime.enable = false;
  xdg.sounds.enable = false;

  boot.isContainer = true;
  networking.useHostResolvConf = false;

  # sshd config
  networking.hostName = "hocus";
  services.openssh.enable = true;
  services.openssh.settings.PasswordAuthentication = true;
  services.openssh.settings.PermitRootLogin = "yes";
  users.users.root.password = "root";

  # This value determines the NixOS release from which the default
  # settings for stateful data, like file locations and database versions
  # on your system were taken. It‘s perfectly fine and recommended to leave
  # this value at the release version of the first install of this system.
  # Before changing this value read the documentation for this option
  # (e.g. man configuration.nix or on https://nixos.org/nixos/options.html).
  system.stateVersion = "23.05"; # Did you read the comment?
}

