const API_BASE = 'https://script.google.com/macros/s/AKfycbwPwWN7BcggcZ33ajLsobq3xY82NT8mGtXuxN86AO5PbxFEQzD-G-BskrrtlLtz_Zs/exec';

const nameInput = document.getElementById('nameInput');
const calendarWrap = document.getElementById('calendarWrap');
const selectedList = document.getElementById('selectedList');
const existingPanel = document.getElementById('existingPanel');
const existingList = document.getElementById('existingList');
const messageEl = document.getElementById('message');
const btnSubmit = document.getElementById('btnSubmit');
const btnClear = document.getElementById('btnClear');
const btnCheckReservation = document.getElementById('btnCheckReservation');
const nameError = document.getElementById('nameError');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');

function setLoading(isLoading, text) {
  if (isLoading) {
    loadingText.textContent = text || '処理中です...';
    loadingOverlay.classList.add('visible');
  } else {
    loadingOverlay.classList.remove('visible');
  }
}

const state = {
  displayName: '',
  normalizedName: '',
  months: [],
  monthMap: new Map(),
  slots: [],
  slotIndex: new Map(),
  daySlots: new Map(),
  existing: [],
  existingSet: new Set(),
  existingByDay: new Map(),
  selected: new Map(),
  activeDay: null,
  loading: false,
  classSelection: {
    category: 'smartphone',
    course: 'intro',
    frequency: '2'
  }
};

let overviewTimer = null;
const DEFAULT_TIMES = ['10:00', '14:00', '16:00', '18:00'];

// --- Initialization ---

// Class Selection Logic
function initClassSelection() {
  // Category
  document.querySelectorAll('#categoryGroup .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Update UI
      document.querySelectorAll('#categoryGroup .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update State
      const val = btn.dataset.value;
      state.classSelection.category = val;

      // Toggle Course Options
      const smGroup = document.getElementById('courseSmartphone');
      const pcGroup = document.getElementById('coursePcAi');

      if (val === 'smartphone') {
        smGroup.classList.remove('hidden');
        pcGroup.classList.add('hidden');
        // Set default course for smartphone
        updateCourseSelection('intro');
        updateToggleUI(smGroup, 'intro');
      } else {
        smGroup.classList.add('hidden');
        pcGroup.classList.remove('hidden');
        // Set default course for pc_ai
        updateCourseSelection('basic');
        updateToggleUI(pcGroup, 'basic');
      }
    });
  });

  // Course (Smartphone)
  document.querySelectorAll('#courseSmartphone .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      updateToggleUI(document.getElementById('courseSmartphone'), btn.dataset.value);
      updateCourseSelection(btn.dataset.value);
    });
  });

  // Course (PC/AI)
  document.querySelectorAll('#coursePcAi .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      updateToggleUI(document.getElementById('coursePcAi'), btn.dataset.value);
      updateCourseSelection(btn.dataset.value);
    });
  });

  // Frequency
  document.querySelectorAll('#frequencyGroup .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      updateToggleUI(document.getElementById('frequencyGroup'), btn.dataset.value);
      state.classSelection.frequency = btn.dataset.value;
      // Re-render to update slot types (Regular/Service) based on new frequency
      renderAll();
    });
  });
}

function updateToggleUI(group, value) {
  group.querySelectorAll('.toggle-btn').forEach(b => {
    if (b.dataset.value === value) b.classList.add('active');
    else b.classList.remove('active');
  });
}

function updateCourseSelection(val) {
  state.classSelection.course = val;
}

initClassSelection();

// Restore name from local storage - REMOVED
// const savedName = localStorage.getItem('teraco_name');
// if (savedName) {
//   nameInput.value = savedName;
//   normalizeNameInput();
// }

nameInput.addEventListener('input', () => {
  normalizeNameInput();
  if (nameInput.value) {
    nameError.style.display = 'none';
  }
});

nameInput.addEventListener('blur', () => {
  normalizeNameInput();
  // if (state.displayName) {
  //   localStorage.setItem('teraco_name', state.displayName);
  // }
});

btnClear.addEventListener('click', () => {
  if (confirm('選択した内容をすべて取り消しますか？')) {
    state.selected.clear();
    state.activeDay = null;
    renderAll();
    showMessage('選択をクリアしました。');
  }
});

