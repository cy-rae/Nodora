# Technical reference

## Architecture

Nodora has two layers:

1. **Editor:** `index.html`, `styles.css`, `app.js`, and `i18n.js`. These files use ordinary browser JavaScript, without a bundler, framework, or ES modules, so the page can also be opened as local files.
2. **Local runtime:** `server.py` publishes the folder, `runtime.py` starts and stops that process, and `mindmap_manager.py` installs and reconfigures it.

```text
Browser
  |
  |  http://<user>.nodora.local:8765
  v
/etc/hosts or Windows hosts file
  |
  |  127.0.0.1
  v
server.py on 127.0.0.1:<port>
  |
  +-- index.html, styles.css, app.js, i18n.js
```

The editor stores its working copy in the browser. The Python process does not keep map data and has no accounts, database, or network API.

## Project files

| File | Role |
| --- | --- |
| `index.html` | Application shell and accessible labels |
| `styles.css` | Layout and visual theme |
| `app.js` | Map model, interaction, history, storage, and export |
| `i18n.js` | Five language catalogs, language detection, and flag markup |
| `server.py` | Threaded static server with `Cache-Control: no-store` |
| `runtime.py` | `start`, `stop`, `restart`, `status`, and `open` |
| `mindmap_manager.py` | Interactive cross-platform installer and manager |
| `install-linux.sh` | Linux launcher |
| `install-macos.command` | macOS launcher |
| `install-windows.ps1` | Windows launcher |

The installer copies the application files listed in `APP_FILES`. It does not copy this documentation or the launcher scripts into the destination; the installed manager is invoked through the generated commands.

## Runtime model

Nodes and edges are dictionaries keyed by ID.

```json
{
  "version": 1,
  "title": "Brainstorming",
  "nodes": {
    "n1": {
      "id": "n1",
      "text": "Central idea",
      "richText": "<span style=\"font-size:54px\">Central</span> idea",
      "x": 0,
      "y": 0,
      "w": 180,
      "h": 64,
      "color": "sand",
      "fontSize": 48,
      "fontFamily": "sans",
      "bold": true,
      "italic": false,
      "underline": false,
      "note": ""
    }
  },
  "edges": {
    "e1": {
      "id": "e1",
      "from": "n1",
      "to": "n2",
      "route": "curve",
      "dash": "solid",
      "arrow": false
    }
  },
  "linkStyle": {
    "route": "curve",
    "dash": "solid",
    "arrow": false
  },
  "brush": {
    "color": "sand",
    "fontSize": 48,
    "bold": true,
    "italic": false,
    "underline": false
  },
  "view": {
    "panX": 80,
    "panY": 80,
    "zoom": 1
  },
  "notesOpen": false
}
```

Accepted values are:

| Field | Values |
| --- | --- |
| `color` | `sand`, `coral`, `amber`, `sage`, `teal`, `sky`, `iris`, `rose`, `ink` |
| `fontFamily` | `sans`, `serif`, `mono`, `rounded` |
| `route` | `curve`, `straight`, `elbow` |
| `dash` | `solid`, `dashed`, `dotted` |
| `fontSize` | Integer from 10 to 96 |

`text` is the plain-text representation used by notes, search-like labels, and PDF output. Bulleted items are written with `- ` and numbered items with `1.`, `1.1.`, or `1.1.1.`, including two leading spaces per indent. `richText` is a sanitized HTML subset for inline formatting. Allowed markup is limited to emphasis, underline, spans with approved font properties, line breaks, lists (`ul`/`ol`/`li`) with an indent level from 0 to 2, and safe HTTP, HTTPS, or mail links. `normalizeFile()` drops edges whose endpoints do not exist and replaces unknown colors, fonts, and route styles with defaults. Width and height are measured from the rendered text and are not meaningful as manually authored layout input. Undo history stores content without the transient viewport state.

## Browser storage

| Key | Content |
| --- | --- |
| `mindmap.autosave.v1` | Serialized map; the legacy key is retained so the Nodora rename does not lose existing maps |
| `mindmap.autosave.enabled` | `1` or `0` |
| `mindmap.lang.v1` | `de`, `en`, `it`, `es`, or `fr` |

