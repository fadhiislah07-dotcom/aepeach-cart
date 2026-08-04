/* ============================================================
   aePeach Cart — SETTINGS
   Edit the values below. You do NOT need to touch app.js or
   style.css to update your announcement, sheet, or tab names.
   ============================================================ */

const CONFIG = {

  // The long ID from your Google Sheet URL:
  // https://docs.google.com/spreadsheets/d/THIS_PART_HERE/edit
  sheetId: "1Uydfpck_G3T9cOt58IRp40FX2hkRkA3XEHv320zl4cY",

  // The exact names of the tabs you want the site to read, as they
  // appear on the tabs at the bottom of your Google Sheet.
  // Add or remove tabs here any time — the site will combine them all.
  tabs: ["KR BATCH", "CH BATCH", "TH BATCH", "INA BATCH", "MY BATCH"],

  // ==========================================================
  // ANNOUNCEMENT BOXES — edit anytime, no coding needed.
  // Shown under the "aePeach Cart" title. Add or remove boxes by
  // adding/removing {emoji, text} entries below — any number works.
  //   emoji → one emoji shown on the left of the box
  //   text  → the message shown next to it
  // ==========================================================
  announcements: [
    {
      emoji: "🍑",
      text: "Welcome to aePeach Cart! Orders are updated regularly, please check back for status changes.",
    },
    {
      emoji: "💌",
      text: "Kindly settle down your payment within 24 hours of invoicing. Please settle down your EMS before checkout.",
    },
    {
      emoji: "📢",
      text: "Further information will be update here.",
    },
  ],

  // How the sheet is fetched. Leave this as "gviz" unless told otherwise.
  fetchMethod: "gviz",
};