btnSubmit.addEventListener('click', submitSelection);

btnCheckReservation.addEventListener('click', checkReservations);

function normalizeNameInput() {
  const original = nameInput.value || '';
  const cleaned = original.replace(/\s+/g, '');
  state.displayName = cleaned;
  state.normalizedName = cleaned;
}

function scheduleOverview(force) {
  clearTimeout(overviewTimer);
  overviewTimer = setTimeout(() => loadOverview({ preserveSelection: true }), force ? 100 : 400);
}

async function checkReservations() {
  normalizeNameInput();
  if (!state.displayName) {
    alert('予約を確認するには、まず「STEP 1」でお名前を入力してください。');
    nameInput.focus();
    nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // showMessage('予約状況を確認しています...');
  setLoading(true, '予約状況を確認しています...');

  try {
    // Load real data
    await loadOverview({ preserveSelection: true });

    if (state.existing.length === 0) {
      alert('現在、登録されている予約はありません。');
      existingPanel.classList.add('hidden');
    } else {
      existingPanel.classList.remove('hidden');
      // Scroll to existing panel
      existingPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showMessage('予約状況を表示しました。');
    }
  } finally {
    setLoading(false);
  }
}

async function loadOverview({ preserveSelection }) {
  // 1. Initialize Slots (Local Mock for Grid)
  if (!state.slots.length) {
    applySlotList(buildMockSlots(90));
  }

  // 2. Fetch Data from GAS (Always fetch to get slot counts)
  try {
    const url = new URL(API_BASE);
    if (state.displayName) {
      url.searchParams.append('name', state.displayName);
    }

    // Show loading if it's the first load or explicit check
    // We check a flag on the first slot to see if we've updated counts yet
    const firstSlot = state.slots[0];
    if (firstSlot && !firstSlot.reserved_count_updated) {
      setLoading(true, '最新の予約状況を読み込んでいます...');
    }

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.existing) {
      state.existing = data.existing;
      state.existingSet = new Set(state.existing.map(e => e.slot_id));

      // Re-map existing by day
      state.existingByDay = new Map();
      state.existing.forEach(ev => {
        const slot = state.slotIndex.get(ev.slot_id);
        const dayKey = slot ? slot.day_key : (ev.iso ? ev.iso.slice(0, 10) : '');
        if (!dayKey) return;
        state.existingByDay.set(dayKey, (state.existingByDay.get(dayKey) || 0) + 1);
      });
    }

    // Update slot counts based on real data
    if (data.slot_counts) {
      state.slots.forEach(slot => {
        // Default capacity is 8
        slot.capacity = 8;
        // Update reserved count if available in response
        if (data.slot_counts[slot.slot_id] !== undefined) {
          slot.reserved_count = data.slot_counts[slot.slot_id];
        } else {
          slot.reserved_count = 0;
        }
        slot.reserved_count_updated = true;
      });
    }
  } catch (e) {
    console.error("Failed to fetch reservations:", e);
    // showMessage('予約情報の取得に失敗しました。');
  } finally {
    setLoading(false);
  }

  renderAll();
}

function applySlotList(slots) {
  let list = Array.isArray(slots) ? slots : [];
  if (!list.length) {
    list = buildMockSlots(90);
  }
  state.slots = list;
  state.slotIndex = new Map(state.slots.map(slot => [slot.slot_id, slot]));
  state.daySlots = new Map();
  state.slots.forEach(slot => {
    if (!state.daySlots.has(slot.day_key)) state.daySlots.set(slot.day_key, []);
    state.daySlots.get(slot.day_key).push(slot);
  });
}

function renderAll() {
  renderCalendar();
  renderSelected();
  renderExisting();
}

function renderCalendar() {
  // Ensure slots exist
  if (!state.slots.length) {
    applySlotList(buildMockSlots(60));
  }

  calendarWrap.innerHTML = '';
  const monthKeys = Array.from(new Set(state.slots.map(slot => slot.month_key))).sort();

  // Always display exactly 2 months (Current and Next)
  const displayMonths = monthKeys.slice(0, 2);

  if (displayMonths.length === 0) {
    calendarWrap.innerHTML = '<div class="error-msg">カレンダーデータの読み込みに失敗しました。</div>';
    return;
  }

  displayMonths.forEach(monthKey => {
    calendarWrap.appendChild(buildMonthCalendar(monthKey));
  });
}

