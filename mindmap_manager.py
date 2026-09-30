#!/usr/bin/env python3
"""Interactive cross-platform installer and configuration manager for Nodora."""

from __future__ import annotations

import ctypes
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path


APP_FILES = (
    "index.html",
    "styles.css",
    "app.js",
    "i18n.js",
    "server.py",
    "runtime.py",
    "mindmap_manager.py",
)
CONFIG_NAME = "nodora-config.json"
BEGIN_HOSTS = "# BEGIN NODORA"
END_HOSTS = "# END NODORA"
DEFAULT_PORT = 8765
HOST_SUFFIX = "nodora.local"
HOST_RE = re.compile(
    r"^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+"
    r"[a-zA-Z](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$"
)


def platform_name() -> str:
    if sys.platform == "darwin":
        return "macos"
    if os.name == "nt":
        return "windows"
    return "linux"


PLATFORM = platform_name()


def metadata_file() -> Path:
    if PLATFORM == "windows":
        base = Path(os.environ.get("APPDATA", Path.home() / "AppData/Roaming"))
    elif PLATFORM == "macos":
        base = Path.home() / "Library/Application Support"
    else:
        base = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    return base / "Nodora" / "installation.json"


def default_destination() -> Path:
    if PLATFORM == "windows":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData/Local"))
        return base / "Nodora"
    if PLATFORM == "macos":
        return Path.home() / "Applications" / "Nodora"
    return Path.home() / ".local" / "share" / "nodora"


def cli_directory() -> Path:
    if PLATFORM == "windows":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData/Local"))
        return base / "Nodora" / "bin"
    return Path.home() / ".local" / "bin"


def hosts_file() -> Path:
    if PLATFORM == "windows":
        root = Path(os.environ.get("SystemRoot", r"C:\Windows"))
        return root / "System32/drivers/etc/hosts"
    return Path("/etc/hosts")


def load_json(path: Path) -> dict | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else None
    except (OSError, ValueError):
        return None


def load_installation() -> dict | None:
    data = load_json(metadata_file())
    if not data:
        return None
    destination = Path(data.get("destination", "")).expanduser()
    if not (destination / CONFIG_NAME).is_file():
        return None
    data["destination"] = str(destination)
    return data


def save_installation(destination: Path) -> None:
    path = metadata_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"destination": str(destination)}, indent=2) + "\n",
        encoding="utf-8",
    )


def ask(prompt: str, default: str | None = None) -> str:
    suffix = f" [{default}]" if default is not None else ""
    value = input(f"{prompt}{suffix}: ").strip()
    return value or (default or "")


def ask_choice(prompt: str, choices: dict[str, str], default: str | None = None) -> str:
    while True:
        print(f"\n{prompt}")
        for key, label in choices.items():
            marker = " (default)" if key == default else ""
            print(f"  {key}) {label}{marker}")
        value = input("> ").strip().lower() or (default or "")
        if value in choices:
            return value
        print("Please choose one of the listed options.")


def normalize_destination(raw: str) -> Path:
    return Path(os.path.expandvars(raw)).expanduser().resolve()


def validate_destination(destination: Path, source: Path) -> None:
    if destination == source:
        raise ValueError("The source folder cannot be used as the installation folder.")
    if source in destination.parents:
        raise ValueError("The installation folder cannot be inside the source folder.")
    if destination == Path(destination.anchor):
        raise ValueError("The root directory is not a valid installation folder.")


def port_available(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def suggest_port(preferred: int, current: int | None = None) -> int:
    if port_available(preferred):
        return preferred
    for port in range(8765, 8866):
        if port_available(port):
            return port
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def choose_port(default: int, current: int | None = None) -> int:
    recommended = suggest_port(default, current=current)
    while True:
        raw = ask("Port", str(recommended))
        try:
            port = int(raw)
        except ValueError:
            print("The port must be a number.")
            continue
        if not 1024 <= port <= 65535:
            print("Please choose a port between 1024 and 65535.")
            continue
        if not port_available(port):
            recommended = suggest_port(port + 1, current=current)
            print(f"Port {port} is in use. Suggested free port: {recommended}")
            continue
        return port


def host_label(raw: str) -> str:
    label = re.sub(r"[^a-z0-9-]+", "-", raw.strip().lower())
    label = re.sub(r"-{2,}", "-", label).strip("-")
    return label[:63]


def account_name() -> str:
    for key in ("USERNAME", "USER", "LOGNAME"):
        value = os.environ.get(key, "").strip()
        if value:
            return value
    try:
        import getpass

        return getpass.getuser()
    except OSError:
        return ""


def organization_name() -> str:
    if PLATFORM == "windows":
        try:
            import winreg

            with winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Microsoft\Windows NT\CurrentVersion",
            ) as key:
                value, _ = winreg.QueryValueEx(key, "RegisteredOrganization")
            organization = str(value).strip()
            if organization.casefold() not in {"", "organization", "default", "n/a", "na"}:
                return organization
        except OSError:
            pass
        domain = os.environ.get("USERDOMAIN", "").strip()
        computer = os.environ.get("COMPUTERNAME", "").strip()
        if domain and domain.casefold() != computer.casefold():
            return domain
    return os.environ.get("ORGANIZATION", "").strip()


