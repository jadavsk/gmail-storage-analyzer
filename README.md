# Gmail Storage Analyzer

A Google Apps Script utility to identify Gmail storage cleanup targets.

## What it does

- Scans old Gmail messages from Promotions, Social, and Updates categories.
- Aggregates messages by sender domain.
- Estimates total storage used by each domain.
- Creates a live Google Sheet report with Gmail search/delete queries.
- Stops before Apps Script timeout and resumes on the next run.

## Setup

1. Go to Google Apps Script: https://script.google.com
2. Create a new project.
3. Paste `apps-script/GmailCleanup.gs` into `Code.gs`.
4. Enable Gmail Advanced Service:
   - Left sidebar > Services > +
   - Choose **Gmail API**
   - Click **Add**
5. Run `liveGmailCleanupReport`.
6. Approve permissions.

## Usage

Run:

```text
liveGmailCleanupReport
```

The script processes emails until it is close to Apps Script timeout, writes a live Google Sheet, and stops safely.

Run the same function again to continue.

To reset progress:

```text
resetLiveGmailCleanupReport
```

To check progress:

```text
showLiveGmailCleanupProgress
```

## Report output

The Google Sheet includes:

- Status
- Processed email count
- Last updated timestamp
- Top domains by estimated Gmail size
- Gmail search/delete query for each domain

Example query:

```text
from:(linkedin.com) older_than:1y
```

## Safety notes

Review Gmail results before deleting. Avoid bulk deleting finance, legal, tax, immigration, healthcare, job, or insurance emails.

Deleting emails does not free space until Gmail Trash is emptied.
