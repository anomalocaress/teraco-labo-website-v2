const API_BASE = 'https://script.google.com/macros/s/AKfycbx8ABfNaUZe3C02gtN--jSCut-Aul1umYSu7kQEBMrenIKgWLA0kjQkmJ-5OcXFuCjX/exec';

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
    category: 'smartphone', // smartphone | pc_ai
    course: 'intro',        // intro | applied | basic | advance
    frequency: 4            // 4 | 8
  },
  googleUser: null // Store Google User Info
};

// Global callback for Google Sign-In
window.handleCredentialResponse = function (response) {
  try {
    const responsePayload = decodeJwtResponse(response.credential);

    const user = {
      sub: responsePayload.sub,
      name: responsePayload.name,
      email: responsePayload.email,
      picture: responsePayload.picture
    };

    // Save to session
    setGoogleUser(user);

    // Trigger check
    loadOverview({ preserveSelection: true });

  } catch (e) {
    console.error("Error handling Google credential", e);
  }
};

function setGoogleUser(user) {
  state.googleUser = user;
  const wrapper = document.getElementById('googleBtnWrapper');

  if (user) {
    // Save to localStorage
    localStorage.setItem('teraco_google_user', JSON.stringify(user));

    // Auto-fill name and lock input
    nameInput.value = user.name;
    nameInput.disabled = true;
    state.displayName = user.name;

    // Show Profile
    wrapper.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:8px;background:#f1f8e9;border-radius:4px;border:1px solid #c5e1a5;">
        <img src="${user.picture}" style="width:32px;height:32px;border-radius:50%;">
        <div style="flex:1;">
          <div style="font-weight:bold;font-size:14px;">${user.name}</div>
          <div style="font-size:12px;color:#666;">${user.email}</div>
        </div>
        <button onclick="signOut()" style="background:none;border:none;color:#666;cursor:pointer;font-size:12px;text-decoration:underline;">ログアウト</button>
      </div>
    `;

    // Show Calendar Option
    document.getElementById('calendarOption').style.display = 'block';

  } else {
    // Logout / Initial State
    // Restore original Google Button HTML
    // We need to re-render the button using GSI API if possible, or just reload page.
    // Since we reload page on signOut, this block is mostly for initial state if we were to do it dynamically.
    // But wait, if we reload, the HTML in index.html is used, which IS the button.
    // So we don't need to manually restore HTML here if we reload.
    // However, if we want to support dynamic switch without reload, we need to put back the div.

    // For now, signOut does location.reload(), so index.html's default button will show.
    // If the user request implies it's NOT showing, maybe it's because we are overwriting it somewhere else?
    // No, index.html has the button by default.

    // Let's ensure signOut clears everything and reloads.
    document.getElementById('calendarOption').style.display = 'none';
    document.getElementById('addToCalendar').checked = false;
  }
}

window.signOut = function () {
  state.googleUser = null;
  state.displayName = '';
  nameInput.value = '';
  nameInput.disabled = false;

  localStorage.removeItem('teraco_google_user');

  // Reload page to reset button and state completely
  location.reload();
};

function checkSavedSession() {
  const saved = localStorage.getItem('teraco_google_user');
  if (saved) {
    try {
      const user = JSON.parse(saved);
      setGoogleUser(user);
    } catch (e) {
      console.error("Failed to restore session", e);
      localStorage.removeItem('teraco_google_user');
    }
  }
}

function decodeJwtResponse(token) {
  var base64Url = token.split('.')[1];
  var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));

  return JSON.parse(jsonPayload);
}

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
      renderAll();
    });
  });

  // Course (PC/AI)
  document.querySelectorAll('#coursePcAi .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      updateToggleUI(document.getElementById('coursePcAi'), btn.dataset.value);
      updateCourseSelection(btn.dataset.value);
      renderAll();
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
    applySlotList(buildMockSlots(60));
  }

  // Render calendar first for better UX
  if (!state.slots[0]?.reserved_count_updated) {
    renderAll();
  }

  // 2. Fetch Data from GAS (Always fetch to get slot counts)
  try {
    const url = new URL(API_BASE);
    if (state.displayName) {
      url.searchParams.append('name', state.displayName);
    }

    // Show loading only on first load
    const firstSlot = state.slots[0];
    const isFirstLoad = firstSlot && !firstSlot.reserved_count_updated;
    if (isFirstLoad) {
      setLoading(true, '予約状況を確認しています...');
    }

    // Add timeout to prevent infinite loading (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      mode: 'cors',
      cache: 'no-cache'
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    console.log('📥 サーバーからのレスポンス:', data);

    if (data.existing) {
      state.existing = data.existing;
      state.existingSet = new Set(state.existing.map(e => e.slot_id));

      // Re-map existing by day
      state.existingByDay = new Map();
      state.existing.forEach(ev => {
        const slot = state.slotIndex.get(ev.slot_id);
        const dayKey = slot ? slot.day_key : (ev.start ? ev.start.slice(0, 10) : '');
        if (!dayKey) return;
        state.existingByDay.set(dayKey, (state.existingByDay.get(dayKey) || 0) + 1);
      });
    }

    // Update slots from server data
    if (data.slots && Array.isArray(data.slots)) {
      applySlotList(data.slots);
    }
  } catch (e) {
    console.error("Failed to fetch reservations:", e);
    if (e.name === 'AbortError') {
      console.warn('Request timeout after 30 seconds');
      showMessage('サーバーへの接続がタイムアウトしました。Google Apps Scriptの初回起動には時間がかかることがあります。');
    } else {
      showMessage('予約データの読み込みに失敗しました: ' + e.message);
    }
    // Continue to render with mock data even on error
  } finally {
    setLoading(false);
  }

  renderAll();
}

function applySlotList(slots) {
  let list = Array.isArray(slots) ? slots : [];
  if (!list.length) {
    list = buildMockSlots(60);
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

function renderCurrentDate() {
  const el = document.getElementById('current-date-display');
  if (!el) return;
  const today = new Date();
  const seconds = today.getSeconds();
  const colonVisible = (seconds % 2 === 0); // true for visible, false for hidden

  const datePart = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日(${['日', '月', '火', '水', '木', '金', '土'][today.getDay()]})`;
  const hours = String(today.getHours()).padStart(2, '0');
  const minutes = String(today.getMinutes()).padStart(2, '0');

  el.innerHTML = `現在日時: ${datePart} ${hours}<span style="visibility: ${colonVisible ? 'visible' : 'hidden'};">:</span>${minutes}`;
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

    const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    const slots = state.daySlots.get(dayKey) || [];
    const hasSelected = Array.from(state.selected.values()).some(slot => slot.day_key === dayKey);
    const hasReservation = state.existing.some(ev => (state.slotIndex.get(ev.slot_id)?.day_key || ev.start.slice(0, 10)) === dayKey);

    // 1. 過去・今日は選択不可
    if (date <= today) {
      cell.classList.add('disabled');
      cell.addEventListener('click', () => {
        alert('予約・修正は講座前日の17:00までにお願いいたします。なお当日の変更はお受け付けできません。お急ぎの場合は教室管理者に直接ご連絡ください。');
      });
      row.appendChild(cell);
      continue;
    }

    // 2. 土日は選択不可（お休み）
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      cell.classList.add('disabled');
      cell.addEventListener('click', () => {
        alert('土曜日・日曜日は休講日です。');
      });
      row.appendChild(cell);
      continue;
    }

    // 3. 個人レッスンの場合のみ、月・火・木以外は選択不可
    if (state.classSelection.course === 'private') {
      if (![1, 2, 4].includes(dayOfWeek)) {
        cell.classList.add('disabled');
        cell.addEventListener('click', () => {
          alert('個人レッスンは月曜日・火曜日・木曜日のみ受付可能です。');
        });
        row.appendChild(cell);
        continue;
      }
    }

    // スロットデータがない場合（範囲外または読み込み中）
    if (!slots.length) {
      cell.classList.add('disabled');
      cell.addEventListener('click', () => {
        alert('この日の予約枠データを取得できませんでした。ページを再読み込みしてください。');
      });
      row.appendChild(cell);
      continue;
    }

    // Check if there are any available slots for this day
    const hasSelectable = slots.some(slot => slot.reserved_count < slot.capacity && !state.existingSet.has(slot.slot_id));

    if (!hasSelectable) {
      cell.classList.add('full');
      cell.addEventListener('click', () => {
        alert('この日の予約枠はすべて満席または予約済みです。');
      });
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

        // Calculate remaining seats based on server data
        let remaining = Math.max(0, slot.capacity - slot.reserved_count);

        if (state.existingSet.has(slot.slot_id)) {
          // Already reserved by this user
          text += ` (済) (${slot.reserved_count}人)`;
          disabled = true;
        } else if (slot.reserved_count >= slot.capacity) {
          text += ' (満)';
          disabled = true;
        } else if (state.selected.has(slot.slot_id)) {
          // Selected by user currently
          // Show reserved count
          text += ` (選) (${slot.reserved_count}人)`;
          disabled = true;
        } else {
          text += ` (${slot.reserved_count}人)`;
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

function detectCategory(title) {
  if (!title) return 'unknown';
  if (title.includes('スマホ')) return 'smartphone';
  if (title.includes('パソコン') || title.includes('PC')) return 'pc_ai';
  return 'unknown';
}

function addSlot(slot) {
  // Check limits based on frequency AND category
  const monthKey = slot.month_key;
  const currentCategory = state.classSelection.category; // 'smartphone' or 'pc_ai'
  const limitRegular = getRegularLimit();
  const limitService = 4;
  const limitTotal = limitRegular + limitService;

  // Count existing reservations for this month AND this category
  const existingInMonth = state.existing.filter(ev => {
    const evSlot = state.slotIndex.get(ev.slot_id);
    if (!evSlot || evSlot.month_key !== monthKey) return false;

    // Check category of existing event
    // If it's a legacy event (TERACO予約...), we might not know. 
    // Assuming new events have "Category Course" title.
    let cat = detectCategory(ev.label);
    // If unknown, maybe treat as current category? Or ignore?
    // Let's treat unknown as current category to be safe (prevent overbooking if unsure)
    if (cat === 'unknown') cat = currentCategory;

    return cat === currentCategory;
  }).length;

  // Count currently selected for this month AND this category
  // All items in state.selected are for the CURRENT category being booked
  const selectedCounts = countSelectedByMonth();
  const selectedInMonth = selectedCounts[monthKey] || 0;

  if (existingInMonth + selectedInMonth + 1 > limitTotal) {
    alert(`${monthKey}の${currentCategory === 'smartphone' ? 'スマホ' : 'パソコンAI'}クラス予約上限（通常${limitRegular}枠＋サービス${limitService}枠）に達しています。`);
    return;
  }

  state.selected.set(slot.slot_id, slot);
  renderAll();
  showMessage('リストに追加しました。');
}

function renderSelected() {
  selectedList.innerHTML = '';
  const sorted = Array.from(state.selected.values()).sort((a, b) => Number(a.slot_id) - Number(b.slot_id));

  if (!sorted.length) {
    selectedList.innerHTML = '<div class="hint">まだ日時が選択されていません。カレンダーの日付をタップして時間を選んでください。</div>';
    btnSubmit.disabled = true;
    return;
  }

  const limitRegular = getRegularLimit();
  const limitService = 4;
  const limitTotal = limitRegular + limitService;
  const currentCategory = state.classSelection.category;

  // Count existing reservations by month for the CURRENT category
  const monthCounts = {};
  state.existing.forEach(ev => {
    const s = state.slotIndex.get(ev.slot_id);
    if (s) {
      let cat = detectCategory(ev.label);
      if (cat === 'unknown') cat = currentCategory;

      if (cat === currentCategory) {
        monthCounts[s.month_key] = (monthCounts[s.month_key] || 0) + 1;
      }
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
      typeColor = '#ff9800';
    } else {
      typeLabel = '枠外';
    }

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
        <div style="font-size:20px;color:var(--green-deep);margin-bottom:4px;">${slot.start_time}~</div>
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

  const sortedExisting = state.existing.slice().sort((a, b) => Number(a.slot_id || 0) - Number(b.slot_id || 0));

  // Track counts by (Month + Category)
  const countsMap = {}; // Key: "YYYY-MM_category"

  // We need to know the limit for each category.
  // For the CURRENT category, we use state.classSelection.frequency.
  // For the OTHER category, we don't know the user's contract. Default to 4?
  // Or, if the user has mixed reservations, maybe we should just use 4 as default for non-selected categories.
  const currentCategory = state.classSelection.category;
  const currentLimit = getRegularLimit();

  sortedExisting.forEach(ev => {
    const slot = state.slotIndex.get(ev.slot_id);
    let typeLabel = '予約済';
    let typeColor = '#999';

    if (slot) {
      let cat = detectCategory(ev.label);
      // If unknown, assume it belongs to the current category context if we are strict, 
      // but for display, maybe just 'unknown'? 
      // Let's map unknown to current for counting safety.
      if (cat === 'unknown') cat = currentCategory;

      const key = `${slot.month_key}_${cat}`;
      const currentCount = (countsMap[key] || 0) + 1;
      countsMap[key] = currentCount;

      // Determine limit for this category
      let limitRegular = 4; // Default
      if (cat === currentCategory) {
        limitRegular = currentLimit;
      }
      const limitService = 4;
      const limitTotal = limitRegular + limitService;

      if (currentCount <= limitRegular) {
        typeLabel = '通常枠';
      } else if (currentCount <= limitTotal) {
        typeLabel = 'サービス枠';
      }
    }

    let displayTitle = ev.label || '';
    if (displayTitle.startsWith('TERACO予約')) {
      displayTitle = '旧形式の予約';
    }

    const row = document.createElement('div');
    row.className = 'selected-item';
    row.style.borderColor = '#ccc';
    row.style.background = '#f9f9f9';
    row.dataset.slotId = ev.slot_id;
    row.dataset.eventId = ev.event_id;

    row.innerHTML = `
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="font-weight:700;">${formatDayLabelFromKey(ev.start.slice(0, 10))}</span>
          <span style="font-size:12px;background:#999;color:#fff;padding:2px 6px;border-radius:4px;">${typeLabel}</span>
        </div>
        <div style="font-size:18px;color:#333;margin-bottom:4px;">
          ${fmtTime_(new Date(ev.start))}~
        </div>
        <div style="font-size:14px;color:#666;">
          ${displayTitle}
        </div>
      </div>
    `;

    const btn = document.createElement('button');
    btn.className = 'soft toggle-cancel';
    btn.textContent = '選択';
    btn.style.minWidth = '60px';

    btn.addEventListener('click', () => {
      const isSelected = row.classList.toggle('to-be-cancelled');
      if (isSelected) {
        btn.textContent = '解除';
        btn.style.background = 'var(--error)';
        btn.style.color = '#fff';
        btn.style.borderColor = 'var(--error)';
        row.style.background = '#ffebee';
      } else {
        btn.textContent = '選択';
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
        row.style.background = '#f9f9f9';
      }
      updateBatchCancelButton();
    });

    row.appendChild(btn);
    existingList.appendChild(row);
  });

  updateBatchCancelButton();
}

function updateBatchCancelButton() {
  const btn = document.getElementById('btnCancelSelected');
  const selectedCount = document.querySelectorAll('.selected-item.to-be-cancelled').length;

  if (selectedCount > 0) {
    btn.textContent = `${selectedCount}件の予約を取り消す`;
    btn.disabled = false;
    btn.style.opacity = '1';
  } else {
    btn.textContent = '取り消す予約を選択してください';
    btn.disabled = true;
    btn.style.opacity = '0.5';
  }
}

// Bind the batch cancel button once (outside render loop or check existence)
// We'll just attach listener here since renderExisting is called repeatedly
// Better to attach to a static element or replace node to clear listeners
// We'll use the ID directly after checking it exists.
document.addEventListener('DOMContentLoaded', () => {
    const btnCancelSelected = document.getElementById('btnCancelSelected');
    if (btnCancelSelected) {
        const newBtn = btnCancelSelected.cloneNode(true);
        btnCancelSelected.parentNode.replaceChild(newBtn, btnCancelSelected);

        newBtn.addEventListener('click', async () => {
        const selectedRows = document.querySelectorAll('.selected-item.to-be-cancelled');
        if (selectedRows.length === 0) return;

        if (!confirm(`${selectedRows.length}件の予約を取り消しますか？`)) return;

        const itemsToCancel = [];
        selectedRows.forEach(row => {
            itemsToCancel.push({
            slot_id: row.dataset.slotId,
            event_id: row.dataset.eventId
            });
        });

        await batchCancelReservations(itemsToCancel);
        });
    }
});

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
      if (course === 'private') {
        courseLabel = '個人レッスン(50分)';
      } else if (category === 'smartphone') {
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

    const addToCalendar = document.getElementById('addToCalendar').checked;

    const selectedSlots = Array.from(state.selected.keys());
    console.log('🔍 予約しようとしているスロット:', selectedSlots);
    console.log('🔍 既存の予約:', Array.from(state.existingSet));
    console.log('🔍 名前:', state.displayName);

    const payload = {
      action: 'batch_reserve',
      name: state.displayName,
      email: state.googleUser ? state.googleUser.email : null, // Send email if logged in
      add_to_calendar: addToCalendar, // User preference
      slots: selectedSlots,
      class_details: {
        category: categoryLabel,
        course: courseLabel,
        frequency: freqLabel
      }
    };

    console.log('📤 送信するペイロード:', payload);

    // Real API Call
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow' // Explicitly follow redirects
    });

    // Check response status
    if (!res.ok) {
      console.error('HTTP Error:', res.status, res.statusText);
      const text = await res.text();
      console.error('Response body:', text.substring(0, 500));
      alert(`サーバーエラーが発生しました（ステータス: ${res.status}）。詳細はコンソールを確認してください。`);
      return;
    }

    const data = await res.json();

    console.log('📥 GASからのレスポンス:', data);

    if (!data.ok) {
      console.error('❌ API Error:', data);
      console.error('エラー詳細:', {
        message: data.message,
        existing: data.existing?.length || 0,
        slots: data.slots?.length || 0
      });
      alert(data.message || '予約の登録に失敗しました。');
      return;
    }

    // Success - 即座にUI更新（API待たない）
    state.selected.clear();
    state.activeDay = null;

    // 作成された予約をローカルに追加
    if (data.created) {
      data.created.forEach(ev => {
        state.existing.push(ev);
        state.existingSet.add(ev.slot_id);
      });
    }

    // 即座に画面更新
    renderAll();
    setLoading(false);

    showMessage(data.message || `${count}件の予約を登録しました。`);
    alert('予約が完了しました！');

    // バックグラウンドで最新データを取得（ユーザーを待たせない）
    loadOverview({ preserveSelection: false }).catch(console.error);
    return;

  } catch (err) {
    console.error('予約エラー:', err);
    if (err.name === 'AbortError') {
      alert('サーバーへの接続がタイムアウトしました。予約が完了している可能性があるため、ページを再読み込みして確認してください。');
    } else {
      alert('予約の登録に失敗しました。時間をおいて再度お試しください。\nエラー: ' + err.message);
    }
  } finally {
    btnSubmit.disabled = false;
    setLoading(false);
  }
}

async function batchCancelReservations(items) {
  try {
    setLoading(true, '予約を取り消しています...');

    // Use batch_cancel action
    const eventIds = items.map(item => item.event_id);

    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'batch_cancel',
        name: state.displayName,
        email: state.googleUser ? state.googleUser.email : null,
        event_ids: eventIds
      }),
      redirect: 'follow'
    });

    if (!res.ok) {
      console.error('HTTP Error:', res.status, res.statusText);
      const text = await res.text();
      console.error('Response body:', text.substring(0, 500));
      alert(`サーバーエラーが発生しました（ステータス: ${res.status}）`);
      return;
    }

    const data = await res.json();

    if (!data.ok) {
      console.error('API Error:', data);
      alert(data.message || '予約の取り消しに失敗しました。');
      return;
    }

    // 取り消した予約をローカルから削除
    items.forEach(item => {
      state.existingSet.delete(item.slot_id);
      state.existing = state.existing.filter(ev => ev.slot_id !== item.slot_id);
    });

    // 即座に画面更新
    renderAll();
    setLoading(false);

    alert(data.message || '予約を取り消しました。');
    showMessage('予約を取り消しました。');

    // バックグラウンドで最新データを取得
    loadOverview({ preserveSelection: true }).catch(console.error);
    return;

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

// Initial Load
checkSavedSession();
loadOverview({ preserveSelection: false });
renderCurrentDate(); // Initial call
setInterval(renderCurrentDate, 1000);
