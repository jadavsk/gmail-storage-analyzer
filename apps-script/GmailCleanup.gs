/**
 * Gmail Storage Analyzer - Fast first-pass cleanup report
 *
 * Purpose:
 * - Scans old Promotions/Social/Updates emails
 * - Aggregates by sender domain
 * - Estimates total storage consumed per domain
 * - Writes a LIVE Google Sheet once per run before timeout
 *
 * Requirements:
 * - Apps Script Advanced Service: Gmail API enabled
 *   Apps Script > Services > + > Gmail API > Add
 */

function liveGmailCleanupReport() {
  const query = '(category:promotions OR category:social OR category:updates) older_than:1y';
  const maxPerPage = 500; // Gmail API caps page size around 500
  const safeStopMs = 5 * 60 * 1000; // stop around 5 minutes to avoid timeout
  const startTime = Date.now();

  const props = PropertiesService.getScriptProperties();

  let pageToken = props.getProperty('live_pageToken');
  let domainMap = JSON.parse(props.getProperty('live_domainMap') || '{}');
  let totalProcessed = parseInt(props.getProperty('live_totalProcessed') || '0', 10);

  while (true) {
    const response = Gmail.Users.Messages.list('me', {
      q: query,
      maxResults: maxPerPage,
      pageToken: pageToken
    });

    const messages = response.messages || [];

    for (let i = 0; i < messages.length; i++) {
      const msg = Gmail.Users.Messages.get('me', messages[i].id, {
        format: 'metadata',
        metadataHeaders: ['From']
      });

      const fromHeader = (msg.payload.headers || []).find(h => h.name === 'From');
      const fromValue = fromHeader ? fromHeader.value : 'unknown';

      const email = extractEmail(fromValue);
      const domain = extractDomain(email);
      const sizeBytes = msg.sizeEstimate || 0;

      if (!domainMap[domain]) {
        domainMap[domain] = { count: 0, sizeBytes: 0 };
      }

      domainMap[domain].count++;
      domainMap[domain].sizeBytes += sizeBytes;
      totalProcessed++;

      if (Date.now() - startTime > safeStopMs) {
        saveLiveProgress(props, pageToken, domainMap, totalProcessed);
        writeLiveSheetOnce(domainMap, totalProcessed, false);

        Logger.log('Stopped safely.');
        Logger.log('Processed so far: ' + totalProcessed);
        Logger.log('Run liveGmailCleanupReport again to continue.');
        return;
      }
    }

    pageToken = response.nextPageToken || null;
    saveLiveProgress(props, pageToken, domainMap, totalProcessed);

    Logger.log('Processed so far: ' + totalProcessed);

    if (!pageToken) {
      writeLiveSheetOnce(domainMap, totalProcessed, true);
      Logger.log('DONE. Final report is ready.');
      return;
    }
  }
}

function writeLiveSheetOnce(domainMap, totalProcessed, isDone) {
  const props = PropertiesService.getScriptProperties();
  let sheetId = props.getProperty('live_sheetId');
  let ss;

  if (sheetId) {
    ss = SpreadsheetApp.openById(sheetId);
  } else {
    ss = SpreadsheetApp.create('LIVE Gmail Cleanup Report');
    sheetId = ss.getId();
    props.setProperty('live_sheetId', sheetId);
  }

  const sheet = ss.getSheets()[0];

  const rows = Object.entries(domainMap)
    .map(([domain, data]) => [
      domain,
      data.count,
      Math.round((data.sizeBytes / 1024 / 1024) * 100) / 100
    ])
    .sort((a, b) => b[2] - a[2])
    .slice(0, 25)
    .map((row, index) => [
      index + 1,
      row[0],
      row[1],
      row[2],
      'from:(' + row[0] + ') older_than:1y'
    ]);

  const output = [
    ['Status', isDone ? 'DONE' : 'RUNNING', '', '', ''],
    ['Processed Emails', totalProcessed, '', '', ''],
    ['Last Updated', new Date(), '', '', ''],
    ['', '', '', '', ''],
    ['Rank', 'Domain', 'Email Count', 'Total Size MB', 'Gmail Delete/Search Query'],
    ...rows
  ];

  sheet.clearContents();
  sheet.getRange(1, 1, output.length, 5).setValues(output);
  sheet.autoResizeColumns(1, 5);

  Logger.log('LIVE REPORT URL: ' + ss.getUrl());
}

function saveLiveProgress(props, pageToken, domainMap, totalProcessed) {
  if (pageToken) {
    props.setProperty('live_pageToken', pageToken);
  } else {
    props.deleteProperty('live_pageToken');
  }

  props.setProperty('live_domainMap', JSON.stringify(domainMap));
  props.setProperty('live_totalProcessed', totalProcessed.toString());
}

function extractEmail(fromValue) {
  const match = fromValue.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase();

  const plainEmail = fromValue.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (plainEmail) return plainEmail[0].toLowerCase();

  return fromValue.toLowerCase();
}

function extractDomain(email) {
  const parts = email.split('@');
  return parts.length > 1 ? parts[1].toLowerCase() : email.toLowerCase();
}

function resetLiveGmailCleanupReport() {
  const props = PropertiesService.getScriptProperties();

  props.deleteProperty('live_pageToken');
  props.deleteProperty('live_domainMap');
  props.deleteProperty('live_totalProcessed');
  props.deleteProperty('live_sheetId');

  Logger.log('Live cleanup progress reset.');
}

function showLiveGmailCleanupProgress() {
  const props = PropertiesService.getScriptProperties();
  const domainMap = JSON.parse(props.getProperty('live_domainMap') || '{}');

  Logger.log('Page token exists: ' + !!props.getProperty('live_pageToken'));
  Logger.log('Total processed: ' + (props.getProperty('live_totalProcessed') || '0'));
  Logger.log('Unique domains: ' + Object.keys(domainMap).length);
  Logger.log('Sheet ID: ' + (props.getProperty('live_sheetId') || 'Not created yet'));
}
