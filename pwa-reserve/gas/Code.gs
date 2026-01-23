// TERACO 予約 PWA 用 Google Apps Script バックエンド（多枠対応版）
//  - 一覧:        doGet?action=overview&name=藤崎
//  - 予約まとめ:  POST action=batch_reserve  { name, slots: [slot_id,...] }
//  - 取消まとめ:  POST action=batch_cancel  { name, event_ids: [id,...] }

const CONFIG = {
  TIMEZONE: 'Asia/Tokyo',
  CALENDAR_ID: 'primary', // 先生の予定を入れるカレンダー
  TEACHER_EMAIL: 'fujisaki@teraco-labo.com',
  TITLE_PREFIX: 'TERACO予約',
  LOCATION: 'TERACOラボ',
  SLOT_MINUTES: 45,
  CAPACITY: 8,
  FIXED_TIMES: ['10:00','14:00','16:00','18:00'],
  ALLOWED_WEEKDAYS: [0,1,2,3,4,5,6],
  OVERVIEW_DAYS: 60,      // 何日先まで表示するか
  MONTHLY_LIMIT: 8,        // 1か月あたりの予約上限
  NAME_KEY_PREFIX: 'NameKey:',
  LIMIT_SHEET_ID: '',      // 任意：個別上限管理用スプレッドシート
  LIMIT_RANGE: 'Limits!A:C'
};

function doGet(e) {
  setScriptTZ();
  const p = (e && e.parameter) || {};
  const action = p.action || 'overview';
  const nameInput = p.name || '';
  const days = Number(p.days || CONFIG.OVERVIEW_DAYS);
  if (action === 'overview') {
    const overview = overview_(nameInput, days);
    return jsonOutput(overview);
  }
  if (action === 'list') {
    const cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
    const start = startOfDay_(new Date());
    const slots = buildSlots_(cal, start, days);
    return jsonOutput({ ok: true, slots: slots });
  }
  return jsonOutput({ ok: true, message: 'ok' });
}

function doPost(e) {
  setScriptTZ();

  // Handle OPTIONS request for CORS preflight
  if (e && e.parameter && e.parameter.method === 'OPTIONS') {
    return ContentService.createTextOutput('')
      .setMimeType(ContentService.MimeType.TEXT);
  }

  let body = {};
  try {
    if (e && e.postData && e.postData.contents) {
      // Try to parse as JSON first (works for both application/json and text/plain with JSON content)
      try {
        body = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        // If JSON parse fails, try to use parameters
        body = Object.assign({}, e.parameter || {});
      }
    }
  } catch (err) {
    return jsonOutput({ ok: false, message: 'リクエスト形式が正しくありません。' });
  }

  const action = body.action || (e && e.parameter && e.parameter.action);
  if (action === 'batch_reserve') {
    const name = String(body.name || '').trim();
    const slots = Array.isArray(body.slots) ? body.slots : [];
    const classDetails = body.class_details || {};
    const userEmail = body.email || null;
    const addToCalendar = body.add_to_calendar || false;
    const res = batchReserve_(name, slots, classDetails, userEmail, addToCalendar);
    return jsonOutput(res);
  }
  if (action === 'batch_cancel') {
    const name = String(body.name || '').trim();
    const eventIds = Array.isArray(body.event_ids) ? body.event_ids : [];
    const userEmail = body.email || null;
    const res = batchCancel_(name, eventIds, userEmail);
    return jsonOutput(res);
  }
  return jsonOutput({ ok: false, message: '未対応の操作です。' });
}

// 概要取得
function overview_(displayName, days) {
  const cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  const start = startOfDay_(new Date());
  const rangeDays = Math.max(1, days || CONFIG.OVERVIEW_DAYS);
  const slots = buildSlots_(cal, start, rangeDays);

  const trimmedName = String(displayName || '').trim();
  if (!trimmedName) {
    return {
      ok: true,
      name: '',
      months: buildMonthSkeleton_(start, rangeDays),
      slots: slots,
      existing: []
    };
  }

  const normalized = normalizeName_(trimmedName);
  const nameKey = getNameKey_(normalized);
  const searchEnd = addDays_(start, rangeDays + 31); // 翌月分もカバー
  const existing = getReservationsByName_(cal, trimmedName, normalized, nameKey, start, searchEnd);
  const months = buildMonthSummary_(start, rangeDays, existing, nameKey);

  return {
    ok: true,
    name: trimmedName,
    normalized_name: normalized,
    name_key: nameKey,
    months: months,
    slots: slots,
    existing: existing,
    limit_default: CONFIG.MONTHLY_LIMIT
  };
}

