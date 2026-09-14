# Society Management System - Setup Guide for AI Agents

## Prerequisites
- Google Cloud Project with **Apps Script API enabled**
- `clasp` installed and authenticated (`clasp login`)
- Project cloned locally

## IDs from `.env.original`
```
SOCIETY_SHEET_ID:      1bvgoFqay2LT92ahLQ2PC5KXGf1IjQ3hiXjaFZuQ5khA
AUTH_SHEET_ID:         1ISCaMXFsZCDBFoD1dqvhpPU_97JnqutzSmat0GUqLWM
DRIVE_ROOT_FOLDER_ID:  1xiVw5Z_dAbQQ4YNyrlu_7b1910Kv21Ec
SCRIPT_ID:             1wnxKx1VUyN_ZEOWc6ieetyOqt8yMilynxkVIy-VPlZGt7lWzYFo9OuwL
WEB_APP_URL:           https://script.google.com/macros/s/AKfycbxykEjIPkZ0XzuTmQxC2osz9nPuKp1oyI416tf4z9Et3VOgoPuFAxamsWG270KtNfyw/exec
```

## Setup Steps (Run in Order)

### 1. Push code to GAS
```bash
cd backend
clasp push --force
```

### 2. Configure IDs (Script Properties)
```bash
clasp run "Setup.configureIds" -p '[{"societySheetId":"1bvgoFqay2LT92ahLQ2PC5KXGf1IjQ3hiXjaFZuQ5khA","authSheetId":"1ISCaMXFsZCDBFoD1dqvhpPU_97JnqutzSmat0GUqLWM","driveRootFolderId":"1xiVw5Z_dAbQQ4YNyrlu_7b1910Kv21Ec"}]'
```
**OR** in GAS editor:
```js
Setup.configureIds({
  societySheetId: '1bvgoFqay2LT92ahLQ2PC5KXGf1IjQ3hiXjaFZuQ5khA',
  authSheetId: '1ISCaMXFsZCDBFoD1dqvhpPU_97JnqutzSmat0GUqLWM',
  driveRootFolderId: '1xiVw5Z_dAbQQ4YNyrlu_7b1910Kv21Ec'
});
```

### 3. Health Check
```bash
clasp run "Setup.healthCheck" -p '[]'
```
**OR** in GAS editor:
```js
Setup.healthCheck();
```

### 4. Install Sheets + Seed Data
```bash
clasp run "Setup.install" -p '[]'
```
**OR** in GAS editor:
```js
Setup.install();
```

### 5. Create Admin User
```bash
clasp run "Setup.seedAdminUser" -p '[{"username":"admin","email":"your-email@example.com","password":"YourSecurePass123!"}]'
```
**OR** in GAS editor:
```js
Setup.seedAdminUser({
  username: 'admin',
  email: 'your-email@example.com',
  password: 'YourSecurePass123!'  // min 8 chars, ≠ username/email
});
```

### 6. Deploy Web App
- GAS Editor → Deploy → New deployment
- Type: Web app
- Execute as: Me
- Who has access: Anyone
- Copy the new Web App URL

## Troubleshooting

### "Request contains an invalid argument" from `clasp run`
**Cause:** Apps Script API not enabled in Google Cloud Console.
**Fix:**
1. Go to https://console.cloud.google.com/
2. Select your project (same as script)
3. APIs & Services → Library → Search "Google Apps Script API" → Enable
4. Wait 1-2 minutes, retry `clasp run`

### clasp not authenticated
```bash
clasp login
# Follow browser prompts
```

### Permissions errors
- Ensure you're the script owner
- Check Drive folder permissions for `DRIVE_ROOT_FOLDER_ID`
- Verify sheet IDs are correct and accessible

## Verification
After all steps, verify:
- [ ] `Setup.healthCheck()` returns all `ok: true`
- [ ] Sheets created in both spreadsheets
- [ ] Admin user can login at Web App URL
- [ ] Triggers installed (check GAS Editor → Triggers)

## File Locations
- Main setup: `backend/src/Setup.gs`
- Config: `backend/src/Config.gs`
- Schema: `backend/src/Schema.gs`
- clasp config: `backend/.clasp.json`
- IDs reference: `.env.original`
