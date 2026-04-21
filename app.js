// ============================================================
//   TaxiFinder طنجة — app.js  v3.0
//   ✓ Verified Drivers Only
//   ✓ Registration Card Field
//   ✓ Dark Mode (Light default / Dark toggle)
//   ✓ TaxiFinder Brand
// ============================================================

const API_BASE   = window.location.origin;
const SOCKET_URL = window.location.origin;

// ── Tangier Center ──────────────────────────────────────────
const TANGIER_CENTER = { lat: 35.7767, lng: -5.8037 };

// ── Leaflet Tile Sources ────────────────────────────────────
const TILE_URLS = {
    light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    dark:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
};
const TILE_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com">CARTO</a>';

// ── Tangier Suggestions ─────────────────────────────────────
const TANGIER_SUGGESTIONS = [
    { label: '🏰 القصبة',                      lat: 35.7890, lng: -5.8003 },
    { label: '🕌 سوق البالة (المدينة القديمة)', lat: 35.7785, lng: -5.8029 },
    { label: '✈️ مطار ابن بطوطة',               lat: 35.7264, lng: -5.8989 },
    { label: '🛍️ مول باسيفيكو',                lat: 35.7830, lng: -5.8177 },
    { label: '🌊 شاطئ ملابطة',                 lat: 35.7795, lng: -5.8005 },
    { label: '🎓 جامعة عبد المالك السعدي',      lat: 35.7810, lng: -5.7960 },
    { label: '🏥 مستشفى محمد الخامس',          lat: 35.7710, lng: -5.8130 },
    { label: '🚢 ميناء طنجة المتوسط',          lat: 35.7853, lng: -5.8095 },
    { label: '🏨 فندق إنتركونتيننتال',         lat: 35.7840, lng: -5.8040 },
    { label: '🌿 حديقة لالة مينا',             lat: 35.7800, lng: -5.7970 },
    { label: '🎭 المسرح الجهوي',               lat: 35.7760, lng: -5.8010 },
    { label: '🏢 ولاية طنجة',                  lat: 35.7730, lng: -5.8050 },
];

const PRICE_PER_KM = { economy: 4, comfort: 6, vip: 12 };
const BASE_FARE    = { economy: 8, comfort: 12, vip: 20 };

// ── Demo Drivers — Verified + Unverified mix (for testing filter) ──
const DEMO_DRIVERS = [
    {
        id: 'drv_001',
        name: 'أحمد الطنجاوي',
        car_model: 'تويوتا كورولا 2023',
        plate: '1234 أ',
        car_type: 'economy',
        rating: 4.9,
        total_trips: 1240,
        available: true,
        status: 'online',
        location_lat: 35.7767,
        location_lng: -5.8037,
        distanceKm: 1.2,
        eta: 4,
        emoji: '🧑‍✈️',
        verified: true,                    // ✓ Verified Driver
        registration_card: 'RC-2024-TNG-00123'
    },
    {
        id: 'drv_002',
        name: 'محمد البقالي',
        car_model: 'هيونداي سوناتا 2022',
        plate: '5678 ب',
        car_type: 'comfort',
        rating: 4.8,
        total_trips: 832,
        available: true,
        status: 'online',
        location_lat: 35.7700,
        location_lng: -5.7900,
        distanceKm: 2.1,
        eta: 6,
        emoji: '👨‍✈️',
        verified: true,                    // ✓ Verified Driver
        registration_card: 'RC-2023-TNG-00456'
    },
    {
        id: 'drv_003',
        name: 'يوسف الريفي',
        car_model: 'مرسيدس E200 2024',
        plate: '9012 ج',
        car_type: 'vip',
        rating: 5.0,
        total_trips: 2100,
        available: true,
        status: 'online',
        location_lat: 35.7850,
        location_lng: -5.8150,
        distanceKm: 3.5,
        eta: 10,
        emoji: '🤵',
        verified: true,                    // ✓ Verified Driver
        registration_card: 'RC-2024-TNG-00789'
    },
    {
        id: 'drv_004',
        name: 'كريم الزياني',
        car_model: 'داسيا لوغان 2022',
        plate: '3456 د',
        car_type: 'economy',
        rating: 4.7,
        total_trips: 560,
        available: true,
        status: 'online',
        location_lat: 35.7600,
        location_lng: -5.8200,
        distanceKm: 0.8,
        eta: 3,
        emoji: '🧑',
        verified: false,                   // ✗ NOT Verified — will be excluded
        registration_card: null
    },
    {
        id: 'drv_005',
        name: 'سمير الراشدي',
        car_model: 'رينو كانجو 2023',
        plate: '7890 هـ',
        car_type: 'economy',
        rating: 4.6,
        total_trips: 310,
        available: true,
        status: 'online',
        location_lat: 35.7720,
        location_lng: -5.8100,
        distanceKm: 1.5,
        eta: 5,
        emoji: '🧑‍✈️',
        verified: false,                   // ✗ NOT Verified — will be excluded
        registration_card: null
    },
    {
        id: 'drv_006',
        name: 'عبد الرحمن العمراني',
        car_model: 'كيا سيراتو 2024',
        plate: '2468 و',
        car_type: 'comfort',
        rating: 4.85,
        total_trips: 987,
        available: true,
        status: 'online',
        location_lat: 35.7810,
        location_lng: -5.7950,
        distanceKm: 2.8,
        eta: 8,
        emoji: '👨‍✈️',
        verified: true,                    // ✓ Verified Driver
        registration_card: 'RC-2024-TNG-01012'
    },
];

