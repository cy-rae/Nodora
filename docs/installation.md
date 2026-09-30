# Installation and management

The installer copies the application into a folder you choose, creates command-line shortcuts, configures sign-in autostart, and can add a local hostname. It is one program with three launchers:

| System | Launcher |
| --- | --- |
| Ubuntu and other Linux systems | `./install-linux.sh` |
| macOS | `./install-macos.command` |
| Windows | `install-windows.ps1` |

Python 3.10 or newer must be installed first. On Windows, enable **Add Python to PATH** in the Python installer. If PowerShell blocks the script, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-windows.ps1
```

On macOS, the `.command` file can be double-clicked in Finder after it has been made executable:

```bash
chmod +x install-macos.command
```

## What the installer asks

1. **Installation folder.** The suggested locations are:
   - Linux: `~/.local/share/nodora`
   - macOS: `~/Applications/Nodora`
   - Windows: `%LOCALAPPDATA%\Nodora`
2. **Port.** The preferred port is 8765. Only ports from 1024 through 65535 are accepted. If the chosen port is busy, the installer suggests another free port.
3. **Local hostname.** The suggestion is `<user>.nodora.local`. The installer fills `<user>` from the account name on this computer. Characters that are not valid in a hostname become hyphens. If no account name is available, it tries a registered organization name, and otherwise suggests `local.nodora.local`. You can replace the suggestion with any other DNS-style name except `localhost`.

The application files are copied into the selected folder. That folder remains editable: configuration, logs, and the server PID file live beside the application.

## Local hostname

Yes. A hosts entry can replace `127.0.0.1` with a name. The installer writes a clearly marked block into the system hosts file:

```text
# BEGIN NODORA
127.0.0.1 cy-rae.nodora.local
# END NODORA
```

The files are:

| System | Hosts file |
| --- | --- |
| Linux and macOS | `/etc/hosts` |
| Windows | `%SystemRoot%\System32\drivers\etc\hosts` |

Writing that file requires administrator rights, so Linux and macOS request `sudo`, and Windows opens a User Account Control prompt. The Nodora server itself continues to listen only on `127.0.0.1`; the hostname simply points back to that address.

`.local` stays on this computer. The hosts entry points the name at `127.0.0.1`. Some systems also use `.local` for local network discovery, but the Nodora hosts entry is checked as a normal hosts-file name.

The browser URL keeps the port:

```text
http://cy-rae.nodora.local:8765
```

A hosts file cannot map a name to a port. Removing `:8765` from the URL would require serving the application on port 80, which needs additional system privileges or a reverse proxy. Nodora does not install either of those.

Removing or reconfiguring the application updates or deletes only the marked Nodora block. Other hosts entries are preserved.

## Existing installation

Run the installer again, or run `nodora-manager`. If an installation is registered, the manager offers:

| Choice | Result |
| --- | --- |
| Reconfigure | Choose a new port and hostname, restart the server, and open the browser |
| Delete and reinstall | Choose the folder, port, and hostname again, then replace the installation |
| Delete | Stop the server, remove shortcuts, autostart, the hosts block, and the installation folder |
| Cancel | Leave everything unchanged |

The registration file is stored at:

| System | Location |
| --- | --- |
| Linux | `${XDG_CONFIG_HOME:-~/.config}/Nodora/installation.json` |
| macOS | `~/Library/Application Support/Nodora/installation.json` |
| Windows | `%APPDATA%\Nodora\installation.json` |

## Command-line tools

Shortcuts are created in:

| System | Directory |
| --- | --- |
| Linux and macOS | `~/.local/bin` |
| Windows | `%LOCALAPPDATA%\Nodora\bin` |

The installer adds that directory to the user `PATH` through `.bashrc`, `.zshrc`, or `.profile` on Linux and macOS, and through the user environment on Windows. Existing terminals do not automatically reload that change.

| Command | Behavior |
| --- | --- |
| `nodora-start` | Start the server if it is not already running |
| `nodora-stop` | Stop the server started by Nodora |
| `nodora-status` | Print the PID and URL, or report that it is stopped |
| `nodora-open` | Start if necessary and open the configured URL |
| `nodora-manager` | Open this installer again |

An open browser tab keeps running after `nodora-stop` because the editor is client-side. Reloading then fails until `nodora-start` runs again. Saved browser data and downloaded JSON files remain intact.

## Autostart

The server starts when the user signs in. It does not require a manually run start command after that:

| System | Mechanism |
| --- | --- |
| Linux | `~/.config/autostart/nodora.desktop` |
| macOS | `~/Library/LaunchAgents/com.nodora.local.plist` |
| Windows | Startup folder entry `Nodora.cmd` |

Autostart is per user, not a system-wide service. The server listens on localhost only.

## Files created in the installation folder

| File | Purpose |
| --- | --- |
| `nodora-config.json` | Selected port, hostname, and installation time |
| `.nodora-server.pid` | PID of the running server |
| `nodora-server.log` | Server output and startup errors |

The configuration looks like this:

```json
{
  "version": 1,
  "port": 8765,
  "host": "cy-rae.nodora.local",
  "autostart": true,
  "installedAt": "2026-09-30T11:40:00"
}
```

## Development server

From a source checkout, this starts only the web server:

```bash
python3 server.py --bind 127.0.0.1 --port 8765
```

It sends `Cache-Control: no-store`, so a normal reload picks up HTML, CSS, and JavaScript changes. It does not install commands or autostart. Use the manager when a persistent local installation is wanted.

## Troubleshooting

**The command is not found.** Open a new terminal. On Windows, sign out and back in if the user `PATH` has not been refreshed.

**The page is empty after switching hostname.** Auto-save is stored separately for each origin. Download the JSON file from the old address and open it at the new one.

**Port already in use.** Run `nodora-manager` and choose another port. A server that was not started by Nodora is left untouched.

**The hosts change was cancelled.** Installation can stop at that confirmation because the hostname would not resolve. Approve the administrator prompt and run the manager again.

**Python is missing.** Install Python 3.10 or newer from [python.org](https://www.python.org/downloads/) or the operating system’s package manager. On Ubuntu:

```bash
sudo apt install python3
```
