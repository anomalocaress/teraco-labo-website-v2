// TERACO予約システム v39 (管理者ダッシュボード対応版)

var CONFIG = {
  TIMEZONE: 'Asia/Tokyo',
  CALENDAR_ID: 'primary',
  TEACHER_EMAIL: 'fujisaki@teraco-labo.com',
  ADMIN_PASSCODE: '2684', // 管理者画面用のパスコード
  TITLE_PREFIX: 'TERACO予約',
  LOCATION: 'TERACOラボ',
  SLOT_MINUTES: 45,
  CAPACITY: 8,
  FIXED_TIMES: ['10:00', '14:00', '16:00', '18:00'],
  OVERVIEW_DAYS: 60,
  MONTHLY_LIMIT: 8
};

function authorizeMe() {
  var me = Session.getActiveUser().getEmail();
  GmailApp.sendEmail(me, '承認テスト', 'これが届いたら承認完了です');
  Logger.log('承認されました！');
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var action = p.action || 'overview';
  if (action === 'version') return jsonOut({ok: true, version: 'v39', timestamp: new Date().toISOString()});
  if (action === 'overview') return jsonOut(getOverview(p.name || '', Number(p.days) || CONFIG.OVERVIEW_DAYS));
  if (action === 'admin_summary') return jsonOut(getAdminSummary(p.passcode));
  return jsonOut({ok: true});
}

/**
 * 管理者用：今日・明日の予約状況をまとめて取得
 */
function getAdminSummary(passcode) {
  if (passcode !== CONFIG.ADMIN_PASSCODE) return { ok: false, message: 'パスコードが正しくありません' };
  
  var cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  var now = new Date();
  var start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var end = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000); // 今日・明日の2日間
  
  var events = cal.getEvents(start, end);
  var days = {};
  
  // 2日分の枠を初期化
  for (var i = 0; i < 2; i++) {
    var d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    var key = formatDate(d);
    days[key] = { label: formatDay(d), slots: [] };
    
    CONFIG.FIXED_TIMES.forEach(function(time) {
      days[key].slots.push({ time: time, title: '', count: 0, names: [] });
    });
  }

  events.forEach(function(ev) {
    var st = ev.getStartTime();
    var dayKey = formatDate(st);
    var timeStr = pad(st.getHours()) + ':' + pad(st.getMinutes());
    
    if (days[dayKey]) {
      var names = (ev.getDescription() || '').split('\n').filter(function(l) { 
        return l.trim() && !isJunkLine(l.trim()); 
      });
      
      days[dayKey].slots.forEach(function(slot) {
        if (slot.time === timeStr) {
          slot.title = ev.getTitle();
          slot.count = names.length;
          slot.names = names;
        }
      });
    }
  });

  return { ok: true, days: days };
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { return jsonOut({ok: false, message: 'JSONエラー'}); }
  if (body.action === 'batch_reserve') return jsonOut(reserve(body.name, body.slots, body.class_details, body.email, body.add_to_calendar));
  if (body.action === 'batch_cancel') return jsonOut(cancel(body.name, body.event_ids, body.email));
  return jsonOut({ok: false, message: '不明なアクション'});
}

function getOverview(name, days) {
  var cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  var start = todayStart();
  var slots = buildSlots(cal, start, days);
  if (!name || !name.trim()) return {ok: true, name: '', slots: slots, existing: [], months: getMonths(start, days)};
  var trimmed = name.trim();
  var end = addDays(start, days + 31);
  var existing = findUserEvents(cal, trimmed, start, end);
  return { ok: true, name: trimmed, slots: slots, existing: existing, months: getMonthsWithCount(start, days, existing) };
}

