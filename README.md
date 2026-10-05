# MONA Pay for Google Sheets

A Google Apps Script that copies the incoming transactions of a MONA Pay virtual account into a Google Sheet, on demand or every hour, for tracking and reconciliation.

## Install

1. Create or open the target Google Sheet and choose **Extensions → Apps Script**.
2. Copy `Code.gs` and `appsscript.json` into the project (show `appsscript.json` via **Project Settings → Show "appsscript.json" manifest file in editor**).
3. Add the Script Properties listed under Configuration.
4. Reload the Sheet. A **MONA Pay** menu appears.

## Quick start

1. Choose **MONA Pay → Đồng bộ** (Sync) and grant the requested permissions the first time.
2. To sync automatically, choose **MONA Pay → Bật đồng bộ mỗi giờ** (Enable hourly sync), which installs a time-driven trigger.
3. **MONA Pay → Tắt đồng bộ tự động** (Disable automatic sync) removes the trigger; **Hướng dẫn cấu hình** (Setup guide) shows the required properties.

## Configuration

Set these in **Project Settings → Script Properties**:

| Property | Required | Meaning |
| --- | --- | --- |
| `MONAPAY_USERNAME` | yes | MONA Pay username |
| `MONAPAY_PASSWORD` | yes | MONA Pay password |
| `MONAPAY_VIRTUAL_ACCOUNT_NUMBER` | yes | Virtual account (VA) to sync |
| `MONAPAY_BASE_URL` | no | Defaults to `https://api.monapay.vn` |
| `MONAPAY_SHEET_NAME` | no | Defaults to `MONA Pay Transactions` |

Credentials live in Script Properties, not in Sheet cells. Give edit access to the Apps Script project only to people allowed to use the MONA Pay account. The script only logs in and reads transactions, so it does not need a Client Secret.

The manifest requests these OAuth scopes: `spreadsheets.currentonly`, `script.external_request` and `script.scriptapp`.

## Usage

The sheet is created if missing, with the columns `transaction_code`, `amount`, `description`, `transfer_date`, `account_number`, `bank_name`, `type` and `synced_at`.

How a sync works:

- The script reads the VA's transactions 100 per page, newest first, up to 100 pages.
- When it meets a `transaction_code` that is already in the sheet, it finishes the current page and stops.
- New rows are appended oldest first.
- A document lock stops two runs from writing at the same time, and the `transaction_code` column is the deduplication key.

Apps Script is not a real-time order confirmation system. Use the sheet for tracking and reconciliation; a sales flow still needs an HMAC-verified webhook, a database transaction and a unique constraint on `transaction_code`.

Documentation: https://monapay.vn/docs

**MONA Pay is part of MONA Cloud by The MONA Group.**
