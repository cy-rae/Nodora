# User guide

Nodora is designed for keyboard-first brainstorming. The canvas holds the map, the inspector on the left changes the current selection, and the toolbar handles files, history, zoom, notes, and the shortcut legend.

## First map

A new map starts with one root node, **Central idea** in English, set to 48 px and bold. Its default title is **Brainstorming**. Spanish uses **Lluvia de ideas** and French uses **Remue-méninges** for that initial title. Existing text is never rewritten when the interface language changes.

Double-click an empty part of the canvas to create a free node. Select a node and press Tab to create a connected child.

## Nodes

Each node has:

- text, including line breaks and lists,
- one of nine colors,
- a font family,
- a font size from 10 px to 96 px,
- bold, italic, and underline styles,
- optional rich-text formatting and hyperlinks inside the text,
- an optional private note.

### Create and edit

| Action | Result |
| --- | --- |
| Tab | Create a child of the selected node |
| Shift+Tab | Create a sibling under the same parent |
| Enter or F2 | Edit the selected node |
| Double-click a node | Edit its text |
| Double-click empty canvas | Create a free node |
| Shift+Enter while editing | Insert a line break |
| Enter while editing | Finish editing, or add a list item |
| "- " at the start of a line | Start a bulleted list |
| "1. " at the start of a line | Start a numbered list |
| Tab while editing a list | Indent the item, up to two levels |
| Shift+Tab while editing a list | Outdent, or restore the "- " or "1. " marker |
| Esc | Finish editing, close a menu, cancel a connection, or clear the selection |
| Delete or Backspace | Delete every selected node and connection |

A Tab child copies the parent’s color and text style, connects to it with the current connection style, and uses a font size 4 px smaller than its parent. The size never goes below 10 px. A grandchild is therefore 8 px smaller than the root, and so on. A sibling keeps the selected node’s size.

While a node is being edited, typing is normal. Bold, italic, underline, and the font size then apply to the selected words. The node-level style, including bold on a new root, still covers every part of the node that has no inline override, including list items.

### Colors

Colors are numbered 1 through 9:

| Key | Color |
| --- | --- |
| 1 | Sand |
| 2 | Coral |
| 3 | Amber |
| 4 | Sage |
| 5 | Teal |
| 6 | Sky |
| 7 | Iris |
| 8 | Rose |
| 9 | Ink |

Pressing a number, or choosing a swatch, applies that color to every selected node. A connection takes its color from its source node.

### Fonts and rich text

The font-family selector offers Modern Sans, Classic Serif, Monospace, and Rounded. Choosing a family while a node is selected changes the whole node. Font size, bold, italic, and underline continue to work at node level.

To format only part of a node:

1. Double-click the node or press Enter to edit it.
2. Select the words to change.
3. Choose a font family or size, or use bold, italic, and underline.

Inline formatting overrides the node’s base style for that selection. Different families, sizes, and styles can therefore appear in the same node. New and existing plain-text maps remain compatible.

Use the link button or Ctrl+K while editing to turn selected text into a hyperlink. Enter an HTTP, HTTPS, or `mailto:` address. If the scheme is omitted, Nodora adds `https://`. With no selected text, the address itself is inserted as linked text. Links open in a new browser tab when the node is not being edited.

The list buttons, Ctrl+Shift+8, and Ctrl+Shift+7 turn the current line into a bulleted or numbered list. Typing `- ` or `1. ` at the beginning of a line does the same, so a heading and a list can share one node. Each item keeps its own inline size, weight, and style. Enter at the end of an item starts the next item with the formatting at the caret and places the cursor after the marker. Tab indents the current item, up to two levels. A numbered item then reads `1.1.` and, one level deeper, `1.1.1.`. Shift+Tab outdents it. On the outermost level, Shift+Tab turns the item back into the typed `- ` or `1. ` marker. Enter adds another item at the same depth. Enter on an empty indented item outdents it, and Enter on an empty outermost item leaves the list. Backspace at the start of an item joins it with the previous one. Shift+Enter still inserts a line break inside an item. Outside a list, Tab still creates a child node.

### Font size

Use the slider or type a number in the pixel field. The number is applied when you leave the field or press Enter. If the selection contains more than one font size, the field shows the translated word for “mixed” until one size is chosen. Ctrl+Plus and Ctrl+Minus change the selected nodes by 2 px. On macOS, use Command instead of Ctrl. When nothing is selected, those shortcuts zoom the canvas instead.

## Selection

Click a node to select it. Ctrl+click or Shift+click adds or removes a node. On macOS, Command+click does the same as Ctrl+click.