// 一括予約
function batchReserve_(displayName, slotIdList, classDetails, userEmail, addToCalendar) {
  const trimmedName = String(displayName || '').trim();
  if (!trimmedName) return { ok: false, message: 'お名前を入力してください。' };
  const normalized = normalizeName_(trimmedName);
  const nameKey = getNameKey_(normalized);

  const slotIds = (slotIdList || []).map(function(id){ return Number(id); })
    .filter(function(n){ return !isNaN(n); });
  if (!slotIds.length) return { ok: false, message: '予約したい日時を選択してください。' };

  const cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const start = startOfDay_(new Date());
    const tomorrow = addDays_(start, 1);
    const searchEnd = addDays_(start, CONFIG.OVERVIEW_DAYS + 31);
    const existing = getReservationsByName_(cal, trimmedName, normalized, nameKey, start, searchEnd);
    const countsByMonth = {};
    existing.forEach(function(ev){
      countsByMonth[ev.month_key] = (countsByMonth[ev.month_key] || 0) + 1;
    });

    const limitOverrides = fetchLimitOverrides_(nameKey);
    const prepared = [];
    const seen = {};

    // Generate rich title
    let eventTitle = CONFIG.TITLE_PREFIX + ' ' + trimmedName;
    if (classDetails && classDetails.category) {
      if (classDetails.course) {
        eventTitle = `【${classDetails.category} / ${classDetails.course}】${trimmedName}`;
      } else {
        eventTitle = `【${classDetails.category}】${trimmedName}`;
      }
    }

    for (var i = 0; i < slotIds.length; i++) {
      var slotId = slotIds[i];
      if (seen[slotId]) continue; // 重複選択は無視
      seen[slotId] = true;

      var startTime = new Date(slotId);
      if (isNaN(startTime.getTime())) {
        return { ok:false, message:'日時の指定に誤りがあります。' };
      }
      if (startTime < tomorrow) {
        return { ok:false, message:'当日および過去の講座は予約できません。' };
      }

      var monthKey = monthKey_(startTime);
      var limit = limitOverrides[monthKey] || CONFIG.MONTHLY_LIMIT;
      var currentCount = countsByMonth[monthKey] || 0;

      // 既に同じ日時が予約済みならスキップ
      var already = existing.find(function(ev){ return ev.slot_id === String(slotId); });
      if (already) {
        continue;
      }

      if (currentCount + 1 > limit) {
        var remain = Math.max(0, limit - currentCount);
        return { ok:false, message: formatMonthLabel_(monthKey) + 'はあと' + remain + '件まで予約できます。' };
      }

      var endTime = new Date(startTime.getTime() + CONFIG.SLOT_MINUTES * 60 * 1000);
      var reservedCount = countOverlaps_(cal, startTime, endTime);
      if (reservedCount >= CONFIG.CAPACITY) {
        return { ok:false, message: formatSlotLabel_(startTime) + 'は満席になりました。' };
      }

      prepared.push({
        slot_id: String(slotId),
        start: startTime,
        end: endTime,
        month_key: monthKey
      });
      countsByMonth[monthKey] = currentCount + 1;
    }

    if (!prepared.length) {
      return { ok:false, message:'新しく予約できる枠がありません（すでに予約済みの可能性があります）。' };
    }

    var created = [];
    try {
      prepared.forEach(function(item){
        var desc = buildDescription_(trimmedName, normalized, nameKey, classDetails);
        var options = {
          description: desc,
          location: CONFIG.LOCATION
        };
        if (addToCalendar && userEmail) {
          options.guests = userEmail;
        }
        var ev = cal.createEvent(eventTitle, item.start, item.end, options);
        created.push({ event: ev, info: item });
      });
    } catch (err) {
      // 差し戻し
      created.forEach(function(row){ try { row.event.deleteEvent(); } catch (e) {} });
      return { ok:false, message:'予約の作成に失敗しました。時間をおいて再度お試しください。' };
    }

    sendSummaryMail_('予約', trimmedName, created.map(function(row){
      return formatSlotLabel_(row.info.start);
    }), eventTitle, userEmail);

    var overview = overview_(trimmedName, CONFIG.OVERVIEW_DAYS);
    overview.message = created.length + '件の予約を登録しました。';
    return overview;

  } catch (err) {
    return { ok:false, message:'処理中にエラーが発生しました。' };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// 一括取消
function batchCancel_(displayName, eventIdList, userEmail) {
  const trimmedName = String(displayName || '').trim();
  if (!trimmedName) return { ok:false, message:'お名前を入力してください。' };
  const normalized = normalizeName_(trimmedName);
  const nameKey = getNameKey_(normalized);

  const cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const removedLabels = [];
    let representativeTitle = '';

    (eventIdList || []).forEach(function(eventId){
      if (!eventId) return;
      var ev = cal.getEventById(String(eventId));
      if (!ev) return;
      if (!eventMatchesName_(ev, trimmedName, normalized, nameKey)) return;
      
      if (!representativeTitle) {
        representativeTitle = ev.getTitle();
      }
      removedLabels.push(formatSlotLabel_(ev.getStartTime()));
      ev.deleteEvent();
    });

    if (!removedLabels.length) {
      return { ok:false, message:'取消できる予約が見つかりませんでした。' };
    }

    sendSummaryMail_('取消', trimmedName, removedLabels, representativeTitle, userEmail);
    var overview = overview_(trimmedName, CONFIG.OVERVIEW_DAYS);
    overview.message = removedLabels.length + '件の予約を取り消しました。';
    return overview;

  } catch (err) {
    return { ok:false, message:'取消処理中にエラーが発生しました。' };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// 空き枠一覧を生成
function buildSlots_(cal, startDate, rangeDays) {
  const results = [];
  const today = new Date();
  const days = Math.max(1, rangeDays);
  for (var i = 0; i < days; i++) {
    var day = addDays_(startDate, i);
    if (CONFIG.ALLOWED_WEEKDAYS && CONFIG.ALLOWED_WEEKDAYS.indexOf(day.getDay()) === -1) {
      continue;
    }
    CONFIG.FIXED_TIMES.forEach(function(time){
      var startTime = atTime_(day, time);
      if (startTime <= today) return; // 過去は除外
      var endTime = new Date(startTime.getTime() + CONFIG.SLOT_MINUTES * 60 * 1000);
      var reserved = countOverlaps_(cal, startTime, endTime);
      results.push({
        slot_id: String(startTime.getTime()),
        iso: startTime.toISOString(),
        day_key: Utilities.formatDate(startTime, CONFIG.TIMEZONE, 'yyyy-MM-dd'),
        day_label: formatDayLabel_(startTime),
        start_time: time,
        end_time: fmtTime_(endTime),
        month_key: monthKey_(startTime),
        capacity: CONFIG.CAPACITY,
        reserved_count: reserved
      });
    });
  }
  results.sort(function(a,b){ return Number(a.slot_id) - Number(b.slot_id); });
  return results;
}

function getReservationsByName_(cal, displayName, normalized, nameKey, start, end) {
  const events = cal.getEvents(start, end);
  const list = [];
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    if (!eventMatchesName_(ev, displayName, normalized, nameKey)) continue;
    var st = ev.getStartTime();
    list.push({
      event_id: ev.getId(),
      slot_id: String(st.getTime()),
      iso: st.toISOString(),
      label: formatSlotLabel_(st),
      month_key: monthKey_(st),
      month_label: formatMonthLabel_(monthKey_(st))
    });
  }
  list.sort(function(a,b){ return Number(a.slot_id) - Number(b.slot_id); });
  return list;
}

function eventMatchesName_(ev, displayName, normalized, nameKey) {
  const desc = ev.getDescription() || '';
  if (desc.indexOf(CONFIG.NAME_KEY_PREFIX + nameKey) !== -1) return true;

  // 旧フォーマット互換: 予約者: ○○
  const match = desc.match(/予約者:\s*(.+)/);
  if (match && normalizeName_(match[1]) === normalized) return true;

  const title = ev.getTitle() || '';
  if (title.indexOf(CONFIG.TITLE_PREFIX) === 0) {
    const rest = title.replace(CONFIG.TITLE_PREFIX, '').trim();
    if (normalizeName_(rest.replace(/[（）\(\)]/g,'')) === normalized) return true;
  }
  return false;
}

function buildDescription_(displayName, normalized, nameKey, classDetails) {
  var details = [
    CONFIG.NAME_KEY_PREFIX + nameKey,
    '予約者: ' + displayName,
    '登録: ' + fmtJP_(new Date())
  ];
  if (classDetails) {
    details.push('---');
    if (classDetails.category) details.push('カテゴリ: ' + classDetails.category);
    if (classDetails.course) details.push('コース: ' + classDetails.course);
    if (classDetails.frequency) details.push('頻度: ' + classDetails.frequency);
  }
  return details.join('\n');
}

function buildMonthSkeleton_(startDate, rangeDays) {
  const months = [];
  const seen = {};
  const days = Math.max(1, rangeDays);
  for (var i = 0; i < days; i++) {
    var day = addDays_(startDate, i);
    var key = monthKey_(day);
    if (seen[key]) continue;
    seen[key] = true;
    months.push({
      key: key,
      label: formatMonthLabel_(key),
      limit: CONFIG.MONTHLY_LIMIT,
      reserved: 0,
      remaining: CONFIG.MONTHLY_LIMIT
    });
  }
  months.sort(function(a,b){ return a.key < b.key ? -1 : 1; });
  return months;
}

function buildMonthSummary_(startDate, rangeDays, existing, nameKey) {
  const skeleton = buildMonthSkeleton_(startDate, rangeDays);
  const overrides = fetchLimitOverrides_(nameKey);
  const map = {};
  skeleton.forEach(function(item){
    var limit = overrides[item.key] || CONFIG.MONTHLY_LIMIT;
    map[item.key] = {
      key: item.key,
      label: item.label,
      limit: limit,
      reserved: 0,
      remaining: limit
    };
  });
  existing.forEach(function(ev){
    var key = ev.month_key;
    if (!map[key]) {
      var limit = overrides[key] || CONFIG.MONTHLY_LIMIT;
      map[key] = {
        key: key,
        label: formatMonthLabel_(key),
        limit: limit,
        reserved: 0,
        remaining: limit
      };
    }
    map[key].reserved += 1;
    map[key].remaining = Math.max(0, map[key].limit - map[key].reserved);
  });
  return Object.keys(map).sort().map(function(k){ return map[k]; });
}

function fetchLimitOverrides_(nameKey) {
  if (!CONFIG.LIMIT_SHEET_ID) return {};
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.LIMIT_SHEET_ID);
    const range = sheet.getRange(CONFIG.LIMIT_RANGE);
    const values = range.getValues();
    const map = {};
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var nameCell = normalizeName_(String(row[0] || ''));
      var month = String(row[1] || '').trim();
      var limit = Number(row[2] || '');
      if (!nameCell || !month || isNaN(limit)) continue;
      if (nameCell === nameKey) {
        map[month] = limit;
      }
    }
    return map;
  } catch (err) {
    return {};
  }
}

