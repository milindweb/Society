/**
 * Main.gs — GAS web-app entry points (doGet / doPost).
 *
 * GAS invokes these for every HTTP request to the deployed web app. Both delegate to
 * ApiRouter.handle(e) and return the JSON envelope via ContentService (text/plain bodies
 * keep cross-origin requests "simple" — see backend-architecture.md §1).
 *
 * Rules: no business logic here; this file only translates the GAS event object into a
 * router call and the router result into a ContentService output.
 */

function doGet(e) {
  e = e || {};
  e.method = 'GET';
  var result = ApiRouter.handle(e);
  return ContentService
    .createTextOutput(Utils.safeJsonStringify(result.output))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  e = e || {};
  e.method = 'POST';
  var result = ApiRouter.handle(e);
  return ContentService
    .createTextOutput(Utils.safeJsonStringify(result.output))
    .setMimeType(ContentService.MimeType.JSON);
}
