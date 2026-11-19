// Bundled UI translations. Keys missing in a language fall back to English.
const en = {
  app: { name: 'UnifiedTree', tagline: 'One platform from first day of school to PhD' },
  nav: {
    dashboard: 'Dashboard', learners: 'Learners', staff: 'Staff', academics: 'Academics', timetable: 'Timetable',
    attendance: 'Attendance', research: 'Research & PhD', settings: 'Settings', audit: 'Audit log', tenants: 'Institutions',
    frameworks: 'Framework packs', languages: 'Languages', myTimetable: 'My timetable', myAttendance: 'My attendance',
    children: 'My children', profile: 'My profile', roadmap: 'Coming next',
    admissions: 'Admissions', exams: 'Exams & gradebook', gradebook: 'Gradebook', results: 'Results', fees: 'Fees', communication: 'Communication', library: 'Library',
    learn: 'Learn', myClasses: 'My classes', insights: 'AI insights',
    credentials: 'Credentials', wallet: 'Credential wallet',
  },
  common: {
    search: 'Search', save: 'Save', cancel: 'Cancel', add: 'Add', edit: 'Edit', signOut: 'Sign out', language: 'Language',
    today: 'Today', loading: 'Loading…', noData: 'Nothing here yet', viewAll: 'View all', all: 'All', present: 'Present',
    absent: 'Absent', late: 'Late', excused: 'Excused', total: 'Total', status: 'Status', name: 'Name', section: 'Section',
    programme: 'Programme', level: 'Level', theme: 'Theme', back: 'Back', previous: 'Previous', next: 'Next', close: 'Close',
  },
  login: {
    title: 'Sign in to UnifiedTree', subtitle: 'Demo mode — pick an institution and a role. No password needed.',
    chooseInstitution: 'Choose an institution', chooseRole: 'Choose who you are', platform: 'Platform operator',
    reset: 'Reset demo data', resetDone: 'Demo data has been reset',
  },
  dash: {
    welcome: 'Welcome, {{name}}', learners: 'Active learners', staff: 'Staff', programmes: 'Programmes', sections: 'Sections',
    avgAttendance: 'Average attendance', attendanceTrend: 'Attendance — last 14 working days', byLevel: 'Learners by level',
    atRisk: 'Early-warning: learners at risk', todaysClasses: "Today's classes", noClasses: 'No classes scheduled today',
    markedToday: 'Attendance marked today', gender: 'Gender mix', recent: 'Recent activity',
  },
  att: {
    mark: 'Mark attendance', markAll: 'Mark all present', saved: 'Attendance saved', date: 'Date', notMarked: 'Not marked',
    marked: 'Marked', holiday: 'Not a working day',
  },
  kids: { hello: 'Hi {{name}}!', myDay: 'My day', myAttendance: 'My stars', great: 'Great job coming to school!' },
  roles: { SUPER_ADMIN: 'Super admin', INST_ADMIN: 'Institution admin', FACULTY: 'Faculty', STUDENT: 'Learner', GUARDIAN: 'Parent / guardian' },
  levels: {
    PRE_PRIMARY: 'Pre-primary', PRIMARY: 'Primary', MIDDLE: 'Middle school', SECONDARY: 'Secondary', SENIOR_SECONDARY: 'Senior secondary',
    DIPLOMA: 'Diploma', UG: 'Undergraduate', PG: 'Postgraduate', PHD: 'Doctoral (PhD)', VOCATIONAL: 'Vocational',
  },
}

type Dict = { [k: string]: string | Dict }

