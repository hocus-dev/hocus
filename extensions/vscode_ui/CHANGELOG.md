# Change Log

## 0.0.6

- Set the remote platform when connecting to a Hocus workspace, eliminates a prompt on Windows
- Ensure the installed SSH client will work with Hocus
- In case of bugs the extension will open in the default browser the Hocus issue tracker
- Detect whether SSH Agent is available and notify the user if there are problems with it
- Add logo

## 0.0.5

- Vscode on Windows may now connect to Hocus workspaces

## 0.0.4

- Sideload the remote part of the extension on ssh connect

## 0.0.3

- Connect to the proper workspace within a monorepo
- Deleting the hocus ssh config now won't break the extension
- When the underlying IP of an workspace changes then properly update the SSH config

## 0.0.2

- If another workspace is already open then connect to a Hocus workspace in a new window
- Don't keep hocus enviroments in the recently opened list
- Release under MIT license

## 0.0.1

- SSH config management
- Macos and Linux support
- SSH agent forwarding
- Deeplinking from the hocus app