Right-drag on empty canvas draws a selection box. Every node touched by that box becomes selected. Hold Ctrl or Shift while right-dragging to add those nodes to the existing selection. A right-click without dragging does not change the selection.

The whole selection can then be styled, moved, or deleted together:

- Dragging one selected node moves all selected nodes by the same amount.
- Arrow keys nudge them by 8 px, or by 24 px with Shift.
- Delete removes all selected nodes and any connections that belong to them.

Right-click a node for **Edit text**, **Note**, **Connect**, **Duplicate**, and **Delete**.

## Connections

The inspector’s connection controls describe the style used for the next connection: curve, straight line, or elbow; solid, dashed, or dotted; and an optional arrowhead.

| Action | Result |
| --- | --- |
| V, then click the target | Connect the selected node |
| Drag the dot on a node | Pull a new connection to another node |
| R | Cycle the path style |
| G | Cycle the dash style |
| P | Turn the arrowhead on or off |

If a connection is selected, R, G, and P change that connection. Otherwise they change the style remembered for the next one. Duplicate connections between the same two nodes are rejected. Right-click a connection to change its path, arrowhead, or to delete it.

Alt+Arrow jumps from a single selected node to a neighboring node in that direction.

## Canvas navigation

| Action | Result |
| --- | --- |
| Mouse wheel | Zoom toward the pointer |
| Space+drag, or middle-drag | Pan |
| Left-drag on empty canvas | Pan |
| Ctrl+0 | Fit the whole map |
| Click the zoom percentage | Return to 100% |
| Fit | Fit the map in the window |

Zoom is limited to the range used by the editor, from 35% to 220%.

## Notes

Select a node and press Ctrl+N, or use the **Notes** button, to open its note. Notes are saved with the map and the manual JSON file. They are deliberately omitted from SVG and PDF exports.

The note panel shows the selected node’s text. If several nodes are selected, it follows the primary selected node.

## Languages

The interface supports German, English, Italian, Spanish, and French. On the first visit, Nodora uses the first matching browser language. If the browser language is not one of those five, it uses English.

Click the globe button in the top-right corner to open the language menu. Each entry shows its country flag and the language name:

| Language | Flag |
| --- | --- |
| Deutsch | Germany |
| English | United Kingdom |
| Italiano | Italy |
| Español | Spain |
| Français | France |

The choice is stored in this browser and overrides the browser language on later visits. It changes interface labels, shortcut names, messages, and the text of newly created nodes. It does not translate text that has already been written.

Close the menu with Esc, a click outside it, or by choosing a language. Esc in this situation does not clear the node selection.

## Saving and opening

Auto-save is on by default. About 350 ms after a change, the current map is written to this browser’s `localStorage`. The status line shows when it was saved. Turn **Auto-save** off to keep changes only in the current session; closing the page can then ask for confirmation.

Auto-save belongs to the exact browser origin. These are different stores:

- `http://127.0.0.1:8765`
- `http://localhost:8765`
- `http://<user>.nodora.local:8765`

Use **Save** or Ctrl+S to download a `.nodora.json` file. Use **Open** or Ctrl+O to replace the current map with a file. **New** asks for confirmation and starts again from one root node. The previous auto-saved state remains available only when auto-save is enabled or the map was downloaded.

Undo and redo cover content changes. Ctrl+Z undoes, and Ctrl+Y or Ctrl+Shift+Z redoes. The view position is not part of those history snapshots.

## Clipboard

| Shortcut | Result |
| --- | --- |
| Ctrl+C | Copy selected nodes and their internal connections |
| Ctrl+X | Cut them |
| Ctrl+V | Paste them |
| Ctrl+D | Duplicate them |
| Ctrl+A | Select all nodes |

Copied nodes keep their styles and notes. Pasted nodes are offset from the originals.

## Export

| Shortcut | Format |
| --- | --- |
| Ctrl+E | SVG |
| Ctrl+P | PDF |

Both exports include the title, nodes, styles, and connections. Notes are not drawn.

SVG preserves Unicode text, inline font formatting, lists, and hyperlinks. PDF uses the node-level style with standard Helvetica fonts and the Windows-1252 character set; inline font differences and links are flattened to plain text, and lists become lines with bullets or numbers. German characters such as ä, ö, ü, and ß are included, while characters outside that set are omitted. For a fully faithful visual export, use SVG.

## Shortcut legend

Press Ctrl+L or `?` to show every shortcut inside the application. The legend is translated with the interface. Physical keys stay the same; only modifier names such as Ctrl, Shift, and Delete change with the language. On macOS, Command is accepted wherever the documentation says Ctrl.

The legend is the authoritative list while using the application. The tables in this guide describe the same behavior.
