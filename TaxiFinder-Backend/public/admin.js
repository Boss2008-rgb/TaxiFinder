/**
 * public/admin.js  —  TaxiGo Admin Dashboard (client-side)
 *
 * Loaded by admin.html via  <script src="/admin.js"></script>
 *
 * Responsibilities:
 *   1. Login  → POST /api/admin/login  → stores JWT in localStorage
 *   2. Stats  → GET  /api/admin/stats
 *   3. Feed   → GET  /api/admin/feed
 *   4. Drivers→ GET  /api/admin/drivers  (shows ALL drivers, including pending)
 *   5. Approve→ PATCH /api/admin/drivers/:id/approve
 *   6. Status → PATCH /api/admin/drivers/:id/status   (activate / deactivate)
 *   7. Riders → GET  /api/admin/riders
 *   8. Rides  → GET  /api/admin/rides
 *   9. Charts → GET  /api/admin/chart/rides|status|weekly
 */

'use strict';

// ── State ─────────────────────────────────────────────────
let API      = localStorage.getItem('tg_admin_api')   || '';  // auto-detect below
let TOKEN    = localStorage.getItem('tg_admin_token') || '';
let allDrivers = [];
let allRiders  = [];
let allRides   = [];
let driverFilter = 'all';
let ridesChart, statusChart;

// Auto-detect API base from current page origin so it works
// whether the admin is on localhost:3016, localhost:3018, etc.
if (!API) {
    API = window.location.origin;
    localStorage.setItem('tg_admin_api', API);
}