const hi: Dict = {
  app: { tagline: 'स्कूल के पहले दिन से पीएचडी तक एक ही प्लेटफ़ॉर्म' },
  nav: {
    dashboard: 'डैशबोर्ड', learners: 'विद्यार्थी', staff: 'स्टाफ़', academics: 'शैक्षणिक', timetable: 'समय सारणी', attendance: 'उपस्थिति',
    research: 'शोध और पीएचडी', settings: 'सेटिंग्स', audit: 'ऑडिट लॉग', tenants: 'संस्थान', frameworks: 'फ्रेमवर्क पैक', languages: 'भाषाएँ',
    myTimetable: 'मेरी समय सारणी', myAttendance: 'मेरी उपस्थिति', children: 'मेरे बच्चे', profile: 'मेरी प्रोफ़ाइल', roadmap: 'आगे आने वाला',
    admissions: 'प्रवेश', exams: 'परीक्षा और अंक', gradebook: 'अंक पुस्तिका', results: 'परिणाम', fees: 'शुल्क', communication: 'संवाद', library: 'पुस्तकालय',
    learn: 'सीखें', myClasses: 'मेरी कक्षाएँ', insights: 'एआई अंतर्दृष्टि',
    credentials: 'प्रमाणपत्र', wallet: 'प्रमाणपत्र वॉलेट',
  },
  common: {
    search: 'खोजें', save: 'सहेजें', cancel: 'रद्द करें', add: 'जोड़ें', edit: 'संपादित करें', signOut: 'साइन आउट', language: 'भाषा', today: 'आज',
    loading: 'लोड हो रहा है…', noData: 'अभी कुछ नहीं है', viewAll: 'सभी देखें', all: 'सभी', present: 'उपस्थित', absent: 'अनुपस्थित', late: 'देर से',
    excused: 'छुट्टी', total: 'कुल', status: 'स्थिति', name: 'नाम', section: 'सेक्शन', programme: 'कार्यक्रम', level: 'स्तर', theme: 'थीम', back: 'वापस',
    previous: 'पिछला', next: 'अगला', close: 'बंद करें',
  },
  login: {
    title: 'UnifiedTree में साइन इन करें', subtitle: 'डेमो मोड — संस्थान और भूमिका चुनें। पासवर्ड की ज़रूरत नहीं।',
    chooseInstitution: 'संस्थान चुनें', chooseRole: 'अपनी भूमिका चुनें', platform: 'प्लेटफ़ॉर्म संचालक', reset: 'डेमो डेटा रीसेट करें', resetDone: 'डेमो डेटा रीसेट हो गया',
  },
  dash: {
    welcome: 'स्वागत है, {{name}}', learners: 'सक्रिय विद्यार्थी', staff: 'स्टाफ़', programmes: 'कार्यक्रम', sections: 'सेक्शन', avgAttendance: 'औसत उपस्थिति',
    attendanceTrend: 'उपस्थिति — पिछले 14 कार्य दिवस', byLevel: 'स्तर के अनुसार विद्यार्थी', atRisk: 'पूर्व चेतावनी: जोखिम वाले विद्यार्थी',
    todaysClasses: 'आज की कक्षाएँ', noClasses: 'आज कोई कक्षा नहीं', markedToday: 'आज उपस्थिति दर्ज', gender: 'लिंग अनुपात', recent: 'हाल की गतिविधि',
  },
  att: { mark: 'उपस्थिति दर्ज करें', markAll: 'सभी को उपस्थित करें', saved: 'उपस्थिति सहेजी गई', date: 'तारीख', notMarked: 'दर्ज नहीं', marked: 'दर्ज', holiday: 'कार्य दिवस नहीं' },
  kids: { hello: 'नमस्ते {{name}}!', myDay: 'मेरा दिन', myAttendance: 'मेरे सितारे', great: 'स्कूल आने के लिए शाबाश!' },
  roles: { SUPER_ADMIN: 'सुपर एडमिन', INST_ADMIN: 'संस्थान एडमिन', FACULTY: 'शिक्षक', STUDENT: 'विद्यार्थी', GUARDIAN: 'अभिभावक' },
  levels: {
    PRE_PRIMARY: 'पूर्व-प्राथमिक', PRIMARY: 'प्राथमिक', MIDDLE: 'माध्यमिक (मिडिल)', SECONDARY: 'माध्यमिक', SENIOR_SECONDARY: 'उच्च माध्यमिक',
    DIPLOMA: 'डिप्लोमा', UG: 'स्नातक', PG: 'स्नातकोत्तर', PHD: 'डॉक्टरेट (पीएचडी)', VOCATIONAL: 'व्यावसायिक',
  },
}