Language detection checks the saved choice first, then `navigator.languages`, using the first two-letter language code that the application supports. The fallback is `en`.

Storage is partitioned by browser profile and origin, including hostname and port. It is not synchronized between browsers or machines. A downloaded `.nodora.json` file is the portable copy.

## Internationalization

`i18n.js` contains one flat dictionary per language. `t(key, vars)` substitutes values such as `{n}` and `{time}`, and falls back to English when a key is absent. Static HTML uses:

| Attribute | Updates |
| --- | --- |
| `data-i18n` | Text content |
| `data-i18n-title` | `title` |
| `data-i18n-aria` | `aria-label` |
| `data-i18n-placeholder` | Placeholder |

`applyStaticI18n()` updates those elements and `document.documentElement.lang`. Dynamic text—including the legend, color names, selection summary, menus, and status—is rendered again by the application. Flags are inline SVG, so they do not depend on emoji fonts.

To add a language, add its code to `LANGS`, a native label to `LANG_META`, an SVG to `FLAGS`, a locale to `LANG_LOCALE`, and a complete dictionary with the same keys as English. The language menu grows vertically, so the toolbar does not need another flag button.

## Interaction details

- The primary node is the first selected node. Tab, notes, and single-node navigation use it.
- A marquee selects nodes whose boxes intersect the dragged rectangle. Ctrl or Shift makes that selection additive.
- Node hit testing and connection routing work in world coordinates. Pan and zoom are applied to the world container.
- Connection paths leave and enter the facing sides of their nodes. Elbow routes use a midpoint, and curves use a control offset.
- New-node placement searches nearby positions to reduce overlap.
- The editor confirms a replacement when opening a file and when starting a new map.

## Export implementation

SVG export calculates the content bounds, adds padding, draws connections as paths, and renders node text with `foreignObject`. The result keeps Unicode text, inline font formatting, lists, and hyperlinks.

PDF export builds a small PDF 1.4 document directly. It uses the node-level size and Helvetica, Helvetica-Bold, Helvetica-Oblique, and Helvetica-BoldOblique with `WinAnsiEncoding`. Inline rich-text differences and links are flattened to plain node text, with list items prefixed by bullets or numbers. Bytes outside Windows-1252 are skipped rather than replaced with a visible error. There is no embedded font and no note layer.

## Server and process control

`server.py` accepts:

```bash
python3 server.py --bind 127.0.0.1 --port 8765
```

`--bind` defaults to `127.0.0.1` and `--port` defaults to 8765. The installed runtime always passes the configured port and localhost bind address. It does not expose the server on the network.

`runtime.py` detaches the server, writes its PID, and waits briefly to detect an immediate startup failure. Output goes to `nodora-server.log`. Stopping sends `SIGTERM`, then `SIGKILL` if needed. On Windows it uses `taskkill /T /F`. A stale PID file is removed when its process no longer exists.

The manager stops the old server before copying or reconfiguring, updates the hosts block before declaring success, and opens the browser only after the new server responds to startup. If startup fails, it reports the log path.

## Security and privacy

- The application does not upload map content.
- The server has directory listing and static-file behavior only; it has no upload endpoint.
- Binding to localhost prevents other machines from reaching it through a normal network route.
- Administrator rights are requested only to edit the hosts file.
- Downloaded JSON contains notes as well as node text, so treat exported files as private documents.

## Limits

- One auto-saved map is kept per browser origin. There is no built-in library of several server-side maps.
- PDF is a visual export, not a round-trip format. Reopen the JSON file to continue editing.
- Very unusual characters can disappear in PDF output.
- The hostname cannot remove the need for a non-default port.
- Linux autostart uses the desktop autostart specification. A machine without a graphical session will not launch that desktop entry.
- macOS and Windows installation paths are implemented and reviewed, but they need to be run on those operating systems for a full end-to-end check.

## Verification during development

Syntax and isolated runtime checks:

```bash
python3 -m py_compile server.py runtime.py mindmap_manager.py
node --check app.js
node --check i18n.js
sh -n install-linux.sh install-macos.command
```

For interface changes, exercise the affected browser flow: language switching, node creation, selection, notes, saving, and export. A screenshot alone does not prove that keyboard or pointer behavior works.
