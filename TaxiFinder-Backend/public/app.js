/**
 * TaxiGo — app.js  Phase 3
 * ─────────────────────────────────────────────────────────────
 * FIXES (Phase 2 → 3):
 *   • _handleLogin: this.currentRole → this.role; login-pass → login-password;
 *     consistent localStorage keys (tg_access/tg_refresh); calls _showApp()
 *   • _handleRegister: correct endpoint /register/rider|driver; fullName field
 *   • Removed _initAppForUser() (never existed) — _showApp() used instead
 *
 * PHASE 3 ADDITIONS:
 *   • Premium System (100 MAD) — credit card simulation modal, isPremium badge,
 *     premium drivers sorted to top of search results
 *   • Two-Way Ratings — driver→rider rating modal fires after completeRide
 *   • Real-time Chat — live chat window in active ride card (Socket.IO)
 *   • Shared Ride UI — "Find shared rides" panel, join open shared ride
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

/* ══════════════════════════════════════════════════════════
   INTERNATIONALISATION
══════════════════════════════════════════════════════════ */
const TRANSLATIONS = {
    ar: {
        city_tangier: 'طنجة', auth_subtitle: 'طنجة • رحلتك بأمان',
        role_rider: 'راكب', role_driver: 'سائق',
        btn_login: 'تسجيل الدخول', btn_register: 'حساب جديد',
        btn_enter: 'دخول', btn_create_account: 'إنشاء الحساب',
        field_phone: 'رقم الهاتف', field_password: 'كلمة المرور',
        field_fullname: 'الاسم الكامل', vehicle_info: 'معلومات السيارة',
        field_make: 'الماركة', field_model: 'الموديل',
        field_year: 'السنة', field_plate: 'اللوحة',
        field_color: 'اللون', field_capacity: 'المقاعد', field_type: 'نوع الخدمة',
        type_economy: 'اقتصادي', type_comfort: 'مريح',
        type_grand: 'طاكسي كبير', type_vip: 'VIP',
        heading_whereto: 'إلى أين؟',
        placeholder_pickup: 'نقطة الانطلاق', placeholder_dropoff: 'الوجهة',
        placeholder_comment: 'تعليق اختياري…',
        heading_nearby: 'سائقون قريبون', no_drivers: 'لا يوجد سائقون متاحون الآن',
        est_fare: 'السعر التقديري', pay_cash: 'نقدي', pay_card: 'بطاقة',
        btn_request: 'طلب سيارة',
        status_offline: 'غير متاح', status_online: 'متاح',
        stat_today: 'اليوم MAD', stat_rides: 'رحلات', stat_rating: 'تقييم',
        heatmap_title: 'خريطة الطلب', heatmap_sub: 'المناطق الأكثر نشاطاً',
        legend_low: 'منخفض', legend_mid: 'متوسط', legend_high: 'مرتفع',
        heading_requests: 'طلبات الركوب', no_requests: 'لا طلبات جديدة',
        status_searching: 'نبحث عن سائق…', status_driver_found: 'تم العثور على سائق',
        status_in_progress: 'الرحلة جارية', status_completed: 'اكتملت الرحلة',
        final_fare: 'الأجرة النهائية',
        settings_title: 'الإعدادات',
        setting_darkmode: 'الوضع الليلي', setting_darkmode_sub: 'خريطة عالية التباين',
        setting_language: 'اللغة', setting_profile: 'الملف الشخصي',
        sos_contacts: 'جهات اتصال الطوارئ', btn_add_contact: 'إضافة جهة اتصال',
        btn_logout: 'تسجيل الخروج',
        sos_title: 'زر الطوارئ',
        sos_desc: 'سيتم إرسال موقعك الحالي ومعلومات رحلتك لجهات الاتصال الطارئة فوراً',
        sos_locating: 'جاري تحديد الموقع…',
        btn_sos_send: 'إرسال التنبيه', btn_cancel: 'إلغاء',
        rating_title: 'كيف كانت رحلتك؟',
        rating_passenger_title: 'قيّم الراكب',
        btn_submit_rating: 'إرسال التقييم',
        // Phase 4 — AI
        ai_brand_name:   'TaxiGo AI',
        ai_brand_sub:    'مساعدك الذكي',
        ai_placeholder:  'اسألني أي شيء…',
        ai_welcome:      'مرحباً! أنا مساعد TaxiGo الذكي. يمكنني مساعدتك في اختيار أفضل طريق أو حساب الأجرة أو الإجابة على أسئلتك.',
        ai_chip_route:   '🗺️ أفضل طريق',
        ai_chip_fare:    '💰 تقدير الأجرة',
        ai_chip_shared:  '👥 الرحلات المشتركة',
        ai_chip_help:    '❓ كيف أستخدم التطبيق؟',
        ai_chip_sos:     '🆘 طوارئ',
        ai_route_label:  'اقتراح AI للطريق',
        ai_traffic_low:  'حركة خفيفة',
        ai_traffic_med:  'حركة متوسطة',
        ai_traffic_high: 'ازدحام مرتفع',
        ai_split_title:  'تقسيم الأجرة بالذكاء الاصطناعي',
        ai_error:        'عذراً، تعذر الوصول للمساعد الذكي. حاول مجدداً.',
        btn_complete_ride: 'إنهاء الرحلة',
        // Phase 3
        premium_title: 'اشتراك بريميوم',
        premium_desc: 'ظهر أولاً في نتائج البحث واحصل على شارة التحقق',
        premium_price: '100 MAD / شهر',
        premium_badge: 'بريميوم',
        btn_go_premium: 'اشترك الآن',
        premium_card_number: 'رقم البطاقة',
        premium_card_expiry: 'تاريخ الانتهاء',
        premium_card_cvv: 'CVV',
        premium_card_name: 'اسم حامل البطاقة',
        btn_pay: 'ادفع 100 MAD',
        premium_processing: 'جارٍ المعالجة…',
        premium_success: '🎉 أصبحت عضواً بريميوم!',
        chat_title: 'المحادثة',
        chat_placeholder: 'اكتب رسالة…',
        btn_send: 'إرسال',
        shared_rides_title: 'الرحلات المشتركة',
        shared_rides_sub: 'رحلات متاحة بالقرب منك',
        btn_find_shared: 'البحث عن رحلة مشتركة',
        btn_join_ride: 'انضم',
        no_shared_rides: 'لا توجد رحلات مشتركة متاحة',
        seats_available: 'مقاعد متاحة',
    },
    fr: {
        city_tangier: 'Tanger', auth_subtitle: 'Tanger • Votre trajet en sécurité',
        role_rider: 'Passager', role_driver: 'Chauffeur',
        btn_login: 'Se connecter', btn_register: 'Créer un compte',
        btn_enter: 'Entrer', btn_create_account: 'Créer le compte',
        field_phone: 'Numéro de téléphone', field_password: 'Mot de passe',
        field_fullname: 'Nom complet', vehicle_info: 'Informations véhicule',
        field_make: 'Marque', field_model: 'Modèle',
        field_year: 'Année', field_plate: 'Plaque', field_color: 'Couleur',
        field_capacity: 'Places', field_type: 'Type de service',
        type_economy: 'Économique', type_comfort: 'Confort',
        type_grand: 'Grand taxi', type_vip: 'VIP',
        heading_whereto: 'Où allez-vous ?',
        placeholder_pickup: 'Point de départ', placeholder_dropoff: 'Destination',
        placeholder_comment: 'Commentaire facultatif…',
        heading_nearby: 'Chauffeurs proches', no_drivers: 'Aucun chauffeur disponible',
        est_fare: 'Tarif estimé', pay_cash: 'Espèces', pay_card: 'Carte',
        btn_request: 'Demander un taxi',
        status_offline: 'Hors ligne', status_online: 'En ligne',
        stat_today: "Aujourd'hui MAD", stat_rides: 'Courses', stat_rating: 'Note',
        heatmap_title: 'Carte de demande', heatmap_sub: 'Zones les plus actives',
        legend_low: 'Faible', legend_mid: 'Moyen', legend_high: 'Élevé',
        heading_requests: 'Demandes de course', no_requests: 'Aucune demande',
        status_searching: 'Recherche d\'un chauffeur…', status_driver_found: 'Chauffeur trouvé',
        status_in_progress: 'Course en cours', status_completed: 'Course terminée',
        final_fare: 'Tarif final',
        settings_title: 'Paramètres', setting_darkmode: 'Mode sombre',
        setting_darkmode_sub: 'Carte à fort contraste', setting_language: 'Langue',
        setting_profile: 'Profil',
        sos_contacts: 'Contacts d\'urgence', btn_add_contact: 'Ajouter un contact',
        btn_logout: 'Déconnexion',
        sos_title: 'Bouton SOS',
        sos_desc: 'Votre position et informations de trajet seront envoyées immédiatement à vos contacts d\'urgence',
        sos_locating: 'Localisation en cours…',
        btn_sos_send: 'Envoyer l\'alerte', btn_cancel: 'Annuler',
        rating_title: 'Comment était votre trajet ?',
        rating_passenger_title: 'Évaluer le passager',
        btn_submit_rating: 'Soumettre la note',
        // Phase 4 — AI
        ai_brand_name:   'TaxiGo AI',
        ai_brand_sub:    'Votre assistant intelligent',
        ai_placeholder:  'Posez-moi une question…',
        ai_welcome:      'Bonjour ! Je suis l\'assistant IA de TaxiGo. Je peux vous suggérer des itinéraires, estimer les tarifs ou répondre à vos questions.',
        ai_chip_route:   '🗺️ Meilleur itinéraire',
        ai_chip_fare:    '💰 Estimer le tarif',
        ai_chip_shared:  '👥 Trajets partagés',
        ai_chip_help:    '❓ Comment utiliser l\'app ?',
        ai_chip_sos:     '🆘 Urgence',
        ai_route_label:  'Suggestion IA d\'itinéraire',
        ai_traffic_low:  'Trafic fluide',
        ai_traffic_med:  'Trafic modéré',
        ai_traffic_high: 'Trafic dense',
        ai_split_title:  'Partage de tarif IA',
        ai_error:        'Désolé, l\'assistant IA est temporairement indisponible.',
        btn_complete_ride: 'Terminer la course',
        premium_title: 'Abonnement Premium',
        premium_desc: 'Apparaissez en premier dans les résultats et obtenez un badge vérifié',
        premium_price: '100 MAD / mois',
        premium_badge: 'Premium',
        btn_go_premium: 'S\'abonner',
        premium_card_number: 'Numéro de carte',
        premium_card_expiry: 'Date d\'expiration',
        premium_card_cvv: 'CVV',
        premium_card_name: 'Nom du titulaire',
        btn_pay: 'Payer 100 MAD',
        premium_processing: 'Traitement en cours…',
        premium_success: '🎉 Vous êtes maintenant Premium !',
        chat_title: 'Chat',
        chat_placeholder: 'Écrire un message…',
        btn_send: 'Envoyer',
        shared_rides_title: 'Trajets partagés',
        shared_rides_sub: 'Trajets disponibles près de vous',
        btn_find_shared: 'Rechercher un trajet partagé',
        btn_join_ride: 'Rejoindre',
        no_shared_rides: 'Aucun trajet partagé disponible',
        seats_available: 'places disponibles',
    },
    en: {
        city_tangier: 'Tangier', auth_subtitle: 'Tangier • Your safe ride',
        role_rider: 'Rider', role_driver: 'Driver',
        btn_login: 'Log in', btn_register: 'Create account',
        btn_enter: 'Enter', btn_create_account: 'Create account',
        field_phone: 'Phone number', field_password: 'Password',
        field_fullname: 'Full name', vehicle_info: 'Vehicle info',
        field_make: 'Make', field_model: 'Model',
        field_year: 'Year', field_plate: 'Plate', field_color: 'Color',
        field_capacity: 'Seats', field_type: 'Service type',
        type_economy: 'Economy', type_comfort: 'Comfort',
        type_grand: 'Grand taxi', type_vip: 'VIP',
        heading_whereto: 'Where to?',
        placeholder_pickup: 'Pickup point', placeholder_dropoff: 'Destination',
        placeholder_comment: 'Optional comment…',
        heading_nearby: 'Nearby drivers', no_drivers: 'No drivers available right now',
        est_fare: 'Estimated fare', pay_cash: 'Cash', pay_card: 'Card',
        btn_request: 'Request a ride',
        status_offline: 'Offline', status_online: 'Online',
        stat_today: 'Today MAD', stat_rides: 'Rides', stat_rating: 'Rating',
        heatmap_title: 'Demand map', heatmap_sub: 'Highest demand areas',
        legend_low: 'Low', legend_mid: 'Medium', legend_high: 'High',
        heading_requests: 'Ride requests', no_requests: 'No new requests',
        status_searching: 'Finding a driver…', status_driver_found: 'Driver found',
        status_in_progress: 'Ride in progress', status_completed: 'Ride completed',
        final_fare: 'Final fare',
        settings_title: 'Settings', setting_darkmode: 'Dark mode',
        setting_darkmode_sub: 'High-contrast map', setting_language: 'Language',
        setting_profile: 'Profile',
        sos_contacts: 'Emergency contacts', btn_add_contact: 'Add contact',
        btn_logout: 'Log out',
        sos_title: 'Emergency SOS',
        sos_desc: 'Your current location and ride info will be sent immediately to your emergency contacts',
        sos_locating: 'Locating…',
        btn_sos_send: 'Send alert', btn_cancel: 'Cancel',
        rating_title: 'How was your ride?',
        rating_passenger_title: 'Rate the passenger',
        btn_submit_rating: 'Submit rating',
        // Phase 4 — AI
        ai_brand_name:   'TaxiGo AI',
        ai_brand_sub:    'Your smart assistant',
        ai_placeholder:  'Ask me anything…',
        ai_welcome:      'Hello! I\'m TaxiGo\'s AI assistant. I can suggest routes, estimate fares, or answer questions about your trip.',
        ai_chip_route:   '🗺️ Best route',
        ai_chip_fare:    '💰 Estimate fare',
        ai_chip_shared:  '👥 Shared rides',
        ai_chip_help:    '❓ How to use the app?',
        ai_chip_sos:     '🆘 Emergency',
        ai_route_label:  'AI Route Suggestion',
        ai_traffic_low:  'Light traffic',
        ai_traffic_med:  'Moderate traffic',
        ai_traffic_high: 'Heavy traffic',
        ai_split_title:  'AI Fare Split',
        ai_error:        'Sorry, the AI assistant is temporarily unavailable.',
        btn_complete_ride: 'Complete Ride',
        premium_title: 'Premium Subscription',
        premium_desc: 'Appear first in search results and get a verified badge',
        premium_price: '100 MAD / month',
        premium_badge: 'Premium',
        btn_go_premium: 'Go Premium',
        premium_card_number: 'Card number',
        premium_card_expiry: 'Expiry date',
        premium_card_cvv: 'CVV',
        premium_card_name: 'Cardholder name',
        btn_pay: 'Pay 100 MAD',
        premium_processing: 'Processing…',
        premium_success: '🎉 You are now Premium!',
        chat_title: 'Chat',
        chat_placeholder: 'Type a message…',
        btn_send: 'Send',
        shared_rides_title: 'Shared Rides',
        shared_rides_sub: 'Available rides near you',
        btn_find_shared: 'Find a shared ride',
        btn_join_ride: 'Join',
        no_shared_rides: 'No shared rides available',
        seats_available: 'seats available',
    },
    es: {
        city_tangier: 'Tánger', auth_subtitle: 'Tánger • Tu viaje seguro',
        role_rider: 'Pasajero', role_driver: 'Conductor',
        btn_login: 'Iniciar sesión', btn_register: 'Crear cuenta',
        btn_enter: 'Entrar', btn_create_account: 'Crear cuenta',
        field_phone: 'Número de teléfono', field_password: 'Contraseña',
        field_fullname: 'Nombre completo', vehicle_info: 'Información del vehículo',
        field_make: 'Marca', field_model: 'Modelo',
        field_year: 'Año', field_plate: 'Matrícula', field_color: 'Color',
        field_capacity: 'Asientos', field_type: 'Tipo de servicio',
        type_economy: 'Económico', type_comfort: 'Confort',
        type_grand: 'Grand taxi', type_vip: 'VIP',
        heading_whereto: '¿A dónde vas?',
        placeholder_pickup: 'Punto de recogida', placeholder_dropoff: 'Destino',
        placeholder_comment: 'Comentario opcional…',
        heading_nearby: 'Conductores cercanos', no_drivers: 'No hay conductores disponibles',
        est_fare: 'Tarifa estimada', pay_cash: 'Efectivo', pay_card: 'Tarjeta',
        btn_request: 'Solicitar taxi',
        status_offline: 'Desconectado', status_online: 'En línea',
        stat_today: 'Hoy MAD', stat_rides: 'Viajes', stat_rating: 'Calificación',
        heatmap_title: 'Mapa de demanda', heatmap_sub: 'Zonas más activas',
        legend_low: 'Baja', legend_mid: 'Media', legend_high: 'Alta',
        heading_requests: 'Solicitudes de viaje', no_requests: 'Sin solicitudes',
        status_searching: 'Buscando conductor…', status_driver_found: 'Conductor encontrado',
        status_in_progress: 'Viaje en curso', status_completed: 'Viaje completado',
        final_fare: 'Tarifa final',
        settings_title: 'Ajustes', setting_darkmode: 'Modo oscuro',
        setting_darkmode_sub: 'Mapa de alto contraste', setting_language: 'Idioma',
        setting_profile: 'Perfil',
        sos_contacts: 'Contactos de emergencia', btn_add_contact: 'Añadir contacto',
        btn_logout: 'Cerrar sesión',
        sos_title: 'Botón SOS',
        sos_desc: 'Tu ubicación y datos del viaje se enviarán inmediatamente a tus contactos de emergencia',
        sos_locating: 'Localizando…',
        btn_sos_send: 'Enviar alerta', btn_cancel: 'Cancelar',
        rating_title: '¿Cómo fue tu viaje?',
        rating_passenger_title: 'Calificar al pasajero',
        btn_submit_rating: 'Enviar calificación',
        // Phase 4 — AI
        ai_brand_name:   'TaxiGo AI',
        ai_brand_sub:    'Tu asistente inteligente',
        ai_placeholder:  'Pregúntame cualquier cosa…',
        ai_welcome:      '¡Hola! Soy el asistente IA de TaxiGo. Puedo sugerirte rutas, estimar tarifas o responder tus preguntas.',
        ai_chip_route:   '🗺️ Mejor ruta',
        ai_chip_fare:    '💰 Estimar tarifa',
        ai_chip_shared:  '👥 Viajes compartidos',
        ai_chip_help:    '❓ ¿Cómo usar la app?',
        ai_chip_sos:     '🆘 Emergencia',
        ai_route_label:  'Sugerencia de ruta IA',
        ai_traffic_low:  'Tráfico fluido',
        ai_traffic_med:  'Tráfico moderado',
        ai_traffic_high: 'Tráfico intenso',
        ai_split_title:  'División de tarifa IA',
        ai_error:        'Lo siento, el asistente IA no está disponible temporalmente.',
        btn_complete_ride: 'Completar viaje',
        premium_title: 'Suscripción Premium',
        premium_desc: 'Aparece primero en los resultados y obtén una insignia verificada',
        premium_price: '100 MAD / mes',
        premium_badge: 'Premium',
        btn_go_premium: 'Hazte Premium',
        premium_card_number: 'Número de tarjeta',
        premium_card_expiry: 'Fecha de vencimiento',
        premium_card_cvv: 'CVV',
        premium_card_name: 'Nombre del titular',
        btn_pay: 'Pagar 100 MAD',
        premium_processing: 'Procesando…',
        premium_success: '🎉 ¡Ahora eres Premium!',
        chat_title: 'Chat',
        chat_placeholder: 'Escribe un mensaje…',
        btn_send: 'Enviar',
        shared_rides_title: 'Viajes compartidos',
        shared_rides_sub: 'Viajes disponibles cerca de ti',
        btn_find_shared: 'Buscar viaje compartido',
        btn_join_ride: 'Unirse',
        no_shared_rides: 'No hay viajes compartidos disponibles',
        seats_available: 'asientos disponibles',
    },
    de: {
        city_tangier: 'Tanger', auth_subtitle: 'Tanger • Sicher ans Ziel',
        role_rider: 'Fahrgast', role_driver: 'Fahrer',
        btn_login: 'Anmelden', btn_register: 'Konto erstellen',
        btn_enter: 'Eingabe', btn_create_account: 'Konto erstellen',
        field_phone: 'Telefonnummer', field_password: 'Passwort',
        field_fullname: 'Vollständiger Name', vehicle_info: 'Fahrzeuginformationen',
        field_make: 'Marke', field_model: 'Modell',
        field_year: 'Jahr', field_plate: 'Kennzeichen', field_color: 'Farbe',
        field_capacity: 'Sitze', field_type: 'Servicetyp',
        type_economy: 'Wirtschaft', type_comfort: 'Komfort',
        type_grand: 'Großtaxi', type_vip: 'VIP',
        heading_whereto: 'Wohin?',
        placeholder_pickup: 'Abholpunkt', placeholder_dropoff: 'Ziel',
        placeholder_comment: 'Optionaler Kommentar…',
        heading_nearby: 'Fahrer in der Nähe', no_drivers: 'Keine Fahrer verfügbar',
        est_fare: 'Geschätzter Preis', pay_cash: 'Bargeld', pay_card: 'Karte',
        btn_request: 'Taxi anfordern',
        status_offline: 'Offline', status_online: 'Online',
        stat_today: 'Heute MAD', stat_rides: 'Fahrten', stat_rating: 'Bewertung',
        heatmap_title: 'Nachfragekarte', heatmap_sub: 'Aktivste Bereiche',
        legend_low: 'Niedrig', legend_mid: 'Mittel', legend_high: 'Hoch',
        heading_requests: 'Fahrtanfragen', no_requests: 'Keine neuen Anfragen',
        status_searching: 'Fahrer suchen…', status_driver_found: 'Fahrer gefunden',
        status_in_progress: 'Fahrt läuft', status_completed: 'Fahrt abgeschlossen',
        final_fare: 'Endpreis',
        settings_title: 'Einstellungen', setting_darkmode: 'Dunkelmodus',
        setting_darkmode_sub: 'Kontrastreiche Karte', setting_language: 'Sprache',
        setting_profile: 'Profil',
        sos_contacts: 'Notfallkontakte', btn_add_contact: 'Kontakt hinzufügen',
        btn_logout: 'Abmelden',
        sos_title: 'Notfall SOS',
        sos_desc: 'Ihr aktueller Standort und Fahrtdaten werden sofort an Ihre Notfallkontakte gesendet',
        sos_locating: 'Ortung läuft…',
        btn_sos_send: 'Alarm senden', btn_cancel: 'Abbrechen',
        rating_title: 'Wie war Ihre Fahrt?',
        rating_passenger_title: 'Fahrgast bewerten',
        btn_submit_rating: 'Bewertung abgeben',
        // Phase 4 — AI
        ai_brand_name:   'TaxiGo AI',
        ai_brand_sub:    'Ihr intelligenter Assistent',
        ai_placeholder:  'Stellen Sie mir eine Frage…',
        ai_welcome:      'Hallo! Ich bin TaxiGos KI-Assistent. Ich kann Routen vorschlagen, Preise schätzen oder Ihre Fragen beantworten.',
        ai_chip_route:   '🗺️ Beste Route',
        ai_chip_fare:    '💰 Preis schätzen',
        ai_chip_shared:  '👥 Geteilte Fahrten',
        ai_chip_help:    '❓ Wie nutze ich die App?',
        ai_chip_sos:     '🆘 Notfall',
        ai_route_label:  'KI-Routenvorschlag',
        ai_traffic_low:  'Wenig Verkehr',
        ai_traffic_med:  'Mittlerer Verkehr',
        ai_traffic_high: 'Starker Verkehr',
        ai_split_title:  'KI-Preisaufteilung',
        ai_error:        'Entschuldigung, der KI-Assistent ist vorübergehend nicht verfügbar.',
        btn_complete_ride: 'Fahrt abschließen',
        premium_title: 'Premium-Abonnement',
        premium_desc: 'Erscheinen Sie zuerst in Suchergebnissen und erhalten Sie ein verifiziertes Abzeichen',
        premium_price: '100 MAD / Monat',
        premium_badge: 'Premium',
        btn_go_premium: 'Premium werden',
        premium_card_number: 'Kartennummer',
        premium_card_expiry: 'Ablaufdatum',
        premium_card_cvv: 'CVV',
        premium_card_name: 'Name des Karteninhabers',
        btn_pay: '100 MAD zahlen',
        premium_processing: 'Wird verarbeitet…',
        premium_success: '🎉 Sie sind jetzt Premium-Mitglied!',
        chat_title: 'Chat',
        chat_placeholder: 'Nachricht schreiben…',
        btn_send: 'Senden',
        shared_rides_title: 'Geteilte Fahrten',
        shared_rides_sub: 'Verfügbare Fahrten in der Nähe',
        btn_find_shared: 'Geteilte Fahrt suchen',
        btn_join_ride: 'Beitreten',
        no_shared_rides: 'Keine geteilten Fahrten verfügbar',
        seats_available: 'Plätze verfügbar',
    },
};