function reserve(name, slotIds, classDetails, email, addToCalendar) {
  if (!name || !name.trim()) return {ok: false, message: 'お名前を入力してください'};
  var userName = name.trim();
  var cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return {ok: false, message: 'サーバーが一時的に混み合っています。少し時間をおいてからもう一度お試しください。'};

  try {
    // 予約締切チェック (前日17:00まで)
    var now = new Date();
    var deadlineLimit = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0); // 今日の17:00
    
    var title = makeTitle(classDetails);
    var minutes = getMinutes(classDetails);
    var created = [];

    for (var i = 0; i < slotIds.length; i++) {
      var startTime = new Date(Number(slotIds[i]));
      if (isNaN(startTime.getTime())) continue;

      // 判定: 予約日が明日以降か、または今日が17時前で明日以降の予約か
      var reservationDay = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate());
      var tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      
      if (reservationDay < tomorrow) {
        return {ok: false, message: '当日および過去の予約はできません。前日17:00までにご予約ください。'};
      }
      if (reservationDay.getTime() === tomorrow.getTime() && now > deadlineLimit) {
        return {ok: false, message: '明日の予約締切（本日17:00）を過ぎています。お急ぎの場合は教室へ直接ご連絡ください。'};
      }

      var endTime = new Date(startTime.getTime() + minutes * 60000);
      var existing = findEventAt(cal, startTime, title);
      var eventId = "";

      if (existing) {
        eventId = existing.getId();
        var desc = existing.getDescription() || '';
        if (!hasName(desc, userName)) {
          existing.setDescription(addName(desc, userName));
        }
      } else {
        var ev = cal.createEvent(title, startTime, endTime, {
          description: userName,
          location: CONFIG.LOCATION,
          sendInvites: false
        });
        eventId = ev.getId();
      }
      
      // 予約時は「回答待ち」ステータスでサイレント追加
      if (addToCalendar && email && eventId) {
        addGuestSilently(eventId, email);
      }
      
      created.push({event_id: eventId, slot_id: String(slotIds[i]), start: startTime.toISOString()});
    }

    if (created.length > 0) sendNotification('予約', userName, created, title, email);
    return {ok: true, message: created.length + '件予約しました', created: created};
  } finally {
    lock.releaseLock();
  }
}

/**
 * ゲストを「回答待ち」状態でサイレント追加する
 */
function addGuestSilently(eventId, email) {
  try {
    var cleanId = eventId.split('@')[0];
    var event = Calendar.Events.get(CONFIG.CALENDAR_ID, cleanId);
    var attendees = event.attendees || [];
    
    var exists = attendees.some(function(a) { return a.email.toLowerCase() === email.toLowerCase(); });
    if (!exists) {
      attendees.push({ email: email, responseStatus: 'needsAction' });
      // 招待メールを送らずに追加
      Calendar.Events.patch({attendees: attendees}, CONFIG.CALENDAR_ID, cleanId, { sendUpdates: 'none' });
    }
  } catch (e) {
    Logger.log('ゲスト追加失敗: ' + e.toString());
  }
}

function cancel(name, eventIds, email) {
  if (!name || !name.trim()) return {ok: false, message: 'お名前を入力してください'};
  var userName = name.trim();
  var cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return {ok: false, message: 'サーバーが一時的に混み合っています。少し時間をおいてからもう一度お試しください。'};

  try {
    var now = new Date();
    var deadlineLimit = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0); // 今日の17:00
    var removed = [];
    var title = '';
    for (var i = 0; i < eventIds.length; i++) {
      var ev = cal.getEventById(eventIds[i]);
      if (!ev) continue;

      // 取消締切チェック (前日17:00まで)
      var startTime = ev.getStartTime();
      var reservationDay = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate());
      var tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

      if (reservationDay < tomorrow || (reservationDay.getTime() === tomorrow.getTime() && now > deadlineLimit)) {
        return {ok: false, message: '当日および前日17:00を過ぎたキャンセルの受付はできません。教室へ直接ご連絡ください。'};
      }

      var desc = ev.getDescription() || '';
      if (!hasName(desc, userName)) continue;
      if (!title) title = ev.getTitle();
      removed.push({slot_id: String(ev.getStartTime().getTime()), start: ev.getStartTime().toISOString()});

      // ゲストから削除（通知を飛ばすことで相手のカレンダーから確実に消去）
      if (email) removeGuestAndNotify(eventIds[i], email);

      var newDesc = removeName(desc, userName);
      if (newDesc.trim()) {
        ev.setDescription(newDesc);
      } else {
        // イベント自体の削除も通知付きで行う
        deleteEventAndNotify(eventIds[i]);
      }
    }
    if (removed.length > 0) sendNotification('取消', userName, removed, title, email);
    return {ok: true, message: removed.length + '件取り消しました'};
  } finally {
    lock.releaseLock();
  }
}