function buildMonthCalendar(monthKey) {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const title = `${year}年${month + 1}月`;
  const table = document.createElement('table');
  table.className = 'month-grid';
  table.innerHTML = `
    <thead>
      <tr><th>日</th><th>月</th><th>火</th><th>水</th><th>木</th><th>金</th><th>土</th></tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');
  let row = document.createElement('tr');
  const startDay = first.getDay();
  for (let i = 0; i < startDay; i++) {
    const cell = document.createElement('td');
    cell.className = 'disabled';
    row.appendChild(cell);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let day = 1; day <= daysInMonth; day++) {
    if (row.children.length === 7) {
      tbody.appendChild(row);
      row = document.createElement('tr');
    }
    const date = new Date(year, month, day);
    const dayKey = formatDayKey(date);
    const cell = document.createElement('td');
    cell.textContent = String(day);

    const slots = state.daySlots.get(dayKey) || [];
    // Check if there are any available slots for this day
    const hasSelectable = slots.some(slot => slot.reserved_count < slot.capacity && !state.existingSet.has(slot.slot_id));
    const hasSelected = Array.from(state.selected.values()).some(slot => slot.day_key === dayKey);
    const hasReservation = state.existing.some(ev => (state.slotIndex.get(ev.slot_id)?.day_key || ev.iso.slice(0, 10)) === dayKey);

    if (!slots.length || date < today) {
      cell.classList.add('disabled');
    } else if (!hasSelectable) {
      cell.classList.add('full');
    } else {
      // Clickable - Embed invisible select for native behavior
      const select = document.createElement('select');
      select.className = 'inline-time-select';

      // Default option
      const def = document.createElement('option');
      def.text = '';
      def.value = '';
      def.disabled = true;
      def.selected = true;
      select.appendChild(def);

      slots.forEach(slot => {
        const option = document.createElement('option');
        option.value = slot.slot_id;

        let text = `${slot.start_time}`;
        let disabled = false;

        if (state.existingSet.has(slot.slot_id)) {
          text += '(済)';
          disabled = true;
        } else if (slot.reserved_count >= slot.capacity) {
          text += '(満)';
          disabled = true;
        } else if (state.selected.has(slot.slot_id)) {
          text += '(選)';
          disabled = true;
        } else {
          const remaining = Math.max(0, slot.capacity - slot.reserved_count);
          text += ` (あと${remaining}人)`;
        }

        option.textContent = text;
        option.disabled = disabled;
        select.appendChild(option);
      });

      select.addEventListener('change', (e) => {
        const slotId = e.target.value;
        if (slotId) {
          const slot = state.slotIndex.get(slotId);
          if (slot) addSlot(slot);
        }
        // Reset value so it can be selected again if needed (though usually re-rendered)
        select.value = '';
      });

      // Add hover effect to parent
      select.addEventListener('mouseenter', () => cell.classList.add('hover'));
      select.addEventListener('mouseleave', () => cell.classList.remove('hover'));

      cell.appendChild(select);
    }

    if (hasSelected) cell.classList.add('has-selected');
    if (state.activeDay === dayKey) cell.classList.add('active');
    if (hasReservation) cell.classList.add('has-reservation');

    row.appendChild(cell);
  }

  while (row.children.length && row.children.length < 7) {
    const cell = document.createElement('td');
    cell.className = 'disabled';
    row.appendChild(cell);
  }
  if (row.children.length) tbody.appendChild(row);

  const wrapper = document.createElement('div');
  wrapper.className = 'calendar';
  const header = document.createElement('header');
  header.textContent = title;
  wrapper.appendChild(header);
  wrapper.appendChild(table);
  return wrapper;
}

function handleDayClick(dayKey, cell) {
  // Deprecated: Logic moved to inline select in buildMonthCalendar
}

function getRegularLimit() {
  return parseInt(state.classSelection.frequency, 10) || 4;
}

function addSlot(slot) {
  // Check limits based on frequency
  const monthKey = slot.month_key;
  const limitRegular = getRegularLimit();
  const limitService = 4; // Service slots are always 4 (implied rule, or could be dynamic too)
  const limitTotal = limitRegular + limitService;

  // Count existing reservations for this month
  const existingInMonth = state.existing.filter(ev => {
    const evSlot = state.slotIndex.get(ev.slot_id);
    return evSlot && evSlot.month_key === monthKey;
  }).length;

  // Count currently selected for this month
  const selectedCounts = countSelectedByMonth();
  const selectedInMonth = selectedCounts[monthKey] || 0;

  if (existingInMonth + selectedInMonth + 1 > limitTotal) {
    alert(`${monthKey}の予約上限（通常${limitRegular}枠＋サービス${limitService}枠）に達しています。`);
    return;
  }

  state.selected.set(slot.slot_id, slot);
  renderAll();
  showMessage('リストに追加しました。');
}

function renderSelected() {
  selectedList.innerHTML = '';
  // Sort by date/time
  const sorted = Array.from(state.selected.values()).sort((a, b) => Number(a.slot_id) - Number(b.slot_id));

  if (!sorted.length) {
    selectedList.innerHTML = '<div class="hint">まだ日時が選択されていません。カレンダーの日付をタップして時間を選んでください。</div>';
    btnSubmit.disabled = true;
    return;
  }

  // Calculate slot types (Regular vs Service) dynamically
  const limitRegular = getRegularLimit();
  const limitService = 4;
  const limitTotal = limitRegular + limitService;

  // We need to know how many existing reservations are in each month to assign types correctly
  const monthCounts = {};
  state.existing.forEach(ev => {
    const s = state.slotIndex.get(ev.slot_id);
    if (s) {
      monthCounts[s.month_key] = (monthCounts[s.month_key] || 0) + 1;
    }
  });

  sorted.forEach(slot => {
    const currentCount = (monthCounts[slot.month_key] || 0) + 1;
    monthCounts[slot.month_key] = currentCount;

    let typeLabel = '';
    let typeColor = '#666';
    if (currentCount <= limitRegular) {
      typeLabel = '通常枠';
      typeColor = 'var(--green-deep)';
    } else if (currentCount <= limitTotal) {
      typeLabel = 'サービス枠';
      typeColor = '#ff9800'; // Orange for service
    } else {
      typeLabel = '枠外'; // Should not happen due to addSlot check
    }

    // Get current class selection details for display
    const { category, course, frequency } = state.classSelection;
    const categoryLabel = category === 'smartphone' ? 'スマホ' : 'パソコンAI';
    let courseLabel = '';
    if (category === 'smartphone') {
      courseLabel = course === 'intro' ? '入門まなび' : '応用てらこ';
    } else {
      courseLabel = course === 'basic' ? '基礎ベーシック' : '実践アドバンス';
    }
    const freqLabel = `月${frequency}回`;

    const row = document.createElement('div');
    row.className = 'selected-item';
    row.innerHTML = `
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="font-weight:700;">${slot.day_label}</span>
          <span style="font-size:12px;background:${typeColor};color:#fff;padding:2px 6px;border-radius:4px;">${typeLabel}</span>
        </div>
        <div style="font-size:20px;color:var(--green-deep);margin-bottom:4px;">${slot.start_time} 〜 ${slot.end_time}</div>
        <div style="font-size:14px;color:#666;">
          ${categoryLabel} / ${courseLabel} / ${freqLabel}
        </div>
      </div>
    `;

    const btn = document.createElement('button');
    btn.className = 'soft';
    btn.textContent = '削除';
    btn.style.padding = '8px 16px';
    btn.addEventListener('click', () => {
      state.selected.delete(slot.slot_id);
      renderAll();
    });

    row.appendChild(btn);
    selectedList.appendChild(row);
  });

  btnSubmit.disabled = false;
}

function countSelectedByMonth() {
  const counts = {};
  state.selected.forEach(slot => {
    counts[slot.month_key] = (counts[slot.month_key] || 0) + 1;
  });
  return counts;
}

function renderExisting() {
  existingList.innerHTML = '';
  if (!state.displayName || !state.existing.length) {
    existingPanel.classList.add('hidden');
    return;
  }

  existingPanel.classList.remove('hidden');

  // Sort existing
  const sortedExisting = state.existing.slice().sort((a, b) => Number(a.slot_id || 0) - Number(b.slot_id || 0));

  // Track counts for labels
  const monthCounts = {};
  const limitRegular = getRegularLimit();
  const limitService = 4;
  const limitTotal = limitRegular + limitService;

  sortedExisting.forEach(ev => {
    const slot = state.slotIndex.get(ev.slot_id);
    let typeLabel = '予約済';
    let typeColor = '#999';

    if (slot) {
      const currentCount = (monthCounts[slot.month_key] || 0) + 1;
      monthCounts[slot.month_key] = currentCount;

      if (currentCount <= limitRegular) {
        typeLabel = '通常枠';
      } else if (currentCount <= limitTotal) {
        typeLabel = 'サービス枠';
      }
    }

    // Parse description to extract class details if available
    let details = '';
    if (ev.description) {
      const lines = ev.description.split('\n');
      // Assuming format: "お名前: ...", "カテゴリ: ...", "コース: ...", "頻度: ..."
      // But since we changed logic to just append names, we might not have this metadata in description anymore for shared events.
      // However, the TITLE now contains "Category Course".
      // Let's use the title for basic info.
    }

    // Title format is expected to be "Category Course" (e.g. "スマホ 入門まなび(45分)")
    // or old format "TERACO予約: Name"
    let displayTitle = ev.label;
    if (displayTitle.startsWith('TERACO予約')) {
      displayTitle = '旧形式の予約';
    }

    const row = document.createElement('div');
    row.className = 'selected-item';
    row.style.borderColor = '#ccc';
    row.style.background = '#f9f9f9';

    // Checkbox for multi-select
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'cancel-checkbox';
    checkbox.value = ev.slot_id; // Use slot_id as value
    checkbox.dataset.eventId = ev.event_id; // Store event_id
    checkbox.style.transform = 'scale(1.5)';
    checkbox.style.marginRight = '16px';

    row.innerHTML = `
      <div style="display:flex; align-items:center; flex:1;">
        ${checkbox.outerHTML}
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="font-weight:700;">${formatDayLabelFromKey(ev.start.slice(0, 10))}</span>
            <span style="font-size:12px;background:#999;color:#fff;padding:2px 6px;border-radius:4px;">${typeLabel}</span>
          </div>
          <div style="font-size:18px;color:#333;margin-bottom:4px;">
            ${fmtTime_(new Date(ev.start))} 〜 ${fmtTime_(new Date(ev.end))}
          </div>
          <div style="font-size:14px;color:#666;">
            ${displayTitle}
          </div>
        </div>
      </div>
    `;

    // Re-attach event listener to the checkbox element we just created via string
    const actualCheckbox = row.querySelector('.cancel-checkbox');
    // No specific listener needed, we will querySelectorAll on submit

    existingList.appendChild(row);
  });

  // Re-bind cancel button
  const btnCancelSelected = document.getElementById('btnCancelSelected');
  // Remove old listeners to avoid duplicates (simple way: clone node)
  const newBtn = btnCancelSelected.cloneNode(true);
  btnCancelSelected.parentNode.replaceChild(newBtn, btnCancelSelected);

  newBtn.addEventListener('click', async () => {
    const checked = document.querySelectorAll('.cancel-checkbox:checked');
    if (checked.length === 0) {
      alert('取り消す予約を選択してください。');
      return;
    }

    if (!confirm(`${checked.length}件の予約を取り消しますか？`)) return;

    const itemsToCancel = [];
    checked.forEach(cb => {
      itemsToCancel.push({
        slot_id: cb.value,
        event_id: cb.dataset.eventId
      });
    });

    await batchCancelReservations(itemsToCancel);
  });
}

async function submitSelection() {
  // Validate Name
  normalizeNameInput();
  if (!state.displayName) {
    nameError.style.display = 'block';
    nameInput.focus();
    // Scroll to input
    nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (!state.selected.size) return;

  const count = state.selected.size;

  // Get class selection details
  const { category, course, frequency } = state.classSelection;
  const categoryLabel = category === 'smartphone' ? 'スマホ' : 'パソコンAI';
  let courseLabel = '';
  if (category === 'smartphone') {
    courseLabel = course === 'intro' ? '入門まなび(45分)' : '応用てらこ(90分)';
  } else {
    courseLabel = course === 'basic' ? '基礎ベーシック(45分)' : '実践アドバンス(90分)';
  }
  const freqLabel = `月${frequency}回`;

  const confirmMsg = `${state.displayName}様\n\n` +
    `【選択クラス】\n${categoryLabel} / ${courseLabel} / ${freqLabel}\n\n` +
    `${count}件の予約を確定します。よろしいですか？`;

  if (!confirm(confirmMsg)) return;

  // Save name for next time - REMOVED
  // localStorage.setItem('teraco_name', state.displayName);

  try {
    btnSubmit.disabled = true;
    // showMessage('予約を登録しています…');
    setLoading(true, '予約を登録しています...');

    const payload = {
      action: 'batch_reserve',
      name: state.displayName,
      slots: Array.from(state.selected.keys()),
      class_details: {
        category: categoryLabel,
        course: courseLabel,
        frequency: freqLabel
      }
    };

    // Real API Call
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // GAS requires text/plain for CORS sometimes
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!data.ok) {
      alert(data.message || '予約の登録に失敗しました。');
      return;
    }

    // Success
    state.selected.clear();
    state.activeDay = null;

    // Reload to show new reservations
    await loadOverview({ preserveSelection: false });

    showMessage(data.message || `${count}件の予約を登録しました。`);
    alert('予約が完了しました！');

  } catch (err) {
    console.error(err);
    alert('予約の登録に失敗しました。時間をおいて再度お試しください。');
  } finally {
    btnSubmit.disabled = false;
    setLoading(false);
  }
}

async function batchCancelReservations(items) {
  try {
    setLoading(true, '予約を取り消しています...');

    // Process sequentially or parallel? Parallel is faster but might hit rate limits.
    // Let's do parallel for better UX, GAS should handle it with lock (wait).
    // Or we can update GAS to handle batch cancel, but for now let's loop fetch.

    const promises = items.map(item => {
      return fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'cancel',
          slot_id: item.slot_id,
          event_id: item.event_id,
          name: state.displayName
        })
      }).then(res => res.json());
    });

    const results = await Promise.all(promises);

    // Check results
    const failures = results.filter(r => !r.ok);
    if (failures.length > 0) {
      console.error("Some cancellations failed", failures);
      alert('一部の予約の取り消しに失敗しました。');
    } else {
      alert('予約を取り消しました。');
    }

    // Reload
    await loadOverview({ preserveSelection: true });
    showMessage('予約を取り消しました。');

  } catch (err) {
    console.error(err);
    alert('エラーが発生しました。');
  } finally {
    setLoading(false);
  }
}

async function cancelReservation(item) {
  // Deprecated single cancel, redirect to batch
  await batchCancelReservations([item]);
}

function showMessage(text) {
  messageEl.textContent = text || '';
}

function formatDayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDayLabelFromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${m}/${d}(${['日', '月', '火', '水', '木', '金', '土'][date.getDay()]})`;
}

function fmtTime_(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function buildMockSlots(days) {
  const slots = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const day = new Date(start.getTime());
    day.setDate(day.getDate() + i);
    const dayKey = formatDayKey(day);
    const dayLabel = formatDayLabelFromKey(dayKey);
    DEFAULT_TIMES.forEach(time => {
      const [hh, mm] = time.split(':').map(Number);
      const startTime = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm, 0, 0);
      if (startTime <= now) return;
      const endTime = new Date(startTime.getTime() + 45 * 60 * 1000);
      slots.push({
        slot_id: String(startTime.getTime()),
        iso: startTime.toISOString(),
        day_key: dayKey,
        day_label: dayLabel,
        start_time: time,
        end_time: fmtTime_(endTime),
        month_key: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}`,
        capacity: 8,
        reserved_count: 0 // Initial mock count, will be overwritten by API
      });
    });
  }
  return slots;
}

// Initial Load - Fetch data immediately
loadOverview({ preserveSelection: false });
