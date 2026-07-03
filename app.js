const STORE_KEY = 'pemiscot-ip-audit-system-v1';

const options = {
  departments: ['ER', 'Outpatient Surgery', 'Lab', 'Radiology', 'Respiratory Therapy', 'Physical Therapy', 'Central Supply', 'Dietary', 'Registration', 'Administration', 'EVS'],
  yesNo: ['Yes', 'No'],
  yesNoNa: ['Yes', 'No', 'N/A'],
  months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  quarters: ['Q1', 'Q2', 'Q3', 'Q4'],
  shifts: ['Days', 'Evenings', 'Nights', 'Weekend'],
  employeeTypes: ['Nurse', 'Provider', 'CNA', 'Therapy', 'EVS', 'Dietary', 'Visitor', 'Other'],
  whoMoments: ['Before touching a patient', 'Before clean/aseptic procedure', 'After body fluid exposure risk', 'After touching a patient', 'After touching patient surroundings'],
  patientAreas: ['Patient Room', 'Nursing Station', 'Procedure Area', 'Lab', 'Radiology', 'Other'],
  methods: ['Soap and water', 'Alcohol-based hand rub', 'Not performed', 'Other'],
  riskLevels: ['Low', 'Medium', 'High', 'Immediate Action'],
  isolationPrecautions: ['None', 'Contact', 'Droplet', 'Airborne', 'Enhanced Barrier', 'Other'],
  cultureStatuses: ['Open', 'Awaiting Provider', 'Awaiting Patient', 'In Progress', 'Complete', 'Closed'],
  auditAreas: ['Patient Care Area', 'Clean Supply', 'Dirty Utility', 'Medication Room', 'Nursing Station', 'Public Area', 'Other']
};

const pageMeta = {
  dashboard: ['Command Center', 'Daily infection prevention overview and priority follow-up.'],
  handHygiene: ['Hand Hygiene Audit', 'Observe, coach, and trend hand hygiene compliance.'],
  culture: ['Culture Follow-Up', 'Track positive culture review, notifications, and deadlines.'],
  icRound: ['IC Rounds', 'Document monthly infection control rounds and corrective actions.'],
  environmental: ['Environmental Rounds', 'Update quarterly environmental audit status by department.'],
  reports: ['Reports & Export', 'Download audit data from this browser.']
};

document.querySelectorAll('.nav-item').forEach(button => {
  button.addEventListener('click', () => showTab(button.dataset.tab));
});

bindForm('handHygieneForm', 'handHygiene');
bindForm('cultureForm', 'cultures');
bindForm('icRoundForm', 'icRounds');
bindForm('environmentalForm', 'environmentalRounds');

document.getElementById('exportButton').addEventListener('click', downloadCsv);
document.getElementById('downloadReportButton').addEventListener('click', downloadCsv);
document.getElementById('clearDataButton').addEventListener('click', () => {
  if (!confirm('Clear all audit data saved in this browser?')) return;
  localStorage.removeItem(STORE_KEY);
  renderDashboard();
});

hydrateSelects();
renderDashboard();

function bindForm(id, collection) {
  document.getElementById(id).addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.querySelector('.status');
    const entry = Object.fromEntries(new FormData(form).entries());
    entry.date = new Date().toISOString();

    const store = readStore();
    if (collection === 'environmentalRounds') {
      const existing = store.environmentalRounds.find(item =>
        item.quarter === entry.quarter && item.department === entry.department
      );
      if (existing) Object.assign(existing, entry);
      else store.environmentalRounds.push(entry);
    } else {
      store[collection].push(entry);
    }
    writeStore(store);
    form.reset();
    hydrateSelects();
    renderDashboard();
    status.className = 'status ok';
    status.textContent = 'Saved in this browser.';
    showTab('dashboard');
    setTimeout(() => { status.textContent = ''; }, 2200);
  });
}

function hydrateSelects() {
  const now = new Date();
  const defaults = {
    month: options.months[now.getMonth()],
    quarter: `Q${Math.floor(now.getMonth() / 3) + 1}`
  };

  document.querySelectorAll('[data-options]').forEach(select => {
    const key = select.dataset.options;
    const selected = select.value;
    select.innerHTML = '';
    (options[key] || []).forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
    if (selected) select.value = selected;
    if (select.dataset.default && defaults[select.dataset.default]) {
      select.value = defaults[select.dataset.default];
    }
  });
}

function showTab(tabName) {
  document.querySelectorAll('.nav-item').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === tabName);
  });
  document.querySelectorAll('.content').forEach(section => {
    section.classList.toggle('active', section.id === tabName);
  });
  const meta = pageMeta[tabName] || pageMeta.dashboard;
  document.getElementById('pageTitle').textContent = meta[0];
  document.getElementById('pageSubtitle').textContent = meta[1];
}

