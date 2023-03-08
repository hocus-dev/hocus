# Launching the extension

1. Open the project LOCALLY
2. Go to `.vscode/project.code-workspace`
3. Press the "Open Workspace button"
4. Expand the "VSCode Extension" workspace
5. Go to "Run and Debug"
6. Launch `Run Extension (VSCode Extension)`
7. A new VSCode instance with the extension installed should open

## Testing the URI handler

Inside a terminal on the **HOST/LOCAL** machine!!! please run `xdg-open "vscode://hocus.hocus/<query>"`

# Publishing

Publish on the official marketplace using `vsce`, publish on Open VSX using `ovsx`. The accounts are currently managed by @gorbak25

# URI HANDLER
```sh
xdg-open "vscode://hocus.hocus/?workspace-hostname=10.231.0.10&agent-hostname=setup1.hedgehog-hen.ts.net&workspace-name=test2"
```
