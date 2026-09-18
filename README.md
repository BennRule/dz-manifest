# DZ Manifest

Live skydiving manifest display for multiple dropzones, picked from a selector in the header. Headcorn, Old Sarum and Swansea come from the GoSkydive API; the rest come from Burble public boards. Formerly Headcorn Manifest. A single-page web app with no build step, designed for ops screens and wallboards.

## Deployment

### GitHub Pages

1. Push the repo to GitHub
2. Go to **Settings > Pages**
3. Set source to the branch containing `index.html`
4. The app will be available at `https://<username>.github.io/<repo>/`

### Any static host

Serve `index.html` from any web server or CDN. No build step or dependencies required (fonts load from Google Fonts CDN).

### Local

Open `index.html` directly in a browser.

## API

**Base URL:** `https://dz.goskydive.com`

**Auth:** HTTP Basic — pass an `Authorization: Basic <token>` header.

### Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/manifests?dropzone_id=<id>` | GET | Returns today's manifest/load data |
| `/calendar/weather-holds?dropzone_id=<id>&date=YYYY-MM-DD` | GET | Returns weather hold status and wallboard message |

Both endpoints are polled every 30 seconds (configurable in settings).

### Dropzone IDs

| Dropzone | ID |
|---|---|
| Headcorn | `dz_0kFFGQXAkk` |
| Old Sarum | `dz_0dropzone1` |
| Swansea | `dz_0rU8gA2pHO` |

## Burble dropzones

Dropzones that run Burble DZM and have their public board switched on (`https://dzm.burblesoft.com/jmp?dz_id=NNN`) can be shown too. The board's JSON feed needs a session cookie and a POST, so it only works through the Cloudflare Worker's `?burble=<dz_id>` route (see `worker.js`), not the generic fallback proxies. Redeploy the Worker (`npx wrangler deploy`) after changing it.

| Dropzone | Burble `dz_id` |
|---|---|
| Langar | 531 |
| Netheravon | 398 |
| Sibson | 8154 |
| Black Knights | 9134 |
| Beccles | 8494 |
| Skydive GB | 8144 |
| Skydive Spain | 2351 |

The Burble feed is thinner than GoSkydive: current and upcoming loads only (no landed loads or history), load status, expected take-off, slots, LM/DZSO/GCA, and jumpers in their exit groups with a free-text jump code. No weights, licences, notes, weather hold or realtime push, so those parts of the board stay empty and it polls on the refresh interval.

### Adding a dropzone

Add a row to the `DROPZONES` array near the top of the script in `index.html`: `key` (`burble:<dz_id>` or the GoSkydive id), `provider`, `name`, and the `lat`/`lon` of the landing area. The weather panel and the landing-pattern satellite map both centre on that point. Headcorn, Langar, Netheravon, Beccles and Skydive Spain are pinpointed landing areas; the others use the airfield reference point and are flagged `approx: true`, which shows a note under the map.

## Tracking plan

The **Track Plan** button in the filter bar opens a planner for tracking jumps, for whichever dropzone is selected. A tracking group leaves the run-in (jump run) at 90 degrees, left or right.

- **Run-in heading** defaults to into the wind at exit height (from the Open-Meteo winds aloft) and can be set by hand. A hand-set value is dropped when the dropzone changes.
- **Plan view**: satellite map with the run-in line, exit point, the heading flown (dashed) and the expected path over the ground once the mean upper wind has pushed the group (solid), ending at the pull point.
- **View from exit height**: the same satellite imagery re-projected as seen from the exit point at exit height, facing along the track, 35 degrees below the horizon, with nearby towns and villages labelled with their distance. It is a flat render with no terrain relief; the link under it opens the same camera in Google Earth for full 3D. Drag the view to look around (the imagery covers every direction out to about 40 km), scroll or pinch to zoom, double-click or Reset to face along the track again, and Full screen to fill the display. On a phone, a sideways drag turns the view while an up/down swipe still scrolls the page; in full screen the drag also tilts.
- Track distance is glide ratio x height lost between exit and pull, at an assumed 45 m/s (about 100 mph) fall rate. It is a planning aid, not a spot calculation: the pilot and DZ decide the run-in and exit order.