function renderDashboard() {
  const data = getDashboard();
  document.getElementById('hhDetail').textContent =
    `${data.handHygiene.performed} performed / ${data.handHygiene.missed} missed; ${data.handHygiene.coaching} coached`;
  document.getElementById('hhRate').textContent = data.handHygiene.complianceLabel;
  document.getElementById('cultureOutstanding').textContent = data.cultures.outstanding;
  document.getElementById('cultureDetail').textContent =
    `${data.cultures.overdue} overdue / ${data.cultures.reportableConcerns} reportable`;
  document.getElementById('roundProgress').textContent = `${data.icRounds.completed} / ${data.icRounds.goal}`;
  document.getElementById('roundDetail').textContent =
    `${data.icRounds.month}; environmental ${data.environmental.completed} / ${data.environmental.goal} for ${data.environmental.quarter}`;
  document.getElementById('priorityCount').textContent = data.attention.length;
  renderAttention(data.attention);
  renderRecent(data.recent);
}

function getDashboard() {
  const store = readStore();
  const now = new Date();
  const month = options.months[now.getMonth()];
  const quarter = `Q${Math.floor(now.getMonth() / 3) + 1}`;
  const hhTotal = store.handHygiene.length;
  const hhPerformed = store.handHygiene.filter(entry => yes(entry.hhPerformed)).length;
  const hhMissed = hhTotal - hhPerformed;
  const hhRate = hhTotal ? hhPerformed / hhTotal : 0;
  const cultures = store.cultures;
  const outstandingCultures = cultures.filter(entry => yes(entry.followUpNeeded) && !closed(entry.status)).length;
  const icMonth = store.icRounds.filter(entry => entry.month === month);
  const envQuarter = store.environmentalRounds.filter(entry => entry.quarter === quarter);
  const attention = buildAttentionQueue(store, month, quarter);
  const recent = [
    ...store.handHygiene.map(entry => ({ type: 'Hand Hygiene', date: entry.date, title: entry.department, detail: `${entry.hhPerformed || ''} ${entry.riskLevel || ''}` })),
    ...store.cultures.map(entry => ({ type: 'Culture', date: entry.date, title: entry.patient, detail: `${entry.organism || ''} ${entry.status || ''}` })),
    ...store.icRounds.map(entry => ({ type: 'IC Round', date: entry.date, title: entry.department, detail: `${entry.roundCompleted || ''} ${entry.riskLevel || ''}` })),
    ...store.environmentalRounds.map(entry => ({ type: 'Environmental', date: entry.date, title: entry.department, detail: `${entry.roundCompleted || ''} ${entry.riskLevel || ''}` }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

  return {
    handHygiene: {
      performed: hhPerformed,
      missed: hhMissed,
      coaching: store.handHygiene.filter(entry => yes(entry.coachingProvided)).length,
      complianceLabel: `${(hhRate * 100).toFixed(1)}%`
    },
    cultures: {
      total: cultures.length,
      outstanding: outstandingCultures,
      reportableConcerns: cultures.filter(entry => yes(entry.reportableConcern)).length,
      overdue: cultures.filter(entry => overdue(entry.dueDate) && !closed(entry.status)).length
    },
    icRounds: {
      month,
      completed: icMonth.filter(entry => yes(entry.roundCompleted)).length,
      goal: 9
    },
    environmental: {
      quarter,
      completed: envQuarter.filter(entry => yes(entry.roundCompleted)).length,
      goal: 9
    },
    attention,
    recent
  };
}

function buildAttentionQueue(store, month, quarter) {
  const items = [];
  store.handHygiene.forEach(entry => {
    if (!yes(entry.hhPerformed) || high(entry.riskLevel)) {
      items.push({ priority: high(entry.riskLevel) ? 'High' : 'Medium', section: 'Hand Hygiene', title: entry.department, detail: !yes(entry.hhPerformed) ? 'Missed hand hygiene opportunity' : `${entry.riskLevel} risk observation`, owner: entry.observer, dueDate: '' });
    }
  });
  store.cultures.forEach(entry => {
    if ((yes(entry.followUpNeeded) && !closed(entry.status)) || yes(entry.reportableConcern) || overdue(entry.dueDate)) {
      items.push({ priority: yes(entry.reportableConcern) || overdue(entry.dueDate) ? 'High' : 'Medium', section: 'Culture', title: entry.patient, detail: entry.organism || entry.status, owner: entry.owner || entry.initials, dueDate: entry.dueDate });
    }
  });
  store.icRounds.filter(entry => entry.month === month).forEach(entry => {
    if ((yes(entry.followUpRequired) && !yes(entry.followUpCompleted)) || high(entry.riskLevel) || overdue(entry.dueDate)) {
      items.push({ priority: high(entry.riskLevel) || overdue(entry.dueDate) ? 'High' : 'Medium', section: 'IC Rounds', title: entry.department, detail: entry.auditArea || 'Follow-up required', owner: entry.surveyor, dueDate: entry.dueDate });
    }
  });
  store.environmentalRounds.filter(entry => entry.quarter === quarter).forEach(entry => {
    if ((yes(entry.followUpRequired) && !yes(entry.followUpCompleted)) || high(entry.riskLevel) || overdue(entry.dueDate)) {
      items.push({ priority: high(entry.riskLevel) || overdue(entry.dueDate) ? 'High' : 'Medium', section: 'Environmental', title: entry.department, detail: entry.auditArea || 'Follow-up required', owner: entry.surveyor, dueDate: entry.dueDate });
    }
  });
  return items.sort((a, b) => (b.priority === 'High') - (a.priority === 'High')).slice(0, 12);
}

function renderAttention(items) {
  const list = document.getElementById('attentionList');
  list.innerHTML = '';
  if (!items.length) {
    list.innerHTML = '<div class="work-item"><span class="badge">Clear</span><div><strong>No open priority items</strong><span>High-risk and follow-up items will appear here.</span></div></div>';
    return;
  }
  items.forEach(item => {
    const row = document.createElement('div');
    const priorityClass = item.priority === 'High' ? 'high' : 'medium';
    row.className = 'work-item';
    row.innerHTML = `<span class="badge ${priorityClass}">${escapeHtml(item.priority)}</span><div><strong>${escapeHtml(item.section)}: ${escapeHtml(item.title || 'Untitled')}</strong><span>${escapeHtml(item.detail || '')}</span><span>${item.owner ? `Owner: ${escapeHtml(item.owner)}` : 'Owner not assigned'}</span></div><span>${item.dueDate ? escapeHtml(item.dueDate) : 'No due date'}</span>`;
    list.appendChild(row);
  });
}

function renderRecent(items) {
  const list = document.getElementById('recentList');
  list.innerHTML = '';
  if (!items.length) {
    list.innerHTML = '<div class="recent-item"><strong>No entries yet</strong><span>New activity will show here.</span></div>';
    return;
  }
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'recent-item';
    row.innerHTML = `<strong>${escapeHtml(item.type)}: ${escapeHtml(item.title || 'Untitled')}</strong><span>${escapeHtml(item.detail || '')}</span><span>${formatDate(item.date)}</span>`;
    list.appendChild(row);
  });
}

function downloadCsv() {
  const store = readStore();
  const rows = [['Section', 'Date', 'Location', 'Subject', 'Result', 'Risk', 'Owner', 'Due Date', 'Notes']];
  store.handHygiene.forEach(entry => rows.push(['Hand Hygiene', entry.date, entry.department, entry.employeeType, entry.hhPerformed, entry.riskLevel, entry.observer, '', entry.comments]));
  store.cultures.forEach(entry => rows.push(['Culture', entry.date, entry.source, entry.patient, entry.organism, entry.status, entry.owner || entry.initials, entry.dueDate, entry.notes]));
  store.icRounds.forEach(entry => rows.push(['IC Round', entry.date, entry.department, entry.auditArea, entry.roundCompleted, entry.riskLevel, entry.surveyor, entry.dueDate, entry.notes]));
  store.environmentalRounds.forEach(entry => rows.push(['Environmental', entry.date, entry.department, entry.auditArea, entry.roundCompleted, entry.riskLevel, entry.surveyor, entry.dueDate, entry.notes]));
  const csv = rows.map(row => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ip-audit-export.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function readStore() {
  const saved = localStorage.getItem(STORE_KEY);
  return saved ? JSON.parse(saved) : { handHygiene: [], cultures: [], icRounds: [], environmentalRounds: [] };
}

function writeStore(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function yes(value) {
  return ['yes', 'y', 'true', 'complete', 'completed', 'done', '1'].includes(String(value || '').trim().toLowerCase());
}

function high(value) {
  return ['high', 'immediate action'].includes(String(value || '').trim().toLowerCase());
}

function closed(value) {
  return ['complete', 'completed', 'closed', 'done', 'resolved'].includes(String(value || '').trim().toLowerCase());
}

function overdue(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  date.setHours(23, 59, 59, 999);
  return date.getTime() < Date.now();
}

function csvCell(value) {
  const text = String(value || '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
}