const ta: Dict = {
  app: { tagline: 'பள்ளியின் முதல் நாள் முதல் முனைவர் பட்டம் வரை ஒரே தளம்' },
  nav: {
    dashboard: 'முகப்பு', learners: 'மாணவர்கள்', staff: 'பணியாளர்கள்', academics: 'கல்வி', timetable: 'கால அட்டவணை', attendance: 'வருகை',
    research: 'ஆராய்ச்சி & முனைவர்', settings: 'அமைப்புகள்', audit: 'தணிக்கை பதிவு', tenants: 'நிறுவனங்கள்', languages: 'மொழிகள்',
    myTimetable: 'என் கால அட்டவணை', myAttendance: 'என் வருகை', children: 'என் குழந்தைகள்',
    admissions: 'சேர்க்கை', exams: 'தேர்வுகள்', results: 'முடிவுகள்', fees: 'கட்டணம்', communication: 'தகவல் தொடர்பு', library: 'நூலகம்',
    learn: 'கற்றல்', myClasses: 'என் வகுப்புகள்', insights: 'AI நுண்ணறிவு',
    credentials: 'சான்றிதழ்கள்', wallet: 'சான்றிதழ் பணப்பை',
  },
  common: { search: 'தேடு', save: 'சேமி', cancel: 'ரத்து', add: 'சேர்', signOut: 'வெளியேறு', language: 'மொழி', today: 'இன்று', loading: 'ஏற்றுகிறது…', present: 'வருகை', absent: 'வரவில்லை', late: 'தாமதம்', name: 'பெயர்', section: 'பிரிவு' },
  login: { title: 'UnifiedTree-இல் உள்நுழைக', chooseInstitution: 'நிறுவனத்தைத் தேர்வுசெய்க', chooseRole: 'உங்கள் பங்கைத் தேர்வுசெய்க' },
  dash: { welcome: 'வரவேற்கிறோம், {{name}}', learners: 'செயலில் உள்ள மாணவர்கள்', avgAttendance: 'சராசரி வருகை', todaysClasses: 'இன்றைய வகுப்புகள்', atRisk: 'முன்னெச்சரிக்கை: ஆபத்தில் உள்ள மாணவர்கள்' },
  att: { mark: 'வருகையைப் பதிவு செய்', markAll: 'அனைவரும் வருகை', saved: 'வருகை சேமிக்கப்பட்டது' },
  kids: { hello: 'வணக்கம் {{name}}!', myDay: 'என் நாள்', myAttendance: 'என் நட்சத்திரங்கள்', great: 'பள்ளிக்கு வந்ததற்கு பாராட்டுகள்!' },
  roles: { INST_ADMIN: 'நிறுவன நிர்வாகி', FACULTY: 'ஆசிரியர்', STUDENT: 'மாணவர்', GUARDIAN: 'பெற்றோர்' },
}

const te: Dict = {
  app: { tagline: 'బడిలో మొదటి రోజు నుండి పీహెచ్‌డీ వరకు ఒకే వేదిక' },
  nav: {
    dashboard: 'డాష్‌బోర్డ్', learners: 'విద్యార్థులు', staff: 'సిబ్బంది', academics: 'విద్యా వ్యవహారాలు', timetable: 'టైమ్‌టేబుల్', attendance: 'హాజరు',
    research: 'పరిశోధన & పీహెచ్‌డీ', settings: 'సెట్టింగ్‌లు', languages: 'భాషలు', myTimetable: 'నా టైమ్‌టేబుల్', myAttendance: 'నా హాజరు', children: 'నా పిల్లలు',
    admissions: 'ప్రవేశాలు', exams: 'పరీక్షలు', results: 'ఫలితాలు', fees: 'ఫీజులు', communication: 'సమాచారం', library: 'గ్రంథాలయం',
    learn: 'నేర్చుకోండి', myClasses: 'నా తరగతులు', insights: 'AI అంతర్దృష్టులు',
    credentials: 'ధృవపత్రాలు', wallet: 'ధృవపత్రాల వాలెట్',
  },
  common: { search: 'వెతకండి', save: 'సేవ్ చేయండి', cancel: 'రద్దు', add: 'జోడించండి', signOut: 'సైన్ అవుట్', language: 'భాష', today: 'ఈ రోజు', present: 'హాజరు', absent: 'గైర్హాజరు', late: 'ఆలస్యం', name: 'పేరు' },
  login: { title: 'UnifiedTree‌కి సైన్ ఇన్ చేయండి', chooseInstitution: 'సంస్థను ఎంచుకోండి', chooseRole: 'మీ పాత్రను ఎంచుకోండి' },
  dash: { welcome: 'స్వాగతం, {{name}}', learners: 'చురుకైన విద్యార్థులు', avgAttendance: 'సగటు హాజరు', todaysClasses: 'ఈ రోజు తరగతులు' },
  att: { mark: 'హాజరు నమోదు', markAll: 'అందరూ హాజరు', saved: 'హాజరు సేవ్ అయింది' },
  kids: { hello: 'నమస్తే {{name}}!', myDay: 'నా రోజు', myAttendance: 'నా నక్షత్రాలు', great: 'బడికి వచ్చినందుకు శభాష్!' },
  roles: { INST_ADMIN: 'సంస్థ నిర్వాహకులు', FACULTY: 'అధ్యాపకులు', STUDENT: 'విద్యార్థి', GUARDIAN: 'తల్లిదండ్రులు' },
}

