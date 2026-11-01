const P = PropertiesService.getScriptProperties();
// 10 Kolom Standar: Kolom B adalah User_Key untuk isolasi multi-user
const COLS = ['ID','User_Key','Timestamp','Mood','Tags','Deleted','Updated_At',
              'Drive_File_ID','Teks','Thumbnail_Base64'];
// Kolom Tabel Profil Pengguna (1 baris per user key)
const PROFILE_COLS = ['User_Key', 'Username', 'Avatar_File_ID', 'Avatar_Base64', 'Updated_At'];
const MAX_IMG_B64 = 3000000; // sekitar 2,2 MB biner

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Mendapatkan sheet 'entries'. Otomatis membuat dan memformat jika belum ada.
 */
function sheet_() {
  const ss = SpreadsheetApp.openById(P.getProperty('SHEET_ID'));
  let sh = ss.getSheetByName('entries');
  
  if (!sh) {
    sh = ss.insertSheet('entries');
  }

  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, COLS.length).setValues([COLS]);
    formatHeaderAndColumns_(sh, COLS, '#F4EFE6', '#2B2620');
  } else {
    const firstRow = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 10)).getValues()[0];
    if (firstRow[1] !== 'User_Key') {
      sh.insertColumnAfter(1);
      sh.getRange(1, 2).setValue('User_Key');
      const lastRow = sh.getLastRow();
      if (lastRow > 1) {
        sh.getRange(2, 2, lastRow - 1, 1).setValue('DEFAULT_USER');
      }
      formatHeaderAndColumns_(sh, COLS, '#F4EFE6', '#2B2620');
    }
  }

  return sh;
}

/**
 * Mendapatkan sheet 'profiles' untuk data username & foto profil per User_Key
 */
function profileSheet_() {
  const ss = SpreadsheetApp.openById(P.getProperty('SHEET_ID'));
  let sh = ss.getSheetByName('profiles');
  
  if (!sh) {
    sh = ss.insertSheet('profiles');
  }

  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, PROFILE_COLS.length).setValues([PROFILE_COLS]);
    formatHeaderAndColumns_(sh, PROFILE_COLS, '#EAE6DF', '#1E1B18');
  }

  return sh;
}

/**
 * Format tampilan header, warna, freeze row, dan Plain Text otomatis
 */
function formatHeaderAndColumns_(sh, cols, bgColor, textColor) {
  try {
    const headerRange = sh.getRange(1, 1, 1, cols.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground(bgColor);
    headerRange.setFontColor(textColor);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), 2).setNumberFormat('@');
  } catch (_) {}
}

/**
 * FUNGSI SETUP OTOMATIS:
 * Konfigurasi sheet 'entries' dan 'profiles' secara otomatis
 */
function setupAuto() {
  const shEntries = sheet_();
  const shProfiles = profileSheet_();
  return {
    ok: true,
    message: 'Setup otomatis selesai! Sheet "entries" (10 kolom) dan "profiles" (5 kolom) telah aktif.',
    entriesSheet: shEntries.getName(),
    profilesSheet: shProfiles.getName(),
    columns: COLS,
    profileColumns: PROFILE_COLS
  };
}

function authOk_(t) {
  const real = P.getProperty('API_TOKEN');
  return !!real && !!t && t === real;
}

function doGet(e) { 
  if (e && e.parameter && e.parameter.setup === '1') {
    if (authOk_(e.parameter.token)) {
      return json_(setupAuto());
    }
  }
  return json_({ ok: true, service: 'daily-journal', multiUser: true, profiles: true }); 
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const req = JSON.parse(e.postData.contents);
    if (!authOk_(req.token)) return json_({ ok: false, error: 'unauthorized' });

    if (req.op === 'setup') {
      return json_(setupAuto());
    }

    const userKey = (req.userKey || '').trim().toUpperCase();
    if (!userKey) {
      return json_({ ok: false, error: 'missing_user_key' });
    }

    lock.waitLock(20000);
    switch (req.op) {
      case 'create':      return json_(createEntry_(req.entry, userKey));
      case 'update':      return json_(updateEntry_(req.entry, userKey));
      case 'delete':      return json_(deleteEntry_(req.id, userKey));
      case 'list':        return json_(listEntries_(userKey, req.limit || 30));
      case 'stats':       return json_(stats_(userKey));
      case 'image':       return json_(getImage_(req.fileId));
      case 'get_profile': return json_(getProfile_(userKey));
      case 'set_profile': return json_(setProfile_(req.profile, userKey));
      default:            return json_({ ok: false, error: 'unknown_op' });
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
      return i + 2;
    }
  }
  return null;
}

