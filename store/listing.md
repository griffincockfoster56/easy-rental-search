# Chrome Web Store listing

**Name:** Easy Rental Search

**Summary (132 chars max):**
Found a rental on Airbnb or Vrbo? Find the same place on its own website and skip the booking fees.

**Category:** Shopping (alt: Travel)

**Description:**
Lots of vacation rentals are run by owners or local property managers who also take bookings on their own website, usually without the 14–15% guest service fee.

Easy Rental Search reads the listing you're looking at on Airbnb, Vrbo or Booking.com (photos, location, host, description) and finds that website for you.

✦ FIND ITS OWN WEBSITE (AI Deep Search)
An AI agent looks at the photos and listing details, runs a series of web searches (property name, exact description phrases, the host's management company, the town plus "book direct"), opens promising sites, and checks that it's really the same place. You get each match with a confidence score, the details that matched, and any price or availability it found for your dates.

🔍 FREE REVERSE IMAGE SEARCH
Tap any listing photo to search it on Google Lens, Bing, Yandex or TinEye. Owners reuse their photos on their own sites.

🌐 FREE SMART SEARCHES
One-click Google searches for the exact title, a distinctive description phrase, the host or manager, and "book direct" rentals nearby, with the big booking sites filtered out.

HOW TO USE
1. Open a listing on Airbnb, Vrbo or Booking.com.
2. Click the Easy Rental Search icon to open the side panel.
3. Press "Find its own website", or use the free tools.

AI Deep Search uses your own Anthropic API key (usually $0.50–$2 per search), stored only in your browser. The free tools need no key or account.

PRIVATE & OPEN SOURCE
No servers, no accounts, no analytics. Code: https://github.com/griffincockfoster56/easy-rental-search

Always compare the final price, cancellation terms and the site's legitimacy before booking direct.

**Privacy policy URL:** https://github.com/griffincockfoster56/easy-rental-search/blob/main/docs/privacy.md
**Homepage URL:** https://github.com/griffincockfoster56/easy-rental-search

## Privacy practices tab

**Single purpose:** Helps travelers find the independent/direct booking website for a vacation rental listing they are viewing.

**Permission justifications:**
- `sidePanel`: the extension's UI is a side panel shown next to the listing.
- `scripting`: reads the listing details (title, photos, location, host) from the rental listing page the user is viewing, when the panel is open.
- `activeTab`: access the current listing tab when the user clicks the toolbar icon.
- `storage`: saves the user's own API key and model choice locally, and caches search results for the session.
- Host permissions (airbnb, vrbo, booking.com, expedia, hometogo, evolve, plumguide): read the listing the user is viewing on these rental sites. `api.anthropic.com`: send the listing to the Anthropic API when the user runs AI Deep Search with their own key.

**Remote code:** No. All code is bundled in the package.

**Data usage:** Collects "Website content" (listing page details) only to provide the feature, sent to the Anthropic API only when the user runs AI Deep Search. Not sold, not used for unrelated purposes, not used for creditworthiness.

## Assets
- Icon: extension/icons/icon128.png
- Screenshots (1280x800): store/screenshots/*.png
- Small promo tile (440x280): store/promo-small-440x280.png
- Marquee (1400x560): store/promo-marquee-1400x560.png
- Package: `npm run zip` → store/easy-rental-search.zip