const bn: Dict = {
  app: { tagline: 'স্কুলের প্রথম দিন থেকে পিএইচডি পর্যন্ত একটি প্ল্যাটফর্ম' },
  nav: {
    dashboard: 'ড্যাশবোর্ড', learners: 'শিক্ষার্থী', staff: 'কর্মী', academics: 'শিক্ষাক্রম', timetable: 'সময়সূচি', attendance: 'উপস্থিতি',
    research: 'গবেষণা ও পিএইচডি', settings: 'সেটিংস', languages: 'ভাষা', myTimetable: 'আমার সময়সূচি', myAttendance: 'আমার উপস্থিতি', children: 'আমার সন্তান',
    admissions: 'ভর্তি', exams: 'পরীক্ষা', results: 'ফলাফল', fees: 'ফি', communication: 'যোগাযোগ', library: 'গ্রন্থাগার',
    learn: 'শিখুন', myClasses: 'আমার ক্লাস', insights: 'এআই অন্তর্দৃষ্টি',
    credentials: 'সনদপত্র', wallet: 'সনদ ওয়ালেট',
  },
  common: { search: 'খুঁজুন', save: 'সংরক্ষণ', cancel: 'বাতিল', add: 'যোগ করুন', signOut: 'সাইন আউট', language: 'ভাষা', today: 'আজ', present: 'উপস্থিত', absent: 'অনুপস্থিত', late: 'দেরি', name: 'নাম' },
  login: { title: 'UnifiedTree-এ সাইন ইন করুন', chooseInstitution: 'প্রতিষ্ঠান বেছে নিন', chooseRole: 'আপনার ভূমিকা বেছে নিন' },
  dash: { welcome: 'স্বাগতম, {{name}}', learners: 'সক্রিয় শিক্ষার্থী', avgAttendance: 'গড় উপস্থিতি', todaysClasses: 'আজকের ক্লাস' },
  att: { mark: 'উপস্থিতি নিন', markAll: 'সবাই উপস্থিত', saved: 'উপস্থিতি সংরক্ষিত' },
  kids: { hello: 'হ্যালো {{name}}!', myDay: 'আমার দিন', myAttendance: 'আমার তারা', great: 'স্কুলে আসার জন্য সাবাশ!' },
  roles: { INST_ADMIN: 'প্রতিষ্ঠান প্রশাসক', FACULTY: 'শিক্ষক', STUDENT: 'শিক্ষার্থী', GUARDIAN: 'অভিভাবক' },
}

const mr: Dict = {
  app: { tagline: 'शाळेच्या पहिल्या दिवसापासून पीएचडीपर्यंत एकच व्यासपीठ' },
  nav: {
    dashboard: 'डॅशबोर्ड', learners: 'विद्यार्थी', staff: 'कर्मचारी', academics: 'शैक्षणिक', timetable: 'वेळापत्रक', attendance: 'हजेरी',
    research: 'संशोधन व पीएचडी', settings: 'सेटिंग्ज', languages: 'भाषा', myTimetable: 'माझे वेळापत्रक', myAttendance: 'माझी हजेरी', children: 'माझी मुले',
    admissions: 'प्रवेश', exams: 'परीक्षा', results: 'निकाल', fees: 'शुल्क', communication: 'संवाद', library: 'ग्रंथालय',
    learn: 'शिका', myClasses: 'माझे वर्ग', insights: 'एआय अंतर्दृष्टी',
    credentials: 'प्रमाणपत्रे', wallet: 'प्रमाणपत्र वॉलेट',
  },
  common: { search: 'शोधा', save: 'जतन करा', cancel: 'रद्द करा', add: 'जोडा', signOut: 'साइन आउट', language: 'भाषा', today: 'आज', present: 'हजर', absent: 'गैरहजर', late: 'उशीरा', name: 'नाव' },
  login: { title: 'UnifiedTree मध्ये साइन इन करा', chooseInstitution: 'संस्था निवडा', chooseRole: 'तुमची भूमिका निवडा' },
  dash: { welcome: 'स्वागत आहे, {{name}}', learners: 'सक्रिय विद्यार्थी', avgAttendance: 'सरासरी हजेरी', todaysClasses: 'आजचे तास' },
  att: { mark: 'हजेरी घ्या', markAll: 'सर्व हजर', saved: 'हजेरी जतन झाली' },
  kids: { hello: 'नमस्कार {{name}}!', myDay: 'माझा दिवस', myAttendance: 'माझे तारे', great: 'शाळेत आल्याबद्दल शाबास!' },
  roles: { INST_ADMIN: 'संस्था प्रशासक', FACULTY: 'शिक्षक', STUDENT: 'विद्यार्थी', GUARDIAN: 'पालक' },
}

