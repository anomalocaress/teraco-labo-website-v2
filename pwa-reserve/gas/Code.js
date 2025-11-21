function doGet(e) {
    const name = e.parameter.name;
    const calendar = CalendarApp.getDefaultCalendar();
    const now = new Date();
    const threeMonthsLater = new Date();
    threeMonthsLater.setMonth(now.getMonth() + 3);

    const events = calendar.getEvents(now, threeMonthsLater);
    const existing = [];
    const slot_counts = {};

    events.forEach(ev => {
        const title = ev.getTitle();
        const desc = ev.getDescription();
        const slotId = ev.getStartTime().getTime().toString();

        // 予約人数の計算: 説明文の行数（空行を除く）をカウント
        let count = 0;
        if (desc) {
            count = desc.split('\n').filter(line => line.trim() !== '').length;
        }

        // 同じ時間枠（slotId）に複数のイベント（別コースなど）がある場合を考慮して加算する
        if (slot_counts[slotId]) {
            slot_counts[slotId] += count;
        } else {
            slot_counts[slotId] = count;
        }

        // ユーザー名が説明文に含まれているか確認
        if (name && desc.includes(name)) {
            existing.push({
                event_id: ev.getId(),
                slot_id: slotId,
                label: title,
                start: ev.getStartTime().toISOString(),
                end: ev.getEndTime().toISOString(),
                description: desc
            });
        }
    });

    return ContentService.createTextOutput(JSON.stringify({
        existing: existing,
        slot_counts: slot_counts
    })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    const lock = LockService.getScriptLock();
    // 最大30秒待機
    try {
        lock.waitLock(30000);
    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({
            ok: false,
            message: 'サーバーが混み合っています。もう一度お試しください。'
        })).setMimeType(ContentService.MimeType.JSON);
    }

    try {
        const data = JSON.parse(e.postData.contents);
        const calendar = CalendarApp.getDefaultCalendar();

        if (data.action === 'batch_reserve') {
            const results = [];
            const errors = [];

            data.slots.forEach(slotId => {
                try {
                    const startTime = new Date(parseInt(slotId));
                    // コースに応じて時間を決定（デフォルト45分）
                    let duration = 45;
                    if (data.class_details && data.class_details.course && data.class_details.course.includes('90分')) {
                        duration = 90;
                    }

                    const endTime = new Date(startTime.getTime() + duration * 60000);

                    // タイトルは「カテゴリ コース名」
                    // 例: "スマホ 入門まなび(45分)"
                    const title = `${data.class_details.category} ${data.class_details.course}`;

                    // 同じ時間の同じタイトルのイベントを探す
                    const existingEvents = calendar.getEvents(startTime, endTime);
                    let targetEvent = null;

                    for (const ev of existingEvents) {
                        if (ev.getTitle() === title) {
                            targetEvent = ev;
                            break;
                        }
                    }

                    if (targetEvent) {
                        // 既存のイベントがある場合、説明文に名前を追加
                        let currentDesc = targetEvent.getDescription() || "";
                        // 名前がまだなければ追加
                        if (!currentDesc.includes(data.name)) {
                            const newDesc = currentDesc ? `${currentDesc}\n${data.name}` : data.name;
                            targetEvent.setDescription(newDesc);
                        }
                        results.push({
                            slot_id: slotId,
                            event_id: targetEvent.getId()
                        });
                    } else {
                        // 新規作成
                        const desc = data.name;
                        const ev = calendar.createEvent(title, startTime, endTime, { description: desc });
                        results.push({
                            slot_id: slotId,
                            event_id: ev.getId()
                        });
                    }

                } catch (err) {
                    errors.push({ slot_id: slotId, error: err.toString() });
                }
            });

            return ContentService.createTextOutput(JSON.stringify({
                ok: true,
                message: `${results.length}件の予約を登録しました`,
                results: results,
                errors: errors
            })).setMimeType(ContentService.MimeType.JSON);
        }

        if (data.action === 'cancel') {
            let ev = null;
            if (data.event_id) {
                try {
                    ev = calendar.getEventById(data.event_id);
                } catch (e) {
                    // イベントが見つからない場合（既に削除された等）
                    console.log("Event not found by ID: " + data.event_id);
                }
            }

            // event_idで見つからない場合、slot_idと名前から探す（念のため）
            if (!ev && data.slot_id) {
                const startTime = new Date(parseInt(data.slot_id));
                const endTime = new Date(startTime.getTime() + 45 * 60000); // 仮の終了時間
                const candidates = calendar.getEvents(startTime, endTime);
                for (const c of candidates) {
                    if (c.getDescription().includes(data.name)) {
                        ev = c;
                        break;
                    }
                }
            }

            if (ev) {
                const currentDesc = ev.getDescription() || "";
                // 名前を行単位で削除
                const lines = currentDesc.split('\n');
                const newLines = lines.filter(line => line.trim() !== data.name.trim());

                if (newLines.length === 0) {
                    // 誰もいなくなったらイベント削除
                    ev.deleteEvent();
                } else {
                    // まだ他の人がいれば更新
                    ev.setDescription(newLines.join('\n'));
                }

                return ContentService.createTextOutput(JSON.stringify({
                    ok: true,
                    message: '予約を取り消しました'
                })).setMimeType(ContentService.MimeType.JSON);
            } else {
                return ContentService.createTextOutput(JSON.stringify({
                    ok: false,
                    message: '予約が見つかりませんでした'
                })).setMimeType(ContentService.MimeType.JSON);
            }
        }

        return ContentService.createTextOutput(JSON.stringify({
            ok: false,
            message: '不明なアクションです'
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({
            ok: false,
            message: 'エラーが発生しました: ' + e.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}