Landmark names are baked into `DZ_PLACES` in `index.html` (from OpenStreetMap, ODbL) so the planner has no live lookup to fail. When adding a dropzone, add its towns and villages there too, as `[name, lat, lon, rank]` with rank 2 = city, 1 = town, 0 = village.

## Landing pattern, 3D view and run-in

The sidebar map under the weather has a **Landing pattern / Run-in** selector.

- **Landing pattern** is the 900 / 600 / 300 ft circuit on the satellite map, as before. The **3D view of the pattern** button opens the same circuit drawn in 3D over the satellite ground, with a pole under each turn point and the path's shadow on the ground. Drag to orbit and tilt, scroll or pinch (or + and -) to move in and out, double-click or Reset for the starting view, Esc or Close to leave. Both full-screen views (this one and the tracking view) size themselves to the screen, so a phone held upright gets a tall picture with a wider vertical angle, not a letterboxed landscape one, and they redraw when the phone is turned.
- **Run-in** shows the jump run over the DZ instead. The heading is the same one the Tracking Plan uses: auto is into the wind at exit height, or untick Auto and enter the heading the CI has set. A hand-set heading is remembered for that dropzone for the rest of the day only. Below the map it lists the wind at exit height, the head/tailwind on the run-in, the ground speed for the aircraft TAS you enter (default 90 kt), and the time to leave between groups.

Time between groups = distance / ground speed, rounded up, never under 5 s, for the commonly taught 300 m between solos and small groups and 500 m between groups of four or more. British Skydiving's Operations Manual, Jump Pilots Manual and Tracking Progression Manual set no separation figures, so these are not a British Skydiving standard: the CI and jumpmaster brief is what counts. The constants are `RI_SEP_SMALL_M`, `RI_SEP_LARGE_M` and `RI_MIN_SECS` in `index.html` if a DZ uses different numbers.

## Data Schema

### Manifest

```json
{
  "liftNumber": 3,
  "manifestStatus": "airborne | trained | candidate | landedComplete | draft",
  "manifestDate": "2026-04-06",
  "dropzoneId": "dz_0kFFGQXAkk",
  "planeSlots": 18,
  "passengerSlots": 6,
  "takeOffDateTime": "2026-04-06T10:30:00Z",
  "landedDateTime": null,
  "customerCount": 4,
  "colleagueCount": 8,
  "customers": [],
  "colleagues": [],
  "sets": []
}
```

### Customer

```json
{
  "eid": "cust_abc",
  "setEid": "set_123",
  "customerRole": "tandem",
  "fullName": "Jane Smith",
  "arrivalTime": "09:00:00",
  "weightInLbs": 150,
  "teamName": null,
  "isTrained": true,
  "prominantNote": "Birthday jump!",
  "fitSignatureFileLocation": "https://..."
}
```

### Colleague

```json
{
  "eid": "col_xyz",
  "setEid": "set_123",
  "colleagueRole": "tandemInstructor | tandemInstructorWithHandcam | tandemVideographer | sportsSolo",
  "fullName": "John Doe",
  "weightInLbs": 180,
  "bpaLicenseType": "a | b | c | d",
  "cameraName": "GoPro Hero 12",
  "jumpMasterSeniority": 5
}
```

### Set

```json
{
  "eid": "set_123",
  "skydiveType": "tandem | colleagueSports",
  "jumpAltitudeInFt": 15000,
  "requiresCameraHandcam": true,
  "requiresCameraFreefall": false,
  "requiresCoach": false,
  "specialWarning": null
}
```

### Linking

Customers, colleagues, and sets are linked by `setEid`. A tandem customer shares a `setEid` with their instructor and optional videographer. Always match by `setEid`, never by array position.

## Settings

The dropzone is chosen from the selector in the header and remembered in `localStorage`.

Click the cog icon to configure:
- **API Key** — Base64-encoded Basic auth credentials
- **Refresh interval** — polling frequency in seconds (default 30)

Settings persist in `localStorage`.

## CORS

The GoSkydive API may not include CORS headers for all origins. If you see fetch errors, you may need to:
- Open the official GoSkydive wallboard first to establish a session cookie
- Use a CORS proxy
- Deploy behind a reverse proxy that adds the appropriate headers
