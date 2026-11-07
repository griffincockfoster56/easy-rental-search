<p align="center"><img src="assets/logo-512.png" width="96" alt="Easy Rental Search logo"></p>

<h1 align="center">Easy Rental Search</h1>
<p align="center"><b>Found a rental on Airbnb or Vrbo? Find the same place on its own website and skip the booking fees.</b></p>

Lots of vacation rentals are run by owners or local property managers who also take bookings on their own website, usually without the 14%+ guest service fee. Easy Rental Search is a free, open-source Chrome extension that reads the listing you're looking at (photos, location, host, description) and goes looking for that site.

## What it does

Open any Airbnb, Vrbo or Booking.com listing and click the Easy Rental Search icon. A side panel opens with:

- **✦ Find its own website (AI Deep Search).** An AI agent (Claude, with live web search) looks at the photos and listing details, runs a bunch of searches (property name, exact description phrases, the host's management company, the town plus key features plus "book direct"), opens promising sites, and checks that it's really the same house. You get matches with a confidence score, the evidence that matched, and any price it found for your dates.
- **Reverse image search (free).** Tap any listing photo to search it on Google Lens, Bing, Yandex or TinEye. Owners reuse their photos on their own sites.
- **Smart searches (free).** One-click Google searches for the exact title, a distinctive description phrase, the host or manager, and "book direct" rentals in the area, with the big booking platforms filtered out.
- **Map.** Jump to the listing's approximate pin on Google Maps.

The free tools need no account. AI Deep Search uses your own [Anthropic API key](https://console.anthropic.com/settings/keys) (typically $0.20–$1 per search), stored only in your browser.

## Install

**Chrome Web Store:** _link coming soon_

**From source:**

```bash
git clone https://github.com/griffincockfoster56/easy-rental-search
cd easy-rental-search
npm install
npm run build
```

Then open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick the `extension/` folder.

## How it works

| File | What it does |
| --- | --- |
| `src/extract.js` | Injected into the listing tab. Pulls the title, description, photos, map pin, host, amenities, dates and price from the page (Airbnb DOM + embedded data, JSON-LD for Vrbo/Booking). |
| `src/tools.js` | Builds the free reverse-image and Google search links. |
| `src/ai.js` | The Deep Search agent: sends photos + details to Claude with the web search and web fetch tools, streams each search into the UI, and parses a structured verdict. |
| `src/sidepanel.js` | Side panel UI. |
| `extension/` | The unpacked extension (Manifest V3). `npm run build` bundles `src/` into `extension/sidepanel.js`. |

## Privacy

No servers, no analytics, no tracking. Listing data only leaves your browser when you click a search link or run AI Deep Search (then it goes straight to the Anthropic API with your key). Full policy: [docs/privacy.md](docs/privacy.md).

## Notes

- Booking direct is often cheaper but not always. Compare the final total, and check cancellation terms and that the site is legitimate before paying.
- Platforms blur the exact address, so matches are verified on details (name, bedrooms, amenities, description wording), not the pin.

## License

MIT