def default_host() -> str:
    label = host_label(account_name()) or host_label(organization_name()) or "local"
    host = f"{label}.{HOST_SUFFIX}"
    return host if HOST_RE.fullmatch(host) else f"local.{HOST_SUFFIX}"


def choose_host(default: str) -> str:
    while True:
        host = ask("Local hostname", default).lower().rstrip(".")
        if host == "localhost":
            print(f"localhost needs no hosts entry. Please choose a name such as {default_host()}.")
            continue
        if not HOST_RE.fullmatch(host):
            print(f"Invalid hostname. Example: {default_host()}")
            continue
        return host


def strip_hosts_block(content: str) -> str:
    pattern = re.compile(
        rf"\n?{re.escape(BEGIN_HOSTS)}.*?{re.escape(END_HOSTS)}\n?",
        flags=re.DOTALL,
    )
    cleaned = pattern.sub("\n", content).rstrip()
    return cleaned + "\n"


def hosts_content(host: str | None) -> str:
    path = hosts_file()
    content = path.read_text(encoding="utf-8", errors="replace")
    content = strip_hosts_block(content)
    if host:
        content += f"{BEGIN_HOSTS}\n127.0.0.1 {host}\n{END_HOSTS}\n"
    return content


def write_hosts_as_admin(content: str) -> None:
    target = hosts_file()
    if PLATFORM != "windows":
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as handle:
            handle.write(content)
            temporary = Path(handle.name)
        try:
            subprocess.run(["sudo", "cp", str(temporary), str(target)], check=True)
        finally:
            temporary.unlink(missing_ok=True)
        return

    if ctypes.windll.shell32.IsUserAnAdmin():
        target.write_text(content, encoding="ascii", errors="ignore")
        return

    with tempfile.TemporaryDirectory() as temp_dir:
        temp = Path(temp_dir)
        source = temp / "hosts"
        script = temp / "install-host.ps1"
        source.write_text(content, encoding="ascii", errors="ignore")
        source_ps = str(source).replace("'", "''")
        target_ps = str(target).replace("'", "''")
        script.write_text(
            "$ErrorActionPreference = 'Stop'\n"
            f"Copy-Item -LiteralPath '{source_ps}' "
            f"-Destination '{target_ps}' -Force\n",
            encoding="utf-8-sig",
        )
        script_ps = str(script).replace("'", "''")
        command = (
            "Start-Process powershell.exe -Verb RunAs -Wait "
            "-ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',"
            f"'''{script_ps}'''"
        )
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-Command", command],
            check=False,
        )
        if result.returncode:
            raise RuntimeError("Administrator approval for the hosts file was cancelled.")


def configure_host(host: str | None) -> None:
    desired = hosts_content(host)
    current = hosts_file().read_text(encoding="utf-8", errors="replace")
    if current == desired:
        return
    print("\nConfiguring the local hostname in the system hosts file.")
    if PLATFORM != "windows":
        print("You may be asked for your sudo password.")
    write_hosts_as_admin(desired)


def copy_application(source: Path, destination: Path, clean: bool) -> None:
    if clean and (source == destination or source in destination.parents):
        with tempfile.TemporaryDirectory() as temp_dir:
            staging = Path(temp_dir)
            for name in APP_FILES:
                shutil.copy2(source / name, staging / name)
            return copy_application(staging, destination, clean=True)
    if clean and destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True, exist_ok=True)
    for name in APP_FILES:
        src = source / name
        if not src.is_file():
            raise FileNotFoundError(f"Installation file is missing: {src}")
        shutil.copy2(src, destination / name)
    if os.name != "nt":
        (destination / "runtime.py").chmod(0o755)
        (destination / "mindmap_manager.py").chmod(0o755)


