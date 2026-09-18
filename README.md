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