// ══════════════════════════════════════════════════════════
//  UTILITY — authenticated fetch wrapper
// ══════════════════════════════════════════════════════════
async function apiCall(path, method = 'GET', body = null) {
    const opts = {
        method,
        headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${TOKEN}`,
        },
    };
    if (body) opts.body = JSON.stringify(body);

    const res  = await fetch(API + path, opts);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        // Token expired or invalid → force re-login
        if (res.status === 401 || res.status === 403) logout();
        throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
}

// ══════════════════════════════════════════════════════════
//  LOGIN / LOGOUT
// ══════════════════════════════════════════════════════════
async function login() {
    const email = document.getElementById('lEmail')?.value?.trim();
    const pass  = document.getElementById('lPass')?.value;
    const errEl = document.getElementById('lErr');
    const btn   = document.getElementById('lBtn');

    if (!email || !pass) {
        showErr(errEl, 'يرجى إدخال البريد وكلمة المرور');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0 auto"></div>';

    try {
        // POST /api/admin/login
        const res = await fetch(API + '/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pass }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) throw new Error(data.error || 'بيانات خاطئة');

        TOKEN = data.token;
        localStorage.setItem('tg_admin_token', TOKEN);
        localStorage.setItem('tg_admin_email', email);

        openDashboard(email);

    } catch (err) {
        showErr(errEl, err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول';
    }
}

function logout() {
    TOKEN = '';
    localStorage.removeItem('tg_admin_token');
    document.getElementById('loginScreen').style.display  = 'flex';
    document.getElementById('dashboard').style.display    = 'none';
}

function openDashboard(email) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboard').style.display   = 'block';

    const nameEl = document.getElementById('adminNameSidebar') || document.getElementById('adminName');
    if (nameEl) nameEl.textContent = email || localStorage.getItem('tg_admin_email') || 'admin';

    // Populate API URL field in settings
    const cfgEl = document.getElementById('cfgApi');
    if (cfgEl) cfgEl.value = API;

    // Load initial data
    loadStats();
    loadFeed();
    loadDrivers();    // ← This is what was broken — wrong routes file was loaded
}

// ══════════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════════
function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const page = document.getElementById('page-' + name);
    if (page) page.classList.add('active');

    // Highlight nav item
    document.querySelectorAll(`[data-page="${name}"]`).forEach(el =>
        el.classList.add('active')
    );

    // Update topbar title
    const titles = {
        dashboard: 'لوحة البيانات',
        drivers:   'إدارة السائقين',
        rides:     'سجل الرحلات',
        users:     'الركاب',
        settings:  'الإعدادات',
    };
    const titleEl = document.getElementById('pageTitle');
    const breadEl = document.getElementById('pageBreadcrumb');
    if (titleEl) titleEl.textContent = titles[name] || name;
    if (breadEl) breadEl.textContent = titles[name] || name;

    // Lazy-load page data
    const loaders = {
        dashboard: () => { loadStats(); loadFeed(); },
        drivers:   loadDrivers,
        rides:     loadRides,
        users:     loadRiders,
    };
    loaders[name]?.();
}

// ══════════════════════════════════════════════════════════
//  STATS
// ══════════════════════════════════════════════════════════
async function loadStats() {
    try {
        const data = await apiCall('/api/admin/stats');

        setText('statEarnings', fmtNum(data.totalEarnings) + ' MAD');
        setText('statDrivers',  data.totalDrivers);
        setText('statRides',    data.activeRides);
        setText('statUsers',    data.totalUsers);
        setText('earningsTrend', (data.earningsGrowth || 0) + '%');
        setText('driversTrend',  (data.driversGrowth  || 0) + '%');
        setText('usersTrend',    (data.usersGrowth     || 0) + '%');

        // Quick-stats on login screen
        setText('qs1', data.onlineDrivers  || 0);
        setText('qs2', data.todayRides     || 0);
        setText('qs3', data.totalUsers     || 0);

        await loadCharts();

    } catch (err) {
        console.error('[loadStats]', err.message);
    }
}

// ══════════════════════════════════════════════════════════
//  CHARTS
// ══════════════════════════════════════════════════════════
async function loadCharts() {
    try {
        const [ridesData, statusData] = await Promise.all([
            apiCall('/api/admin/chart/rides?period=7d'),
            apiCall('/api/admin/chart/status'),
        ]);

        // Rides line chart
        const rCtx = document.getElementById('ridesChart')?.getContext('2d');
        if (rCtx) {
            if (ridesChart) ridesChart.destroy();
            ridesChart = new Chart(rCtx, {
                type: 'line',
                data: {
                    labels:   ridesData.labels,
                    datasets: [{
                        label:           'الرحلات',
                        data:            ridesData.values,
                        borderColor:     '#2563eb',
                        backgroundColor: 'rgba(37,99,235,0.08)',
                        tension:         0.4,
                        fill:            true,
                        pointRadius:     4,
                        pointBackgroundColor: '#2563eb',
                    }],
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales:  { y: { beginAtZero: true, ticks: { precision: 0 } } },
                },
            });
        }

        // Status doughnut chart
        const sCtx = document.getElementById('statusChart')?.getContext('2d');
        if (sCtx) {
            if (statusChart) statusChart.destroy();
            statusChart = new Chart(sCtx, {
                type: 'doughnut',
                data: {
                    labels:   ['مفعّلون', 'معلّقون', 'معطّلون'],
                    datasets: [{
                        data: [statusData.approved, statusData.pending, statusData.inactive],
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                        borderWidth: 0,
                    }],
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                },
            });
        }

    } catch (err) {
        console.warn('[loadCharts]', err.message);
    }
}

async function changeChartPeriod(period, btn) {
    document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    try {
        const data = await apiCall(`/api/admin/chart/rides?period=${period}`);
        if (ridesChart) {
            ridesChart.data.labels   = data.labels;
            ridesChart.data.datasets[0].data = data.values;
            ridesChart.update();
        }
    } catch (err) {
        console.warn('[changeChartPeriod]', err.message);
    }
}

// ══════════════════════════════════════════════════════════
//  FEED  (recent activity)
// ══════════════════════════════════════════════════════════
async function loadFeed() {
    const el = document.getElementById('liveFeed');
    if (!el) return;
    try {
        const data = await apiCall('/api/admin/feed');
        const feedItems = data.feed || [];

        if (!feedItems.length) {
            el.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px">لا توجد أنشطة حديثة</div>';
            return;
        }

        el.innerHTML = feedItems.map(f => `
            <div class="feed-item">
                <div class="feed-dot ${f.color}"></div>
                <div class="feed-text">${esc(f.text)}</div>
                <div class="feed-time">${esc(f.time)}</div>
            </div>
        `).join('');
    } catch (err) {
        if (el) el.innerHTML = errState(err.message);
    }
}

// ══════════════════════════════════════════════════════════
//  DRIVERS  ← THE MAIN FIX
// ══════════════════════════════════════════════════════════

/**
 * Fetch ALL drivers from GET /api/admin/drivers
 *
 * This was returning no results because server.js was loading
 * routes/admin.js (only has /login and /status) instead of
 * routes/admin_routes.js (has /drivers, /riders, /stats, etc.)
 *
 * Fix: server.js now requires './routes/admin_routes'
 */
async function loadDrivers() {
    const tbody = document.getElementById('driversTableBody');
    if (!tbody) return;
    tbody.innerHTML = loadRow(7);

    try {
        // GET /api/admin/drivers — returns { drivers: [...], count: N }
        const data = await apiCall('/api/admin/drivers');
        allDrivers = data.drivers || [];

        renderDrivers();
        updatePendingBadge();
        renderPendingPreview();

    } catch (err) {
        tbody.innerHTML = errRow(7, err.message);
    }
}

function renderDrivers() {
    const tbody = document.getElementById('driversTableBody');
    if (!tbody) return;

    let list = allDrivers;

    // Filter
    if (driverFilter === 'pending')  list = list.filter(d => !d.isApproved && d.isActive !== false);
    if (driverFilter === 'approved') list = list.filter(d =>  d.isApproved && d.isActive !== false);
    if (driverFilter === 'inactive') list = list.filter(d =>  d.isActive === false);

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:#94a3b8">
            <i class="fas fa-search" style="font-size:24px;margin-bottom:8px;display:block"></i>
            لا توجد نتائج في هذه الفئة
        </td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(d => {
        const inactive  = d.isActive === false;
        const statusKey = !d.isApproved && !inactive ? 'pending' : inactive ? 'inactive' : 'approved';
        const statusLabel = {
            pending:  '<span class="badge badge-pending"><i class="fas fa-hourglass-half"></i> معلّق</span>',
            approved: '<span class="badge badge-approved"><i class="fas fa-check-circle"></i> مفعّل</span>',
            inactive: '<span class="badge badge-inactive"><i class="fas fa-ban"></i> معطّل</span>',
        }[statusKey];

        const veh  = [d.vehicle?.make, d.vehicle?.model].filter(Boolean).join(' ') || '—';
        const date = d.createdAt ? new Date(d.createdAt).toLocaleDateString('ar-MA') : '—';
        const rating = d.ratings?.average ? `<i class="fas fa-star" style="color:#f59e0b"></i> ${d.ratings.average.toFixed(1)}` : '—';
        const rides  = d.stats?.totalRides ?? 0;

        // Action buttons depend on current status
        let actions = '';
        if (!d.isApproved && d.isActive !== false) {
            // PENDING: show Approve + Reject
            actions = `
                <button class="btn btn-success btn-sm" onclick="approveDriver('${d._id}', true)">
                    <i class="fas fa-check"></i> قبول
                </button>
                <button class="btn btn-danger btn-sm" style="margin-right:4px" onclick="rejectDriver('${d._id}')">
                    <i class="fas fa-times"></i> رفض
                </button>`;
        } else if (d.isActive !== false) {
            // APPROVED & ACTIVE: show Deactivate
            actions = `<button class="btn btn-warning btn-sm" onclick="toggleDriverStatus('${d._id}', false)">
                <i class="fas fa-pause"></i> تعطيل
            </button>`;
        } else {
            // INACTIVE: show Activate
            actions = `<button class="btn btn-primary btn-sm" onclick="toggleDriverStatus('${d._id}', true)">
                <i class="fas fa-play"></i> تفعيل
            </button>`;
        }

        return `<tr>
            <td>
                <div style="font-weight:700">${esc(d.fullName || '—')}</div>
                <div style="font-size:12px;color:#64748b;font-family:monospace">${esc(d.phone || '')}</div>
            </td>
            <td>${esc(veh)}</td>
            <td>${statusLabel}</td>
            <td>${rating}</td>
            <td style="font-family:monospace">${rides}</td>
            <td style="color:#64748b;font-size:13px">${date}</td>
            <td><div style="display:flex;gap:4px">${actions}</div></td>
        </tr>`;
    }).join('');
}

function filterDrivers(filter, btn) {
    driverFilter = filter;
    document.querySelectorAll('#driverFilterTabs .filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderDrivers();
}

function searchDrivers(q) {
    const lower = q.toLowerCase();
    const list  = allDrivers.filter(d =>
        (d.fullName || '').toLowerCase().includes(lower) ||
        (d.phone    || '').includes(q)
    );
    const tbody = document.getElementById('driversTableBody');
    if (!tbody) return;
    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:#94a3b8">لا توجد نتائج</td></tr>`;
        return;
    }
    // Temporarily override allDrivers for rendering
    const backup = allDrivers;
    allDrivers = list;
    renderDrivers();
    allDrivers = backup;
}

