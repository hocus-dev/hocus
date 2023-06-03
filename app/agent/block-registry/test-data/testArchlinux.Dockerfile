FROM archlinux:base

RUN pacman --noconfirm -Syu openssh \
    && pacman -Scc \
    && rm -rf /var/lib/pacman/sync \
    && sed -ie "s/#PasswordAuthentication yes/PasswordAuthentication yes/g" /etc/ssh/sshd_config \
    && sed -ie "s/#PermitRootLogin prohibit-password/PermitRootLogin yes/g" /etc/ssh/sshd_config \
    && echo "root:root" | chpasswd \
    && systemctl enable sshd