function removeGuestAndNotify(eventId, email) {
  try {
    var cleanId = eventId.split('@')[0];
    var event = Calendar.Events.get(CONFIG.CALENDAR_ID, cleanId);
    if (!event.attendees) return;

    var lowerEmail = email.toLowerCase();
    var newList = event.attendees.filter(function(a) { return a.email.toLowerCase() !== lowerEmail; });

    if (newList.length !== event.attendees.length) {
      // 削除通知を送信することで、相手のカレンダーから消去させる
      Calendar.Events.patch({attendees: newList}, CONFIG.CALENDAR_ID, cleanId, { sendUpdates: 'all' });
    }
  } catch (e) {
    Logger.log('ゲスト削除失敗: ' + e.toString());
  }
}

function deleteEventAndNotify(eventId) {
  try {
    var cleanId = eventId.split('@')[0];
    Calendar.Events.remove(CONFIG.CALENDAR_ID, cleanId, { sendUpdates: 'all' });
  } catch (e) {
    Logger.log('イベント削除失敗: ' + e.toString());
  }
}

// --- 共通ユーティリティ ---
function makeTitle(details) {
  if (!details || !details.category) return CONFIG.TITLE_PREFIX;
  return details.category + (details.course ? ' ' + details.course : '');
}
function getMinutes(details) {
  if (!details || !details.course) return 45;
  var c = details.course;
  if (c.indexOf('90') >= 0 || c.indexOf('応用') >= 0 || c.indexOf('アドバンス') >= 0) return 90;
  if (c.indexOf('50') >= 0 || c.indexOf('個人') >= 0) return 50;
  return 45;
}
function findEventAt(cal, startTime, title) {
  var events = cal.getEvents(new Date(startTime.getTime() - 60000), new Date(startTime.getTime() + 60000));
  for (var i = 0; i < events.length; i++) {
    if (events[i].getTitle() === title && events[i].getStartTime().getTime() === startTime.getTime()) return events[i];
  }
  return null;
}
function findUserEvents(cal, userName, start, end) {
  var events = cal.getEvents(start, end);
  var result = [];
  var search = normalize(userName);
  for (var i = 0; i < events.length; i++) {
    var ev = events[i], desc = ev.getDescription() || '', title = ev.getTitle() || '';
    if (hasName(desc, userName) || normalize(title).indexOf(search) >= 0) {
      var st = ev.getStartTime();
      result.push({ event_id: ev.getId(), slot_id: String(st.getTime()), start: st.toISOString(), label: formatSlot(st), month_key: monthKey(st) });
    }
  }
  return result;
}
function hasName(desc, userName) {
  var search = normalize(userName), lines = desc.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line && (normalize(line) === search || normalize(line).indexOf(search) >= 0)) return true;
  }
  return false;
}
function addName(desc, userName) {
  var lines = desc.split('\n'), names = [], search = normalize(userName);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line && !isJunkLine(line)) names.push(line);
  }
  if (!names.some(function(n) { return normalize(n) === search; })) names.push(userName);
  return names.join('\n');
}
function removeName(desc, userName) {
  var lines = desc.split('\n'), result = [], search = normalize(userName);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line && !isJunkLine(line) && normalize(line) !== search) result.push(line);
  }
  return result.join('\n');
}
function isJunkLine(line) {
  var lower = line.toLowerCase();
  return lower.indexOf('namekey') >= 0 || line.indexOf('予約者') >= 0 || line === '---';
}
function normalize(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase().replace(/﨑/g, '崎').replace(/髙/g, '高').replace(/濵/g, '浜').replace(/邊/g, '辺').replace(/邉/g, '辺').replace(/齋/g, '斎');
}
function buildSlots(cal, start, days) {
  var slots = [], now = new Date(), end = addDays(start, days), events = cal.getEvents(start, end);
  for (var d = 0; d < days; d++) {
    var day = addDays(start, d);
    for (var t = 0; t < CONFIG.FIXED_TIMES.length; t++) {
      var time = CONFIG.FIXED_TIMES[t], st = atTime(day, time);
      if (st <= now) continue;
      var et = new Date(st.getTime() + CONFIG.SLOT_MINUTES * 60000), count = 0;
      for (var e = 0; e < events.length; e++) {
        var ev = events[e];
        if (ev.getStartTime() < et && ev.getEndTime() > st) {
          var names = (ev.getDescription() || '').split('\n').filter(function(l) { return l.trim() && !isJunkLine(l.trim()); });
          count += names.length;
        }
      }
      slots.push({ slot_id: String(st.getTime()), iso: st.toISOString(), day_key: formatDate(st), day_label: formatDay(st), start_time: time, month_key: monthKey(st), capacity: CONFIG.CAPACITY, reserved_count: count });
    }
  }
  return slots;
}
function getMonths(start, days) {
  var months = [], seen = {};
  for (var i = 0; i < days; i++) {
    var key = monthKey(addDays(start, i));
    if (!seen[key]) { seen[key] = true; months.push({key: key, label: monthLabel(key), limit: CONFIG.MONTHLY_LIMIT, reserved: 0, remaining: CONFIG.MONTHLY_LIMIT}); }
  }
  return months;
}
function getMonthsWithCount(start, days, existing) {
  var months = getMonths(start, days), counts = {};
  for (var i = 0; i < existing.length; i++) { counts[existing[i].month_key] = (counts[existing[i].month_key] || 0) + 1; }
  for (var j = 0; j < months.length; j++) { var m = months[j]; m.reserved = counts[m.key] || 0; m.remaining = Math.max(0, m.limit - m.reserved); }
  return months;
}
function sendNotification(type, userName, items, title, email) {
  var dates = items.map(function(it) { return '・' + formatSlot(new Date(it.start)); }).join('\n');
  var now = new Date(), timestamp = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy/MM/dd HH:mm');
  if (CONFIG.TEACHER_EMAIL) {
    try {
      var teacherBody = userName + ' さんの予約が ' + type + ' されました。\n\n■ 内容: ' + title + '\n■ 日時:\n' + dates + '\n\n■ 連絡先: ' + (email || '（Google未ログイン）') + '\n■ 処理日時: ' + timestamp;
      GmailApp.sendEmail(CONFIG.TEACHER_EMAIL, '【TERACO予約】' + type + '通知 (' + userName + '様)', teacherBody, { name: 'TERACO予約システム' });
    } catch (e) {}
  }
  if (email) {
    try {
      var userBody = userName + ' 様\n\nTERACOラボのご予約が ' + type + ' されました。\n\n■ 予約内容: ' + title + '\n■ 予約日時:\n' + dates + '\n\nご不明な点がございましたら、お気軽にお問い合わせください。\n\nTERACOラボ';
      GmailApp.sendEmail(email, '【TERACO予約】' + type + '完了のお知らせ (' + userName + '様)', userBody, { name: 'TERACOラボ' });
    } catch (e) {}
  }
}
function jsonOut(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function todayStart() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n) { var r = new Date(d.getTime()); r.setDate(r.getDate() + n); return r; }
function atTime(d, hhmm) { var p = hhmm.split(':'); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(p[0]), Number(p[1] || 0)); }
function formatDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function formatDay(d) { return (d.getMonth() + 1) + '/' + d.getDate() + '(' + ['日', '月', '火', '水', '木', '金', '土'][d.getDay()] + ')'; }
function formatSlot(d) { return formatDay(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function monthKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
function monthLabel(k) { var p = k.split('-'); return p[0] + '年' + Number(p[1]) + '月'; }
function pad(n) { return n < 10 ? '0' + n : String(n); }