// ══════════════════════════════════════════════════════════
//  APPROVE / REJECT / TOGGLE DRIVER
// ══════════════════════════════════════════════════════════

/**
 * Approve a driver:
 *   PATCH /api/admin/drivers/:id/approve   body: { isApproved: true }
 *
 * After this, the driver can log in and access their dashboard.
 */
async function approveDriver(id, approved) {
    try {
        await apiCall(`/api/admin/drivers/${id}/approve`, 'PATCH', { isApproved: approved });

        // Update local cache so UI reflects change without a full reload
        const driver = allDrivers.find(d => d._id === id);
        if (driver) driver.isApproved = approved;

        renderDrivers();
        updatePendingBadge();
        toast(`✅ تمت الموافقة على السائق`, 'success');

        // Refresh stats counters
        loadStats();

    } catch (err) {
        toast('❌ ' + err.message, 'error');
    }
}

/**
 * Reject (deactivate) a pending driver:
 *   PATCH /api/admin/drivers/:id/approve   body: { isApproved: false, isActive: false }
 */
async function rejectDriver(id) {
    if (!confirm('هل تريد رفض هذا السائق وتعطيل حسابه؟')) return;
    try {
        await apiCall(`/api/admin/drivers/${id}/approve`, 'PATCH', {
            isApproved: false,
            isActive:   false,
        });

        const driver = allDrivers.find(d => d._id === id);
        if (driver) { driver.isApproved = false; driver.isActive = false; }

        renderDrivers();
        updatePendingBadge();
        toast('🚫 تم رفض السائق', 'info');
        loadStats();

    } catch (err) {
        toast('❌ ' + err.message, 'error');
    }
}

