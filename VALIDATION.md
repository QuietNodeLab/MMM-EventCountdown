# Local release-candidate validation

Validated with Node 24.19.0, MagicMirror 2.38.0 and headless Chromium on Linux.
No production device or external API was accessed. All displayed events are synthetic.

## Completed

- `npm ci --ignore-scripts` succeeds with the empty runtime dependency set.
- `npm test` passes 11 unit tests and syntax checks on the three runtime JS files.
- Unit tests cover inclusive final-day ranges, expired events, leap days, calendar-day
  DST arithmetic, year rollover, movable holidays, invalid schemas/dates, ordering,
  timezone boundaries, midnight polling, duplicate responses, preview/empty/error
  rendering, helper lookup and independent instance routing.
- A disposable upstream MagicMirror 2.38.0 runtime loaded only this custom module,
  its own stylesheet and synthetic data. Its config check and server startup passed.
- Two real browser instances read different JSON files through the actual NodeHelper
  and socket connection. Each retained its own entries; no cross-instance data appeared.
- Today, final-day and future cards rendered successfully. Chromium reported no
  JavaScript errors. Browser requests were restricted to the loopback test server.
- The screenshot in `docs/preview.png` was captured from the actual module in that
  runtime. `docs/narrow.png` exercises a long synthetic title in a narrow viewport;
  its card had no internal horizontal overflow. No dashboard stylesheet was loaded.
- Package source/docs were scanned for personal names, deployment paths, private
  source references and common credential formats. No findings remained. The
  extracted package contains no Git history or repository-account metadata.

## Remaining limits

Other MagicMirror versions, Electron startup, physical displays, Docker, screen-reader
behavior and prolonged unattended use have not been tested. English labels and
US-oriented holiday rules are intentional first-version limitations. Repository-name
availability is not established. No public repository, release or announcement exists.

The MIT license was selected for this package. No third-party module implementation,
photographs, proprietary font files, private calendars or service source is included.
System emoji glyphs vary across platforms; the screenshot reflects the test browser.