const ar: Dict = {
  app: { tagline: 'منصة واحدة من أول يوم دراسي حتى الدكتوراه' },
  nav: {
    dashboard: 'لوحة التحكم', learners: 'الطلاب', staff: 'الموظفون', academics: 'الشؤون الأكاديمية', timetable: 'الجدول الدراسي', attendance: 'الحضور',
    research: 'البحث والدكتوراه', settings: 'الإعدادات', audit: 'سجل التدقيق', tenants: 'المؤسسات', frameworks: 'حزم المناهج', languages: 'اللغات',
    myTimetable: 'جدولي', myAttendance: 'حضوري', children: 'أبنائي', profile: 'ملفي', roadmap: 'قريبًا',
    admissions: 'القبول', exams: 'الامتحانات والدرجات', gradebook: 'سجل الدرجات', results: 'النتائج', fees: 'الرسوم', communication: 'التواصل', library: 'المكتبة',
    learn: 'التعلّم', myClasses: 'صفوفي', insights: 'رؤى الذكاء الاصطناعي',
    credentials: 'الشهادات', wallet: 'محفظة الشهادات',
  },
  common: {
    search: 'بحث', save: 'حفظ', cancel: 'إلغاء', add: 'إضافة', edit: 'تعديل', signOut: 'تسجيل الخروج', language: 'اللغة', today: 'اليوم', loading: 'جارٍ التحميل…',
    noData: 'لا توجد بيانات بعد', viewAll: 'عرض الكل', all: 'الكل', present: 'حاضر', absent: 'غائب', late: 'متأخر', excused: 'معذور', total: 'المجموع',
    status: 'الحالة', name: 'الاسم', section: 'الشعبة', programme: 'البرنامج', level: 'المرحلة', theme: 'المظهر', back: 'رجوع', previous: 'السابق', next: 'التالي', close: 'إغلاق',
  },
  login: {
    title: 'تسجيل الدخول إلى UnifiedTree', subtitle: 'وضع العرض — اختر مؤسسة ودورًا. لا حاجة لكلمة مرور.', chooseInstitution: 'اختر مؤسسة',
    chooseRole: 'اختر دورك', platform: 'مشغل المنصة', reset: 'إعادة تعيين بيانات العرض', resetDone: 'تمت إعادة تعيين البيانات',
  },
  dash: {
    welcome: 'مرحبًا، {{name}}', learners: 'الطلاب النشطون', staff: 'الموظفون', programmes: 'البرامج', sections: 'الشعب', avgAttendance: 'متوسط الحضور',
    attendanceTrend: 'الحضور — آخر 14 يوم عمل', byLevel: 'الطلاب حسب المرحلة', atRisk: 'إنذار مبكر: طلاب معرضون للخطر', todaysClasses: 'حصص اليوم',
    noClasses: 'لا توجد حصص اليوم', markedToday: 'تم تسجيل الحضور اليوم', gender: 'توزيع الجنس', recent: 'النشاط الأخير',
  },
  att: { mark: 'تسجيل الحضور', markAll: 'تحديد الجميع حاضرين', saved: 'تم حفظ الحضور', date: 'التاريخ', notMarked: 'غير مسجل', marked: 'مسجل', holiday: 'ليس يوم عمل' },
  kids: { hello: 'مرحبًا {{name}}!', myDay: 'يومي', myAttendance: 'نجومي', great: 'أحسنت على حضورك إلى المدرسة!' },
  roles: { SUPER_ADMIN: 'المشرف العام', INST_ADMIN: 'مدير المؤسسة', FACULTY: 'عضو هيئة التدريس', STUDENT: 'طالب', GUARDIAN: 'ولي الأمر' },
  levels: {
    PRE_PRIMARY: 'رياض الأطفال', PRIMARY: 'ابتدائي', MIDDLE: 'متوسط', SECONDARY: 'ثانوي', SENIOR_SECONDARY: 'ثانوي عالٍ', DIPLOMA: 'دبلوم',
    UG: 'بكالوريوس', PG: 'دراسات عليا', PHD: 'دكتوراه', VOCATIONAL: 'مهني',
  },
}