function sendSummaryMail_(type, displayName, labels, eventTitle, userEmail) {
  if (!CONFIG.TEACHER_EMAIL) return;

  const subject = `【TERACO予約】${type}確定のお知らせ (${displayName}様)`;

  // Notify teacher
  const teacherBodyParts = [
    `${displayName} さんの予約が${type}されました。`,
    ''
  ];
  if (userEmail) {
    teacherBodyParts.push(`連絡先: ${userEmail}`, '');
  }
  teacherBodyParts.push(
    `件名: ${eventTitle}`,
    '日時:',
    labels.map(function(t){ return '・' + t; }).join('\n'),
    '',
    'カレンダー: ' + CONFIG.CALENDAR_ID
  );
  const teacherBody = teacherBodyParts.join('\n');
  GmailApp.sendEmail(CONFIG.TEACHER_EMAIL, subject, teacherBody, { name: 'TERACO予約' });

  // Notify user if email is available
  if (userEmail) {
    const userBody = [
      `${displayName}様`,
      '',
      `TERACOラボのご予約が${type}されましたので、お知らせいたします。`,
      '',
      `件名: ${eventTitle}`,
      '日時:',
      labels.map(function(t){ return '・' + t; }).join('\n'),
      '',
      'ご不明な点がございましたら、お気軽にお問い合わせください。'
    ].join('\n');
    GmailApp.sendEmail(userEmail, subject, userBody, { name: 'TERACO予約' });
  }
}