/* ══════════════════════════════════════════════════════════
   MAP TILE LAYERS
══════════════════════════════════════════════════════════ */
const TILES = {
    // Light mode: CartoDB Voyager — bright, detailed, professional
    light: {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attr: '&copy; <a href="https://carto.com">CARTO</a> &copy; <a href="https://openstreetmap.org">OSM</a>',
    },
    // Dark mode: CartoDB Positron — light & clear so drivers/routes stay perfectly visible.
    // We intentionally keep a light tile even in dark UI so the map is never too dark.
    dark: {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attr: '&copy; <a href="https://carto.com">CARTO</a> &copy; <a href="https://openstreetmap.org">OSM</a>',
    },
};

const TANGIER_HEAT_POINTS = [
    [35.7882, -5.8114, 1.0], [35.7870, -5.8100, 0.9], [35.7860, -5.8090, 0.8],
    [35.7908, -5.8098, 0.95], [35.7930, -5.8070, 0.85],
    [35.7698, -5.8290, 0.9], [35.7680, -5.8310, 0.8],
    [35.7890, -5.7720, 0.75], [35.7820, -5.7800, 0.7],
    [35.7261, -5.9133, 0.6], [35.7280, -5.9100, 0.55],
    [35.7740, -5.8070, 0.85], [35.7730, -5.8080, 0.8],
    [35.7524, -5.8472, 0.7], [35.7540, -5.8450, 0.65],
    [35.7710, -5.8125, 0.75],
    [35.7919, -5.8128, 0.7],
];

