// TERACO予約システム v31 (カレンダー自動登録・通知オフ版)

var CONFIG = {
  TIMEZONE: 'Asia/Tokyo',
  CALENDAR_ID: 'primary',
  TEACHER_EMAIL: 'fujisaki@teraco-labo.com',
  TITLE_PREFIX: 'TERACO予約',
  LOCATION: 'TERACOラボ',
  SLOT_MINUTES: 45,
  CAPACITY: 8,
  FIXED_TIMES: ['10:00', '14:00', '16:00', '18:00'],
  OVERVIEW_DAYS: 60,
  MONTHLY_LIMIT: 8
};

/**
 * 承認ポップアップを強制的に出すための関数
 */
function authorizeMe() {
  var me = Session.getActiveUser().getEmail();
  GmailApp.sendEmail(me, '承認テスト', 'これが届いたら承認完了です');
  Logger.log('承認されました！');
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var action = p.action || 'overview';

  if (action === 'version') {
    return jsonOut({ok: true, version: 'v31', timestamp: new Date().toISOString()});
  }
  if (action === 'overview') {
    return jsonOut(getOverview(p.name || '', Number(p.days) || CONFIG.OVERVIEW_DAYS));
  }
  return jsonOut({ok: true});
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ok: false, message: 'JSONエラー'});
  }

  if (body.action === 'batch_reserve') {
    // add_to_calendar フラグを引数に追加
    return jsonOut(reserve(body.name, body.slots, body.class_details, body.email, body.add_to_calendar));
  }
  if (body.action === 'batch_cancel') {
    return jsonOut(cancel(body.name, body.event_ids, body.email));
  }
  return jsonOut({ok: false, message: '不明なアクション'});
}

function getOverview(name, days) {
  var cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  var start = todayStart();
  var slots = buildSlots(cal, start, days);

  if (!name || !name.trim()) {
    return {ok: true, name: '', slots: slots, existing: [], months: getMonths(start, days)};
  }

  var trimmed = name.trim();
  var end = addDays(start, days + 31);
  var existing = findUserEvents(cal, trimmed, start, end);

  return {
    ok: true,
    name: trimmed,
    slots: slots,
    existing: existing,
    months: getMonthsWithCount(start, days, existing)
  };
}

function reserve(name, slotIds, classDetails, email, addToCalendar) {
  if (!name || !name.trim()) return {ok: false, message: 'お名前を入力してください'};
  
  var userName = name.trim();
  var cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  var lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) return {ok: false, message: 'サーバー混雑中'};

  try {
    var title = makeTitle(classDetails);
    var minutes = getMinutes(classDetails);
    var created = [];

    for (var i = 0; i < slotIds.length; i++) {
      var startTime = new Date(Number(slotIds[i]));
      if (isNaN(startTime.getTime())) continue;
      
      var endTime = new Date(startTime.getTime() + minutes * 60000);
      var existing = findEventAt(cal, startTime, title);

      if (existing) {
        // 既存イベントに名前を追加
        var desc = existing.getDescription() || '';
        if (!hasName(desc, userName)) {
          existing.setDescription(addName(desc, userName));
        }
        
        // カレンダー登録（通知メールなし）
        if (addToCalendar && email) {
          addGuestWithoutEmail(existing.getId(), email);
        }
        
        created.push({event_id: existing.getId(), slot_id: String(slotIds[i]), start: startTime.toISOString()});
      } else {
        // 新規イベント作成
        var eventOptions = {
          description: userName,
          location: CONFIG.LOCATION,
          sendInvites: false // 招待メールを送らない
        };
        
        // ゲストとして追加する場合
        if (addToCalendar && email) {
          eventOptions.guests = email;
        }
        
        var ev = cal.createEvent(title, startTime, endTime, eventOptions);
        created.push({event_id: ev.getId(), slot_id: String(slotIds[i]), start: startTime.toISOString()});
      }
    }

    if (created.length > 0) {
      sendNotification('予約', userName, created, title, email);
    }

    return {ok: true, message: created.length + '件予約しました', created: created};

  } finally {
    lock.releaseLock();
  }
}

/**
 * 招待メールを送らずにゲストを追加する（Advanced Calendar APIを使用）
 */