/**
 * Toggle driver active/inactive:
 *   PATCH /api/admin/drivers/:id/status   body: { isActive: true|false }
 */
async function toggleDriverStatus(id, active) {
    try {
        await apiCall(`/api/admin/drivers/${id}/status`, 'PATCH', { isActive: active });

        const driver = allDrivers.find(d => d._id === id);
        if (driver) driver.isActive = active;

        renderDrivers();
        toast(active ? '✅ تم تفعيل السائق' : '🔒 تم تعطيل السائق', active ? 'success' : 'info');
        loadStats();

    } catch (err) {
        toast('❌ ' + err.message, 'error');
    }
}

function updatePendingBadge() {
    const pending = allDrivers.filter(d => !d.isApproved && d.isActive !== false).length;
    const badge   = document.getElementById('pendingBadge');
    if (badge) {
        badge.textContent = pending || '';
        badge.style.display = pending ? 'inline-flex' : 'none';
    }
}

function renderPendingPreview() {
    const el = document.getElementById('pendingPreview');
    if (!el) return;

    const pending = allDrivers.filter(d => !d.isApproved && d.isActive !== false).slice(0, 5);

    if (!pending.length) {
        el.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8"><i class="fas fa-check-circle" style="font-size:24px;color:#10b981;margin-bottom:8px;display:block"></i> لا توجد طلبات معلّقة</div>';
        return;
    }

    el.innerHTML = pending.map(d => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9">
            <div style="width:36px;height:36px;border-radius:50%;background:#dbeafe;color:#2563eb;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <i class="fas fa-user-tie"></i>
            </div>
            <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:13px">${esc(d.fullName || '—')}</div>
                <div style="font-size:11px;color:#64748b">${esc(d.phone || '')} · ${esc([d.vehicle?.make, d.vehicle?.model].filter(Boolean).join(' ') || '—')}</div>
            </div>
            <button class="btn btn-success btn-sm" onclick="approveDriver('${d._id}', true)">
                <i class="fas fa-check"></i> قبول
            </button>
        </div>
    `).join('');
}

// ══════════════════════════════════════════════════════════
//  RIDERS
// ══════════════════════════════════════════════════════════
async function loadRiders() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = loadRow(5);

    try {
        const data = await apiCall('/api/admin/riders');
        allRiders = data.users || [];

        if (!allRiders.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:#94a3b8">لا يوجد ركاب</td></tr>`;
            return;
        }

        renderRiders(allRiders);

    } catch (err) {
        tbody.innerHTML = errRow(5, err.message);
    }
}