function createEntry_(en, userKey) {
  const sh = sheet_();
  if (findRow_(sh, en.id, userKey)) {
    return { ok: true, id: en.id, duplicate: true };
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
  
  const cur = sh.getRange(row, 7).getValue();
  if (cur && cur > en.updatedAt) return { ok: true, id: en.id, skipped: true };
  
  sh.getRange(row, 4, 1, 4).setValues([[en.mood, (en.tags||[]).join(','), false, en.updatedAt]]);
  sh.getRange(row, 9).setValue(en.text);
  return { ok: true, id: en.id };
}

function deleteEntry_(id, userKey) {
  const sh = sheet_(); 
  const row = findRow_(sh, id, userKey);
  if (!row) return { ok: true, id: id };
  
  sh.getRange(row, 6).setValue(true);
  sh.getRange(row, 7).setValue(new Date().toISOString());
  return { ok: true, id: id };
}

function listEntries_(userKey, limit) {
  const sh = sheet_(); 
  const last = sh.getLastRow();
  if (last < 2) return { ok: true, items: [] };

  const rows = sh.getRange(2, 1, last - 1, COLS.length).getValues();
  const items = [];

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

// ==========================================
// USER PROFILE HANDLERS (Username & Foto Profil)
// ==========================================

function getProfile_(userKey) {
  const sh = profileSheet_();
  const last = sh.getLastRow();
  if (last < 2) return { ok: true, profile: null };

  const rows = sh.getRange(2, 1, last - 1, PROFILE_COLS.length).getValues();
  for (let i = 0; i < rows.length; i++) {
    const rUser = String(rows[i][0]).trim().toUpperCase();
    if (rUser === userKey) {
      return {
        ok: true,
        profile: {
          userKey: rows[i][0],
          username: rows[i][1] || '',
          avatarFileId: rows[i][2] || '',
          avatarBase64: rows[i][3] || '',
          updatedAt: rows[i][4] || ''
        }
      };
    }
  }

  return { ok: true, profile: null };
}

function setProfile_(profile, userKey) {
  if (!profile) return { ok: false, error: 'missing_profile' };
  const sh = profileSheet_();
  const last = sh.getLastRow();
  const username = (profile.username || '').trim();
  let avatarBase64 = profile.avatarBase64 || '';
  let avatarFileId = profile.avatarFileId || '';
  const updatedAt = new Date().toISOString();

  // Jika ada foto profil HD baru yang dikirim
  if (profile.avatarHD && profile.avatarHD.length <= MAX_IMG_B64) {
    try {
      const bytes = Utilities.base64Decode(profile.avatarHD);
      const blob = Utilities.newBlob(bytes, 'image/jpeg', 'avatar_' + userKey + '.jpg');
      avatarFileId = DriveApp.getFolderById(P.getProperty('FOLDER_ID')).createFile(blob).getId();
    } catch (_) {}
  }

  let existingRow = null;
  if (last >= 2) {
    const values = sh.getRange(2, 1, last - 1, 1).getValues();
    for (let i = 0; i < values.length; i++) {
      if (String(values[i][0]).trim().toUpperCase() === userKey) {
        existingRow = i + 2;
        break;
      }
    }
  }

  if (existingRow) {
    sh.getRange(existingRow, 2, 1, 4).setValues([[username, avatarFileId, avatarBase64, updatedAt]]);
  } else {
    sh.appendRow([userKey, username, avatarFileId, avatarBase64, updatedAt]);
  }

  return {
    ok: true,
    profile: {
      userKey: userKey,
      username: username,
      avatarFileId: avatarFileId,
      avatarBase64: avatarBase64,
      updatedAt: updatedAt
    }
  };
}
