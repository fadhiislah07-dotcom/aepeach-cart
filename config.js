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
  tabs: ["KR BATCH", "CH BATCH"],

  // Welcome / reminder message shown in the banner at the top.
  // Safe to edit any time — supports plain text.
  announcement:
    "🍑 Welcome to aePeach Cart! Orders are updated regularly, please check back for status changes. Kindly settle payment within 24 hours of invoicing 💌",

  // How the sheet is fetched. Leave this as "gviz" unless told otherwise.
  fetchMethod: "gviz",
};