const es: Dict = {
  app: { tagline: 'Una plataforma desde el primer día de escuela hasta el doctorado' },
  nav: {
    dashboard: 'Panel', learners: 'Estudiantes', staff: 'Personal', academics: 'Académico', timetable: 'Horario', attendance: 'Asistencia',
    research: 'Investigación y doctorado', settings: 'Configuración', audit: 'Registro de auditoría', tenants: 'Instituciones', frameworks: 'Paquetes curriculares',
    languages: 'Idiomas', myTimetable: 'Mi horario', myAttendance: 'Mi asistencia', children: 'Mis hijos', profile: 'Mi perfil', roadmap: 'Próximamente',
    admissions: 'Admisiones', exams: 'Exámenes y calificaciones', gradebook: 'Calificaciones', results: 'Resultados', fees: 'Pagos', communication: 'Comunicación', library: 'Biblioteca',
    learn: 'Aprender', myClasses: 'Mis clases', insights: 'Análisis con IA',
    credentials: 'Credenciales', wallet: 'Cartera de credenciales',
  },
  common: {
    search: 'Buscar', save: 'Guardar', cancel: 'Cancelar', add: 'Añadir', edit: 'Editar', signOut: 'Cerrar sesión', language: 'Idioma', today: 'Hoy',
    loading: 'Cargando…', noData: 'Aún no hay nada', viewAll: 'Ver todo', all: 'Todos', present: 'Presente', absent: 'Ausente', late: 'Tarde', excused: 'Justificado',
    total: 'Total', status: 'Estado', name: 'Nombre', section: 'Grupo', programme: 'Programa', level: 'Nivel', theme: 'Tema', back: 'Volver', previous: 'Anterior', next: 'Siguiente', close: 'Cerrar',
  },
  login: {
    title: 'Inicia sesión en UnifiedTree', subtitle: 'Modo demo: elige una institución y un rol. Sin contraseña.', chooseInstitution: 'Elige una institución',
    chooseRole: 'Elige quién eres', platform: 'Operador de la plataforma', reset: 'Restablecer datos demo', resetDone: 'Datos demo restablecidos',
  },
  dash: {
    welcome: 'Bienvenido/a, {{name}}', learners: 'Estudiantes activos', staff: 'Personal', programmes: 'Programas', sections: 'Grupos', avgAttendance: 'Asistencia media',
    attendanceTrend: 'Asistencia — últimos 14 días lectivos', byLevel: 'Estudiantes por nivel', atRisk: 'Alerta temprana: estudiantes en riesgo', todaysClasses: 'Clases de hoy',
    noClasses: 'No hay clases hoy', markedToday: 'Asistencia registrada hoy', gender: 'Distribución por género', recent: 'Actividad reciente',
  },
  att: { mark: 'Registrar asistencia', markAll: 'Marcar todos presentes', saved: 'Asistencia guardada', date: 'Fecha', notMarked: 'Sin registrar', marked: 'Registrada', holiday: 'No es día lectivo' },
  kids: { hello: '¡Hola, {{name}}!', myDay: 'Mi día', myAttendance: 'Mis estrellas', great: '¡Muy bien por venir a la escuela!' },
  roles: { SUPER_ADMIN: 'Superadministrador', INST_ADMIN: 'Administrador institucional', FACULTY: 'Docente', STUDENT: 'Estudiante', GUARDIAN: 'Padre / tutor' },
  levels: {
    PRE_PRIMARY: 'Preescolar', PRIMARY: 'Primaria', MIDDLE: 'Secundaria básica', SECONDARY: 'Secundaria', SENIOR_SECONDARY: 'Bachillerato', DIPLOMA: 'Diplomado',
    UG: 'Grado', PG: 'Posgrado', PHD: 'Doctorado', VOCATIONAL: 'Formación profesional',
  },
}

