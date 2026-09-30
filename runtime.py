#!/usr/bin/env python3
"""Start, stop and inspect an installed Nodora server."""

from __future__ import annotations

import argparse
import json
import os
import signal
import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path


ROOT = Path(__file__).resolve().parent
CONFIG_FILE = ROOT / "nodora-config.json"
PID_FILE = ROOT / ".nodora-server.pid"
LOG_FILE = ROOT / "nodora-server.log"


def load_config() -> dict:
    try:
        return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise SystemExit(f"Nodora configuration cannot be read: {exc}") from exc


def process_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    if sys.platform.startswith("linux"):
        return Path(f"/proc/{pid}").exists()
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def read_pid() -> int | None:
    try:
        pid = int(PID_FILE.read_text(encoding="ascii").strip())
    except (OSError, ValueError):
        return None
    if process_alive(pid):
        return pid
    PID_FILE.unlink(missing_ok=True)
    return None


def port_is_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def app_url(config: dict) -> str:
    return f"http://{config['host']}:{config['port']}"


def start(open_browser: bool = False, quiet: bool = False) -> int:
    config = load_config()
    pid = read_pid()
    if pid:
        if not quiet:
            print(f"Nodora is already running (PID {pid}): {app_url(config)}")
        if open_browser:
            webbrowser.open(app_url(config))
        return 0

    port = int(config["port"])
    if not port_is_free(port):
        print(f"Port {port} is already in use. Run nodora-manager to choose another port.", file=sys.stderr)
        return 1

    log = LOG_FILE.open("ab", buffering=0)
    command = [
        sys.executable,
        str(ROOT / "server.py"),
        "--bind",
        "127.0.0.1",
        "--port",
        str(port),
    ]
    kwargs: dict = {
        "cwd": str(ROOT),
        "stdin": subprocess.DEVNULL,
        "stdout": log,
        "stderr": subprocess.STDOUT,
        "close_fds": True,
    }
    if os.name == "nt":
        kwargs["creationflags"] = (
            subprocess.CREATE_NEW_PROCESS_GROUP
            | subprocess.DETACHED_PROCESS
            | subprocess.CREATE_NO_WINDOW
        )
    else:
        kwargs["start_new_session"] = True

    try:
        process = subprocess.Popen(command, **kwargs)
    finally:
        log.close()

    PID_FILE.write_text(str(process.pid), encoding="ascii")
    time.sleep(0.35)
    if process.poll() is not None:
        PID_FILE.unlink(missing_ok=True)
        print(f"Nodora could not be started. See {LOG_FILE}", file=sys.stderr)
        return 1

    if not quiet:
        print(f"Nodora started: {app_url(config)}")
    if open_browser:
        webbrowser.open(app_url(config))
    return 0


def stop(quiet: bool = False) -> int:
    pid = read_pid()
    if not pid:
        if not quiet:
            print("Nodora is not running.")
        return 0

    try:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/PID", str(pid), "/T", "/F"],
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        else:
            os.kill(pid, signal.SIGTERM)
            for _ in range(30):
                if not process_alive(pid):
                    break
                time.sleep(0.1)
            if process_alive(pid):
                os.kill(pid, signal.SIGKILL)
    except OSError:
        pass
    PID_FILE.unlink(missing_ok=True)
    if not quiet:
        print("Nodora stopped.")
    return 0


def status() -> int:
    config = load_config()
    pid = read_pid()
    if pid:
        print(f"Nodora is running (PID {pid}): {app_url(config)}")
        return 0
    print(f"Nodora is stopped. Configured URL: {app_url(config)}")
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Manage the installed Nodora server")
    parser.add_argument("command", choices=("start", "stop", "restart", "status", "open"))
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    if args.command == "start":
        return start(quiet=args.quiet)
    if args.command == "stop":
        return stop(quiet=args.quiet)
    if args.command == "restart":
        stop(quiet=True)
        return start(quiet=args.quiet)
    if args.command == "open":
        result = start(quiet=True)
        if result == 0:
            webbrowser.open(app_url(load_config()))
        return result
    return status()


if __name__ == "__main__":
    raise SystemExit(main())