function renderRiders(list) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    tbody.innerHTML = list.map(r => {
        const active = r.isActive !== false;
        const date   = r.createdAt ? new Date(r.createdAt).toLocaleDateString('ar-MA') : '—';
        const rides  = r.stats?.totalRides ?? 0;
        const badge  = active
            ? '<span class="badge badge-approved"><i class="fas fa-check-circle"></i> نشط</span>'
            : '<span class="badge badge-inactive"><i class="fas fa-ban"></i> معطّل</span>';

        return `<tr>
            <td>
                <div style="font-weight:700">${esc(r.fullName || '—')}</div>
                <div style="font-size:12px;color:#64748b;font-family:monospace">${esc(r.phone || '')}</div>
            </td>
            <td style="color:#64748b;font-size:13px">${esc(r.email || '—')}</td>
            <td>${badge}</td>
            <td style="font-family:monospace">${rides}</td>
            <td>
                ${active
                    ? `<button class="btn btn-warning btn-sm" onclick="toggleRider('${r._id}',false)"><i class="fas fa-pause"></i> تعطيل</button>`
                    : `<button class="btn btn-primary btn-sm" onclick="toggleRider('${r._id}',true)"><i class="fas fa-play"></i> تفعيل</button>`
                }
            </td>
        </tr>`;
    }).join('');
}

function searchUsers(q) {
    const lower = q.toLowerCase();
    const list  = allRiders.filter(r =>
        (r.fullName || '').toLowerCase().includes(lower) ||
        (r.phone    || '').includes(q)
    );
    renderRiders(list);
}

async function toggleRider(id, active) {
    try {
        await apiCall(`/api/admin/riders/${id}/status`, 'PATCH', { isActive: active });
        const rider = allRiders.find(r => r._id === id);
        if (rider) rider.isActive = active;
        renderRiders(allRiders);
        toast(active ? '✅ تم تفعيل الراكب' : '🔒 تم تعطيل الراكب', active ? 'success' : 'info');
    } catch (err) {
        toast('❌ ' + err.message, 'error');
    }
}

// ══════════════════════════════════════════════════════════
//  RIDES
// ══════════════════════════════════════════════════════════
async function loadRides() {
    const tbody = document.getElementById('ridesTableBody');
    if (!tbody) return;
    tbody.innerHTML = loadRow(7);

    try {
        const data = await apiCall('/api/admin/rides');
        allRides = data.rides || [];
        renderRides(allRides);
    } catch (err) {
        tbody.innerHTML = errRow(7, err.message);
    }
}

function renderRides(list) {
    const tbody = document.getElementById('ridesTableBody');
    if (!tbody) return;

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:#94a3b8">لا توجد رحلات</td></tr>`;
        return;
    }

    const statusMap = {
        completed:    { cls: 'badge-approved', label: 'مكتملة' },
        cancelled:    { cls: 'badge-inactive', label: 'ملغاة'  },
        in_progress:  { cls: 'badge-pending',  label: 'جارية'  },
        searching:    { cls: 'badge-pending',  label: 'بحث'    },
        driver_found: { cls: 'badge-pending',  label: 'وجد سائق' },
    };

    tbody.innerHTML = list.map((r, i) => {
        const s     = statusMap[r.status] || { cls: 'badge-pending', label: r.status };
        const driver = r.driverId?.fullName || '—';
        const rider  = r.passengers?.[0]?.userId?.fullName || '—';
        const dist   = r.estimatedDistanceKm ? r.estimatedDistanceKm.toFixed(1) + ' km' : '—';
        const fare   = r.totalFareMAD ? r.totalFareMAD + ' MAD' : '—';
        const date   = r.createdAt ? new Date(r.createdAt).toLocaleDateString('ar-MA') : '—';

        return `<tr>
            <td style="font-family:monospace;font-size:12px">#${String(r._id).slice(-5)}</td>
            <td>${esc(driver)}</td>
            <td>${esc(rider)}</td>
            <td>${dist}</td>
            <td style="font-weight:700;color:#2563eb">${fare}</td>
            <td><span class="badge ${s.cls}">${s.label}</span></td>
            <td style="color:#64748b;font-size:12px">${date}</td>
        </tr>`;
    }).join('');
}