function addGuestWithoutEmail(eventId, email) {
  try {
    // eventIdから余計な文字列を削除（iCalUIDではなくAPI用のIDが必要）
    var cleanId = eventId.replace('@google.com', '');
    
    // 現在のイベント情報を取得
    var event = Calendar.Events.get(CONFIG.CALENDAR_ID, cleanId);
    
    // 既に登録済みかチェック
    var attendees = event.attendees || [];
    var alreadyAdded = attendees.some(function(a) { return a.email === email; });
    
    if (!alreadyAdded) {
      attendees.push({email: email});
      // sendUpdates: 'none' で通知を完全にブロック
      Calendar.Events.patch({attendees: attendees}, CONFIG.CALENDAR_ID, cleanId, {
        sendUpdates: 'none'
      });
      Logger.log('カレンダー登録完了（通知なし）: ' + email);
    }
  } catch (e) {
    Logger.log('カレンダーAPI登録失敗: ' + e.toString());
  }
}

function cancel(name, eventIds, email) {
  if (!name || !name.trim()) return {ok: false, message: 'お名前を入力してください'};

  var userName = name.trim();
  var cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  var lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) return {ok: false, message: 'サーバー混雑中'};

  try {
    var removed = [];
    var title = '';

    for (var i = 0; i < eventIds.length; i++) {
      var ev = cal.getEventById(eventIds[i]);
      if (!ev) continue;

      var desc = ev.getDescription() || '';
      if (!hasName(desc, userName)) continue;

      if (!title) title = ev.getTitle();
      removed.push({slot_id: String(ev.getStartTime().getTime()), start: ev.getStartTime().toISOString()});

      // ゲストからも削除（Advanced API使用で通知なし）
      if (email) {
        removeGuestWithoutEmail(eventIds[i], email);
      }

      var newDesc = removeName(desc, userName);
      if (newDesc.trim()) {
        ev.setDescription(newDesc);
      } else {
        ev.deleteEvent();
      }
    }

    if (removed.length > 0) {
      sendNotification('取消', userName, removed, title, email);
    }

    return {ok: true, message: removed.length + '件取り消しました'};

  } finally {
    lock.releaseLock();
  }
}

/**
 * 招待メールを送らずにゲストを削除する
 */
function removeGuestWithoutEmail(eventId, email) {
  try {
    var cleanId = eventId.replace('@google.com', '');
    var event = Calendar.Events.get(CONFIG.CALENDAR_ID, cleanId);
    
    if (event.attendees) {
      var newList = event.attendees.filter(function(a) { return a.email !== email; });
      Calendar.Events.patch({attendees: newList}, CONFIG.CALENDAR_ID, cleanId, {
        sendUpdates: 'none'
      });
      Logger.log('カレンダー削除完了（通知なし）: ' + email);
    }
  } catch (e) {}
}

function makeTitle(details) {
  if (!details || !details.category) return CONFIG.TITLE_PREFIX;
  if (details.course) return details.category + ' ' + details.course;
  return details.category;
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
    if (events[i].getTitle() === title && events[i].getStartTime().getTime() === startTime.getTime()) {
      return events[i];
    }
  }
  return null;
}

function findUserEvents(cal, userName, start, end) {
  var events = cal.getEvents(start, end);
  var result = [];
  var search = normalize(userName);

  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    var desc = ev.getDescription() || '';
    var title = ev.getTitle() || '';

    if (hasName(desc, userName) || normalize(title).indexOf(search) >= 0) {
      var st = ev.getStartTime();
      result.push({
        event_id: ev.getId(),
        slot_id: String(st.getTime()),
        start: st.toISOString(),
        label: formatSlot(st),
        month_key: monthKey(st)
      });
    }
  }
  return result;
}

function hasName(desc, userName) {
  var search = normalize(userName);
  var lines = desc.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    if (normalize(line) === search || normalize(line).indexOf(search) >= 0) return true;
  }
  return false;
}

function addName(desc, userName) {
  var lines = desc.split('\n');
  var names = [];
  var search = normalize(userName);

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line || isJunkLine(line)) continue;
    names.push(line);
  }

  var exists = names.some(function(n) { return normalize(n) === search; });
  if (!exists) names.push(userName);
  return names.join('\n');
}

function removeName(desc, userName) {
  var lines = desc.split('\n');
  var result = [];
  var search = normalize(userName);

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line || isJunkLine(line) || normalize(line) === search) continue;
    result.push(line);
  }
  return result.join('\n');
}

function isJunkLine(line) {
  var lower = line.toLowerCase();
  return lower.indexOf('namekey') >= 0 || line.indexOf('予約者') >= 0 || line === '---';
}

function normalize(s) {
  var str = String(s || '').replace(/\s+/g, '').toLowerCase();
  str = str.replace(/﨑/g, '崎').replace(/髙/g, '高').replace(/濵/g, '浜');
  str = str.replace(/邊/g, '辺').replace(/邉/g, '辺').replace(/齋/g, '斎');
  return str;
}

