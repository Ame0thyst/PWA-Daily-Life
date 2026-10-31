const P = PropertiesService.getScriptProperties();
// 10 Kolom: Kolom B adalah User_Key untuk memisahkan data antar pengguna
const COLS = ['ID','User_Key','Timestamp','Mood','Tags','Deleted','Updated_At',
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
  return json_({ ok: true, service: 'daily-journal', multiUser: true }); 
} // health check

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const req = JSON.parse(e.postData.contents);
    if (!authOk_(req.token)) return json_({ ok: false, error: 'unauthorized' });

    // Validasi User_Key wajib disertakan untuk semua operasi
    const userKey = (req.userKey || '').trim().toUpperCase();
    if (!userKey) {
      return json_({ ok: false, error: 'missing_user_key' });
    }

    lock.waitLock(20000);
    switch (req.op) {
      case 'create': return json_(createEntry_(req.entry, userKey));
      case 'update': return json_(updateEntry_(req.entry, userKey));
      case 'delete': return json_(deleteEntry_(req.id, userKey));
      case 'list':   return json_(listEntries_(userKey, req.limit || 30));
      case 'stats':  return json_(stats_(userKey));
      case 'image':  return json_(getImage_(req.fileId));
      default:       return json_({ ok: false, error: 'unknown_op' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

// Mencari baris berdasarkan ID dan User_Key
function findRow_(sh, id, userKey) {
  const last = sh.getLastRow();
  if (last < 2) return null;
  const values = sh.getRange(2, 1, last - 1, 2).getValues();
  for (let i = 0; i < values.length; i++) {
    const rId = String(values[i][0]);
    const rUser = String(values[i][1]).trim().toUpperCase();
    if (rId === String(id) && (!userKey || rUser === userKey)) {
      return i + 2; // Baris riil di sheet (1-based, setelah header)
    }
  }
  return null;
}

function createEntry_(en, userKey) {
  const sh = sheet_();
  if (findRow_(sh, en.id, userKey)) {
    return { ok: true, id: en.id, duplicate: true }; // idempoten
  }

  let fileId = '';
  if (en.imageHD) {
    if (en.imageHD.length > MAX_IMG_B64) return { ok: false, error: 'image_too_large' };
    const bytes = Utilities.base64Decode(en.imageHD);
    const blob = Utilities.newBlob(bytes, 'image/jpeg', en.id + '.jpg');
    fileId = DriveApp.getFolderById(P.getProperty('FOLDER_ID')).createFile(blob).getId();
  }
  const tags = (en.tags || []).join(',');
  sh.appendRow([en.id, userKey, en.timestamp, en.mood, tags, false, en.updatedAt,
                fileId, en.text, en.thumb || '']);
  return { ok: true, id: en.id, fileId: fileId };
}

function updateEntry_(en, userKey) {
  const sh = sheet_(); 
  const row = findRow_(sh, en.id, userKey);
  if (!row) return { ok: false, error: 'not_found' };
  
  const cur = sh.getRange(row, 7).getValue(); // Kolom G: Updated_At
  if (cur && cur > en.updatedAt) return { ok: true, id: en.id, skipped: true }; // last-write-wins
  
  // Update kolom Mood(D), Tags(E), Deleted(F), Updated_At(G)
  sh.getRange(row, 4, 1, 4).setValues([[en.mood, (en.tags||[]).join(','), false, en.updatedAt]]);
  // Update kolom Teks (Kolom I)
  sh.getRange(row, 9).setValue(en.text);
  return { ok: true, id: en.id };
}

function deleteEntry_(id, userKey) {
  const sh = sheet_(); 
  const row = findRow_(sh, id, userKey);
  if (!row) return { ok: true, id: id }; // sudah tidak ada: anggap sukses
  
  // Kolom F: Deleted, Kolom G: Updated_At
  sh.getRange(row, 6).setValue(true);
  sh.getRange(row, 7).setValue(new Date().toISOString());
  return { ok: true, id: id };
}

// Mengambil seluruh catatan milik User_Key tertentu saja
function listEntries_(userKey, limit) {
  const sh = sheet_(); 
  const last = sh.getLastRow();
  if (last < 2) return { ok: true, items: [] };

  const rows = sh.getRange(2, 1, last - 1, COLS.length).getValues();
  const items = [];

  // Loop mundur (dari entri terbaru di bawah ke atas)
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    const rUser = String(r[1]).trim().toUpperCase();
    const isDeleted = r[5] === true;

    if (rUser === userKey && !isDeleted) {
      items.push({
        id: r[0],
        timestamp: r[2],
        mood: r[3],
        tags: r[4] ? String(r[4]).split(',') : [],
        updatedAt: r[6],
        fileId: r[7],
        text: r[8],
        thumb: r[9]
      });
      if (limit && items.length >= limit) break;
    }
  }

  return { ok: true, items: items };
}

// Statistik aktivitas hanya untuk User_Key yang meminta
function stats_(userKey) {
  const sh = sheet_(); 
  const last = sh.getLastRow();
  if (last < 2) return { ok: true, rows: [] };

  const rows = sh.getRange(2, 1, last - 1, 6).getValues();
  const result = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rUser = String(r[1]).trim().toUpperCase();
    const isDeleted = r[5] === true;

    if (rUser === userKey && !isDeleted) {
      result.push({
        id: r[0],
        t: r[2],
        mood: r[3],
        tags: r[4]
      });
    }
  }

  return { ok: true, rows: result };
}

function getImage_(fileId) {
  const blob = DriveApp.getFileById(fileId).getBlob();
  return { ok: true, base64: Utilities.base64Encode(blob.getBytes()) };
}