/* ══════════════════════════════════════════════════════════
   MAIN APP CLASS
══════════════════════════════════════════════════════════ */
class TaxiGoApp {

    constructor() {
        this.lang    = localStorage.getItem('tg_lang')  || 'ar';
        this.theme   = localStorage.getItem('tg_theme') || 'light';
        this.tokens  = this._loadTokens();
        this.user    = null;
        this.role    = 'rider';

        this.map        = null;
        this.tileLayer  = null;
        this.heatLayer  = null;
        this.myMarker   = null;
        this.driverMarkers = new Map();
        this.pickupMarker  = null;
        this.dropoffMarker = null;

        this.location = { lat: 35.7595, lng: -5.8340 };

        this.activeRide  = null;
        this.selectedCarType = 'economy';
        this.selectedRating  = 0;
        this.driverOnline = false;
        this.socket = null;

        this.sosContacts = JSON.parse(localStorage.getItem('tg_sos') || '[]');
        this._clockInterval = null;

        // Phase 3 state
        this._chatMessages = [];

        this._injectDynamicModals();
        this.init();
    }

    /* ── Bootstrap ──────────────────────────────────── */
    async init() {
        this._applyTheme(this.theme, false);
        this._applyLang(this.lang, false);
        await this._runPreloader();

        if (this.tokens.access) {
            const ok = await this._restoreSession();
            if (ok) { this._showApp(); return; }
        }
        this._showAuth();
    }

    async _runPreloader() {
        return new Promise(resolve => setTimeout(() => {
            document.getElementById('preloader').classList.add('fade-out');
            setTimeout(resolve, 600);
        }, 1800));
    }

    /* ── Tokens ─────────────────────────────────────── */
    _loadTokens() {
        return {
            access:  localStorage.getItem('tg_access')  || null,
            refresh: localStorage.getItem('tg_refresh') || null,
        };
    }

    _saveTokens(access, refresh) {
        this.tokens = { access, refresh };
        localStorage.setItem('tg_access',  access);
        if (refresh) localStorage.setItem('tg_refresh', refresh);
    }

    _clearTokens() {
        this.tokens = { access: null, refresh: null };
        localStorage.removeItem('tg_access');
        localStorage.removeItem('tg_refresh');
    }

