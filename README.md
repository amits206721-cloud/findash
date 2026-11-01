# FinDash

FinDash is a personal finance dashboard built with vanilla JavaScript, Vite, and Electron. It runs as a web app during development and can be packaged as a Windows desktop app. Finance data is stored locally; the project does not require a backend.

## Requirements

- Node.js 22.12 or later
- npm

## Get started

Install dependencies and start the web app:

```sh
npm ci
npm run dev
```

Vite prints a local URL in the terminal. To create the production web build:

```sh
npm run build
```

To build the web app and launch the Electron desktop app:

```sh
npm run desktop
```

## Windows desktop packages

Run these commands on Windows:

```sh
npm run package:win
```

This creates an installer and a portable app in `release-rebuild/`. To build only one package, use `npm run package:win:installer` or `npm run package:win:portable`.

Build output and installed dependencies are ignored by Git. They can be recreated with the commands above and should not be committed.