// ── API Helper ───────────────────────────────────────────────
async function api(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res  = await fetch(`${API_BASE}${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

// ── Haversine Distance ───────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
    const R  = 6371;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    const a  = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function calcFare(distKm, type) {
    return Math.round((BASE_FARE[type] || 8) + distKm * (PRICE_PER_KM[type] || 4));
}

// ============================================================
//   TaxiFinderApp Class
// ============================================================
class TaxiFinderApp {
    constructor() {
        this.user            = null;
        this.driver          = null;
        this.userType        = 'rider';
        this.socket          = null;
        this.currentLoc      = { lat: TANGIER_CENTER.lat, lng: TANGIER_CENTER.lng };
        this.pickupLoc       = null;
        this.dropoffLoc      = null;
        this.dropoffLabel    = '';
        this.map             = null;
        this.driverMap       = null;
        this.riderTileLayer  = null;   // store tile layer refs for hot-swapping
        this.driverTileLayer = null;
        this.currentMarker   = null;
        this.driverMarkers   = [];
        this.selectedDriver  = null;
        this.selectedType    = 'economy';
        this.selectedPayment = 'cash';
        this.activeRide      = null;
        this.etaInterval     = null;
        this.selectedRating  = 0;
        this.ratingTags      = [];
        this.driverOnline    = false;
        this.hoursOnlineInterval = null;
        this.hoursOnline     = 0;
        this.tripsAccepted   = 0;
        this.tripsRejected   = 0;
        this.earningsData    = [0, 120, 85, 200, 145, 180, 0];
        this.allDrivers      = [];       // will hold VERIFIED drivers only
        this.isDarkMode      = false;

        this.init();
    }

    async init() {
        this.loadThemePreference();   // apply saved theme before any render
        this.setupEventListeners();
        await this.simulatePreloader();
    }

    // ── Theme / Dark Mode ─────────────────────────────────────
    loadThemePreference() {
        const saved = localStorage.getItem('taxifinder-theme');
        if (saved === 'dark') this.applyDarkMode(true, false);
    }

    applyDarkMode(enable, saveToStorage = true) {
        this.isDarkMode = enable;
        document.body.classList.toggle('dark-mode', enable);
        if (saveToStorage) localStorage.setItem('taxifinder-theme', enable ? 'dark' : 'light');
        this.switchMapTiles();
    }

    toggleDarkMode() {
        this.applyDarkMode(!this.isDarkMode);
    }

    getTileUrl() {
        return this.isDarkMode ? TILE_URLS.dark : TILE_URLS.light;
    }

    /**
     * Hot-swap Leaflet tile layers when theme changes.
     * Removes old tile layer, adds new one with correct URL.
     */
    switchMapTiles() {
        const tileUrl = this.getTileUrl();

        if (this.map) {
            if (this.riderTileLayer) {
                this.map.removeLayer(this.riderTileLayer);
            }
            this.riderTileLayer = L.tileLayer(tileUrl, { attribution: TILE_ATTR }).addTo(this.map);
        }

        if (this.driverMap) {
            if (this.driverTileLayer) {
                this.driverMap.removeLayer(this.driverTileLayer);
            }
            this.driverTileLayer = L.tileLayer(tileUrl, { attribution: TILE_ATTR }).addTo(this.driverMap);
        }
    }

    // ── Preloader ─────────────────────────────────────────────
    simulatePreloader() {
        return new Promise(resolve => {
            setTimeout(() => {
                const el = document.getElementById('preloader');
                if (el) { el.classList.add('hidden'); setTimeout(() => { el.remove(); resolve(); }, 500); }
                else resolve();
            }, 1800);
        });
    }

    // ── Event Listeners ───────────────────────────────────────
    setupEventListeners() {
        // Login
        document.getElementById('login-form')?.addEventListener('submit', e => { e.preventDefault(); this.handleLogin(); });

        // Role buttons
        document.querySelectorAll('.role-btn').forEach(btn => btn.addEventListener('click', () => {
            document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.userType = btn.dataset.role;
            document.getElementById('driver-fields')?.classList.toggle('hidden', this.userType !== 'driver');
        }));

        // Location buttons
        ['btn-get-location', 'btn-get-location-2'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', () => this.getCurrentLocation());
        });

        // Destination input
        const destInput = document.getElementById('destination');
        if (destInput) {
            destInput.addEventListener('input', () => this.showSuggestions(destInput.value));
            destInput.addEventListener('focus', () => this.showSuggestions(destInput.value));
            document.addEventListener('click', e => { if (!e.target.closest('.route-input-wrap')) this.hideSuggestions(); });
        }
        document.getElementById('btn-clear-dest')?.addEventListener('click', () => this.clearDestination());

        // Car type cards
        document.querySelectorAll('.car-type-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.car-type-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.selectedType = card.dataset.type;
                this.updatePriceEstimate();
            });
        });

        // Payment
        document.querySelectorAll('.pay-opt').forEach(opt => {
            opt.addEventListener('click', () => {
                document.querySelectorAll('.pay-opt').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                this.selectedPayment = opt.querySelector('input').value;
            });
        });

        // Filter tabs
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.filterDrivers(tab.dataset.filter);
            });
        });

        // Ride request & confirm
        document.getElementById('btn-request-ride')?.addEventListener('click', () => this.requestRide());
        document.getElementById('btn-confirm')?.addEventListener('click', () => this.confirmRide());
        document.getElementById('btn-cancel-modal')?.addEventListener('click', () => this.closeModal('confirm-modal'));

        // Rating
        document.querySelectorAll('.star').forEach(star => {
            star.addEventListener('click', () => {
                this.selectedRating = parseInt(star.dataset.value);
                document.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('active', i < this.selectedRating));
            });
        });
        document.querySelectorAll('.qtag').forEach(tag => {
            tag.addEventListener('click', () => {
                tag.classList.toggle('active');
                const t = tag.dataset.tag;
                if (this.ratingTags.includes(t)) this.ratingTags = this.ratingTags.filter(x => x !== t);
                else this.ratingTags.push(t);
            });
        });
        document.getElementById('btn-submit-rating')?.addEventListener('click', () => this.submitRating());

        // Refresh / driver toggle / logout
        document.getElementById('btn-refresh-drivers')?.addEventListener('click', () => this.refreshDrivers());
        document.getElementById('driver-online-toggle')?.addEventListener('change', e => this.toggleDriverOnline(e.target.checked));
        document.getElementById('btn-logout')?.addEventListener('click', () => this.logout());
        document.getElementById('btn-load-history')?.addEventListener('click', () => this.loadRideHistory());

        // ── Dark Mode Toggle ──
        document.getElementById('btn-dark-mode')?.addEventListener('click', () => this.toggleDarkMode());
    }

    // ── Login ──────────────────────────────────────────────────
    async handleLogin() {
        const name  = document.getElementById('name')?.value.trim();
        const phone = document.getElementById('phone')?.value.trim();
        const role  = this.userType;

        if (!name || name.length < 2) return this.showToast('يرجى إدخال الاسم الكامل', 'error');
        if (!phone || !/^\+?[\d\s\-]{8,20}$/.test(phone)) return this.showToast('رقم الهاتف غير صالح', 'error');

        const btn     = document.getElementById('btn-login');
        const btnText = document.getElementById('btn-login-text');
        btn.disabled = true;
        btnText.textContent = '...جاري التحميل';

        try {
            const body = { name, phone, role };

            if (role === 'driver') {
                body.carModel          = document.getElementById('car-model')?.value.trim();
                body.plate             = document.getElementById('plate')?.value.trim();
                body.registrationCard  = document.getElementById('registration-card')?.value.trim();
                const ct = document.querySelector('input[name="car-type-reg"]:checked');
                body.carType = ct ? ct.value : 'economy';

                if (!body.carModel || !body.plate) throw new Error('يرجى إدخال بيانات السيارة');
                if (!body.registrationCard) {
                    this.showToast('⚠️ بطاقة التسجيل مطلوبة للتوثيق', 'warning');
                }
            }

            let result;
            try {
                result = await api('POST', '/api/auth/login', body);
                this.user   = result.user;
                this.driver = result.driver || null;
            } catch {
                // Demo fallback
                this.user = { id: `usr_${Date.now()}`, name, phone, role };
                this.driver = role === 'driver' ? {
                    id: `drv_${Date.now()}`,
                    user_id:           this.user.id,
                    car_model:         body.carModel || 'تويوتا كورولا',
                    plate:             body.plate    || '0000 أ',
                    car_type:          body.carType  || 'economy',
                    rating:            5.0,
                    total_trips:       0,
                    registration_card: body.registrationCard || null,
                    verified:          !!body.registrationCard   // verified if card supplied
                } : null;
            }

            this.closeModal('login-modal');
            this.initApp();

        } catch(err) {
            this.showToast(err.message || 'خطأ في تسجيل الدخول', 'error');
        } finally {
            btn.disabled = false;
            btnText.textContent = 'ابدأ الآن';
        }
    }

    // ── Init App ──────────────────────────────────────────────
    initApp() {
        document.getElementById('main-app').style.display    = 'block';
        document.getElementById('main-header').style.display = 'block';
        this.updateUserBadge();
        this.connectSocket();
        this.loadWeather();

        if (this.userType === 'rider') {
            document.getElementById('rider-section').classList.add('active');
            document.getElementById('driver-section').classList.remove('active');
            setTimeout(() => {
                this.initRiderMap();
                this.loadDrivers();
                this.loadRideHistory();
                this.animateStats();
            }, 100);
        } else {
            document.getElementById('driver-section').classList.add('active');
            document.getElementById('rider-section').classList.remove('active');
            this.initDriverDashboard();
        }
    }

    updateUserBadge() {
        document.getElementById('user-name-display').textContent = this.user.name;
        document.getElementById('role-badge').textContent = this.userType === 'rider' ? 'راكب' : 'سائق';
        document.getElementById('user-avatar').textContent  = this.userType === 'rider' ? '👤' : '🧑‍✈️';
    }

    // ── Socket.IO ─────────────────────────────────────────────
    connectSocket() {
        try {
            this.socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
            this.socket.on('connect', () => {
                this.socket.emit('register', { userId: this.user.id, role: this.userType, driverId: this.driver?.id });
                this.setConnStatus(true);
            });
            this.socket.on('disconnect', () => this.setConnStatus(false));
            this.socket.on('new-ride-request',   data => this.handleNewRideRequest(data));
            this.socket.on('ride-status-update', data => this.handleRideStatusUpdate(data));
            this.socket.on('driver-moved',       data => this.updateDriverMarker(data));
        } catch(e) { console.warn('Socket unavailable — demo mode'); }
    }

    setConnStatus(connected) {
        const el  = document.getElementById('conn-status');
        if (!el) return;
        const dot = el.querySelector('.conn-dot');
        const txt = el.querySelector('span');
        dot.style.background = connected ? 'var(--green)' : 'var(--red)';
        txt.textContent      = connected ? 'متصل' : 'غير متصل';
    }

    // ── Rider Map ─────────────────────────────────────────────
    initRiderMap() {
        if (this.map) return;
        const container = document.getElementById('rider-map');
        if (!container) return;

        this.map = L.map('rider-map', { zoomControl: false })
            .setView([TANGIER_CENTER.lat, TANGIER_CENTER.lng], 14);

        this.riderTileLayer = L.tileLayer(this.getTileUrl(), { attribution: TILE_ATTR }).addTo(this.map);
        L.control.zoom({ position: 'bottomleft' }).addTo(this.map);

        this.getCurrentLocation();
    }

    getCurrentLocation() {
        if (!navigator.geolocation) return this.setPickupLocation(TANGIER_CENTER.lat, TANGIER_CENTER.lng, 'طنجة المركز');
        navigator.geolocation.getCurrentPosition(
            pos => {
                const { latitude: lat, longitude: lng } = pos.coords;
                this.setPickupLocation(lat, lng, `موقعك الحالي (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
            },
            () => this.setPickupLocation(TANGIER_CENTER.lat, TANGIER_CENTER.lng, 'طنجة المركز (تقريبي)')
        );
    }

    setPickupLocation(lat, lng, label) {
        this.currentLoc = { lat, lng };
        this.pickupLoc  = { lat, lng };
        const textEl  = document.getElementById('current-location-text');
        const inputEl = document.getElementById('pickup-display');
        if (textEl)  textEl.textContent = label;
        if (inputEl) inputEl.value      = label;

        if (this.map) {
            this.map.setView([lat, lng], 15);
            if (this.currentMarker) this.map.removeLayer(this.currentMarker);
            this.currentMarker = L.marker([lat, lng], {
                icon: L.divIcon({
                    html: `<div style="background:var(--accent,#0EA5E9);width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(14,165,233,0.5)"></div>`,
                    iconSize: [14, 14], iconAnchor: [7, 7]
                })
            }).addTo(this.map).bindPopup('📍 موقعك');
        }
        this.updatePriceEstimate();
        this.loadDrivers();
    }

    // ── Verified Driver Filter ────────────────────────────────
    /**
     * Core security filter: return only drivers where verified === true.
     * Any driver without explicit verified:true is excluded.
     */
    filterVerifiedOnly(drivers) {
        return drivers.filter(d => d.verified === true);
    }

    // ── Load Drivers ──────────────────────────────────────────
    async loadDrivers() {
        try {
            const loc = this.currentLoc;
            let rawDrivers;

            try {
                const res = await api('GET', `/api/drivers/nearby?lat=${loc.lat}&lng=${loc.lng}&radius=8000`);
                rawDrivers = res.drivers.map(d => ({
                    ...d,
                    eta:   Math.max(2, Math.round((d.distanceKm || 1) / 0.4)),
                    emoji: this.getDriverEmoji(d.car_type)
                }));
            } catch {
                rawDrivers = DEMO_DRIVERS;
            }

            // ✓ VERIFIED FILTER — only show verified drivers
            const verified = this.filterVerifiedOnly(rawDrivers);

            this.allDrivers = verified;
            this.renderDrivers(verified);
            this.renderDriversOnMap(verified);
            this.updateStatDrivers(verified.length);
            this.updateVerifiedCount(verified.length, rawDrivers.length);

        } catch(e) {
            const fallback = this.filterVerifiedOnly(DEMO_DRIVERS);
            this.renderDrivers(fallback);
        }
    }

    getDriverEmoji(type) {
        return { economy: '🧑‍✈️', comfort: '👨‍✈️', vip: '🤵' }[type] || '🧑‍✈️';
    }

    refreshDrivers() {
        const btn = document.getElementById('btn-refresh-drivers');
        if (btn) { btn.style.transform = 'rotate(180deg)'; setTimeout(() => btn.style.transform = '', 400); }
        this.loadDrivers();
        this.showToast('🔄 تم تحديث قائمة السائقين الموثقين', 'info');
    }

    updateVerifiedCount(verifiedCount, totalCount) {
        const el = document.getElementById('stat-verified');
        if (!el) return;
        const pct = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 100;
        el.textContent = `${pct}%`;
    }

    // ── Render Drivers ────────────────────────────────────────
    renderDrivers(drivers) {
        const grid  = document.getElementById('taxis-grid');
        const empty = document.getElementById('taxis-empty');
        if (!grid) return;

        if (!drivers.length) {
            grid.innerHTML = '';
            if (empty) empty.style.display = 'block';
            return;
        }
        if (empty) empty.style.display = 'none';

        grid.innerHTML = drivers.map(d => {
            const carTypeName = { economy: 'اقتصادي', comfort: 'مريح', vip: 'VIP' }[d.car_type] || d.car_type;
            const fare = this.pickupLoc && this.dropoffLoc
                ? calcFare(haversine(this.pickupLoc.lat, this.pickupLoc.lng, this.dropoffLoc.lat, this.dropoffLoc.lng), d.car_type)
                : null;

            // All drivers here are pre-filtered as verified; show badge on each
            const verifiedBadge = d.verified
                ? `<span class="verified-badge">✓ موثق</span>`
                : '';

            // Show reg card mini (last 6 chars for brevity)
            const regCardMini = d.registration_card
                ? `<div class="reg-card-mini">🪪 ...${d.registration_card.slice(-6)}</div>`
                : '';

            return `
            <div class="taxi-card" data-id="${d.id}" onclick="app.selectDriver('${d.id}')">
                <div class="taxi-avatar">${d.emoji || this.getDriverEmoji(d.car_type)}</div>
                <div class="taxi-info">
                    <div class="taxi-name-row">
                        <div class="taxi-name">${d.name || d.users?.name || 'سائق'}</div>
                        ${verifiedBadge}
                    </div>
                    <div class="taxi-car">${d.car_model}</div>
                    ${regCardMini}
                    <div class="taxi-type-tag ${d.car_type}">${carTypeName}</div>
                </div>
                <div class="taxi-meta">
                    <span class="taxi-rating">⭐ ${(d.rating || 5).toFixed(1)}</span>
                    <span class="taxi-distance">📏 ${(d.distanceKm || 0).toFixed(1)} كم</span>
                    <span class="taxi-eta">⏱️ ~${d.eta || 5} دق</span>
                    ${fare ? `<span class="taxi-price">${fare} درهم</span>` : ''}
                </div>
            </div>`;
        }).join('');
    }

    // ── Render Drivers on Map — Verified Only ─────────────────
    renderDriversOnMap(drivers) {
        if (!this.map) return;
        this.driverMarkers.forEach(m => this.map.removeLayer(m));
        this.driverMarkers = [];

        // drivers are already filtered; this is a safety double-check
        const verified = this.filterVerifiedOnly(drivers);

        verified.forEach(d => {
            if (!d.location_lat || !d.location_lng) return;
            const color = { economy: '#0EA5E9', comfort: '#10B981', vip: '#8B5CF6' }[d.car_type] || '#0EA5E9';
            const verifiedDot = d.verified
                ? `<div style="position:absolute;top:-3px;right:-3px;width:10px;height:10px;background:#10B981;border-radius:50%;border:1.5px solid white;"></div>`
                : '';

            const marker = L.marker([d.location_lat, d.location_lng], {
                icon: L.divIcon({
                    html: `<div style="position:relative;background:${color};width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.2)">${d.emoji || '🚖'}${verifiedDot}</div>`,
                    iconSize:   [30, 30],
                    iconAnchor: [15, 15]
                })
            }).addTo(this.map)
              .bindPopup(`
                <b>${d.name || 'سائق'}</b><br>
                ${d.car_model}<br>
                ⭐ ${(d.rating || 5).toFixed(1)}<br>
                <span style="color:#10B981;font-weight:700">✓ سائق موثق</span>
              `);
            this.driverMarkers.push(marker);
        });
    }

    updateDriverMarker({ driverId, lat, lng }) {
        const idx = this.allDrivers.findIndex(d => d.id === driverId);
        if (idx >= 0 && this.driverMarkers[idx]) {
            this.driverMarkers[idx].setLatLng([lat, lng]);
        }
    }

    filterDrivers(type) {
        const filtered = type === 'all'
            ? this.allDrivers
            : this.allDrivers.filter(d => d.car_type === type);
        this.renderDrivers(filtered);
    }

    selectDriver(id) {
        document.querySelectorAll('.taxi-card').forEach(c => c.classList.toggle('selected', c.dataset.id === id));
        this.selectedDriver = this.allDrivers.find(d => d.id === id);
        if (this.selectedDriver) {
            const typeCard = document.querySelector(`.car-type-card[data-type="${this.selectedDriver.car_type}"]`);
            if (typeCard) {
                document.querySelectorAll('.car-type-card').forEach(c => c.classList.remove('active'));
                typeCard.classList.add('active');
                this.selectedType = this.selectedDriver.car_type;
            }
            this.updatePriceEstimate();
            const verifiedNote = this.selectedDriver.verified ? ' (موثق ✓)' : '';
            this.showToast(`✅ اخترت ${this.selectedDriver.name || 'السائق'}${verifiedNote}`, 'success');
        }
    }

    // ── Suggestions ───────────────────────────────────────────
    showSuggestions(val) {
        const dropdown = document.getElementById('suggestions-dropdown');
        const clearBtn = document.getElementById('btn-clear-dest');
        if (!dropdown) return;
        if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';

        const filtered = val
            ? TANGIER_SUGGESTIONS.filter(s => s.label.includes(val))
            : TANGIER_SUGGESTIONS;

        dropdown.innerHTML = filtered.map(s =>
            `<div class="suggestion-item" onclick="app.selectSuggestion('${s.label.replace(/'/g,"\\'")}', ${s.lat}, ${s.lng})">${s.label}</div>`
        ).join('');
        dropdown.style.display = filtered.length ? 'block' : 'none';
    }

    hideSuggestions() {
        const d = document.getElementById('suggestions-dropdown');
        if (d) d.style.display = 'none';
    }

    selectSuggestion(label, lat, lng) {
        document.getElementById('destination').value = label;
        document.getElementById('btn-clear-dest').style.display = 'block';
        this.hideSuggestions();
        this.dropoffLoc   = { lat, lng };
        this.dropoffLabel = label;
        this.updatePriceEstimate();
        this.showDropoffOnMap(lat, lng, label);
        document.getElementById('btn-request-ride').disabled = false;
        document.getElementById('btn-req-text').textContent  = 'طلب سيارة الأجرة';
    }

    setDestinationPlace(btn) {
        const lat   = parseFloat(btn.dataset.lat);
        const lng   = parseFloat(btn.dataset.lng);
        const label = btn.textContent.trim();
        document.getElementById('destination').value = label;
        document.getElementById('btn-clear-dest').style.display = 'block';
        this.dropoffLoc   = { lat, lng };
        this.dropoffLabel = label;
        this.updatePriceEstimate();
        this.showDropoffOnMap(lat, lng, label);
        document.getElementById('btn-request-ride').disabled = false;
        document.getElementById('btn-req-text').textContent  = 'طلب سيارة الأجرة';
    }

    clearDestination() {
        document.getElementById('destination').value          = '';
        document.getElementById('btn-clear-dest').style.display = 'none';
        this.dropoffLoc = null; this.dropoffLabel = '';
        document.getElementById('btn-request-ride').disabled = true;
        document.getElementById('btn-req-text').textContent  = 'اختر وجهتك أولاً';
        document.getElementById('price-estimate-badge').style.display = 'none';
        this.hideSuggestions();
    }

    showDropoffOnMap(lat, lng, label) {
        if (!this.map) return;
        if (this._dropoffMarker) this.map.removeLayer(this._dropoffMarker);
        this._dropoffMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                html: `<div style="background:#EF4444;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(239,68,68,0.5)"></div>`,
                iconSize: [14, 14], iconAnchor: [7, 7]
            })
        }).addTo(this.map).bindPopup(`🏁 ${label}`).openPopup();
        if (this.pickupLoc) {
            this.map.fitBounds([[this.pickupLoc.lat, this.pickupLoc.lng], [lat, lng]], { padding: [40, 40] });
        }
    }

    updatePriceEstimate() {
        if (!this.pickupLoc || !this.dropoffLoc) return;
        const dist    = haversine(this.pickupLoc.lat, this.pickupLoc.lng, this.dropoffLoc.lat, this.dropoffLoc.lng);
        const badge   = document.getElementById('price-estimate-badge');
        const badgeText = document.getElementById('price-estimate-text');
        if (badge && badgeText) {
            badgeText.textContent = `~${calcFare(dist, this.selectedType)} درهم`;
            badge.style.display = 'block';
        }
        ['economy', 'comfort', 'vip'].forEach(type => {
            const el = document.getElementById(`price-${type}`);
            if (el) el.textContent = `${calcFare(dist, type)} درهم`;
        });
    }

    // ── Request Ride ──────────────────────────────────────────
    requestRide() {
        if (!this.dropoffLoc) return this.showToast('يرجى تحديد الوجهة', 'error');
        if (!this.pickupLoc)  return this.showToast('يرجى تحديد موقعك',  'error');

        const dist     = haversine(this.pickupLoc.lat, this.pickupLoc.lng, this.dropoffLoc.lat, this.dropoffLoc.lng);
        const fare     = calcFare(dist, this.selectedType);
        const typeNames = { economy: 'اقتصادي 🚕', comfort: 'مريح 🚙', vip: 'VIP 🏎️' };
        const payNames  = { cash: 'نقداً 💵', card: 'بطاقة 💳' };

        document.getElementById('confirm-pickup').textContent  = 'موقعك الحالي (طنجة)';
        document.getElementById('confirm-dropoff').textContent = this.dropoffLabel;
        document.getElementById('confirm-details').innerHTML   =
            `<div>📏 المسافة: <strong>${dist.toFixed(1)} كم</strong></div>
             <div>🚗 النوع: <strong>${typeNames[this.selectedType]}</strong></div>
             <div>💳 الدفع: <strong>${payNames[this.selectedPayment]}</strong></div>
             <div>✓ سائقون موثقون فقط</div>`;
        document.getElementById('confirm-price').textContent = `${fare} درهم`;
        this.openModal('confirm-modal');
    }

    async confirmRide() {
        this.closeModal('confirm-modal');
        const dist = haversine(this.pickupLoc.lat, this.pickupLoc.lng, this.dropoffLoc.lat, this.dropoffLoc.lng);
        const fare = calcFare(dist, this.selectedType);

        const rideData = {
            riderId:        this.user.id,
            riderName:      this.user.name,
            pickupLat:      this.pickupLoc.lat,
            pickupLng:      this.pickupLoc.lng,
            pickupAddress:  'طنجة',
            dropoffLat:     this.dropoffLoc.lat,
            dropoffLng:     this.dropoffLoc.lng,
            dropoffAddress: this.dropoffLabel,
            carType:        this.selectedType,
            paymentMethod:  this.selectedPayment,
            fare, distanceKm: +dist.toFixed(2)
        };

        try {
            let rideId;
            try {
                const res = await api('POST', '/api/rides', rideData);
                rideId = res.id;
            } catch {
                if (this.socket?.connected) this.socket.emit('ride-request', rideData);
                rideId = `local_${Date.now()}`;
            }
            this.activeRide = { id: rideId, fare, ...rideData };
            this.showToast('🚖 تم إرسال طلبك! جاري البحث عن سائق موثق...', 'success');
            setTimeout(() => this.simulateDriverAccepted(fare), 3000);
        } catch(err) {
            this.showToast('فشل إنشاء الرحلة، حاول مرة أخرى', 'error');
        }
    }

    simulateDriverAccepted(fare) {
        if (!this.activeRide) return;
        const driver = this.selectedDriver || this.allDrivers[0];
        if (!driver) return;

        // Update tracking panel
        document.getElementById('tracking-driver-name').textContent    = driver.name || 'السائق';
        document.getElementById('tracking-car').textContent            = driver.car_model || '';
        document.getElementById('tracking-driver-rating').textContent  = (driver.rating || 5).toFixed(1);
        document.getElementById('tracking-plate').textContent          = driver.plate || '-- --';
        document.getElementById('eta-value').textContent               = `${driver.eta || 5} دقائق`;
        document.getElementById('fare-display').textContent            = `${fare} درهم`;

        // Show registration card in tracking panel
        const regCardEl  = document.getElementById('tracking-reg-card');
        const regNumEl   = document.getElementById('tracking-reg-card-number');
        if (regCardEl && regNumEl && driver.registration_card) {
            regNumEl.textContent     = driver.registration_card;
            regCardEl.style.display  = 'flex';
        } else if (regCardEl) {
            regCardEl.style.display = 'none';
        }

        document.getElementById('tracking-panel').style.display = 'block';
        this.showToast(`✅ وجدنا لك ${driver.name || 'سائقاً موثقاً'}! يتجه نحوك`, 'success');
        this.startEtaCountdown(driver.eta || 5);
    }

    startEtaCountdown(minutes) {
        clearInterval(this.etaInterval);
        let secs = minutes * 60;
        this.etaInterval = setInterval(() => {
            secs--;
            const m = Math.floor(secs / 60), s = secs % 60;
            const el = document.getElementById('eta-value');
            if (el) el.textContent = m > 0 ? `${m} دقائق ${s} ثانية` : `${secs} ثانية`;
            if (secs <= 0) {
                clearInterval(this.etaInterval);
                this.advanceTrackingStep(2);
                this.showToast('🎉 وصل السائق! ابحث عن سيارتك', 'success');
            }
        }, 1000);
    }

    advanceTrackingStep(step) {
        document.querySelectorAll('.progress-step').forEach(s => {
            s.classList.toggle('active', parseInt(s.dataset.step) <= step);
        });
    }

    cancelRide() {
        if (!confirm('هل تريد إلغاء الرحلة؟')) return;
        clearInterval(this.etaInterval);
        this.activeRide = null;
        document.getElementById('tracking-panel').style.display = 'none';
        this.showToast('❌ تم إلغاء الرحلة', 'error');
    }

    callDriver()    { this.showToast('📞 جاري الاتصال بالسائق...', 'info'); }
    messageDriver() { this.showToast('💬 فتح المحادثة...', 'info'); }

    handleRideStatusUpdate({ rideId, status, driverId, driverName, fare }) {
        if (!this.activeRide || this.activeRide.id !== rideId) return;
        const msgs = {
            accepted:    `✅ ${driverName || 'السائق'} قبل رحلتك!`,
            in_progress: '🚗 الرحلة بدأت!',
            completed:   `🎉 وصلت! الأجرة: ${fare} درهم`,
            cancelled:   '❌ تم إلغاء الرحلة'
        };
        if (msgs[status]) this.showToast(msgs[status], status === 'cancelled' ? 'error' : 'success');
        if (status === 'completed') {
            this.activeRide = null;
            document.getElementById('tracking-panel').style.display = 'none';
            setTimeout(() => this.openModal('rating-modal'), 1000);
            this.loadRideHistory();
        }
    }

    // ── Ride History ──────────────────────────────────────────
    async loadRideHistory() {
        if (!this.user) return;
        const container = document.getElementById('recent-trips-list');
        if (!container) return;
        try {
            let rides;
            try { rides = await api('GET', `/api/users/${this.user.id}/rides`); }
            catch { rides = []; }

            if (!rides.length) {
                container.innerHTML = '<p style="color:var(--text-muted);font-size:0.82rem;text-align:center;padding:1rem">لا توجد رحلات سابقة</p>';
                return;
            }
            const statusNames = { completed: 'مكتملة', cancelled: 'ملغية', pending: 'قيد الانتظار' };
            container.innerHTML = rides.slice(0, 5).map(r => `
                <div class="trip-item">
                    <div class="trip-icon">🚖</div>
                    <div class="trip-info">
                        <span class="trip-dest">${r.dropoff_address || 'وجهة'}</span>
                        <span class="trip-meta">${new Date(r.created_at).toLocaleDateString('ar-MA')} • ${r.fare || '--'} درهم</span>
                    </div>
                    <div class="trip-status ${r.status}">${statusNames[r.status] || r.status}</div>
                </div>
            `).join('');

            const total = document.getElementById('stat-trips');
            if (total) this.animateNumber(total, 0, rides.length, 800);
        } catch(e) { container.innerHTML = ''; }
    }

    // ── Rating ────────────────────────────────────────────────
    async submitRating() {
        if (!this.selectedRating) return this.showToast('يرجى اختيار التقييم', 'error');
        const comment = document.getElementById('rating-comment')?.value;
        const tags    = this.ratingTags.join(', ');
        const fullComment = [tags, comment].filter(Boolean).join(' — ');
        try {
            if (this.activeRide?.driverId) {
                await api('POST', '/api/ratings', {
                    rideId: this.activeRide.id,
                    driverId: this.activeRide.driverId,
                    riderId: this.user.id,
                    score: this.selectedRating,
                    comment: fullComment
                }).catch(() => {});
            }
        } finally {
            this.closeModal('rating-modal');
            this.showToast(`⭐ شكراً على تقييمك ${this.selectedRating}/5!`, 'success');
            this.selectedRating = 0; this.ratingTags = [];
            document.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.qtag').forEach(t => t.classList.remove('active'));
            if (document.getElementById('rating-comment')) document.getElementById('rating-comment').value = '';
        }
    }

    // ── Driver Dashboard ──────────────────────────────────────
    initDriverDashboard() {
        if (!this.driver) return;

        document.getElementById('driver-name-display').textContent = this.user.name;
        document.getElementById('driver-car-display').textContent  = this.driver.car_model;
        document.getElementById('driver-plate-badge').textContent  = this.driver.plate;
        document.getElementById('driver-rating-display').textContent = (this.driver.rating || 5).toFixed(1);
        document.getElementById('driver-trips-count').textContent  = this.driver.total_trips || 0;

        const typeNames = { economy: 'اقتصادي', comfort: 'مريح', vip: 'VIP' };
        const badge = document.getElementById('driver-car-type-badge');
        if (badge) badge.textContent = typeNames[this.driver.car_type] || 'اقتصادي';

        // Show/hide verified badge
        const verifiedBadge = document.getElementById('driver-verified-badge');
        if (verifiedBadge) {
            verifiedBadge.style.display = this.driver.verified ? 'inline-flex' : 'none';
        }

        // Show registration card in driver profile
        const regCardDisplay = document.getElementById('reg-card-display');
        const regCardNumber  = document.getElementById('reg-card-number');
        if (regCardDisplay && regCardNumber) {
            if (this.driver.registration_card) {
                regCardNumber.textContent      = this.driver.registration_card;
                regCardDisplay.style.display   = 'flex';
            } else {
                regCardDisplay.style.display = 'none';
            }
        }

        // Warn driver if not verified
        if (!this.driver.verified) {
            setTimeout(() => {
                this.showToast('⚠️ حسابك غير موثق — أضف بطاقة التسجيل لتظهر للركاب', 'warning');
            }, 1000);
        }

        setTimeout(() => {
            this.initDriverMap();
            this.renderEarningsChart();
        }, 100);
    }

    initDriverMap() {
        if (this.driverMap) return;
        const container = document.getElementById('driver-map');
        if (!container) return;

        this.driverMap = L.map('driver-map', { zoomControl: false })
            .setView([TANGIER_CENTER.lat, TANGIER_CENTER.lng], 14);

        this.driverTileLayer = L.tileLayer(this.getTileUrl(), { attribution: TILE_ATTR }).addTo(this.driverMap);

        if (navigator.geolocation) {
            navigator.geolocation.watchPosition(pos => {
                const { latitude: lat, longitude: lng } = pos.coords;
                if (!this._driverSelfMarker) {
                    this._driverSelfMarker = L.marker([lat, lng], {
                        icon: L.divIcon({
                            html: `<div style="background:#10B981;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 12px rgba(16,185,129,0.6)"></div>`,
                            iconSize: [18, 18], iconAnchor: [9, 9]
                        })
                    }).addTo(this.driverMap).bindPopup('📍 موقعك');
                } else {
                    this._driverSelfMarker.setLatLng([lat, lng]);
                }
                this.driverMap.setView([lat, lng], 15);
                if (this.driverOnline && this.socket?.connected) {
                    this.socket.emit('driver-location-update', {
                        driverId: this.driver.id, lat, lng, status: 'online', available: true
                    });
                }
            }, () => {}, { enableHighAccuracy: true, maximumAge: 5000 });
        }
    }

    toggleDriverOnline(isOnline) {
        this.driverOnline = isOnline;
        const statusText = document.getElementById('toggle-status-text');
        if (statusText) {
            statusText.textContent = isOnline ? 'متصل الآن' : 'غير متصل';
            statusText.className   = 'toggle-status-text' + (isOnline ? ' online' : '');
        }

        if (isOnline) {
            this.showToast('🟢 أنت الآن متصل ومتاح للرحلات', 'success');
            this.simulateIncomingRides();
            this.hoursOnline = 0;
            const el = document.getElementById('d-hours-online');
            this.hoursOnlineInterval = setInterval(() => {
                this.hoursOnline += 0.1;
                if (el) el.textContent = this.hoursOnline.toFixed(1);
            }, 6000);
            if (this.socket?.connected) this.socket.emit('driver-status-change', { driverId: this.driver.id, status: 'online', available: true });
        } else {
            this.showToast('🔴 أنت غير متصل الآن', 'info');
            clearInterval(this.hoursOnlineInterval);
            if (this.socket?.connected) this.socket.emit('driver-status-change', { driverId: this.driver.id, status: 'offline', available: false });
        }
    }

    handleNewRideRequest(data) {
        if (this.userType !== 'driver' || !this.driverOnline) return;
        const ridesList = document.getElementById('rides-list');
        if (!ridesList) return;
        if (ridesList.querySelector('.empty-state')) ridesList.innerHTML = '';
        const card = this.createRideRequestCard({
            from: data.pickup_address || 'موقع الراكب',
            to:   data.dropoff_address || 'الوجهة',
            rider: data.riderName || 'راكب',
            dist: `${data.distance_km || '--'} كم`,
            price: data.fare || '--',
            wait: 2
        });
        ridesList.insertBefore(card, ridesList.firstChild);
        const badge = document.getElementById('requests-count-badge');
        if (badge) badge.textContent = parseInt(badge.textContent || 0) + 1;
        this.showToast('🆕 طلب رحلة جديد!', 'warning');
    }

    simulateIncomingRides() {
        const ridesList = document.getElementById('rides-list');
        if (!ridesList) return;
        ridesList.innerHTML = '';
        const sampleRides = [
            { from: 'القصبة',      to: 'مول باسيفيكو',           rider: 'فاطمة أحمد',    dist: '3.2 كم', price: 28, wait: 2 },
            { from: 'ميناء طنجة', to: 'فندق إنتركونتيننتال',   rider: 'عمر الناصري',   dist: '1.8 كم', price: 18, wait: 4 },
        ];
        sampleRides.forEach(r => ridesList.appendChild(this.createRideRequestCard(r)));
        const badge = document.getElementById('requests-count-badge');
        if (badge) badge.textContent = sampleRides.length;
        setTimeout(() => {
            if (!this.driverOnline) return;
            const r = { from: 'جامعة عبد المالك السعدي', to: 'شاطئ ملابطة', rider: 'ياسين الزيدي', dist: '4.1 كم', price: 24, wait: 1 };
            ridesList.insertBefore(this.createRideRequestCard(r), ridesList.firstChild);
            if (badge) badge.textContent = parseInt(badge.textContent || 0) + 1;
            this.showToast('🆕 طلب رحلة جديد!', 'warning');
        }, 12000);
    }

    createRideRequestCard(ride) {
        const card = document.createElement('div');
        card.className = 'ride-request-card';
        card.innerHTML = `
            <div class="ride-route">
                <div class="ride-from">🟢 ${ride.from}</div>
                <div class="ride-to">🔴 ${ride.to}</div>
            </div>
            <div class="ride-meta">
                <span class="ride-badge">👤 ${ride.rider}</span>
                <span class="ride-badge">📏 ${ride.dist}</span>
                <span class="ride-badge">⏱️ ${ride.wait} دق</span>
                <span class="ride-price-badge">${ride.price} درهم</span>
            </div>
            <div class="ride-actions">
                <button class="btn-accept" onclick="app.acceptRide(this, '${ride.rider}', ${ride.price})">✓ قبول</button>
                <button class="btn-reject" onclick="app.rejectRide(this)">✕ رفض</button>
            </div>`;
        return card;
    }

    acceptRide(btn, rider, price) {
        const card = btn.closest('.ride-request-card');
        card.style.borderColor = 'var(--green)';
        card.style.background  = 'var(--green-light)';
        btn.textContent = '✓ مقبولة'; btn.disabled = true;
        card.querySelector('.btn-reject').disabled = true;
        this.tripsAccepted++;
        this.showToast(`✅ قبلت رحلة ${rider} — ${price} درهم`, 'success');
        const trips = document.getElementById('d-trips-today');
        const earn  = document.getElementById('d-earnings-today');
        if (trips) trips.textContent = parseInt(trips.textContent || 0) + 1;
        if (earn)  earn.textContent  = parseInt(earn.textContent  || 0) + price;
        const badge = document.getElementById('requests-count-badge');
        if (badge) badge.textContent = Math.max(0, parseInt(badge.textContent || 1) - 1);
        this.updateAcceptanceRate();
        const today = new Date().getDay();
        this.earningsData[(today - 1 + 7) % 7] = (this.earningsData[(today - 1 + 7) % 7] || 0) + price;
        this.renderEarningsChart();
    }

    rejectRide(btn) {
        const card = btn.closest('.ride-request-card');
        this.tripsRejected++;
        card.style.opacity = '0.4'; card.style.transform = 'translateX(20px)';
        setTimeout(() => card.remove(), 300);
        this.showToast('❌ تم رفض الرحلة', 'error');
        const badge = document.getElementById('requests-count-badge');
        if (badge) badge.textContent = Math.max(0, parseInt(badge.textContent || 1) - 1);
        this.updateAcceptanceRate();
    }

    updateAcceptanceRate() {
        const total = this.tripsAccepted + this.tripsRejected;
        const rate  = total ? Math.round((this.tripsAccepted / total) * 100) : 100;
        const el = document.getElementById('d-acceptance-rate');
        if (el) el.textContent = `${rate}%`;
    }

    renderEarningsChart() {
        const container = document.getElementById('earnings-chart');
        const labelsEl  = document.getElementById('chart-labels');
        if (!container) return;
        const days     = ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];
        const max      = Math.max(...this.earningsData, 1);
        const todayIdx = (new Date().getDay() - 1 + 7) % 7;

        if (labelsEl) {
            labelsEl.innerHTML = days.map((d, i) =>
                `<span class="chart-lbl ${i === todayIdx ? 'today' : ''}">${d.substring(0, 3)}</span>`
            ).join('');
        }
        container.innerHTML = this.earningsData.map((val, i) => {
            const h = Math.round((val / max) * 75) + 4;
            return `<div class="chart-bar ${i === todayIdx ? 'today' : ''}" style="height:${h}px" data-amount="${val} درهم" title="${days[i]}: ${val} درهم"></div>`;
        }).join('');

        const total = this.earningsData.reduce((a, b) => a + b, 0);
        const avg   = Math.round(total / 7);
        const best  = Math.max(...this.earningsData);
        if (document.getElementById('weekly-total')) document.getElementById('weekly-total').textContent = `${total} درهم`;
        if (document.getElementById('daily-avg'))    document.getElementById('daily-avg').textContent    = `${avg} درهم`;
        if (document.getElementById('best-day'))     document.getElementById('best-day').textContent     = `${best} درهم`;
    }

    // ── Weather ───────────────────────────────────────────────
    async loadWeather() {
        const fallbacks = [
            { icon: '☀️', temp: 22 }, { icon: '🌤️', temp: 20 },
            { icon: '⛅', temp: 18 }, { icon: '🌦️', temp: 16 }
        ];
        const w = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        try {
            const res = await fetch('https://wttr.in/Tangier?format=j1');
            if (res.ok) {
                const d    = await res.json();
                const temp = parseInt(d.current_condition[0].temp_C);
                document.getElementById('weather-temp').textContent = `${temp}°`;
                document.getElementById('weather-icon').textContent = temp > 25 ? '☀️' : temp > 18 ? '🌤️' : '⛅';
                return;
            }
        } catch(_) {}
        document.getElementById('weather-temp').textContent = `${w.temp}°`;
        document.getElementById('weather-icon').textContent = w.icon;
    }

    // ── Stats Animation ────────────────────────────────────────
    animateStats() {
        this.animateNumber(document.getElementById('stat-avg-time'), 0, 5, 1000);
    }

    updateStatDrivers(count) {
        this.animateNumber(document.getElementById('stat-drivers'), 0, count, 800);
    }

    animateNumber(el, from, to, duration) {
        if (!el) return;
        const start = performance.now();
        const update = now => {
            const p = Math.min((now - start) / duration, 1);
            el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }

    // ── Modals ─────────────────────────────────────────────────
    openModal(id)  { document.getElementById(id)?.classList.add('active'); }
    closeModal(id) { document.getElementById(id)?.classList.remove('active'); }

    // ── Toast ──────────────────────────────────────────────────
    showToast(message, type = 'info') {
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 400); }, 3500);
    }

    // ── Logout ─────────────────────────────────────────────────
    logout() {
        if (!confirm('هل تريد تسجيل الخروج؟')) return;
        clearInterval(this.etaInterval);
        clearInterval(this.hoursOnlineInterval);
        this.socket?.disconnect();
        document.getElementById('main-app').style.display = 'none';
        this.user = this.driver = this.activeRide = this.selectedDriver = null;
        this.map = this.driverMap = null;
        this.riderTileLayer = this.driverTileLayer = null;
        document.getElementById('name').value  = '';
        document.getElementById('phone').value = '';
        document.getElementById('rider-section').classList.add('active');
        document.getElementById('driver-section').classList.remove('active');
        this.openModal('login-modal');
        this.showToast('👋 تم تسجيل الخروج بنجاح', 'info');
    }
}

// ── Boot ─────────────────────────────────────────────────────
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new TaxiFinderApp();
    window.app = app;
});