const fr: Dict = {
  app: { tagline: "Une plateforme du premier jour d'école jusqu'au doctorat" },
  nav: {
    dashboard: 'Tableau de bord', learners: 'Apprenants', staff: 'Personnel', academics: 'Scolarité', timetable: 'Emploi du temps', attendance: 'Présences',
    research: 'Recherche et doctorat', settings: 'Paramètres', audit: "Journal d'audit", tenants: 'Établissements', frameworks: 'Référentiels', languages: 'Langues',
    myTimetable: 'Mon emploi du temps', myAttendance: 'Mes présences', children: 'Mes enfants', profile: 'Mon profil', roadmap: 'Bientôt',
    admissions: 'Admissions', exams: 'Examens et notes', gradebook: 'Carnet de notes', results: 'Résultats', fees: 'Frais de scolarité', communication: 'Communication', library: 'Bibliothèque',
    learn: 'Apprendre', myClasses: 'Mes classes', insights: 'Analyses IA',
    credentials: 'Attestations', wallet: 'Portefeuille d’attestations',
  },
  common: {
    search: 'Rechercher', save: 'Enregistrer', cancel: 'Annuler', add: 'Ajouter', edit: 'Modifier', signOut: 'Se déconnecter', language: 'Langue', today: "Aujourd'hui",
    loading: 'Chargement…', noData: 'Rien pour le moment', viewAll: 'Tout voir', all: 'Tous', present: 'Présent', absent: 'Absent', late: 'En retard', excused: 'Excusé',
    total: 'Total', status: 'Statut', name: 'Nom', section: 'Classe', programme: 'Programme', level: 'Niveau', theme: 'Thème', back: 'Retour', previous: 'Précédent', next: 'Suivant', close: 'Fermer',
  },
  login: {
    title: 'Connexion à UnifiedTree', subtitle: 'Mode démo — choisissez un établissement et un rôle. Aucun mot de passe.', chooseInstitution: 'Choisissez un établissement',
    chooseRole: 'Choisissez votre rôle', platform: 'Opérateur de la plateforme', reset: 'Réinitialiser la démo', resetDone: 'Données de démo réinitialisées',
  },
  dash: {
    welcome: 'Bienvenue, {{name}}', learners: 'Apprenants actifs', staff: 'Personnel', programmes: 'Programmes', sections: 'Classes', avgAttendance: 'Assiduité moyenne',
    attendanceTrend: 'Présences — 14 derniers jours ouvrés', byLevel: 'Apprenants par niveau', atRisk: 'Alerte précoce : apprenants à risque', todaysClasses: "Cours d'aujourd'hui",
    noClasses: "Aucun cours aujourd'hui", markedToday: "Présences saisies aujourd'hui", gender: 'Répartition par genre', recent: 'Activité récente',
  },
  att: { mark: "Faire l'appel", markAll: 'Tous présents', saved: 'Présences enregistrées', date: 'Date', notMarked: 'Non saisi', marked: 'Saisi', holiday: 'Jour non ouvré' },
  kids: { hello: 'Bonjour {{name}} !', myDay: 'Ma journée', myAttendance: 'Mes étoiles', great: "Bravo d'être venu à l'école !" },
  roles: { SUPER_ADMIN: 'Super administrateur', INST_ADMIN: "Administrateur d'établissement", FACULTY: 'Enseignant', STUDENT: 'Apprenant', GUARDIAN: 'Parent / tuteur' },
  levels: {
    PRE_PRIMARY: 'Maternelle', PRIMARY: 'Primaire', MIDDLE: 'Collège', SECONDARY: 'Secondaire', SENIOR_SECONDARY: 'Lycée', DIPLOMA: 'Diplôme',
    UG: 'Licence', PG: 'Master', PHD: 'Doctorat', VOCATIONAL: 'Formation professionnelle',
  },
}

export const resources = {
  en: { translation: en },
  hi: { translation: hi },
  ta: { translation: ta },
  te: { translation: te },
  bn: { translation: bn },
  mr: { translation: mr },
  ar: { translation: ar },
  es: { translation: es },
  fr: { translation: fr },
}