def write_config(destination: Path, port: int, host: str) -> None:
    (destination / CONFIG_NAME).write_text(
        json.dumps(
            {
                "version": 1,
                "port": port,
                "host": host,
                "autostart": True,
                "installedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def python_command() -> str:
    return str(Path(sys.executable).resolve())


def shell_quote(value: str) -> str:
    return "'" + value.replace("'", "'\"'\"'") + "'"


def write_cli(destination: Path) -> None:
    directory = cli_directory()
    directory.mkdir(parents=True, exist_ok=True)
    runtime = destination / "runtime.py"
    manager = destination / "mindmap_manager.py"
    python = python_command()

    if PLATFORM == "windows":
        commands = {
            "nodora-start.cmd": f'@echo off\r\n"{python}" "{runtime}" start %*\r\n',
            "nodora-stop.cmd": f'@echo off\r\n"{python}" "{runtime}" stop %*\r\n',
            "nodora-status.cmd": f'@echo off\r\n"{python}" "{runtime}" status %*\r\n',
            "nodora-open.cmd": f'@echo off\r\n"{python}" "{runtime}" open %*\r\n',
            "nodora-manager.cmd": f'@echo off\r\n"{python}" "{manager}" %*\r\n',
        }
        for name, content in commands.items():
            (directory / name).write_text(content, encoding="utf-8")
        add_windows_path(directory)
        return

    commands = {
        "nodora-start": f"#!/bin/sh\nexec {shell_quote(python)} {shell_quote(str(runtime))} start \"$@\"\n",
        "nodora-stop": f"#!/bin/sh\nexec {shell_quote(python)} {shell_quote(str(runtime))} stop \"$@\"\n",
        "nodora-status": f"#!/bin/sh\nexec {shell_quote(python)} {shell_quote(str(runtime))} status \"$@\"\n",
        "nodora-open": f"#!/bin/sh\nexec {shell_quote(python)} {shell_quote(str(runtime))} open \"$@\"\n",
        "nodora-manager": f"#!/bin/sh\nexec {shell_quote(python)} {shell_quote(str(manager))} \"$@\"\n",
    }
    for name, content in commands.items():
        path = directory / name
        path.write_text(content, encoding="utf-8")
        path.chmod(0o755)
    ensure_posix_path(directory)


def ensure_posix_path(directory: Path) -> None:
    marker = "# Nodora CLI"
    line = f'{marker}\nexport PATH="{directory}:$PATH"\n'
    candidates = [Path.home() / ".profile"]
    shell = os.environ.get("SHELL", "")
    if shell.endswith("zsh"):
        candidates.insert(0, Path.home() / ".zshrc")
    elif shell.endswith("bash"):
        candidates.insert(0, Path.home() / ".bashrc")
    path = candidates[0]
    content = path.read_text(encoding="utf-8") if path.exists() else ""
    if marker not in content:
        with path.open("a", encoding="utf-8") as handle:
            if content and not content.endswith("\n"):
                handle.write("\n")
            handle.write(f"\n{line}")


def add_windows_path(directory: Path) -> None:
    import winreg

    key_path = r"Environment"
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_READ | winreg.KEY_WRITE) as key:
        try:
            current, kind = winreg.QueryValueEx(key, "Path")
        except FileNotFoundError:
            current, kind = "", winreg.REG_EXPAND_SZ
        entries = [entry for entry in current.split(";") if entry]
        if str(directory).lower() not in {entry.lower() for entry in entries}:
            entries.append(str(directory))
            winreg.SetValueEx(key, "Path", 0, kind, ";".join(entries))
    ctypes.windll.user32.SendMessageTimeoutW(0xFFFF, 0x001A, 0, "Environment", 0x0002, 5000, None)


def remove_cli() -> None:
    directory = cli_directory()
    suffix = ".cmd" if PLATFORM == "windows" else ""
    for name in ("start", "stop", "status", "open", "manager"):
        (directory / f"nodora-{name}{suffix}").unlink(missing_ok=True)


def autostart_file() -> Path:
    if PLATFORM == "windows":
        appdata = Path(os.environ.get("APPDATA", Path.home() / "AppData/Roaming"))
        return appdata / "Microsoft/Windows/Start Menu/Programs/Startup/Nodora.cmd"
    if PLATFORM == "macos":
        return Path.home() / "Library/LaunchAgents/com.nodora.local.plist"
    config = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    return config / "autostart" / "nodora.desktop"


def configure_autostart(destination: Path) -> None:
    path = autostart_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    runtime = destination / "runtime.py"
    python = python_command()

    if PLATFORM == "windows":
        path.write_text(
            "@echo off\r\n"
            f'start "" /min "{python}" "{runtime}" start --quiet\r\n',
            encoding="utf-8",
        )
    elif PLATFORM == "macos":
        import plistlib

        data = {
            "Label": "com.nodora.local",
            "ProgramArguments": [python, str(runtime), "start", "--quiet"],
            "RunAtLoad": True,
            "ProcessType": "Background",
        }
        with path.open("wb") as handle:
            plistlib.dump(data, handle)
        subprocess.run(["launchctl", "unload", str(path)], check=False, capture_output=True)
        subprocess.run(["launchctl", "load", str(path)], check=False)
    else:
        path.write_text(
            "[Desktop Entry]\n"
            "Type=Application\n"
            "Name=Nodora\n"
            "Comment=Start the local Nodora server\n"
            f'Exec="{python}" "{runtime}" start --quiet\n'
            "Terminal=false\n"
            "X-GNOME-Autostart-enabled=true\n",
            encoding="utf-8",
        )


def remove_autostart() -> None:
    path = autostart_file()
    if PLATFORM == "macos" and path.exists():
        subprocess.run(["launchctl", "unload", str(path)], check=False, capture_output=True)
    path.unlink(missing_ok=True)


def run_runtime(destination: Path, command: str, quiet: bool = False) -> int:
    args = [python_command(), str(destination / "runtime.py"), command]
    if quiet:
        args.append("--quiet")
    return subprocess.run(args, check=False).returncode


def install(source: Path, existing: dict | None = None, reinstall: bool = False) -> None:
    old_destination = Path(existing["destination"]) if existing else None
    default = old_destination or default_destination()
    while True:
        try:
            destination = normalize_destination(ask("Installation folder", str(default)))
            validate_destination(destination, source)
            break
        except ValueError as exc:
            print(exc)

    if destination.exists() and any(destination.iterdir()) and destination != old_destination:
        answer = ask_choice(
            f"The folder {destination} is not empty.",
            {"c": "Choose another folder", "o": "Overwrite the folder", "x": "Cancel"},
            "c",
        )
        if answer == "c":
            return install(source, existing=existing, reinstall=reinstall)
        if answer == "x":
            return

    old_config = load_json(old_destination / CONFIG_NAME) if old_destination else None
    if old_destination:
        run_runtime(old_destination, "stop", quiet=True)
    current_port = int(old_config["port"]) if old_config else None
    port = choose_port(current_port or DEFAULT_PORT, current=current_port)
    host = choose_host(str(old_config.get("host") or default_host()) if old_config else default_host())

    configure_host(host)
    copy_application(source, destination, clean=reinstall or destination != old_destination)
    write_config(destination, port, host)
    write_cli(destination)
    configure_autostart(destination)
    save_installation(destination)
    if old_destination and old_destination != destination:
        shutil.rmtree(old_destination, ignore_errors=True)
    if run_runtime(destination, "open") != 0:
        raise RuntimeError(f"Installation finished, but the server could not start. Log: {destination / 'nodora-server.log'}")
    print(f"\nNodora was installed successfully: http://{host}:{port}")
    print("CLI: nodora-start, nodora-stop, nodora-status, nodora-open, nodora-manager")
    if PLATFORM != "windows":
        print("If the commands are not found in this terminal, open a new terminal.")


def reconfigure(existing: dict) -> None:
    destination = Path(existing["destination"])
    config = load_json(destination / CONFIG_NAME) or {}
    old_port = int(config.get("port", DEFAULT_PORT))
    old_host = str(config.get("host") or default_host())
    print(f"\nCurrent configuration: http://{old_host}:{old_port}")
    run_runtime(destination, "stop", quiet=True)
    port = choose_port(old_port, current=old_port)
    host = choose_host(old_host)
    configure_host(host)
    write_config(destination, port, host)
    write_cli(destination)
    configure_autostart(destination)
    if run_runtime(destination, "open") != 0:
        raise RuntimeError(f"The configuration was saved, but the server could not start. Log: {destination / 'nodora-server.log'}")
    print(f"\nNodora was reconfigured successfully: http://{host}:{port}")


def uninstall(existing: dict) -> None:
    destination = Path(existing["destination"])
    if ask_choice("Really delete Nodora?", {"y": "Yes", "n": "No"}, "n") != "y":
        return
    run_runtime(destination, "stop", quiet=True)
    configure_host(None)
    remove_autostart()
    remove_cli()
    metadata_file().unlink(missing_ok=True)
    try:
        metadata_file().parent.rmdir()
    except OSError:
        pass
    shutil.rmtree(destination, ignore_errors=False)
    print("Nodora was removed completely.")


def main() -> int:
    source = Path(__file__).resolve().parent
    print("\nNodora installer / manager")
    print(f"System: {PLATFORM}")
    existing = load_installation()
    if not existing:
        install(source)
        return 0

    destination = Path(existing["destination"])
    config = load_json(destination / CONFIG_NAME) or {}
    print(f"\nExisting installation found: {destination}")
    print(f"URL: http://{config.get('host') or default_host()}:{config.get('port', DEFAULT_PORT)}")
    action = ask_choice(
        "What would you like to do?",
        {
            "c": "Reconfigure",
            "r": "Delete and reinstall",
            "d": "Delete",
            "x": "Cancel",
        },
        "c",
    )
    if action == "c":
        reconfigure(existing)
    elif action == "r":
        install(source, existing=existing, reinstall=True)
    elif action == "d":
        uninstall(existing)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nCancelled.")
        raise SystemExit(130)
    except Exception as exc:
        print(f"\nError: {exc}", file=sys.stderr)
        raise SystemExit(1)
