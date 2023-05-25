#!/bin/sh

# When closing the login session ensure the ssh-agent symlink points to something sane
# At this point the ssh-agent of the user is already dead
if [ "$PAM_TYPE" = "close_session" ]; then
	# Don't touch the symlink if the symlink already points to something sane
	if [ -d "/home/$PAM_USER/.ssh" ] && [ ! -S "/home/$PAM_USER/.ssh/ssh_auth_sock" ]; then
		# Ok the current symlink is broken, find the oldest ssh-agent of $PAM_USER which is still alive
		ln -sf $(find /tmp -maxdepth 2 -type s -name "agent*" -user $PAM_USER -printf '%T@ %p\n' 2>/dev/null |sort -n|tail -1|cut -d' ' -f2) /home/$PAM_USER/.ssh/ssh_auth_sock;
		chown $PAM_USER:$PAM_USER /home/$PAM_USER/.ssh/ssh_auth_sock;
	fi
fi
