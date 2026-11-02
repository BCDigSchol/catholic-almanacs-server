# Content pages

Essays, guides and project pages live in this folder as files; the site
serves them at `/pages/…`, lists them, and puts them in the top menu. No
Angular knowledge is needed, and most authors never touch these files:
they write in the site's **writing tool** (`/write`, for editors who have
signed in) and export a zip, which the team drops in here.

## Adding a page someone sent you

1. Unzip it into this folder, so it sits at `page-content/<slug>/index.md`
   with its pictures beside it — or, from `client/`, run

       npm run pages:import path/to/the-page.zip

   which does the same (a folder works too: `npm run pages:import path/to/folder`).
2. Run `npm start` or `npm run build`. Both regenerate `pages.json`, so the
   page is in the listing at `/pages` and, if its front matter places it, in
   the top menu. Nothing else to edit.
3. Commit the folder (and `pages.json`).

A revision of an existing page arrives the same way: its folder replaces the
old one. Pages marked `draft: true` render at their address but are kept out
of the listing and the menu.

## What a page is

| You add | The site serves it at |
|---|---|
| `essays/my-essay/index.md` + its pictures (+ `style.css`) | `/pages/essays/my-essay` |
| `my-note.md` | `/pages/my-note` |
| `almanacs/contact.md` | `/pages/almanacs/contact` |
| `custom-layout.html` | `/pages/custom-layout` |

Folder and file names: letters, numbers, hyphens and underscores, no
spaces. A folder page keeps everything that belongs to it together — put
pictures in the folder and refer to them by name (`![…](map.jpg)`), and
they go wherever the folder goes. If both `foo.md` and `foo.html` exist,
the `.md` wins. `README.md`, `pages.json` and `site-nav.json` are not pages.

## Front matter

A page starts with a block of `key: value` lines between `---` fences. All
are optional; the site draws the masthead, byline and "How to cite" block
from them. The worked example, with every device a page can use, is
[`essays/writing-a-page/index.md`](essays/writing-a-page/index.md)
(on the site at `/pages/essays/writing-a-page`).

```
---
title: The Jesuits in Maine
description: One line, shown in the listing
authors: Jane Doe (Boston College); John Roe (Catholic University of America)
date: 2026-03-01
kind: essay
abstract: A paragraph set in italics under the title.
menu: The Almanacs > The data
draft: true
editors: true
cite: Doe, Jane. "The Jesuits in Maine." …  (optional: replaces the generated citation)
---
```

- `authors` — separated by `;`, each with an affiliation in parentheses.
- `kind` — groups the listing (`essay` → "Essays", `guide` → "Guides", …).
- `menu` — where the page goes in the top menu: the group labels, outermost
  first, separated by `>`. Groups that do not exist yet are created. Without
  it the page is only in the listing (and under any menu item with
  `"pages": true`, see below).
- `draft` — reachable at its address, unlisted.
- `editors` — for signed-in editors only: unlisted for everyone else, and
  the address sends them to the sign-in page (the file itself is still a
  static asset, so this hides a page rather than secures it).

Without a `title`, the body's first heading is used (and not shown twice).

## Writing the body

Markdown, as the writing tool exports it (and as you may write by hand):

- Headings `##` and `###`, **bold**, *italics*, lists, quotes, tables, links.
  Links that start with `/` stay inside the site (`/institution/alb.ny.0001`,
  `/people?name=Fenwick`, `/dashboards/overview?years=1850`).
- **Footnotes:** `text[^1]` in the body and `[^1]: The note.` at the end;
  numbered in order and gathered under *Notes*. Write the bibliography as a
  section of its own, in whatever style the field uses.
- **Pictures:** `<figure><img src="map.jpg" alt="…"><figcaption>…</figcaption></figure>`;
  add `class="wide"` or `class="full"` to the figure to let it run wider than
  the text.
- **Alignment:** wrap a block in `<div class="align-center">` or
  `<div class="align-right">` (a blank line inside, as below).
- **Layouts** are plain `<div>`s around Markdown (leave a blank line inside):
  `pull` (a pull quote), `note` (small-print aside), `columns` (two columns),
  `beside` / `beside right` (the first child is a picture, the rest runs
  beside it).
- **A record card:** `<almanac-record record="alb.ny.0001" year="1850"></almanac-record>`
  — a live card for an institution or person (ids as in their addresses).
- **An embedded view:** `<almanac-embed src="/dashboards/overview?years=1850" height="560" caption="…"></almanac-embed>`
  — any dashboard, map or record page of the site in the state its address
  gives (every control writes the address). Add `lazy` to load it on request.
- A page's own CSS goes in `style.css` beside `index.md` (or `<page>.css`
  beside `<page>.md`); its rules reach that page only. The site's tokens
  (`var(--rubric)`, `var(--font-display)`, …) work in it.
- `<script>` tags are not executed.

HTML pages (`.html`) are for custom layouts and may use Tailwind utility
classes; write only the body fragment.

## The top menu: `site-nav.json`

The built-in items (Institutions, People, Dashboards) come first; this file
adds the rest. Each item has a `label` and either a `link` or `children`;
children may have children, to any depth. A wide screen shows a dropdown
(nested groups as sections), a phone an accordion.

```json
{
  "items": [
    { "label": "Essays", "pages": true },
    {
      "label": "The Almanacs",
      "children": [
        { "label": "About", "link": "/pages/about" },
        { "label": "The data", "children": [
          { "label": "What the data holds", "link": "/pages/almanacs/the-data" }
        ]},
        { "label": "Contact", "link": "/pages/almanacs/contact" }
      ]
    }
  ]
}
```

`"pages": true` makes an item list every published page (from
`pages.json`), linking to the listing itself; a page's own `menu` front
matter adds it under the groups it names. Links may point anywhere on the
site.

## `pages.json`

Generated — do not edit. `npm start` and `npm run build` rebuild it from
the files (`npm run pages:index` by hand): slug, title, description, date,
authors, kind, menu and draft for every page, newest first.