function buildSlots(cal, start, days) {
  var slots = [];
  var now = new Date();
  var end = addDays(start, days);
  var events = cal.getEvents(start, end);

  for (var d = 0; d < days; d++) {
    var day = addDays(start, d);
    for (var t = 0; t < CONFIG.FIXED_TIMES.length; t++) {
      var time = CONFIG.FIXED_TIMES[t];
      var st = atTime(day, time);
      if (st <= now) continue;

      var et = new Date(st.getTime() + CONFIG.SLOT_MINUTES * 60000);
      var count = 0;
      for (var e = 0; e < events.length; e++) {
        var ev = events[e];
        if (ev.getStartTime() < et && ev.getEndTime() > st) {
          var desc = ev.getDescription() || '';
          var names = desc.split('\n').filter(function(line) {
            var l = line.trim();
            return l && !isJunkLine(l);
          });
          count += names.length;
        }
      }

      slots.push({
        slot_id: String(st.getTime()),
        iso: st.toISOString(),
        day_key: formatDate(st),
        day_label: formatDay(st),
        start_time: time,
        month_key: monthKey(st),
        capacity: CONFIG.CAPACITY,
        reserved_count: count
      });
    }
  }
  return slots;
}

function getMonths(start, days) {
  var months = [];
  var seen = {};
  for (var i = 0; i < days; i++) {
    var key = monthKey(addDays(start, i));
    if (!seen[key]) {
      seen[key] = true;
      months.push({key: key, label: monthLabel(key), limit: CONFIG.MONTHLY_LIMIT, reserved: 0, remaining: CONFIG.MONTHLY_LIMIT});
    }
  }
  return months;
}

function getMonthsWithCount(start, days, existing) {
  var months = getMonths(start, days);
  var counts = {};
  for (var i = 0; i < existing.length; i++) {
    var k = existing[i].month_key;
    counts[k] = (counts[k] || 0) + 1;
  }
  for (var j = 0; j < months.length; j++) {
    var m = months[j];
    m.reserved = counts[m.key] || 0;
    m.remaining = Math.max(0, m.limit - m.reserved);
  }
  return months;
}

function sendNotification(type, userName, items, title, email) {
  var dates = items.map(function(it) { return '・' + formatSlot(new Date(it.start)); }).join('\n');
  var now = new Date();
  var timestamp = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy/MM/dd HH:mm');

  if (CONFIG.TEACHER_EMAIL) {
    try {
      var teacherSubject = '【TERACO予約】' + type + '通知 (' + userName + '様)';
      var teacherBody = [
        userName + ' さんの予約が ' + type + ' されました。',
        '',
        '■ 内容: ' + title,
        '■ 日時:',
        dates,
        '',
        '■ 連絡先: ' + (email ? email : '（Google未ログイン）'),
        '■ 処理日時: ' + timestamp,
        '',
        '---',
        'このメールはシステムより自動送信されています。'
      ].join('\n');

      GmailApp.sendEmail(CONFIG.TEACHER_EMAIL, teacherSubject, teacherBody, {
        name: 'TERACO予約システム'
      });
    } catch (e) {}
  }

  if (email) {
    try {
      var userSubject = '【TERACO予約】' + type + '完了のお知らせ (' + userName + '様)';
      var userBody = [
        userName + ' 様',
        '',
        'TERACOラボのご予約が ' + type + ' されました。',
        '',
        '■ 予約内容: ' + title,
        '■ 予約日時:',
        dates,
        '',
        'ご不明な点がございましたら、お気軽にお問い合わせください。',
        '',
        'TERACOラボ',
        '---',
        '※このメールに心当たりがない場合は、お手数ですが破棄してください。'
      ].join('\n');

      GmailApp.sendEmail(email, userSubject, userBody, {
        name: 'TERACOラボ'
      });
    } catch (e) {}
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function todayStart() {
  var d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d, n) {
  var r = new Date(d.getTime());
  r.setDate(r.getDate() + n);
  return r;
}

function atTime(d, hhmm) {
  var p = hhmm.split(':');
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(p[0]), Number(p[1] || 0));
}

function formatDate(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function formatDay(d) {
  var w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return (d.getMonth() + 1) + '/' + d.getDate() + '(' + w + ')';
}

function formatSlot(d) {
  return formatDay(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function monthKey(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1);
}

function monthLabel(k) {
  var p = k.split('-');
  return p[0] + '年' + Number(p[1]) + '月';
}

function pad(n) {
  return n < 10 ? '0' + n : String(n);
}