function filterRides(filter, btn) {
    document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const list = filter === 'all' ? allRides : allRides.filter(r => r.status === filter);
    renderRides(list);
}

function searchRides(q) {
    const lower = q.toLowerCase();
    const list  = allRides.filter(r =>
        (r.driverId?.fullName || '').toLowerCase().includes(lower) ||
        String(r._id).includes(q)
    );
    renderRides(list);
}

// ══════════════════════════════════════════════════════════
//  MISC
// ══════════════════════════════════════════════════════════
function refreshCurrentPage() {
    const activePage = document.querySelector('.page.active')?.id?.replace('page-', '');
    if (activePage) {
        const loaders = { dashboard: () => { loadStats(); loadFeed(); }, drivers: loadDrivers, rides: loadRides, users: loadRiders };
        loaders[activePage]?.();
    }
}

function toggleSidebar() {
    document.querySelector('.sidebar')?.classList.toggle('collapsed');
    document.querySelector('.main')?.classList.toggle('sidebar-collapsed');
}

function showTokenDisplay() {
    const el = document.getElementById('tokenDisplay');
    if (!el) return;
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
    el.textContent   = TOKEN || 'لا يوجد توكن';
}

function saveCfg() {
    const v = document.getElementById('cfgApi')?.value?.trim().replace(/\/$/, '');
    if (v) { API = v; localStorage.setItem('tg_admin_api', API); }
    toast('💾 تم الحفظ', 'success');
}

function startClock() {
    const el = document.getElementById('topbarTime');
    if (!el) return;
    setInterval(() => {
        el.textContent = new Date().toLocaleTimeString('en-GB');
    }, 1000);
}

// ══════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ══════════════════════════════════════════════════════════
function toast(msg, type = 'info') {
    const container = document.getElementById('toastContainer') || (() => {
        const d = document.createElement('div');
        d.id = 'toastContainer';
        d.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px';
        document.body.appendChild(d);
        return d;
    })();

    const colors = { success: '#10b981', error: '#ef4444', info: '#2563eb', warning: '#f59e0b' };
    const t = document.createElement('div');
    t.style.cssText = `background:${colors[type]||colors.info};color:white;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,0.2);animation:fadeIn 0.2s ease`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

// ══════════════════════════════════════════════════════════
//  HTML HELPERS
// ══════════════════════════════════════════════════════════
function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function fmtNum(n) {
    return Number(n || 0).toLocaleString('ar-MA');
}
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}
function loadRow(cols) {
    return `<tr><td colspan="${cols}" style="text-align:center;padding:32px">
        <div class="spinner" style="margin:0 auto 8px"></div>جاري التحميل…
    </td></tr>`;
}
function errRow(cols, msg) {
    return `<tr><td colspan="${cols}" style="text-align:center;padding:24px;color:#ef4444">
        <i class="fas fa-exclamation-triangle" style="margin-left:6px"></i> ${esc(msg)}
    </td></tr>`;
}
function errState(msg) {
    return `<div style="text-align:center;padding:20px;color:#ef4444">
        <i class="fas fa-exclamation-triangle"></i> ${esc(msg)}
    </div>`;
}
function showErr(el, msg) {
    if (!el) return;
    el.textContent    = msg;
    el.style.display  = 'block';
}

// ══════════════════════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
    startClock();
    // Auto-open dashboard if token already stored
    if (TOKEN) {
        openDashboard(localStorage.getItem('tg_admin_email') || 'admin');
    }
});
