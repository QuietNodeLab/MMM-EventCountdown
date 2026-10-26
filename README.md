# MMM-EventCountdown

Event and holiday countdown cards for MagicMirror². Shows upcoming dates, today's
events, and progress through multi-day events. It reads local JSON and works offline.
No API keys, companion modules, dashboard CSS, or extra npm packages are needed.

![Synthetic example of event countdown cards](docs/preview.png)

## Installation

From your MagicMirror installation directory:

```sh
cd modules
git clone https://github.com/QuietNodeLab/MMM-EventCountdown.git
cd MMM-EventCountdown
cp countdowns.example.json ../../config/countdowns.json
```

No `npm install` is required. On Windows, copy the example file with your file
manager or PowerShell. Replace its synthetic dates with your own local data and
keep that data private. You can also download the repository ZIP and place its
contents in `MagicMirror/modules/MMM-EventCountdown`.

Add to the `modules` array in `config/config.js`:

```js
{
  module: "MMM-EventCountdown",
  position: "top_left",
  config: {
    dataFile: "countdowns.json",
    title: "Coming up",
    maxShown: 4
  }
}
```

For a first look without a data file, set `preview: true`. Preview mode uses
synthetic relative dates and does not request a file. Restart your development
MagicMirror after adding a module. Later JSON edits are read automatically.

## Data format

```json
{
  "holidays": ["halloween", "thanksgiving"],
  "events": [
    {"name": "Sample trip", "start": "2030-06-01", "end": "2030-06-03", "color": "#4FC3F7"},
    {"name": "Community picnic", "date": "2030-07-12"}
  ]
}
```

Dates use `YYYY-MM-DD`. `date` is a single day; `start` and `end` describe a range.
**Both ends are inclusive**: June 1–3 is three days, including June 3. This differs
from iCalendar's exclusive all-day ends; this module does not ingest ICS feeds.
Completed events disappear the following day. Holidays roll forward each year.
Entries sort by days remaining, start date, then name; ongoing entries count as zero
days away. No automatic recurrence is applied to custom events.

The helper searches the MagicMirror `config` directory first, then the module
folder. `dataFile` is a filename, not an arbitrary filesystem path. The arrays are
optional, so `{}` displays “Nothing coming up.” Each event needs a name and date.
Missing/invalid files and invalid event dates display an error on the card.

Supported holiday identifiers:

`new-years-day`, `mlk-day`, `valentines-day`, `presidents-day`, `easter`,
`mothers-day`, `memorial-day`, `juneteenth`, `independence-day`, `labor-day`,
`halloween`, `thanksgiving`, `christmas-eve`, `christmas`, `new-years-eve`.

These are US-oriented dates; Easter follows the Western Gregorian calculation.
Observed substitute weekdays are not calculated. Other celebrations can be supplied
as custom events. Labels and automatic emoji matching currently use English.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `dataFile` | `"countdowns.json"` | Local JSON filename |
| `title` | `"Countdown"` | Card heading |
| `maxShown` | `3` | Maximum entries displayed; use a positive integer |
| `refreshInterval` | `600000` | JSON refresh interval in milliseconds |
| `timezone` | `null` | Use browser local time, or an IANA zone such as `"Europe/London"` |
| `showEmoji` | `true` | Display automatic event icons |
| `preview` | `false` | Render synthetic examples without reading JSON |
| `debugDate` | `null` | Override today with `YYYY-MM-DD` for previews/tests |

Two instances can use separate data files; helper responses are routed by instance
identifier. Calendar-day arithmetic uses UTC internally to avoid DST rounding,
while `timezone` determines which day is “today.” No server TZ setting is needed
for these date-only JSON records. The module checks for day changes every 30 seconds.
Polling stops while suspended and resumes when shown again.

The card is scoped to its own module and capped at 480px with `max-width: 100%`.
Customize only this module in your own `custom.css`, for example:

```css
.MMM-EventCountdown .cd-card { width: 360px; }
```

Emoji appearance varies by OS/font. No image assets or fonts are downloaded.

A narrow-region example with a long synthetic label:

![Long synthetic event title in a narrow region](docs/narrow.png)

## Development and compatibility

Use Node 24 and a modern MagicMirror browser supporting standard JavaScript APIs.
The source runtime used for development is MagicMirror 2.38.0; other versions and
physical displays still require verification. The package is marked `private` to
prevent accidental npm publication; installation is by module folder.

```sh
npm ci --ignore-scripts
npm test
```

Tests cover date/range logic, holiday rollover, JSON errors, instance routing,
preview rendering, and configured timezone behavior. See [VALIDATION.md](VALIDATION.md)
for the checks actually performed and their limits.

## License and provenance

MIT; see [LICENSE](LICENSE). Copyright is attributed to module contributors.
This package extracts custom countdown code and includes standalone styling and
synthetic fixtures. It does not bundle MagicMirror source, third-party module
patches, remote service data, or a source project's Git history. The holiday
calculations use calendar arithmetic; screenshots use invented events and the
system's own emoji rendering.
