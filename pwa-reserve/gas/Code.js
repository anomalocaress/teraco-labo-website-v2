function doGet(e) {
    const name = e.parameter.name;
    const calendar = CalendarApp.getDefaultCalendar();
    const now = new Date();
    const threeMonthsLater = new Date();
    threeMonthsLater.setMonth(now.getMonth() + 3);

    // 予約タイトルの識別子（これを含むイベントを予約とみなす）
    const TITLE_IDENTIFIER = 'TERACO予約';

    const events = calendar.getEvents(now, threeMonthsLater);
    const existing = [];

    events.forEach(ev => {
        const title = ev.getTitle();
        const desc = ev.getDescription();

        // タイトルまたは説明文でフィルタリング
        if (title.includes(TITLE_IDENTIFIER)) {
            // 名前が指定されている場合は、その名前が含まれているか確認
            if (!name || desc.includes(name)) {
                existing.push({
                    event_id: ev.getId(),
                    slot_id: ev.getStartTime().getTime().toString(),
                    label: title,
                    start: ev.getStartTime().toISOString(),
                    end: ev.getEndTime().toISOString(),
                    description: desc
                });
            }
        }
    });

    return ContentService.createTextOutput(JSON.stringify({
        existing: existing
    })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
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
                    const title = `TERACO予約: ${data.name}`;
                    const desc = `お名前: ${data.name}\n` +
                        `カテゴリ: ${data.class_details.category}\n` +
                        `コース: ${data.class_details.course}\n` +
                        `頻度: ${data.class_details.frequency}\n` +
                        `予約ID: ${slotId}`;

                    const ev = calendar.createEvent(title, startTime, endTime, { description: desc });
                    results.push({
                        slot_id: slotId,
                        event_id: ev.getId()
                    });
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
            // event_idがあればそれを使う、なければslot_idから探す（非推奨だが互換性のため）
            let ev = null;
            if (data.event_id) {
                ev = calendar.getEventById(data.event_id);
            }

            if (ev) {
                ev.deleteEvent();
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
    }
}
