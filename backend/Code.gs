const P = PropertiesService.getScriptProperties();
const COLS = ['ID','Timestamp','Mood','Tags','Deleted','Updated_At',
              'Drive_File_ID','Teks','Thumbnail_Base64'];
const MAX_IMG_B64 = 3000000; // sekitar 2,2 MB biner

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  return SpreadsheetApp.openById(P.getProperty('SHEET_ID')).getSheetByName('entries');
}

function authOk_(t) {
  const real = P.getProperty('API_TOKEN');
  return !!real && !!t && t === real;
}

function doGet() { 
  return json_({ ok: true, service: 'daily-journal' }); 
} // health check

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const req = JSON.parse(e.postData.contents);
    if (!authOk_(req.token)) return json_({ ok: false, error: 'unauthorized' });
    lock.waitLock(20000);
    switch (req.op) {
      case 'create': return json_(createEntry_(req.entry));
      case 'update': return json_(updateEntry_(req.entry));
      case 'delete': return json_(deleteEntry_(req.id));
      case 'list':   return json_(listEntries_(req.limit || 20, req.cursor || null));
      case 'stats':  return json_(stats_());
      case 'image':  return json_(getImage_(req.fileId));
      default:       return json_({ ok: false, error: 'unknown_op' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function findRow_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return null;
  const hit = sh.getRange(2, 1, last - 1, 1)
    .createTextFinder(id).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : null;
}

function createEntry_(en) {
  const sh = sheet_();
  if (findRow_(sh, en.id)) return { ok: true, id: en.id, duplicate: true }; // idempoten

  let fileId = '';
  if (en.imageHD) {
    if (en.imageHD.length > MAX_IMG_B64) return { ok: false, error: 'image_too_large' };
    const bytes = Utilities.base64Decode(en.imageHD);          // base64 mentah tanpa prefix data:
    const blob = Utilities.newBlob(bytes, 'image/jpeg', en.id + '.jpg');
    fileId = DriveApp.getFolderById(P.getProperty('FOLDER_ID')).createFile(blob).getId();
  }
  const tags = (en.tags || []).join(',');
  sh.appendRow([en.id, en.timestamp, en.mood, tags, false, en.updatedAt,
                fileId, en.text, en.thumb || '']);
  return { ok: true, id: en.id, fileId: fileId };
}

function updateEntry_(en) {
  const sh = sheet_(); 
  const row = findRow_(sh, en.id);
  if (!row) return { ok: false, error: 'not_found' };
  const cur = sh.getRange(row, 6).getValue();
  if (cur && cur > en.updatedAt) return { ok: true, id: en.id, skipped: true }; // last-write-wins
  sh.getRange(row, 3, 1, 4).setValues([[en.mood, (en.tags||[]).join(','), false, en.updatedAt]]);
  sh.getRange(row, 8).setValue(en.text);
  return { ok: true, id: en.id };
}

function deleteEntry_(id) {
  const sh = sheet_(); 
  const row = findRow_(sh, id);
  if (!row) return { ok: true, id: id };            // sudah tidak ada: anggap sukses
  sh.getRange(row, 5).setValue(true);
  sh.getRange(row, 6).setValue(new Date().toISOString());
  return { ok: true, id: id };
}

// Paginasi kursor: baca per blok baris dari bawah, bukan getDataRange()
function listEntries_(limit, beforeRow) {
  const sh = sheet_(); 
  const last = sh.getLastRow();
  const end = beforeRow ? Math.min(beforeRow - 1, last) : last;
  if (end < 2) return { ok: true, items: [], nextCursor: null };
  const start = Math.max(2, end - limit + 1);
  const rows = sh.getRange(start, 1, end - start + 1, COLS.length).getValues();
  const items = rows.reverse().filter(r => r[4] !== true).map(r => ({
    id: r[0], timestamp: r[1], mood: r[2],
    tags: r[3] ? String(r[3]).split(',') : [],
    updatedAt: r[5], fileId: r[6], text: r[7], thumb: r[8]
  }));
  return { ok: true, items: items, nextCursor: start > 2 ? start : null };
}

// Hanya kolom 1-5: tanpa teks dan thumbnail, jadi tetap cepat
function stats_() {
  const sh = sheet_(); 
  const last = sh.getLastRow();
  if (last < 2) return { ok: true, rows: [] };
  const rows = sh.getRange(2, 1, last - 1, 5).getValues()
    .filter(r => r[4] !== true)
    .map(r => ({ id: r[0], t: r[1], mood: r[2], tags: r[3] }));
  return { ok: true, rows: rows };
}

function getImage_(fileId) {
  const blob = DriveApp.getFileById(fileId).getBlob();
  return { ok: true, base64: Utilities.base64Encode(blob.getBytes()) };
}