// Utility functions
function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function setScriptTZ() {
  try { Session.getScriptTimeZone() || null; } catch (e) {}
}

function normalizeName_(name) {
  return String(name || '').replace(/\s+/g, '').trim();
}

function getNameKey_(normalized) {
  return normalized.toLowerCase();
}

function addDays_(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function atTime_(d, hhmm) {
  const parts = hhmm.split(':');
  const hh = Number(parts[0] || 0);
  const mm = Number(parts[1] || 0);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0, 0);
}

function fmtTime_(d) {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function fmtJP_(d) {
  const w = ['日','月','火','水','木','金','土'][d.getDay()];
  const y = d.getFullYear();
  const mo = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  const h = String(d.getHours()).padStart(2,'0');
  const m = String(d.getMinutes()).padStart(2,'0');
  return `${y}/${mo}/${da}(${w}) ${h}:${m}`;
}

function monthKey_(d) {
  return Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy-MM');
}

function formatMonthLabel_(monthKey) {
  const parts = monthKey.split('-');
  if (parts.length !== 2) return monthKey;
  return `${parts[0]}年${Number(parts[1])}月`;
}

function formatDayLabel_(d) {
  const w = ['日','月','火','水','木','金','土'][d.getDay()];
  const mo = d.getMonth() + 1;
  const da = d.getDate();
  return `${mo}/${da}(${w})`;
}

function formatSlotLabel_(d) {
  return `${formatDayLabel_(d)} ${fmtTime_(d)}`;
}

function countOverlaps_(cal, start, end) {
  const events = cal.getEvents(start, end);
  let count = 0;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.getEndTime() <= start) continue;
    if (ev.getStartTime() >= end) continue;
    count += 1;
  }
  return count;
}

