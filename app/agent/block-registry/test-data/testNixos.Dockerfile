# This is an alpine image with the nix package manager
# Use this image to bootstrap a real nixos container
FROM nixos/nix AS bootstrap
RUN nix-channel --remove nixpkgs \
 && nix-channel --add https://nixos.org/channels/nixos-23.05 nixpkgs \
 && nix-channel --update \
 && nix-env -f https://github.com/nix-community/nixos-generators/archive/master.tar.gz -i
COPY configuration.nix /configuration.nix
RUN mv $(nixos-generate -f docker -c /configuration.nix) /nixos.tar.xz
RUN nix-env -f '<nixpkgs>' -iA \
      xz \
      && mkdir /mnt \
      && tar -xf /nixos.tar.xz -C /mnt

FROM scratch AS nixos
COPY --from=bootstrap /mnt /
