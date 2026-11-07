// Clicking the toolbar icon opens the Easy Rental Search side panel.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error(err));