    /* ── Session ────────────────────────────────────── */
    async _restoreSession() {
        try {
            const data = await this.api('/auth/me');
            this._setUser(data);
            return true;
        } catch {
            if (this.tokens.refresh) {
                try {
                    const r = await fetch('/api/auth/refresh', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ refreshToken: this.tokens.refresh }),
                    });
                    if (r.ok) {
                        const { accessToken, refreshToken } = await r.json();
                        this._saveTokens(accessToken, refreshToken);
                        const data = await this.api('/auth/me');
                        this._setUser(data);
                        return true;
                    }
                } catch {}
            }
            this._clearTokens();
            return false;
        }
    }

    _setUser(data) {
        this.user = data;
        this.role = data.role === 'driver' ? 'driver' : 'rider';
    }

    /* ── API Helper ─────────────────────────────────── */
    async api(path, options = {}) {
        const url = `/api${path}`;
        const headers = {
            'Content-Type': 'application/json',
            ...(this.tokens.access ? { Authorization: `Bearer ${this.tokens.access}` } : {}),
            ...(options.headers || {}),
        };
        const res = await fetch(url, { ...options, headers });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw Object.assign(new Error(err.error || 'API error'), { status: res.status, data: err });
        }
        return res.json();
    }

    /* ══════════════════════════════════════════════════
       AUTH SCREEN
    ══════════════════════════════════════════════════ */
    _showAuth() {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('app-screen').classList.add('hidden');
        this._bindAuthEvents();
    }

    _bindAuthEvents() {
        document.querySelectorAll('.role-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.role-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.role = btn.dataset.role;
                const driverFields = document.getElementById('driver-reg-fields');
                if (driverFields) driverFields.classList.toggle('hidden', this.role !== 'driver');
            });
        });

        document.querySelectorAll('.auth-mode-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.auth-mode-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const isLogin = btn.dataset.mode === 'login';
                document.getElementById('login-form').classList.toggle('active', isLogin);
                document.getElementById('register-form').classList.toggle('active', !isLogin);
            });
        });

        document.querySelectorAll('.field-toggle-pw').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = btn.closest('.field-wrap').querySelector('input');
                const isText = input.type === 'text';
                input.type = isText ? 'password' : 'text';
                btn.querySelector('i').className = isText ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash';
            });
        });

        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this._handleLogin();
        });

        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this._handleRegister();
        });
    }

    /* ── FIX: was broken — currentRole undefined, wrong token keys,
             _initAppForUser() didn't exist, wrong input ID ── */
   async _handleLogin() {
    const phone = document.getElementById('login-phone').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errorEl = document.getElementById('auth-error');

    // 1. التحقق من ملء الحقول أولاً
    if (!phone || !password) {
        errorEl.textContent = this._t('error_missing_fields') || "يرجى ملء جميع الحقول";
        errorEl.classList.remove('hidden');
        return;
    }

    try {
        // 2. تأكد من أن الرابط (URL) ينتهي بـ /login/ وليس فقط /login
        const resp = await fetch(`/api/auth/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json' 
            },
            body: JSON.stringify({ phone, password, role: this.role }),
        });

        const data = await resp.json();
        console.log('Login response:', data);
        if (resp.ok) {
            // حفظ التوكنات بشكل صحيح
           // جديد ✅
            localStorage.setItem('tg_access', data.accessToken);
            localStorage.setItem('tg_refresh', data.refreshToken);
            
            // إخفاء الخطأ وتشغيل التطبيق
            errorEl.classList.add('hidden');
            this._showApp();
        } else {
            // إظهار رسالة الخطأ القادمة من السيرفر أو الرسالة الافتراضية
            errorEl.textContent = data.detail || data.error || "خطأ في رقم الهاتف أو كلمة المرور";
            errorEl.classList.remove('hidden');
        }
    } catch (err) {
        console.error("Login error:", err);
        errorEl.textContent = "تعذر الاتصال بالخادم، تأكد من تشغيل الـ Backend";
        errorEl.classList.remove('hidden');
    }
}

    /* ── FIX: wrong endpoint, wrong field name, non-existent _showAuthStep ── */
    async _handleRegister() {
        const fullName = document.getElementById('reg-name').value.trim();
        const phone    = document.getElementById('reg-phone').value.trim();
        // FIX: HTML uses id="reg-password", not "reg-pass"
        const password = document.getElementById('reg-password').value;
        const role     = this.role;

        const errEl = document.getElementById('reg-error');
        errEl.classList.add('hidden');

        try {
            // FIX: correct endpoint per role
            const endpoint = role === 'driver'
                ? '/api/auth/register/driver'
                : '/api/auth/register/rider';

            const body = { fullName, phone, password };

            if (role === 'driver') {
                body.vehicle = {
                    make:         document.getElementById('reg-make')?.value?.trim()     || '',
                    model:        document.getElementById('reg-model')?.value?.trim()    || '',
                    year:         parseInt(document.getElementById('reg-year')?.value)   || new Date().getFullYear(),
                    licensePlate: document.getElementById('reg-plate')?.value?.trim()    || '',
                    color:        document.getElementById('reg-color')?.value?.trim()    || '',
                    capacity:     parseInt(document.getElementById('reg-capacity')?.value) || 4,
                    type:         document.getElementById('reg-type')?.value             || 'economy',
                };
            }

            const res  = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const text = await res.text();
            const data = text ? JSON.parse(text) : {};

            if (!res.ok) throw new Error(data.error || 'Registration failed');

            if (role === 'driver') {
                // Driver needs admin approval — show notice, redirect to login tab
                this.toast(data.notice || this._t('premium_success'), 'info', 6000);
                // FIX: use proper tab click instead of non-existent _showAuthStep()
                document.querySelector('.auth-mode-tab[data-mode="login"]')?.click();
            } else {
                // Rider is auto-logged in on register
                this._saveTokens(data.accessToken, data.refreshToken);
                this._setUser(data.user);
                this._showApp();
            }

        } catch (err) {
            console.error('[Register]', err);
            errEl.textContent = err.message;
            errEl.classList.remove('hidden');
        }
    }

    /* ══════════════════════════════════════════════════
       APP SCREEN
    ══════════════════════════════════════════════════ */
    _showApp() {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');

        this._updateNavUI();
        this._initMap();
        this._connectSocket();
        this._bindAppEvents();
        this._startClock();
        this._renderSuggestionsPanel();

        // Phase 4 — AI assistant
        document.getElementById('btn-ai-assistant')?.classList.remove('hidden');
        this._initAI();
        this._bindAIEvents();

        if (this.role === 'rider') {
            document.getElementById('rider-panel').classList.remove('hidden');
            this._loadNearbyDrivers();
            this._pollDrivers();
        } else {
            document.getElementById('driver-panel').classList.remove('hidden');
            this._updateDriverStats();
            this._renderHeatmap();
            this._renderPremiumButton();
        }
    }

    _updateNavUI() {
        const name = this.user?.fullName || '—';
        document.getElementById('nav-username').textContent = name;
        const roleLbl = document.getElementById('role-label');
        roleLbl.textContent = this._t(this.role === 'driver' ? 'role_driver' : 'role_rider');
        const badge = document.getElementById('role-badge');
        badge.querySelector('i').className = this.role === 'driver'
            ? 'fa-solid fa-steering-wheel' : 'fa-solid fa-user';

        if (this.role === 'driver') {
            document.getElementById('driver-name-display').textContent = name;
            const v = this.user?.vehicle;
            if (v) document.getElementById('driver-vehicle-display').textContent =
                `${v.make} ${v.model} ${v.year}`;
            // Show premium badge in nav if premium
            if (this.user?.isPremiumActive || this.user?.premium?.active) {
                const premBadge = document.createElement('span');
                premBadge.className = 'premium-nav-badge';
                premBadge.innerHTML = `<i class="fa-solid fa-crown"></i> ${this._t('premium_badge')}`;
                document.getElementById('role-badge').appendChild(premBadge);
            }
        }

        document.getElementById('settings-username').textContent = name;
        document.getElementById('settings-phone').textContent    = this.user?.phone || '—';
        document.getElementById('settings-role').textContent     = this._t(this.role === 'driver' ? 'role_driver' : 'role_rider');
    }

    _startClock() {
        const el = document.getElementById('live-time');
        if (!el) return;
        const update = () => {
            const now = new Date();
            el.textContent = now.toLocaleTimeString(this.lang === 'ar' ? 'ar-MA' : this.lang, {
                hour: '2-digit', minute: '2-digit',
            });
        };
        update();
        this._clockInterval = setInterval(update, 10000);
    }

    /* ══════════════════════════════════════════════════
       MAP
    ══════════════════════════════════════════════════ */
    _initMap() {
        if (this.map) return;

        this.map = L.map('map', {
            zoomControl: false,
            attributionControl: true,
        }).setView([this.location.lat, this.location.lng], 14);

        this._setTileLayer(this.theme);

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    this.location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    this.map.setView([this.location.lat, this.location.lng], 15);
                    this._updateMyMarker();
                    if (this.role === 'rider') this._loadNearbyDrivers();
                    if (this.role === 'driver') this._broadcastLocation();
                },
                () => { this._updateMyMarker(); },
                { timeout: 8000 }
            );
        }
        this._updateMyMarker();

        this.map.on('click', (e) => {
            if (this.role !== 'rider') return;
            const dropInput = document.getElementById('dropoff-input');
            if (!dropInput.value) {
                dropInput.value = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
                this._setDropoffMarker(e.latlng.lat, e.latlng.lng);
                this._estimateFare();
            }
        });
    }

    _setTileLayer(theme) {
        if (this.tileLayer) this.map.removeLayer(this.tileLayer);
        const t = TILES[theme] || TILES.light;
        this.tileLayer = L.tileLayer(t.url, { attribution: t.attr, maxZoom: 19 });
        this.tileLayer.addTo(this.map);
    }

    _updateMyMarker() {
        if (this.myMarker) this.map.removeLayer(this.myMarker);
        const el = document.createElement('div');
        el.className = 'location-pulse';
        this.myMarker = L.marker([this.location.lat, this.location.lng], {
            icon: L.divIcon({ className: '', html: el, iconSize: [16, 16], iconAnchor: [8, 8] }),
            zIndexOffset: 1000,
        }).addTo(this.map);
    }

    _setPickupMarker(lat, lng) {
        if (this.pickupMarker) this.map.removeLayer(this.pickupMarker);
        this.pickupMarker = L.circleMarker([lat, lng], {
            radius: 8, fillColor: '#355872', color: 'white', weight: 2, fillOpacity: 1,
        }).addTo(this.map);
    }

    _setDropoffMarker(lat, lng) {
        if (this.dropoffMarker) this.map.removeLayer(this.dropoffMarker);
        this.dropoffMarker = L.circleMarker([lat, lng], {
            radius: 8, fillColor: '#d93025', color: 'white', weight: 2, fillOpacity: 1,
        }).addTo(this.map);
    }

    /* ── Heatmap ─────────────────────────────────────── */
    _renderHeatmap() {
        if (!this.map || typeof L.heatLayer !== 'function') return;
        if (this.heatLayer) this.map.removeLayer(this.heatLayer);
        this.heatLayer = L.heatLayer(TANGIER_HEAT_POINTS, {
            radius: 35, blur: 25, maxZoom: 17,
            gradient: { 0.2: '#4575b4', 0.5: '#fee090', 0.8: '#f46d43', 1.0: '#d73027' },
        }).addTo(this.map);
    }

    _toggleHeatmap(visible) {
        if (!this.heatLayer) return;
        visible ? this.map.addLayer(this.heatLayer) : this.map.removeLayer(this.heatLayer);
    }

    /* ══════════════════════════════════════════════════
       NEARBY DRIVERS  (Phase 3: premium badge + sort)
    ══════════════════════════════════════════════════ */
    async _loadNearbyDrivers() {
        try {
            const { lat, lng } = this.location;
            const type = this.selectedCarType !== 'economy' ? `&type=${this.selectedCarType}` : '';
            const data = await this.api(`/drivers/nearby?lat=${lat}&lng=${lng}&radius=5000${type}`);
            this._renderDriverMarkers(data.drivers || []);
            this._renderDriversList(data.drivers || []);
        } catch { /* silently fail if backend not running */ }
    }

    _renderDriverMarkers(drivers) {
        this.driverMarkers.forEach((m) => this.map.removeLayer(m));
        this.driverMarkers.clear();

        drivers.forEach(d => {
            const el = document.createElement('div');
            el.className = `driver-map-marker${d.isPremium ? ' driver-map-premium' : ''}`;
            el.innerHTML = d.isPremium
                ? '<i class="fa-solid fa-crown"></i>'
                : '<i class="fa-solid fa-car"></i>';
            el.title = d.fullName;

            const marker = L.marker([d.location.lat, d.location.lng], {
                icon: L.divIcon({ className: '', html: el, iconSize: [34, 34], iconAnchor: [17, 17] }),
            });

            marker.bindPopup(`
                <strong>${d.fullName}</strong>
                ${d.isPremium ? '<span class="popup-premium-badge">★ Premium</span>' : ''}
                <br>${d.vehicle?.make} ${d.vehicle?.model}
                <br>⭐ ${d.ratings.average.toFixed(1)} · ${d.distanceKm} km
            `, { className: 'driver-popup' });

            marker.addTo(this.map);
            this.driverMarkers.set(String(d.id), marker);
        });
    }

    _renderDriversList(drivers) {
        const list  = document.getElementById('drivers-list');
        const badge = document.getElementById('driver-count');
        badge.textContent = drivers.length;

        if (!drivers.length) {
            list.innerHTML = `<div class="no-drivers">${this._t('no_drivers')}</div>`;
            return;
        }

        // Phase 3: premium drivers first (server also sorts, this is client safety net)
        const sorted = [...drivers].sort((a, b) => (b.isPremium ? 1 : 0) - (a.isPremium ? 1 : 0));

        list.innerHTML = sorted.map(d => `
            <div class="driver-card${d.isPremium ? ' driver-card-premium' : ''}" data-id="${d.id}">
                <div class="driver-card-avatar">
                    <i class="fa-solid fa-user-tie"></i>
                    ${d.isPremium ? '<span class="premium-badge"><i class="fa-solid fa-crown"></i></span>' : ''}
                </div>
                <div class="driver-card-info">
                    <div class="driver-card-name">
                        ${d.fullName}
                        ${d.isPremium ? `<span class="driver-premium-label">${this._t('premium_badge')}</span>` : ''}
                    </div>
                    <div class="driver-card-car">${d.vehicle?.make || ''} ${d.vehicle?.model || ''}</div>
                </div>
                <div class="driver-card-meta">
                    <div class="driver-card-dist">${d.distanceKm} km</div>
                    <div class="driver-card-rating"><i class="fa-solid fa-star"></i> ${d.ratings.average.toFixed(1)}</div>
                </div>
            </div>
        `).join('');

        list.querySelectorAll('.driver-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                const m  = this.driverMarkers.get(id);
                if (m) { m.openPopup(); this.map.panTo(m.getLatLng()); }
            });
        });
    }

    _pollDrivers() {
        this._driverPollInterval = setInterval(() => {
            if (this.role === 'rider' && !this.activeRide) this._loadNearbyDrivers();
        }, 15000);
    }

    /* ══════════════════════════════════════════════════
       SOCKET.IO  (Phase 3: +chat events)
    ══════════════════════════════════════════════════ */
    _connectSocket() {
        if (!this.tokens.access) return;
        try {
            this.socket = io({ auth: { token: this.tokens.access }, timeout: 5000 });

            this.socket.on('connect', () => console.log('[Socket] Connected'));

            this.socket.on('driver:location:update', ({ driverId, location }) => {
                const m = this.driverMarkers.get(String(driverId));
                if (m) m.setLatLng([location.lat, location.lng]);
            });

            this.socket.on('driver:offline', ({ driverId }) => {
                const m = this.driverMarkers.get(String(driverId));
                if (m) { this.map.removeLayer(m); this.driverMarkers.delete(String(driverId)); }
            });

            // Rider events
            this.socket.on('ride:driver_found', ({ rideId, driverId }) => {
                if (this.activeRide?.id === rideId) {
                    this._updateRideStatus('driver_found', driverId);
                    this._initChatUI(rideId);  // Phase 3: open chat
                }
            });
            this.socket.on('ride:status_update', ({ rideId, status }) => {
                if (this.activeRide?.id === rideId) this._updateRideStatus(status);
            });
            this.socket.on('ride:completed', ({ rideId, totalFareMAD }) => {
                if (this.activeRide?.id === rideId) this._onRideCompleted(totalFareMAD);
            });
            this.socket.on('ride:cancelled', ({ rideId }) => {
                if (this.activeRide?.id === rideId) this._onRideCancelled();
            });

            // Driver events
            this.socket.on('ride:new_request', (data) => {
                if (this.role === 'driver' && this.driverOnline) this._addRideRequest(data);
            });
            this.socket.on('ride:passenger_joined', (data) => {
                if (this.role === 'driver') {
                    this.toast(`+1 راكب انضم للرحلة (${data.passengerCount}/${this.activeRide?.maxPassengers || '?'})`, 'info');
                }
            });

            // Phase 3: Chat
            this.socket.on('chat:message', ({ rideId, from, text, ts }) => {
                if (this.activeRide?.id === rideId) {
                    this._appendChatMessage(from, text, ts, false);
                }
            });

        } catch (err) {
            console.warn('[Socket] Could not connect:', err.message);
        }
    }

    /* ══════════════════════════════════════════════════
       PHASE 3 — PREMIUM SYSTEM
    ══════════════════════════════════════════════════ */

    /** Injects premium modal + chat modal + shared rides modal dynamically */
    _injectDynamicModals() {
        // ── Premium payment modal ─────────────────────
        const premiumModal = document.createElement('div');
        premiumModal.id        = 'premium-modal';
        premiumModal.className = 'modal-overlay hidden';
        premiumModal.innerHTML = `
            <div class="modal-sheet premium-modal-sheet" role="dialog">
                <div class="modal-drag-handle"></div>
                <div class="modal-header">
                    <h2 id="premium-title-text"></h2>
                    <button class="btn-modal-close" id="premium-close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="premium-hero">
                    <i class="fa-solid fa-crown premium-crown-icon"></i>
                    <p id="premium-desc-text" class="premium-desc"></p>
                    <div class="premium-price-tag" id="premium-price-text"></div>
                    <ul class="premium-perks">
                        <li><i class="fa-solid fa-check-circle"></i> <span id="perk1"></span></li>
                        <li><i class="fa-solid fa-check-circle"></i> <span id="perk2"></span></li>
                        <li><i class="fa-solid fa-check-circle"></i> <span id="perk3"></span></li>
                    </ul>
                </div>

                <!-- Simulated credit card form -->
                <div class="cc-form" id="cc-form">
                    <!-- Card preview -->
                    <div class="cc-card-preview" id="cc-preview">
                        <div class="cc-preview-top">
                            <i class="fa-solid fa-credit-card"></i>
                            <span class="cc-chip"></span>
                        </div>
                        <div class="cc-preview-number" id="cc-number-preview">•••• •••• •••• ••••</div>
                        <div class="cc-preview-bottom">
                            <span id="cc-name-preview">CARDHOLDER NAME</span>
                            <span id="cc-expiry-preview">MM/YY</span>
                        </div>
                    </div>

                    <div class="field-group">
                        <label id="lbl-cc-number"></label>
                        <div class="field-wrap">
                            <i class="fa-solid fa-credit-card field-icon"></i>
                            <input type="text" id="cc-number" maxlength="19"
                                   placeholder="1234 5678 9012 3456" autocomplete="cc-number">
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label id="lbl-cc-expiry"></label>
                            <div class="field-wrap">
                                <i class="fa-solid fa-calendar field-icon"></i>
                                <input type="text" id="cc-expiry" maxlength="5"
                                       placeholder="MM/YY" autocomplete="cc-exp">
                            </div>
                        </div>
                        <div class="field-group">
                            <label id="lbl-cc-cvv"></label>
                            <div class="field-wrap">
                                <i class="fa-solid fa-lock field-icon"></i>
                                <input type="text" id="cc-cvv" maxlength="3"
                                       placeholder="•••" autocomplete="cc-csc">
                            </div>
                        </div>
                    </div>
                    <div class="field-group">
                        <label id="lbl-cc-name"></label>
                        <div class="field-wrap">
                            <i class="fa-solid fa-user field-icon"></i>
                            <input type="text" id="cc-name"
                                   placeholder="HASSAN BENALI" autocomplete="cc-name">
                        </div>
                    </div>
                    <button class="btn-primary btn-full btn-pay" id="btn-pay-premium">
                        <i class="fa-solid fa-lock"></i>
                        <span id="btn-pay-text"></span>
                    </button>
                    <div class="cc-security-note">
                        <i class="fa-solid fa-shield-halved"></i>
                        <span>Simulated payment — no real charge</span>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(premiumModal);

        // ── Chat widget (injected into active ride card later) ──
        const chatWidget = document.createElement('div');
        chatWidget.id        = 'chat-widget';
        chatWidget.className = 'chat-widget hidden';
        chatWidget.innerHTML = `
            <div class="chat-header">
                <i class="fa-solid fa-comments"></i>
                <span id="chat-title-text"></span>
                <button id="chat-toggle-btn" class="chat-toggle">
                    <i class="fa-solid fa-chevron-down"></i>
                </button>
            </div>
            <div class="chat-body" id="chat-body">
                <div class="chat-messages" id="chat-messages"></div>
                <div class="chat-input-row">
                    <input type="text" id="chat-input" class="chat-input"
                           id="chat-input-placeholder" maxlength="200">
                    <button id="btn-chat-send" class="btn-chat-send">
                        <i class="fa-solid fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(chatWidget);

        // ── Shared Rides panel for riders ─────────────
        const sharedPanel = document.createElement('div');
        sharedPanel.id        = 'shared-rides-modal';
        sharedPanel.className = 'modal-overlay hidden';
        sharedPanel.innerHTML = `
            <div class="modal-sheet" role="dialog">
                <div class="modal-drag-handle"></div>
                <div class="modal-header">
                    <h2 id="shared-rides-title-text"></h2>
                    <button class="btn-modal-close" id="shared-rides-close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <p id="shared-rides-sub-text" class="modal-subtitle"></p>
                <div id="shared-rides-list" class="shared-rides-list">
                    <div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i></div>
                </div>
            </div>
        `;
        document.body.appendChild(sharedPanel);

        // ── Driver rating modal (fires after completing ride) ──
        const driverRateModal = document.createElement('div');
        driverRateModal.id        = 'driver-rating-modal';
        driverRateModal.className = 'modal-overlay hidden';
        driverRateModal.innerHTML = `
            <div class="modal-sheet" role="dialog">
                <div class="modal-header">
                    <h2 id="driver-rating-title"></h2>
                </div>
                <div class="rating-driver-info">
                    <div class="rating-avatar"><i class="fa-solid fa-user"></i></div>
                    <div id="rating-passenger-name" class="rating-driver-name">—</div>
                </div>
                <div class="star-rating" id="driver-star-rating">
                    <button class="star-btn" data-val="1"><i class="fa-solid fa-star"></i></button>
                    <button class="star-btn" data-val="2"><i class="fa-solid fa-star"></i></button>
                    <button class="star-btn" data-val="3"><i class="fa-solid fa-star"></i></button>
                    <button class="star-btn" data-val="4"><i class="fa-solid fa-star"></i></button>
                    <button class="star-btn" data-val="5"><i class="fa-solid fa-star"></i></button>
                </div>
                <textarea id="driver-rating-comment" class="rating-comment" rows="3"
                          placeholder="تعليق اختياري…"></textarea>
                <button class="btn-primary btn-full" id="btn-submit-driver-rating">
                    <span></span><i class="fa-solid fa-paper-plane"></i>
                </button>
            </div>
        `;
        document.body.appendChild(driverRateModal);
    }

    /** Render the "Go Premium" button in driver status card */
    _renderPremiumButton() {
        const statsCard = document.querySelector('.driver-status-card');
        if (!statsCard) return;

        // Remove any existing button
        statsCard.querySelector('#btn-go-premium')?.remove();

        const isPremium = this.user?.premium?.active;

        const btn = document.createElement('button');
        btn.id = 'btn-go-premium';
        btn.className = isPremium ? 'btn-premium-active' : 'btn-go-premium';
        btn.innerHTML = isPremium
            ? `<i class="fa-solid fa-crown"></i> ${this._t('premium_badge')}`
            : `<i class="fa-solid fa-crown"></i> ${this._t('btn_go_premium')} — ${this._t('premium_price')}`;

        if (!isPremium) {
            btn.addEventListener('click', () => this._openPremiumModal());
        }
        statsCard.appendChild(btn);
    }

    _openPremiumModal() {
        const modal = document.getElementById('premium-modal');

        // Populate text in current language
        document.getElementById('premium-title-text').textContent  = this._t('premium_title');
        document.getElementById('premium-desc-text').textContent   = this._t('premium_desc');
        document.getElementById('premium-price-text').textContent  = this._t('premium_price');
        document.getElementById('lbl-cc-number').textContent  = this._t('premium_card_number');
        document.getElementById('lbl-cc-expiry').textContent  = this._t('premium_card_expiry');
        document.getElementById('lbl-cc-cvv').textContent     = this._t('premium_card_cvv');
        document.getElementById('lbl-cc-name').textContent    = this._t('premium_card_name');
        document.getElementById('btn-pay-text').textContent   = this._t('btn_pay');

        const perks = ['ظهور أولاً في نتائج البحث', 'شارة التحقق الذهبية', 'دعم متميز على مدار الساعة'];
        document.getElementById('perk1').textContent = perks[0];
        document.getElementById('perk2').textContent = perks[1];
        document.getElementById('perk3').textContent = perks[2];

        // Card number formatter
        const numberInput = document.getElementById('cc-number');
        numberInput.value = '';
        numberInput.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '').substring(0, 16);
            val = val.replace(/(.{4})/g, '$1 ').trim();
            e.target.value = val;
            document.getElementById('cc-number-preview').textContent =
                val || '•••• •••• •••• ••••';
        });

        document.getElementById('cc-expiry').addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '').substring(0, 4);
            if (val.length >= 3) val = val.substring(0, 2) + '/' + val.substring(2);
            e.target.value = val;
            document.getElementById('cc-expiry-preview').textContent = val || 'MM/YY';
        });

        document.getElementById('cc-name').addEventListener('input', (e) => {
            document.getElementById('cc-name-preview').textContent =
                e.target.value.toUpperCase() || 'CARDHOLDER NAME';
        });

        modal.classList.remove('hidden');

        document.getElementById('premium-close').onclick = () => modal.classList.add('hidden');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });

        document.getElementById('btn-pay-premium').onclick = () => this._processPremiumPayment();
    }

    async _processPremiumPayment() {
        const number  = document.getElementById('cc-number').value.replace(/\s/g, '');
        const expiry  = document.getElementById('cc-expiry').value;
        const cvv     = document.getElementById('cc-cvv').value;
        const name    = document.getElementById('cc-name').value.trim();

        if (number.length < 16 || !expiry || cvv.length < 3 || !name) {
            this.toast('يرجى ملء جميع بيانات البطاقة', 'warning');
            return;
        }

        const btn = document.getElementById('btn-pay-premium');
        btn.disabled = true;
        document.getElementById('btn-pay-text').textContent = this._t('premium_processing');

        try {
            // Call real backend endpoint (see driverController.activatePremium)
            await this.api('/drivers/me/premium', {
                method: 'POST',
                body: JSON.stringify({ plan: 'monthly' }),
            });

            // Update local user state
            if (this.user) {
                this.user.premium = {
                    active: true,
                    plan: 'monthly',
                    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
                };
            }

            document.getElementById('premium-modal').classList.add('hidden');
            this.toast(this._t('premium_success'), 'success', 5000);
            this._renderPremiumButton();
            this._updateNavUI();

        } catch (err) {
            this.toast(err.message, 'error');
            btn.disabled = false;
            document.getElementById('btn-pay-text').textContent = this._t('btn_pay');
        }
    }

    /* ══════════════════════════════════════════════════
       PHASE 3 — REAL-TIME CHAT
    ══════════════════════════════════════════════════ */
    _initChatUI(rideId) {
        const widget = document.getElementById('chat-widget');
        if (!widget) return;

        document.getElementById('chat-title-text').textContent = this._t('chat_title');
        document.getElementById('chat-input').placeholder = this._t('chat_placeholder');
        document.getElementById('chat-messages').innerHTML = '';
        this._chatMessages = [];

        // Attach to active ride card
        const rideCard = document.getElementById('active-ride-card');
        if (rideCard && !rideCard.contains(widget)) {
            rideCard.appendChild(widget);
        }

        widget.classList.remove('hidden');

        // Send button
        document.getElementById('btn-chat-send').onclick = () => {
            const input = document.getElementById('chat-input');
            const text  = input.value.trim();
            if (!text) return;
            this._sendChatMessage(text);
            input.value = '';
        };

        // Enter key
        document.getElementById('chat-input').onkeydown = (e) => {
            if (e.key === 'Enter') document.getElementById('btn-chat-send').click();
        };

        // Collapse / expand
        const toggle = document.getElementById('chat-toggle-btn');
        toggle.onclick = () => {
            const body = document.getElementById('chat-body');
            const collapsed = body.classList.toggle('chat-collapsed');
            toggle.querySelector('i').className =
                collapsed ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
        };
    }

    _sendChatMessage(text) {
        if (!this.socket || !this.activeRide) return;

        const ts  = new Date().toISOString();
        const msg = { rideId: this.activeRide.id, text, ts };

        // Emit to server — server will broadcast to the other party
        this.socket.emit('chat:message', msg);

        // Show own message immediately
        this._appendChatMessage(this.user?.fullName || 'You', text, ts, true);
    }

    _appendChatMessage(from, text, ts, isMine) {
        const msgs = document.getElementById('chat-messages');
        if (!msgs) return;

        const el = document.createElement('div');
        el.className = `chat-msg ${isMine ? 'chat-msg-mine' : 'chat-msg-theirs'}`;
        el.innerHTML = `
            <div class="chat-msg-bubble">${this._escapeHtml(text)}</div>
            <div class="chat-msg-meta">${isMine ? '' : `<strong>${this._escapeHtml(from)}</strong> · `}${this._formatTime(ts)}</div>
        `;
        msgs.appendChild(el);
        msgs.scrollTop = msgs.scrollHeight;
    }

    _escapeHtml(str) {
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    _formatTime(isoStr) {
        const d = new Date(isoStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /* ══════════════════════════════════════════════════
       PHASE 3 — SHARED RIDES
    ══════════════════════════════════════════════════ */
    _openSharedRidesModal() {
        const modal = document.getElementById('shared-rides-modal');
        document.getElementById('shared-rides-title-text').textContent = this._t('shared_rides_title');
        document.getElementById('shared-rides-sub-text').textContent   = this._t('shared_rides_sub');
        modal.classList.remove('hidden');

        document.getElementById('shared-rides-close').onclick = () =>
            modal.classList.add('hidden');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });

        this._loadAvailableSharedRides();
    }

    async _loadAvailableSharedRides() {
        const list = document.getElementById('shared-rides-list');
        list.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i></div>';

        try {
            const { lat, lng } = this.location;
            const data = await this.api(`/rides/shared/available?lat=${lat}&lng=${lng}&radius=5000`);
            const rides = data.rides || [];

            if (!rides.length) {
                list.innerHTML = `<div class="no-drivers">${this._t('no_shared_rides')}</div>`;
                return;
            }

            list.innerHTML = rides.map(r => {
                const origin = r.originLocation?.address || `${r.originLocation?.coordinates?.[1]?.toFixed(3)}, ${r.originLocation?.coordinates?.[0]?.toFixed(3)}`;
                const dest   = r.destinationLocation?.address || '—';
                const seats  = r.availableSeats ?? (r.maxPassengers - (r.activePassengerCount || 0));
                const distKm = r.pickupDistanceM ? (r.pickupDistanceM / 1000).toFixed(1) : '—';

                return `
                    <div class="shared-ride-card" data-ride-id="${r._id}">
                        <div class="shared-ride-route">
                            <div class="shared-route-from">
                                <i class="fa-solid fa-location-dot" style="color:#355872"></i> ${origin}
                            </div>
                            <div class="shared-route-to">
                                <i class="fa-solid fa-flag" style="color:#d93025"></i> ${dest}
                            </div>
                        </div>
                        <div class="shared-ride-meta">
                            <span class="shared-seats">
                                <i class="fa-solid fa-users"></i> ${seats} ${this._t('seats_available')}
                            </span>
                            <span class="shared-dist">${distKm} km</span>
                            <span class="shared-type badge-type">${r.carType || 'grand_taxi'}</span>
                        </div>
                        <button class="btn-join-ride btn-primary" data-ride-id="${r._id}">
                            ${this._t('btn_join_ride')}
                        </button>
                    </div>
                `;
            }).join('');

            list.querySelectorAll('.btn-join-ride').forEach(btn => {
                btn.addEventListener('click', () => this._joinSharedRide(btn.dataset.rideId));
            });

        } catch (err) {
            list.innerHTML = `<div class="no-drivers">${err.message}</div>`;
        }
    }

    async _joinSharedRide(rideId) {
        const pickup  = document.getElementById('pickup-input').value.trim();
        const dropoff = document.getElementById('dropoff-input').value.trim();

        if (!pickup || !dropoff) {
            this.toast('يرجى تحديد نقطة الانطلاق والوجهة أولاً', 'warning');
            document.getElementById('shared-rides-modal').classList.add('hidden');
            return;
        }

        const pickupLoc  = this.pickupMarker
            ? { lat: this.pickupMarker.getLatLng().lat, lng: this.pickupMarker.getLatLng().lng, address: pickup }
            : { lat: this.location.lat, lng: this.location.lng, address: pickup };

        const dropoffLoc = this.dropoffMarker
            ? { lat: this.dropoffMarker.getLatLng().lat, lng: this.dropoffMarker.getLatLng().lng, address: dropoff }
            : { lat: this.location.lat + 0.01, lng: this.location.lng + 0.01, address: dropoff };

        try {
            const data = await this.api(`/rides/${rideId}/join`, {
                method: 'POST',
                body: JSON.stringify({
                    pickupLocation:  pickupLoc,
                    dropoffLocation: dropoffLoc,
                    paymentMethod:   document.getElementById('payment-method').value,
                }),
            });

            this.activeRide = { id: rideId, pickup, dropoff, fare: data.fareMAD };

            if (this.socket) this.socket.emit('ride:join', { rideId });

            document.getElementById('shared-rides-modal').classList.add('hidden');
            this._showActiveRideCard(pickup, dropoff);
            document.getElementById('booking-card').classList.add('hidden');
            this._updateRideStatus('driver_found');
            this.toast(`انضممت للرحلة — ${data.fareMAD} MAD`, 'success');

        } catch (err) {
            this.toast(err.message || 'فشل الانضمام للرحلة', 'error');
        }
    }

    /* ══════════════════════════════════════════════════
       DRIVER — ONLINE / LOCATION / STATS
    ══════════════════════════════════════════════════ */
    async _toggleDriverOnline(online) {
        this.driverOnline = online;
        document.getElementById('online-label').textContent =
            this._t(online ? 'status_online' : 'status_offline');

        try {
            await this.api('/drivers/me/availability', {
                method: 'PATCH',
                body: JSON.stringify({ available: online, status: online ? 'online' : 'offline' }),
            });
        } catch {}

        if (online) {
            this._broadcastLocation();
            this._renderHeatmap();
        } else {
            this._toggleHeatmap(false);
        }
    }

    async _broadcastLocation() {
        if (!this.driverOnline || !this.tokens.access) return;
        try {
            await this.api('/drivers/me/location', {
                method: 'PATCH',
                body: JSON.stringify({ lat: this.location.lat, lng: this.location.lng }),
            });
        } catch {}
    }

    async _updateDriverStats() {
        try {
            const data = await this.api('/auth/me');
            const stats = data.stats || {};
            document.getElementById('stat-today').textContent  = stats.totalEarnedMAD || 0;
            document.getElementById('stat-rides').textContent  = stats.totalRides      || 0;
            document.getElementById('stat-rating').textContent = data.ratings?.average?.toFixed(1) || '—';
        } catch {}
    }

    /* ══════════════════════════════════════════════════
       RIDE REQUESTS (Driver)
    ══════════════════════════════════════════════════ */
    _addRideRequest(data) {
        const container = document.getElementById('ride-requests-list');
        container.querySelector('.empty-state')?.remove();

        const item = document.createElement('div');
        item.className = 'ride-request-item';
        item.dataset.rideId = data.rideId;
        item.innerHTML = `
            <div class="ride-req-route">${this._t('btn_request')} #${String(data.rideId).slice(-5)}</div>
            <div class="ride-req-meta">
                <span class="ride-req-fare">${data.fareMAD || '—'} MAD</span>
                <span class="ride-req-type">${data.carType || ''}</span>
                ${data.type === 'shared' ? '<span class="badge-shared">مشترك</span>' : ''}
            </div>
            <div class="ride-req-actions">
                <button class="btn-accept-ride" data-ride-id="${data.rideId}">
                    <i class="fa-solid fa-check"></i> قبول
                </button>
                <button class="btn-reject-ride" data-ride-id="${data.rideId}">رفض</button>
            </div>
        `;

        item.querySelector('.btn-accept-ride').addEventListener('click', () =>
            this._acceptRide(data.rideId, item));
        item.querySelector('.btn-reject-ride').addEventListener('click', () =>
            item.remove());

        container.prepend(item);
        this.toast('طلب ركوب جديد', 'info');
    }

    async _acceptRide(rideId, itemEl) {
        try {
            await this.api(`/rides/${rideId}/accept`, { method: 'PATCH', body: JSON.stringify({}) });
            itemEl.remove();
            this.activeRide = { id: rideId };
            this._updateRideStatus('driver_found');
            this._initChatUI(rideId);  // Phase 3: open chat for driver
            document.getElementById('active-ride-card').classList.remove('hidden');
            this.toast('تم قبول الرحلة', 'success');
        } catch (err) {
            this.toast(err.message, 'error');
        }
    }

    async _completeRide() {
        if (!this.activeRide) return;
        try {
            const data = await this.api(`/rides/${this.activeRide.id}/complete`, {
                method: 'PATCH',
                body: JSON.stringify({}),
            });
            this._updateRideStatus('completed');

            // Phase 3: driver rates the passenger after completing
            setTimeout(() => this._openDriverRatingModal(), 1500);

            this.toast(`اكتملت الرحلة — ${data.totalFareMAD} MAD`, 'success');
        } catch (err) {
            this.toast(err.message, 'error');
        }
    }

    /* ══════════════════════════════════════════════════
       RIDE REQUEST (Rider)
    ══════════════════════════════════════════════════ */
    async _requestRide() {
        const pickup  = document.getElementById('pickup-input').value.trim();
        const dropoff = document.getElementById('dropoff-input').value.trim();

        if (!pickup || !dropoff) {
            this.toast('يرجى تحديد نقطة الانطلاق والوجهة', 'warning');
            return;
        }

        const pickupLoc  = this.pickupMarker
            ? { lat: this.pickupMarker.getLatLng().lat, lng: this.pickupMarker.getLatLng().lng, address: pickup }
            : { lat: this.location.lat, lng: this.location.lng, address: pickup };

        const dropoffLoc = this.dropoffMarker
            ? { lat: this.dropoffMarker.getLatLng().lat, lng: this.dropoffMarker.getLatLng().lng, address: dropoff }
            : { lat: this.location.lat + 0.01, lng: this.location.lng + 0.01, address: dropoff };

        const payMethod = document.getElementById('payment-method').value;

        try {
            const data = await this.api('/rides', {
                method: 'POST',
                body: JSON.stringify({
                    pickupLocation:  pickupLoc,
                    dropoffLocation: dropoffLoc,
                    type:            this.selectedCarType === 'grand_taxi' ? 'shared' : 'private',
                    carType:         this.selectedCarType,
                    paymentMethod:   payMethod,
                }),
            });

            this.activeRide = {
                id:      data.rideId,
                pickup,
                dropoff,
                fare:    data.estimatedFareMAD,
            };

            if (this.socket) this.socket.emit('ride:join', { rideId: data.rideId });

            this._showActiveRideCard(pickup, dropoff);
            document.getElementById('booking-card').classList.add('hidden');

        } catch (err) {
            this.toast(err.message || 'فشل طلب الرحلة', 'error');
        }
    }

    _showActiveRideCard(pickup, dropoff) {
        const card = document.getElementById('active-ride-card');
        card.classList.remove('hidden');
        document.getElementById('route-mini-from').textContent = pickup;
        document.getElementById('route-mini-to').textContent   = dropoff;
        this._updateRideStatus('searching');
    }

    _updateRideStatus(status, driverId) {
        const statusMap = {
            searching:    { text: 'status_searching',    progress: 15, icon: 'fa-clock' },
            driver_found: { text: 'status_driver_found', progress: 45, icon: 'fa-car' },
            in_progress:  { text: 'status_in_progress',  progress: 70, icon: 'fa-road' },
            completed:    { text: 'status_completed',    progress: 100, icon: 'fa-check-circle' },
        };

        const s = statusMap[status];
        if (!s) return;

        document.getElementById('ride-status-text').textContent = this._t(s.text);
        document.getElementById('ride-status-icon').innerHTML   = `<i class="fa-solid ${s.icon}"></i>`;
        document.getElementById('ride-progress').style.width    = `${s.progress}%`;

        if (status === 'driver_found' && driverId) {
            this._loadDriverInfo(driverId);
        }
    }

    async _loadDriverInfo(driverId) {
        try {
            const d = await this.api(`/drivers/${driverId}`);
            const info = document.getElementById('ride-driver-info');
            info.classList.remove('hidden');
            document.getElementById('ride-driver-name').textContent =
                `${d.fullName}${d.isPremiumActive ? ' 👑' : ''}`;
            document.getElementById('ride-driver-car').textContent  =
                `${d.vehicle?.make} ${d.vehicle?.model}`;
            document.getElementById('ride-driver-rating').innerHTML =
                `<i class="fa-solid fa-star"></i> ${d.ratings?.average?.toFixed(1) || '—'}`;

            // Store for rating modal
            this.activeRide.driverName = d.fullName;
        } catch {}
    }

    _onRideCompleted(fareMAD) {
        this._updateRideStatus('completed');
        const fareEl = document.getElementById('ride-fare-final');
        fareEl.classList.remove('hidden');
        document.getElementById('final-fare-amount').textContent = `${fareMAD} MAD`;
        // Phase 4 — AI fare split for shared rides
        if (this.activeRide?.type === 'shared' && this.activeRide?.id) {
            setTimeout(() => this._triggerFareSplit(this.activeRide.id), 1000);
        }
        setTimeout(() => this._openRatingModal(), 2500);
    }

    _onRideCancelled() {
        document.getElementById('active-ride-card').classList.add('hidden');
        document.getElementById('booking-card').classList.remove('hidden');
        document.getElementById('chat-widget').classList.add('hidden');
        this.activeRide = null;
        this.toast('تم إلغاء الرحلة', 'warning');
    }

    async _cancelRide() {
        if (!this.activeRide) return;
        try {
            await this.api(`/rides/${this.activeRide.id}/cancel`, {
                method: 'PATCH',
                body: JSON.stringify({ note: 'Cancelled by rider' }),
            });
            this._onRideCancelled();
        } catch (err) {
            this.toast(err.message, 'error');
        }
    }

    /* ══════════════════════════════════════════════════
       RATINGS (Phase 3: both directions)
    ══════════════════════════════════════════════════ */

    /** Rider rates driver (fires after ride completed) */
    _openRatingModal() {
        const modal = document.getElementById('rating-modal');
        modal.classList.remove('hidden');
        if (this.activeRide?.driverName) {
            document.getElementById('rating-driver-name').textContent = this.activeRide.driverName;
        }
    }

    async _submitRating() {
        if (!this.activeRide || !this.selectedRating) {
            this.toast('يرجى اختيار تقييم', 'warning');
            return;
        }
        const comment = document.getElementById('rating-comment').value.trim();
        try {
            await this.api(`/rides/${this.activeRide.id}/rate`, {
                method: 'POST',
                body: JSON.stringify({ score: this.selectedRating, comment }),
            });
            document.getElementById('rating-modal').classList.add('hidden');
            document.getElementById('active-ride-card').classList.add('hidden');
            document.getElementById('chat-widget').classList.add('hidden');
            document.getElementById('booking-card').classList.remove('hidden');
            this.activeRide    = null;
            this.selectedRating = 0;
            this.toast('شكراً على تقييمك!', 'success');
        } catch (err) {
            this.toast(err.message, 'error');
        }
    }

    /** Phase 3: Driver rates passenger (fires after completeRide) */
    _openDriverRatingModal() {
        const modal = document.getElementById('driver-rating-modal');
        document.getElementById('driver-rating-title').textContent =
            this._t('rating_passenger_title');
        document.getElementById('driver-rating-modal')
            .querySelector('#btn-submit-driver-rating span').textContent =
            this._t('btn_submit_rating');

        let driverSelectedRating = 0;

        modal.querySelectorAll('.star-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.onclick = () => {
                driverSelectedRating = parseInt(btn.dataset.val);
                modal.querySelectorAll('.star-btn').forEach((s, i) => {
                    s.classList.toggle('active', i < driverSelectedRating);
                });
            };
        });

        document.getElementById('btn-submit-driver-rating').onclick = async () => {
            if (!driverSelectedRating) {
                this.toast('يرجى اختيار تقييم', 'warning');
                return;
            }
            const comment = document.getElementById('driver-rating-comment').value.trim();
            try {
                await this.api(`/rides/${this.activeRide.id}/rate`, {
                    method: 'POST',
                    body: JSON.stringify({ score: driverSelectedRating, comment }),
                });
                modal.classList.add('hidden');
                document.getElementById('active-ride-card').classList.add('hidden');
                document.getElementById('chat-widget').classList.add('hidden');
                this.activeRide = null;
                this._updateDriverStats();
                this.toast('تم إرسال التقييم', 'success');
            } catch (err) {
                this.toast(err.message, 'error');
            }
        };

        modal.classList.remove('hidden');
    }

    /* ── Fare Estimation ─────────────────────────────── */
    _estimateFare() {
        const pickup  = document.getElementById('pickup-input').value.trim();
        const dropoff = document.getElementById('dropoff-input').value.trim();
        if (!pickup || !dropoff) return;

        const fareTable = { economy: 3.5, comfort: 5.5, grand_taxi: 2, vip: 10, minibus: 1.5 };
        const base      = { economy: 10,  comfort: 15,  grand_taxi: 8, vip: 25, minibus: 50  };

        let distKm = 5;
        if (this.pickupMarker && this.dropoffMarker) {
            const p1 = this.pickupMarker.getLatLng();
            const p2 = this.dropoffMarker.getLatLng();
            distKm = this._haversineKm(p1.lat, p1.lng, p2.lat, p2.lng);
        }

        const perKm  = fareTable[this.selectedCarType] || fareTable.economy;
        const baseFr = base[this.selectedCarType]      || base.economy;
        const fare   = Math.max(Math.round(baseFr + distKm * perKm), 10);

        const est = document.getElementById('fare-estimate');
        est.classList.remove('hidden');
        document.getElementById('fare-amount').textContent = `${fare} MAD`;
        document.getElementById('fare-dist').textContent   = `${distKm.toFixed(1)} km`;
        document.getElementById('fare-eta').textContent    = `${Math.round(distKm * 3)} ${this.lang === 'ar' ? 'دقيقة' : 'min'}`;
    }

    _haversineKm(lat1, lng1, lat2, lng2) {
        const R    = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLng = ((lng2 - lng1) * Math.PI) / 180;
        const a    = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    /* ── Suggestions ─────────────────────────────────── */
    _renderSuggestionsPanel() {
        const tangierPlaces = [
            { icon: 'fa-landmark',      name: 'المدينة القديمة',      lat: 35.7882, lng: -5.8114 },
            { icon: 'fa-ship',          name: 'ميناء طنجة',           lat: 35.7908, lng: -5.8098 },
            { icon: 'fa-train',         name: 'محطة القطار',          lat: 35.7698, lng: -5.8290 },
            { icon: 'fa-plane',         name: 'مطار ابن بطوطة',       lat: 35.7261, lng: -5.9133 },
            { icon: 'fa-umbrella-beach',name: 'شاطئ طنجة',            lat: 35.7890, lng: -5.7720 },
            { icon: 'fa-hospital',      name: 'مستشفى محمد الخامس',   lat: 35.7710, lng: -5.8125 },
        ];

        const container = document.getElementById('suggestions');
        container.innerHTML = tangierPlaces.map(p => `
            <div class="suggestion-item" data-lat="${p.lat}" data-lng="${p.lng}" data-name="${p.name}">
                <i class="fa-solid ${p.icon}"></i>
                <span>${p.name}</span>
            </div>
        `).join('');

        container.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const lat = parseFloat(item.dataset.lat);
                const lng = parseFloat(item.dataset.lng);
                document.getElementById('dropoff-input').value = item.dataset.name;
                this._setDropoffMarker(lat, lng);
                this.map.setView([lat, lng], 15);
                this._estimateFare();
            });
        });
    }

    /* ── Settings ────────────────────────────────────── */
    _openSettings() {
        const modal = document.getElementById('settings-modal');
        modal.classList.remove('hidden');
        document.getElementById('dark-mode-toggle').checked = (this.theme === 'dark');
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === this.lang);
        });
        this._renderSOSContactsInSettings();
    }

    _closeSettings() {
        document.getElementById('settings-modal').classList.add('hidden');
    }

    _applyTheme(theme, persist = true) {
        this.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        if (persist) localStorage.setItem('tg_theme', theme);
        if (this.map) this._setTileLayer(theme);
    }

    _applyLang(lang, persist = true) {
        this.lang = lang;
        const isRTL = ['ar'].includes(lang);
        document.documentElement.setAttribute('lang',  lang);
        document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
        if (persist) localStorage.setItem('tg_lang', lang);
        this._translateDOM();
    }

    _t(key) {
        return (TRANSLATIONS[this.lang] || TRANSLATIONS.ar)[key] || (TRANSLATIONS.ar[key] || key);
    }

    _translateDOM() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            if (key) el.textContent = this._t(key);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.dataset.i18nPlaceholder;
            if (key) el.placeholder = this._t(key);
        });
    }

    /* ── SOS ─────────────────────────────────────────── */
    _openSOS() {
        const modal  = document.getElementById('sos-modal');
        const locText = document.getElementById('sos-location-text');
        locText.textContent = `${this.location.lat.toFixed(5)}, ${this.location.lng.toFixed(5)}`;

        const display = document.getElementById('sos-contacts-display');
        if (!this.sosContacts.length) {
            display.innerHTML = `<div class="sos-no-contacts"><i class="fa-solid fa-triangle-exclamation"></i> ${this._t('btn_add_contact')}</div>`;
        } else {
            display.innerHTML = this.sosContacts.map(c => `
                <div class="sos-contact-display-row">
                    <div class="sos-contact-display-name">${c.name}</div>
                    <div class="sos-contact-display-phone">${c.phone}</div>
                </div>
            `).join('');
        }
        modal.classList.remove('hidden');
    }

    _closeSOS() { document.getElementById('sos-modal').classList.add('hidden'); }

    async _sendSOSAlert() {
        this.toast('✅ تم إرسال تنبيه الطوارئ', 'success', 4000);
        this._closeSOS();
        if (this.sosContacts.length) {
            try {
                await this.api('/auth/me', {
                    method: 'PATCH',
                    body: JSON.stringify({ sosContacts: this.sosContacts }),
                });
            } catch {}
        }
    }

    _renderSOSContactsInSettings() {
        const list = document.getElementById('sos-contacts-list');
        if (!this.sosContacts.length) { list.innerHTML = ''; return; }
        list.innerHTML = this.sosContacts.map((c, i) => `
            <div class="sos-contact-row">
                <div class="sos-contact-name">${c.name}</div>
                <div class="sos-contact-phone">${c.phone}</div>
                <button class="btn-remove-contact" data-idx="${i}">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `).join('');

        list.querySelectorAll('.btn-remove-contact').forEach(btn => {
            btn.addEventListener('click', () => {
                this.sosContacts.splice(parseInt(btn.dataset.idx), 1);
                localStorage.setItem('tg_sos', JSON.stringify(this.sosContacts));
                this._renderSOSContactsInSettings();
            });
        });
    }

    _addSOSContact() {
        if (this.sosContacts.length >= 3) {
            this.toast('الحد الأقصى 3 جهات اتصال', 'warning');
            return;
        }
        const name  = prompt(this.lang === 'ar' ? 'اسم جهة الاتصال:' : 'Contact name:');
        if (!name) return;
        const phone = prompt(this.lang === 'ar' ? 'رقم الهاتف:' : 'Phone number:');
        if (!phone) return;

        this.sosContacts.push({ name: name.trim(), phone: phone.trim() });
        localStorage.setItem('tg_sos', JSON.stringify(this.sosContacts));
        this._renderSOSContactsInSettings();
    }

    /* ── Logout ──────────────────────────────────────── */
    async _logout() {
        try { await this.api('/auth/logout', { method: 'POST' }); } catch {}
        if (this.socket) this.socket.disconnect();
        if (this._clockInterval)      clearInterval(this._clockInterval);
        if (this._driverPollInterval) clearInterval(this._driverPollInterval);
        this._clearTokens();
        this.user = null;
        location.reload();
    }

    /* ── Toast ───────────────────────────────────────── */
    toast(msg, type = 'info', duration = 3000) {
        const icons = {
            success: 'fa-check-circle', error: 'fa-circle-xmark',
            info: 'fa-circle-info', warning: 'fa-triangle-exclamation',
        };
        const container = document.getElementById('toast-container');
        const el = document.createElement('div');
        el.className = `toast toast-${type}`;
        el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span class="toast-msg">${msg}</span>`;
        container.appendChild(el);
        setTimeout(() => {
            el.classList.add('hiding');
            setTimeout(() => el.remove(), 280);
        }, duration);
    }

    /* ══════════════════════════════════════════════════
       BIND ALL APP EVENTS
    ══════════════════════════════════════════════════ */
    _bindAppEvents() {
        // Map controls
        document.getElementById('btn-locate').addEventListener('click', () =>
            this.map.setView([this.location.lat, this.location.lng], 15));
        document.getElementById('btn-zoom-in').addEventListener('click',  () => this.map.zoomIn());
        document.getElementById('btn-zoom-out').addEventListener('click', () => this.map.zoomOut());

        // GPS button
        document.getElementById('btn-use-gps')?.addEventListener('click', () => {
            const pickInput = document.getElementById('pickup-input');
            pickInput.value = `${this.location.lat.toFixed(5)}, ${this.location.lng.toFixed(5)}`;
            this._setPickupMarker(this.location.lat, this.location.lng);
            this.map.setView([this.location.lat, this.location.lng], 15);
            this._estimateFare();
        });

        document.getElementById('dropoff-input')?.addEventListener('change', () =>
            this._estimateFare());

        // Ride type buttons
        document.querySelectorAll('.ride-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.ride-type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedCarType = btn.dataset.type;
                this._estimateFare();
                if (this.role === 'rider') this._loadNearbyDrivers();
            });
        });

        // Request ride
        document.getElementById('btn-request-ride')?.addEventListener('click', () =>
            this._requestRide());

        // Cancel ride
        document.getElementById('btn-cancel-ride')?.addEventListener('click', () =>
            this._cancelRide());

        // Phase 3: Find shared rides button (add if not exists)
        this._injectFindSharedBtn();

        // Settings
        document.getElementById('btn-settings').addEventListener('click',  () => this._openSettings());
        document.getElementById('settings-close').addEventListener('click', () => this._closeSettings());
        document.getElementById('settings-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this._closeSettings();
        });

        // Dark mode
        document.getElementById('dark-mode-toggle').addEventListener('change', (e) =>
            this._applyTheme(e.target.checked ? 'dark' : 'light'));

        // Language
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._applyLang(btn.dataset.lang);
                document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._updateNavUI();
                this._renderSuggestionsPanel();
            });
        });

        // SOS contacts
        document.getElementById('btn-add-sos')?.addEventListener('click', () => this._addSOSContact());

        // Logout
        document.getElementById('btn-logout').addEventListener('click', () => this._logout());

        // SOS
        document.getElementById('btn-sos').addEventListener('click',       () => this._openSOS());
        document.getElementById('btn-sos-cancel').addEventListener('click', () => this._closeSOS());
        document.getElementById('btn-sos-confirm').addEventListener('click', () => this._sendSOSAlert());
        document.getElementById('sos-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this._closeSOS();
        });

        // Rider rating stars
        document.querySelectorAll('#star-rating .star-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedRating = parseInt(btn.dataset.val);
                document.querySelectorAll('#star-rating .star-btn').forEach((s, i) => {
                    s.classList.toggle('active', i < this.selectedRating);
                });
            });
        });
        document.getElementById('btn-submit-rating')?.addEventListener('click', () =>
            this._submitRating());

        // Driver toggles
        document.getElementById('online-toggle')?.addEventListener('change', (e) =>
            this._toggleDriverOnline(e.target.checked));
        document.getElementById('heatmap-toggle')?.addEventListener('change', (e) =>
            this._toggleHeatmap(e.target.checked));
    }

    /** Inject "Find shared ride" button below the booking card for riders */
    _injectFindSharedBtn() {
        if (this.role !== 'rider') return;
        if (document.getElementById('btn-find-shared')) return;

        const btn = document.createElement('button');
        btn.id        = 'btn-find-shared';
        btn.className = 'btn-shared-rides';
        btn.innerHTML = `<i class="fa-solid fa-users"></i> <span>${this._t('btn_find_shared')}</span>`;
        btn.addEventListener('click', () => this._openSharedRidesModal());

        const bookingCard = document.getElementById('booking-card');
        if (bookingCard) bookingCard.after(btn);
    }

    /* ══════════════════════════════════════════════════
       PHASE 4 — AI INTEGRATION (Grok)
    ══════════════════════════════════════════════════ */

    // ── Boot AI state ─────────────────────────────────
    _initAI() {
        this._aiHistory    = [];   // multi-turn conversation [{role, content}]
        this._aiTypingEl   = null; // typing-indicator DOM node
        this._aiRouteCache = null; // last smart-route result
        this._aiRouteDebounce = null;
    }

    // ── Open AI assistant modal ───────────────────────
    _openAIModal() {
        const modal = document.getElementById('ai-modal');
        if (!modal) return;

        // Populate language-aware strings
        const brandName = document.getElementById('ai-brand-name');
        const brandSub  = document.getElementById('ai-brand-sub');
        const aiInput   = document.getElementById('ai-input');
        if (brandName) brandName.textContent = this._t('ai_brand_name');
        if (brandSub)  brandSub.textContent  = this._t('ai_brand_sub');
        if (aiInput)   aiInput.placeholder   = this._t('ai_placeholder');

        this._renderAISuggestions();

        // Welcome message on first open
        const msgs = document.getElementById('ai-messages');
        if (msgs && !msgs.children.length) {
            this._appendAIMessage('bot', this._t('ai_welcome'));
        }

        modal.classList.remove('hidden');
        setTimeout(() => document.getElementById('ai-input')?.focus(), 200);

        // Close on backdrop click (one-time listener each open)
        const backdropHandler = (e) => {
            if (e.target === modal) { this._closeAIModal(); modal.removeEventListener('click', backdropHandler); }
        };
        modal.addEventListener('click', backdropHandler);
    }

    _closeAIModal() {
        document.getElementById('ai-modal')?.classList.add('hidden');
    }

    // ── Render suggestion chips (language-aware) ──────
    _renderAISuggestions() {
        const container = document.getElementById('ai-suggestions');
        if (!container) return;

        // Prompt text per language (not in TRANSLATIONS to keep them concise)
        const langPrompts = {
            ar: [
                'ما هو أفضل طريق من المدينة القديمة إلى المطار الآن؟',
                'كم تبلغ أجرة رحلة من المدينة إلى شاطئ طنجة تقريباً؟',
                'كيف تعمل الرحلات المشتركة في TaxiGo؟',
                'كيف أحجز رحلة في التطبيق؟',
                'ماذا أفعل في حالة الطوارئ أثناء الرحلة؟',
            ],
            fr: [
                'Quel est le meilleur itinéraire de la médina à l\'aéroport maintenant ?',
                'Combien coûte environ un trajet de la ville à la plage de Tanger ?',
                'Comment fonctionnent les trajets partagés sur TaxiGo ?',
                'Comment réserver une course dans l\'application ?',
                'Que faire en cas d\'urgence pendant la course ?',
            ],
            en: [
                'What is the best route from the medina to the airport right now?',
                'How much is a trip from the city centre to Tangier beach approximately?',
                'How do shared rides work on TaxiGo?',
                'How do I book a ride in the app?',
                'What should I do in an emergency during a ride?',
            ],
            es: [
                '¿Cuál es la mejor ruta de la medina al aeropuerto ahora mismo?',
                '¿Cuánto cuesta aproximadamente un viaje del centro a la playa de Tánger?',
                '¿Cómo funcionan los viajes compartidos en TaxiGo?',
                '¿Cómo reservo un viaje en la app?',
                '¿Qué hago en caso de emergencia durante el viaje?',
            ],
            de: [
                'Was ist jetzt die beste Route von der Medina zum Flughafen?',
                'Was kostet ungefähr eine Fahrt vom Stadtzentrum zum Strand von Tanger?',
                'Wie funktionieren geteilte Fahrten bei TaxiGo?',
                'Wie buche ich eine Fahrt in der App?',
                'Was soll ich in einem Notfall während der Fahrt tun?',
            ],
        };

        const chipKeys = ['ai_chip_route','ai_chip_fare','ai_chip_shared','ai_chip_help','ai_chip_sos'];
        const prompts  = langPrompts[this.lang] || langPrompts.en;

        container.innerHTML = chipKeys.map((key, i) => `
            <button class="ai-suggestion-chip" data-prompt="${this._escapeHtml(prompts[i] || '')}">
                ${this._t(key)}
            </button>
        `).join('');

        container.querySelectorAll('.ai-suggestion-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const p = chip.dataset.prompt;
                if (p) { this._openAIModal(); this._sendAIMessage(p); }
            });
        });
    }

    // ── Send a message (user text or chip) ────────────
    async _sendAIMessage(text) {
        if (!text?.trim()) return;

        const input   = document.getElementById('ai-input');
        const sendBtn = document.getElementById('btn-ai-send');
        if (input)   { input.value = ''; input.style.height = 'auto'; }
        if (sendBtn) sendBtn.disabled = true;

        this._appendAIMessage('user', text);
        this._showAITyping();

        try {
            const res = await fetch('/api/ai/chat', {
                method:  'POST',
                headers: {
                    'Content-Type':  'application/json',
                    // ✅ الحل — يقرأ مباشرة من localStorage
                    'Authorization': `Bearer ${this.tokens.access || localStorage.getItem('tg_access')}`,
                },
                body: JSON.stringify({
                    message: text.trim(),
                    history: this._aiHistory.slice(-10),
                }),
            });

            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error || this._t('ai_error'));

            const reply = json.data.reply;
            this._hideAITyping();
            this._appendAIMessage('bot', reply);

            // Store conversation turns for context
            this._aiHistory.push({ role: 'user',      content: text });
            this._aiHistory.push({ role: 'assistant', content: reply });

        } catch (err) {
            this._hideAITyping();
            this._appendAIMessage('bot', `${this._t('ai_error')} (${err.message})`);
        } finally {
            if (sendBtn) sendBtn.disabled = false;
        }
    }

    // ── Render a chat bubble ──────────────────────────
    _appendAIMessage(role, text) {
        const msgs = document.getElementById('ai-messages');
        if (!msgs) return;

        const isUser = role === 'user';
        const el     = document.createElement('div');
        el.className = `ai-msg ${isUser ? 'ai-msg-user' : 'ai-msg-bot'}`;
        el.innerHTML = `
            <div class="ai-msg-icon">
                <i class="fa-solid ${isUser ? 'fa-user' : 'fa-robot'}"></i>
            </div>
            <div class="ai-msg-bubble">${this._escapeHtml(text).replace(/\n/g, '<br>')}</div>
        `;
        msgs.appendChild(el);
        msgs.scrollTop = msgs.scrollHeight;
        return el;
    }

    // ── Typing indicator ──────────────────────────────
    _showAITyping() {
        const msgs = document.getElementById('ai-messages');
        if (!msgs) return;
        this._hideAITyping();
        const el = document.createElement('div');
        el.id        = 'ai-typing-indicator';
        el.className = 'ai-msg ai-msg-bot';
        el.innerHTML = `
            <div class="ai-msg-icon"><i class="fa-solid fa-robot"></i></div>
            <div class="ai-msg-bubble">
                <div class="ai-typing-dots"><span></span><span></span><span></span></div>
            </div>
        `;
        msgs.appendChild(el);
        msgs.scrollTop = msgs.scrollHeight;
        this._aiTypingEl = el;
    }

    _hideAITyping() {
        this._aiTypingEl?.remove();
        document.getElementById('ai-typing-indicator')?.remove();
        this._aiTypingEl = null;
    }

    // ── Smart Route — auto-trigger on input blur ──────
    async _triggerSmartRoute() {
        if (!this.tokens.access) return;

        const pickupVal  = document.getElementById('pickup-input')?.value?.trim();
        const dropoffVal = document.getElementById('dropoff-input')?.value?.trim();
        if (!pickupVal || !dropoffVal) return;

        const pickup = this.pickupMarker
            ? { lat: this.pickupMarker.getLatLng().lat, lng: this.pickupMarker.getLatLng().lng, address: pickupVal }
            : { lat: this.location.lat, lng: this.location.lng, address: pickupVal };

        const dropoff = this.dropoffMarker
            ? { lat: this.dropoffMarker.getLatLng().lat, lng: this.dropoffMarker.getLatLng().lng, address: dropoffVal }
            : { lat: this.location.lat + 0.01, lng: this.location.lng + 0.01, address: dropoffVal };

        try {
            const res  = await fetch('/api/ai/route', {
                method:  'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${this.tokens.access}`,
                },
                body: JSON.stringify({ pickup, dropoff }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) return; // non-critical: silently skip

            this._aiRouteCache = json.data;
            this._renderAIRouteCard(json.data);

        } catch { /* silently skip — this is a non-critical enhancement */ }
    }

    // ── Render the AI route card in the booking panel ─
    _renderAIRouteCard(data) {
        const card = document.getElementById('ai-route-card');
        if (!card) return;

        const trafficLabels = {
            low:    this._t('ai_traffic_low'),
            medium: this._t('ai_traffic_med'),
            high:   this._t('ai_traffic_high'),
        };
        const trafficColors = { low: '#2da84f', medium: '#e8a020', high: '#d93025' };
        const traffic = data.traffic || 'low';

        const labelEl   = document.getElementById('ai-route-label');
        const bodyEl    = document.getElementById('ai-route-body');
        const distEl    = document.getElementById('ai-route-dist');
        const etaEl     = document.getElementById('ai-route-eta');
        const trafficEl = document.getElementById('ai-route-traffic');

        if (labelEl)   labelEl.textContent   = this._t('ai_route_label');
        if (bodyEl)    bodyEl.textContent     = data.route    || '—';
        if (distEl)    distEl.textContent     = `${data.distanceKm  ?? '—'} km`;
        if (etaEl)     etaEl.textContent      = `${data.durationMin ?? '—'} min`;
        if (trafficEl) {
            trafficEl.textContent  = trafficLabels[traffic] || traffic;
            trafficEl.style.color  = trafficColors[traffic] || '';
        }

        card.classList.remove('hidden');
    }

    // ── AI Fare Split — called after shared ride ends ─
    async _triggerFareSplit(rideId) {
        if (!rideId || !this.tokens.access) return;
        try {
            const res  = await fetch('/api/ai/split', {
                method:  'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${this.tokens.access}`,
                },
                body: JSON.stringify({ rideId }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) return;

            this._renderAIFareSplit(json.data);

        } catch { /* non-critical */ }
    }

    // ── Render the AI fare split inside the ride card ─
    _renderAIFareSplit(splits) {
        if (!Array.isArray(splits) || !splits.length) return;

        const rideCard = document.getElementById('active-ride-card');
        if (!rideCard) return;

        // Remove any previous split card
        rideCard.querySelector('.ai-split-card')?.remove();

        const el = document.createElement('div');
        el.className = 'ai-split-card';
        el.innerHTML = `
            <div class="ai-split-header">
                <i class="fa-solid faL-robot"></i>
                <span>${this._t('ai_split_title')}</span>
            </div>
            ${splits.map(p => `
                <div class="ai-split-row">
                    <span class="ai-split-name">${this._escapeHtml(p.name || 'Passenger')}</span>
                    <span class="ai-split-pct">${Math.round((p.proportion || 0) * 100)}%</span>
                    <span class="ai-split-fare">${p.fareMAD ?? '—'} MAD</span>
                </div>
                ${p.note ? `<div style="font-size:11px;color:var(--text-3);padding:0 4px 4px;line-height:1.4;">${this._escapeHtml(p.note)}</div>` : ''}
            `).join('')}
        `;

        rideCard.appendChild(el);
    }

    // ── Wire all AI events ────────────────────────────
    _bindAIEvents() {
        // Floating AI button
        document.getElementById('btn-ai-assistant')?.addEventListener('click', () =>
            this._openAIModal());

        // Close button inside modal
        document.getElementById('ai-modal-close')?.addEventListener('click', () =>
            this._closeAIModal());

        // Send on button click
        document.getElementById('btn-ai-send')?.addEventListener('click', () => {
            const text = document.getElementById('ai-input')?.value?.trim();
            if (text) this._sendAIMessage(text);
        });

        // Send on Enter (Shift+Enter = newline)
        document.getElementById('ai-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const text = e.target.value.trim();
                if (text) this._sendAIMessage(text);
            }
        });

        // Auto-resize textarea as user types
        document.getElementById('ai-input')?.addEventListener('input', (e) => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
        });

        // Smart Route — debounced trigger when both inputs are filled
        const routeTrigger = () => {
            clearTimeout(this._aiRouteDebounce);
            this._aiRouteDebounce = setTimeout(() => this._triggerSmartRoute(), 1200);
        };
        document.getElementById('pickup-input')?.addEventListener('change', routeTrigger);
        document.getElementById('dropoff-input')?.addEventListener('change', routeTrigger);
        document.getElementById('pickup-input')?.addEventListener('blur',   routeTrigger);
        document.getElementById('dropoff-input')?.addEventListener('blur',  routeTrigger);
    }
}

/* ══════════════════════════════════════════════════════════
   BOOTSTRAP
══════════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
    window.app = new TaxiGoApp();
});
