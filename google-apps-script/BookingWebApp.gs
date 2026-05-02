/**
 * Al-Mustafa Laser Eye Clinic — booking intake (Google Apps Script Web App)
 *
 * IMPORTANT (fixes empty sheet / "doGet" confusion):
 * - This project MUST be bound to the spreadsheet: open the Sheet →
 *   Extensions → Apps Script → paste this code here (not a standalone script).
 *   Then doPost uses SpreadsheetApp.getActiveSpreadsheet() correctly.
 * - Tab name MUST be exactly: Sheet1
 * - Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone
 * - Redeploy after every change. Ignore browser "doGet" when opening /exec — only POST from the chatbot matters.
 * - Web app URL must match BOOKING_WEBAPP_URL in js/chatbot.js (clinic frontend).
 *
 * Expected POST body (JSON): name, phone, issue, timeOfVisit
 * Sheet columns: Name | Phone | Issue | Time of Visit | Status
 */

/**
 * Receives booking JSON from the clinic chatbot and appends one row to Sheet1.
 * Returns plain text "Success" or "Error: ..." so the frontend can detect success without JSON.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput("Error: empty POST body");
    }

    Logger.log(e.postData.contents);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      return ContentService.createTextOutput(
        "Error: no active spreadsheet — bind this script to the Sheet (Extensions → Apps Script from inside the file)."
      );
    }

    var sheet = ss.getSheetByName("Sheet1");
    if (!sheet) {
      return ContentService.createTextOutput("Error: Sheet1 not found — rename the first tab to Sheet1.");
    }

    var data = JSON.parse(e.postData.contents);

    if (sheet.getLastRow() === 0 || String(sheet.getRange("A1").getValue()).trim() === "") {
      sheet.getRange(1, 1, 1, 5).setValues([["Name", "Phone", "Issue", "Time of Visit", "Status"]]);
    }

    sheet.appendRow([
      data.name || "",
      data.phone || "",
      data.issue || "",
      data.timeOfVisit || "",
      "New",
    ]);

    return ContentService.createTextOutput("Success");
  } catch (error) {
    return ContentService.createTextOutput("Error: " + (error && error.message ? error.message : String(error)));
  }
}
