"use client";

import { useState, useEffect, useRef, createContext, useContext, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  HomeIcon, ClipboardIcon, FolderIcon, CalendarIcon, UserIcon,
  BellIcon, UploadIcon, ActivityIcon, DropletIcon, AlertCircleIcon,
  ChevronRightIcon, ChevronLeftIcon, SearchIcon,
  FileTextIcon, ImageIcon, ArchiveIcon, BarChartIcon, ShieldIcon,
  SparklesIcon, LogOutIcon, HistoryIcon, LoaderIcon, PlusIcon,
  RulerIcon, GenderMaleIcon, MedicalHistoryIcon, AllergyIcon,
  StethoscopeIcon, DnaIcon, AppleIcon, InfoCircleIcon, HeartPulseIcon,
  XIcon, CheckCircleIcon
} from "../components/Icons";
import {
  analysesApi, medcardApi, calendarApi, profileApi, biomarkersApi, productsApi,
  type Analysis, type MedicalDocument, type Reminder, type PatientProfile,
  API_VERSION
} from "../lib/api";

// Модуль встраивается в основное приложение заказчика
// Авторизация происходит на стороне основного приложения
// Пользователь уже залогинен

// ===== Контекст профиля медкарты =====
interface MedcardContextType {
  isProfileFilled: boolean;
  showMedcardModal: boolean;
  setShowMedcardModal: (show: boolean) => void;
  checkAndPromptMedcard: () => boolean; // Returns true if profile is filled, false if modal shown
  refreshProfile: () => Promise<void>;
}

const MedcardContext = createContext<MedcardContextType>({
  isProfileFilled: false,
  showMedcardModal: false,
  setShowMedcardModal: () => {},
  checkAndPromptMedcard: () => false,
  refreshProfile: async () => {},
});

const useMedcard = () => useContext(MedcardContext);

// ===== Модальное окно медкарты =====
function MedcardPromptModal({ 
  onFill, 
  onSkip 
}: { 
  onFill: () => void; 
  onSkip: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header with icon */}
        <div className="bg-gradient-to-br from-brand-400 to-teal-500 p-6 text-center">
          <div className="w-20 h-20 bg-white/20 rounded-full mx-auto flex items-center justify-center mb-4">
            <FolderIcon size={40} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Заполните медкарту</h2>
        </div>
        
        {/* Content */}
        <div className="p-6 text-center">
          <p className="text-gray-600 mb-6 leading-relaxed">
            Для получения <span className="font-semibold text-brand-600">персонализированных рекомендаций</span> и 
            точной расшифровки анализов укажите ваши данные: рост, вес, аллергии и хронические заболевания.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={onFill}
              className="w-full py-3.5 bg-brand-500 text-white font-bold rounded-xl hover:bg-brand-600 transition-colors shadow-lg shadow-brand-200"
            >
              Заполнить медкарту
            </button>
            <button
              onClick={onSkip}
              className="w-full py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors"
            >
              Пропустить
            </button>
          </div>
          
          <p className="text-xs text-gray-400 mt-4">
            Без медкарты AI не сможет учесть ваши индивидуальные особенности
          </p>
        </div>
      </div>
    </div>
  );
}

// ===== Кнопка заполнения медкарты (для главной страницы) =====
function FillMedcardBanner({ onFill }: { onFill: () => void }) {
  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <AlertCircleIcon size={22} className="text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 text-sm mb-1">Медкарта не заполнена</h3>
          <p className="text-xs text-gray-600 mb-3">
            Заполните данные для персонализированных рекомендаций AI
          </p>
          <button
            onClick={onFill}
            className="text-sm font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1"
          >
            Заполнить данные
            <ChevronRightIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Компонент уведомлений
function NotificationBell() {
  const [notifications, setNotifications] = useState<Reminder[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const reminders = await calendarApi.getAll();
      // Filter upcoming reminders (next 7 days)
      const upcoming = reminders.filter(r => {
        const daysUntil = Math.ceil((new Date(r.scheduled_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return daysUntil >= 0 && daysUntil <= 7 && !r.is_completed;
      });
      setNotifications(upcoming);
      
      // Проверяем непрочитанные
      const lastRead = localStorage.getItem('notifications_last_read');
      if (!lastRead) {
        setUnreadCount(upcoming.length);
      } else {
        const lastReadTime = new Date(lastRead).getTime();
        const unread = upcoming.filter(r => new Date(r.created_at || r.scheduled_date).getTime() > lastReadTime);
        setUnreadCount(unread.length);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleOpenPopup = () => {
    setShowPopup(true);
    // Помечаем все как прочитанные
    localStorage.setItem('notifications_last_read', new Date().toISOString());
    setUnreadCount(0);
  };

  const count = unreadCount;

  return (
    <div className="relative">
      <button 
        onClick={() => {
          if (!showPopup) {
            handleOpenPopup();
          } else {
            setShowPopup(false);
          }
        }}
        className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center relative text-gray-600 hover:bg-gray-200 transition-colors"
      >
        <BellIcon size={18} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      
      {showPopup && (
        <div className="absolute right-0 top-12 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Уведомления</h3>
            <button onClick={() => setShowPopup(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-400">Загрузка...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-400">Нет уведомлений</div>
            ) : notifications.map(n => (
              <div key={n.id} className="p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                <div className="font-medium text-sm text-gray-900">{n.title}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(n.scheduled_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  // Auto-login as demo user if not authenticated
  useEffect(() => {
    console.log("API_VERSION", API_VERSION);
    
    // Check if already logged in
    const token = localStorage.getItem('auth_token');
    if (!token) {
      // Auto-login as demo user
      fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@healthtracker.app', password: 'demo123' }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.access_token) {
            localStorage.setItem('auth_token', data.access_token);
            console.log('[Auth] Demo user logged in');
            window.location.reload(); // Reload to apply token
          }
        })
        .catch(err => console.log('[Auth] Auto-login failed:', err));
    }
  }, []);

  const [activeTab, setActiveTab] = useState("home");
  
  // Global processing state
  const [processingIds, setProcessingIds] = useState<number[]>([]);
  const [isGlobalUploading, setIsGlobalUploading] = useState(false);
  const [isProcessingOverlayVisible, setIsProcessingOverlayVisible] = useState(false);

  // Control overlay visibility to prevent flicker
  useEffect(() => {
    if (isGlobalUploading || processingIds.length > 0) {
      setIsProcessingOverlayVisible(true);
    } else {
      const timer = setTimeout(() => {
        setIsProcessingOverlayVisible(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isGlobalUploading, processingIds]);

  // Polling logic for processing items
  useEffect(() => {
    if (processingIds.length === 0) return;
    
    const interval = setInterval(async () => {
      // console.log('[App] Polling status:', processingIds);
      for (const id of processingIds) {
        try {
          const check = await analysesApi.getById(id);
          if (check.status === 'completed' || check.status === 'error' || check.status === 'failed') {
             setProcessingIds(prev => prev.filter(pid => pid !== id));
          }
        } catch (e) { console.error(e); }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [processingIds]);

  const [isProfileFilled, setIsProfileFilled] = useState(true); // Default true to avoid flash
  const [showMedcardModal, setShowMedcardModal] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);

  // Check if profile is filled (has essential data)
  const checkProfileFilled = (profile: PatientProfile | null): boolean => {
    if (!profile) return false;
    const body = profile.body_parameters as any;
    // Consider filled if at least height and weight are set
    return !!(body?.height && body?.weight);
  };

  // Load and check profile on mount
  const refreshProfile = async () => {
    try {
      const profile = await profileApi.getMyProfile();
      const filled = checkProfileFilled(profile);
      setIsProfileFilled(filled);
      
      // Show modal on first visit if not filled and not skipped
      if (!profileChecked) {
        const wasSkipped = localStorage.getItem('medcard_skipped');
        if (!filled && !wasSkipped) {
          setShowMedcardModal(true);
        }
        setProfileChecked(true);
      }
    } catch (err: any) {
      console.error('Failed to load profile:', err);
      
      // Auto-fix for invalid token (401)
      if (err.message?.includes('401') || err.message?.includes('token') || err.message?.includes('авторизаци')) {
        console.log('[Auth] Invalid token, clearing and reloading...');
        localStorage.removeItem('auth_token');
        window.location.reload();
        return;
      }

      setIsProfileFilled(false);
      // Show modal if profile doesn't exist
      if (!profileChecked) {
        const wasSkipped = localStorage.getItem('medcard_skipped');
        if (!wasSkipped) {
          setShowMedcardModal(true);
        }
        setProfileChecked(true);
      }
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  // Check if profile is filled before allowing analysis - returns true if can proceed
  const checkAndPromptMedcard = (): boolean => {
    if (isProfileFilled) return true;
    setShowMedcardModal(true);
    return false;
  };

  const handleFillMedcard = () => {
    setShowMedcardModal(false);
    localStorage.removeItem('medcard_skipped');
    setActiveTab("medcard");
  };

  const handleSkipMedcard = () => {
    setShowMedcardModal(false);
    localStorage.setItem('medcard_skipped', 'true');
  };

  const contextValue: MedcardContextType = {
    isProfileFilled,
    showMedcardModal,
    setShowMedcardModal,
    checkAndPromptMedcard,
    refreshProfile,
  };

  return (
    <MedcardContext.Provider value={contextValue}>
      <div className="min-h-screen bg-gray-50">
        {isProcessingOverlayVisible && <ProcessingScreen />}
        <div className="max-w-md mx-auto bg-white min-h-screen flex flex-col shadow-xl">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Кнопка "Назад" - показывается ВСЕГДА */}
              <button 
                onClick={() => {
                  if (activeTab === "home") {
                    // На главной - выходим в основное приложение
                    if (window.parent !== window) {
                      window.parent.postMessage({ type: 'NAVIGATE_BACK' }, '*');
                    } else {
                      // Fallback если не embedded
                      window.history.back();
                    }
                  } else {
                    // На других вкладках - возвращаемся на главную
                    setActiveTab("home");
                  }
                }}
                className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
                title={activeTab === "home" ? "Выйти в приложение" : "На главную"}
              >
                <ChevronLeftIcon size={22} />
              </button>
              <div>
                <h1 className="text-base font-bold text-gray-900">
                  {activeTab === "home" ? "Health Tracker" : 
                   activeTab === "analyses" ? "Анализы" :
                   activeTab === "medcard" ? "Медкарта" :
                   activeTab === "calendar" ? "Календарь" :
                   activeTab === "profile" ? "Профиль" : ""}
          </h1>
                <p className="text-xs text-brand-600 font-semibold">Медицинский ассистент</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
            </div>
          </div>
        </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto pb-20">
            {activeTab === "home" && <HomePage 
              onNavigate={setActiveTab} 
              onUploadStart={() => setIsGlobalUploading(true)}
              onUploadSuccess={(id) => {
                if (id) setProcessingIds(prev => [...prev, id]);
                // Задержка чтобы избежать мигания заставки при переключении состояния
                setTimeout(() => setIsGlobalUploading(false), 500);
              }}
            />}
            {activeTab === "analyses" && <BiomarkerTablePage 
              processingIds={processingIds}
              onProcessingFound={(ids) => setProcessingIds(prev => [...new Set([...prev, ...ids])])}
              onUploadStart={() => setIsGlobalUploading(true)}
              onUploadSuccess={(id) => {
                if (id) setProcessingIds(prev => [...prev, id]);
                // Задержка чтобы избежать мигания заставки при переключении состояния
                setTimeout(() => setIsGlobalUploading(false), 500);
              }}
            />}
            {activeTab === "medcard" && <MedcardPage />}
            {activeTab === "calendar" && <CalendarPage />}
            {activeTab === "profile" && <ProfilePage />}
          </main>

          {/* Bottom Navigation */}
          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 z-50 max-w-md mx-auto">
            <div className="flex items-center justify-around">
              {[
                { id: "home", label: "Главная", Icon: HomeIcon },
                { id: "analyses", label: "Анализы", Icon: ClipboardIcon },
                { id: "medcard", label: "Медкарта", Icon: FolderIcon },
                { id: "calendar", label: "Календарь", Icon: CalendarIcon },
                { id: "profile", label: "Профиль", Icon: UserIcon },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex flex-col items-center gap-1 py-1 px-3"
                >
                  <tab.Icon
                    size={22}
                    className={activeTab === tab.id ? "text-brand-600" : "text-gray-400"}
                  />
                  <span className={`text-[10px] font-semibold ${activeTab === tab.id ? "text-brand-600" : "text-gray-400"}`}>
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>
          </nav>
        </div>

        {/* Modal for medcard prompt */}
        {showMedcardModal && (
          <MedcardPromptModal
            onFill={handleFillMedcard}
            onSkip={handleSkipMedcard}
          />
        )}
      </div>
    </MedcardContext.Provider>
  );
}

// Главная страница
function HomePage({ onNavigate, onUploadStart, onUploadSuccess }: { 
  onNavigate: (tab: string) => void;
  onUploadStart?: () => void;
  onUploadSuccess?: (id: number) => void;
}) {
  const { isProfileFilled, checkAndPromptMedcard } = useMedcard();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [biomarkers, setBiomarkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestRec, setLatestRec] = useState<any>(null);

  useEffect(() => {
    // Загружаем и анализы и биомаркеры
    Promise.all([
      analysesApi.getAll(),
      biomarkersApi.getAll()
    ])
      .then(([analysesData, biomarkersData]) => {
        setAnalyses(analysesData);
        setBiomarkers(biomarkersData.items || []);
        
        // Find latest recommendation
        const withRecs = analysesData.find((a: any) => a.ai_recommendations?.items?.length > 0);
        if (withRecs) {
            setLatestRec(withRecs.ai_recommendations.items[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalAnalyses = analyses.length;
  
  // Считаем количество АНАЛИЗОВ с отклонениями (а не количество показателей!)
  const analysesWithIssues = analyses.filter(a => 
    Array.isArray(a.biomarkers) && a.biomarkers.some(b => b.status !== 'normal')
  ).length;
  
  // Количество анализов где все в норме
  const analysesAllNormal = analyses.filter(a => 
    Array.isArray(a.biomarkers) && a.biomarkers.length > 0 && a.biomarkers.every(b => b.status === 'normal')
  ).length;

  // Рассчитываем реальный индекс здоровья на основе ВСЕХ биомаркеров (из папок)
  const totalBiomarkers = biomarkers.filter(b => b.last_value !== null && b.last_value !== undefined).length;
  const normalBiomarkers = biomarkers.filter(b => 
    b.last_value !== null && b.last_value !== undefined && b.last_status === 'normal'
  ).length;
  
  // Функция определения категории биомаркера
  function detectBiomarkerCategory(name: string): string {
    const n = name.toLowerCase();
    // Гематология (ПЕРВЫМ - чтобы не перепутать с биохимией)
    if (/гемоглобин|эритроцит|лейкоцит|тромбоцит|гематокрит|тромбокрит|mcv|mch|mchc|rdw|mpv|pct|соэ|esr|ретикулоцит|нейтрофил|лимфоцит|моноцит|эозинофил|базофил|цп|цпэ|цветовой|палочкоядер|сегментоядер|юные/i.test(n)) return 'HEMATOLOGY';
    // Гормоны
    if (/тестостерон|эстрадиол|прогестерон|пролактин|лг|фсг|кортизол|дгэа|андростендион|альдостерон/i.test(n)) return 'HORMONES';
    // Щитовидная (отдельно от гормонов)
    if (/ттг|т3|т4|тироксин|трийодтиронин|тиреоглобулин|ат-тпо|ат-тг|tsh/i.test(n)) return 'THYROID';
    // Липиды
    if (/холестерин|лпнп|лпвп|триглицерид|липопротеин|апо\s?[ab]/i.test(n)) return 'LIPIDS';
    // Печень
    if (/алт|аст|билирубин|ггт|щф|альбумин|белок общий|гамма-глутамил/i.test(n)) return 'LIVER';
    // Почки
    if (/креатинин|мочевина|мочевая кислота|скф|цистатин|клубочков/i.test(n)) return 'KIDNEY';
    // Витамины
    if (/витамин|b12|фолиевая|фолат|d\s|25-oh/i.test(n)) return 'VITAMINS';
    // Минералы
    if (/железо|ферритин|трансферрин|кальций|магний|калий|натрий|хлор|фосфор|цинк|медь|селен/i.test(n)) return 'MINERALS';
    // Воспаление
    if (/срб|c-реактивный|прокальцитонин|интерлейкин|tnf|фибриноген/i.test(n)) return 'INFLAMMATION';
    // Сердечно-сосудистая
    if (/тропонин|bnp|nt-probnp|гомоцистеин|миоглобин|креатинкиназа-мв/i.test(n)) return 'CARDIOVASCULAR';
    // Биохимия (общее - в конце как fallback)
    if (/глюкоз|гликир|hba1c|инсулин|амилаз|липаз/i.test(n)) return 'BIOCHEMISTRY';
    return 'OTHER';
  }

  // Анализ здоровья по системам организма
  // Анализ здоровья по системам организма (из biomarkers)
  const systemsHealth = useMemo(() => {
    // Группируем биомаркеры по системам
    const systemsMap: Record<string, { total: number; normal: number; name: string }> = {};
    
    biomarkers.forEach(b => {
      // Только биомаркеры с значениями
      if (b.last_value === null || b.last_value === undefined) return;
      
      // Определяем категорию
      const category = b.category?.toUpperCase() || detectBiomarkerCategory(b.name || '');
      if (!systemsMap[category]) {
        systemsMap[category] = { total: 0, normal: 0, name: getCategoryName(category) };
      }
      systemsMap[category].total++;
      if (b.last_status === 'normal') {
        systemsMap[category].normal++;
      }
    });
    
    console.log('[SystemsHealth] Распределение по системам:', systemsMap);
    
    // Рассчитываем индекс для каждой системы
    return Object.entries(systemsMap).map(([key, data]) => ({
      system: key,
      name: data.name,
      total: data.total,
      normal: data.normal,
      index: Math.round((data.normal / data.total) * 100),
      hasIssues: data.normal < data.total, // Проблема если есть хотя бы одно отклонение
    }));
  }, [biomarkers]);
  
  // Общий индекс здоровья
  const healthIndex = totalBiomarkers > 0 ? Math.round((normalBiomarkers / totalBiomarkers) * 100) : 0;
  
  // Выявляем системы с проблемами
  const problemSystems = systemsHealth.filter(s => s.hasIssues);
  
  // Текст статуса
  const healthStatus = totalBiomarkers === 0 ? 'Нет данных' :
                       healthIndex >= 90 && problemSystems.length === 0 ? 'Отлично' :
                       healthIndex >= 80 && problemSystems.length > 0 ? `Есть проблемы: ${problemSystems.map(s => s.name).join(', ')}` :
                       healthIndex >= 70 ? `Требует внимания (${problemSystems.length} систем)` :
                       'Рекомендуем обследование';
  
  // Цвет карточки: зелёный #35BA5D (высокий), жёлтый (средний), красный #FF3C3C (низкий)
  // Цвет зависит ТОЛЬКО от общего индекса
  const healthColor = healthIndex >= 80 
    ? 'bg-brand-500'    // Зелёный: высокий индекс (>= 80%)
    : healthIndex >= 60 
      ? 'bg-warning-500'  // Жёлтый: средний индекс (60-79%)
      : healthIndex > 0 
        ? 'bg-danger-500'   // Красный: низкий индекс (< 60%)
        : 'bg-gray-400';    // Серый: нет данных
  
  // Функция получения названия категории
  function getCategoryName(category: string): string {
    const names: Record<string, string> = {
      'HEMATOLOGY': 'Кровь',
      'BIOCHEMISTRY': 'Биохимия',
      'HORMONES': 'Гормоны',
      'VITAMINS': 'Витамины',
      'MINERALS': 'Минералы',
      'LIPIDS': 'Липиды',
      'LIVER': 'Печень',
      'KIDNEY': 'Почки',
      'THYROID': 'Щитовидная',
      'INFLAMMATION': 'Воспаление',
      'CARDIOVASCULAR': 'Сердце',
      'REPRODUCTIVE': 'Репродуктивная',
      'IMMUNE': 'Иммунитет',
      'ADRENAL': 'Надпочечники',
      'NERVOUS': 'Нервная система',
      'MUSCULOSKELETAL': 'Мышцы/Кости',
      'OTHER': 'Прочее',
    };
    return names[category] || category;
  }

  return (
    <div className="px-4 py-5 space-y-5">
      {/* Banner for unfilled medcard */}
      {!isProfileFilled && (
        <FillMedcardBanner onFill={() => onNavigate("medcard")} />
      )}

      <div>
        <p className="text-sm text-gray-500 mb-1">Добрый день,</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Александр 👋</h1>
        
        <div className={`${healthColor} rounded-2xl p-5 text-white shadow-lg transition-all`}>
          <p className="text-white/80 text-sm mb-1">Индекс здоровья</p>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-bold">{healthIndex}</span>
            <span className="text-white/80 text-sm">/ 100</span>
          </div>
          
          {/* Статус */}
          <div className="text-sm mb-3">
            {problemSystems.length === 0 && healthIndex >= 85 ? (
              <span className="font-medium">✨ Отлично</span>
            ) : problemSystems.length > 0 && healthIndex >= 75 ? (
              <div>
                <div className="font-medium mb-1">⚠️ Общий индекс высокий, но есть отклонения от нормы:</div>
                <div className="text-xs text-white/90 space-y-0.5">
                  {problemSystems.slice(0, 3).map(sys => (
                    <div key={sys.system}>• {sys.name} ({sys.normal}/{sys.total} в норме)</div>
                  ))}
                  {problemSystems.length > 3 && (
                    <div>и ещё {problemSystems.length - 3}...</div>
                  )}
                </div>
              </div>
            ) : (
              <span className="font-medium">{healthStatus}</span>
            )}
          </div>
          
          {/* Прогресс-бар */}
          <div className="flex justify-between text-xs text-white/70 mb-2">
            {totalBiomarkers > 0 && (
              <span>{normalBiomarkers} из {totalBiomarkers} показателей в норме</span>
            )}
          </div>
          <div className="h-2 bg-white/20 rounded-full">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${healthIndex}%` }}></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button 
          onClick={() => onNavigate("analyses")}
          className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-left hover:shadow-md hover:border-blue-300 transition-all active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center mb-2">
            <DropletIcon size={22} />
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalAnalyses}</div>
          <div className="text-xs text-gray-500 mt-1">Загружено анализов</div>
        </button>
        <button 
          onClick={() => onNavigate("analyses")}
          className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-left hover:shadow-md hover:border-rose-300 transition-all active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center mb-2">
            <AlertCircleIcon size={22} />
          </div>
          <div className="text-2xl font-bold text-gray-900">{analysesWithIssues}</div>
          <div className="text-xs text-gray-500 mt-1">Анализов с отклонениями</div>
        </button>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900">Быстрые действия</h2>
        
        <UploadAnalysisButton 
          onBeforeUpload={checkAndPromptMedcard} 
          onSuccess={() => onNavigate("analyses")}
          onUploadStart={onUploadStart}
          onUploadSuccess={onUploadSuccess}
        />

        <button 
          onClick={() => onNavigate("medcard")}
          className="w-full bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 text-left hover:bg-gray-50 hover:shadow-md transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
            <FolderIcon size={24} />
          </div>
          <div className="flex-1">
            <div className="font-bold text-gray-900">Медкарта</div>
            <div className="text-sm text-gray-500">Все документы и история</div>
          </div>
          <ChevronRightIcon size={20} className="text-gray-400" />
        </button>

        <a href="https://telegra.ph/Consultation-08-16" target="_blank" rel="noopener noreferrer" className="w-full bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 text-left hover:bg-gray-50 hover:shadow-md transition-all">
          <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
            <UserIcon size={24} />
          </div>
          <div className="flex-1">
            <div className="font-bold text-gray-900">Консультация врача</div>
            <div className="text-sm text-gray-500">Записаться к нутрициологу</div>
          </div>
          <ChevronRightIcon size={20} className="text-gray-400" />
        </a>
      </div>
      
      {/* Последние анализы */}
      {analyses.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Последние анализы</h2>
            <button 
              onClick={() => onNavigate('analyses')}
              className="text-sm text-blue-600 font-semibold hover:text-blue-700"
            >
              Все →
            </button>
          </div>
          
          {analyses.slice(0, 2).map((analysis: any) => {
            const outOfRangeCount = Array.isArray(analysis.biomarkers) 
              ? analysis.biomarkers.filter((b: any) => b.status !== 'normal').length 
              : 0;
            const totalCount = Array.isArray(analysis.biomarkers) ? analysis.biomarkers.length : 0;
            
            return (
              <button
                key={analysis.id}
                onClick={() => onNavigate('analyses')}
                className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left hover:bg-gray-50 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{analysis.title}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {analysis.analysis_date ? new Date(analysis.analysis_date).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      }) : new Date(analysis.created_at).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long'
                      })}
                    </div>
                  </div>
                  {outOfRangeCount > 0 ? (
                    <div className="bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full text-xs font-bold">
                      {outOfRangeCount} откл.
                    </div>
                  ) : totalCount > 0 ? (
                    <div className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold">
                      ✓ В норме
                    </div>
                  ) : null}
                </div>
                
                {Array.isArray(analysis.biomarkers) && analysis.biomarkers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {analysis.biomarkers.slice(0, 3).map((b: any, idx: number) => (
                      <div 
                        key={idx}
                        className={`text-xs px-2 py-1 rounded ${
                          b.status === 'normal' ? 'bg-green-50 text-green-700' :
                          b.status === 'low' || b.status === 'high' ? 'bg-orange-50 text-orange-700' :
                          'bg-red-50 text-red-700'
                        }`}
                      >
                        {b.biomarker_name}: <span className="font-bold">{b.value}</span> {b.unit}
                      </div>
                    ))}
                    {analysis.biomarkers.length > 3 && (
                      <div className="text-xs text-gray-500 px-2 py-1">
                        +{analysis.biomarkers.length - 3} ещё
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {latestRec ? (
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-5 text-white shadow-lg shadow-indigo-200">
            <div className="flex items-center gap-2 mb-2">
            <SparklesIcon size={16} />
            <span className="text-xs font-bold uppercase">AI Рекомендация</span>
            </div>
            <h3 className="text-lg font-bold mb-2">{latestRec.product?.name}</h3>
            <p className="text-sm text-indigo-100 mb-4">
            {latestRec.reason || "Подобрано на основе ваших анализов"}
            </p>
            <button className="bg-white text-indigo-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-50 transition-colors shadow-sm">
            Купить за {latestRec.product?.price} ₽
            </button>
        </div>
      ) : analyses.length === 0 ? (
        <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl p-5 text-gray-500">
            <div className="flex items-center gap-2 mb-2">
            <SparklesIcon size={16} />
            <span className="text-xs font-bold uppercase">AI Ассистент</span>
            </div>
            <p className="text-sm">Загрузите анализы, чтобы получить персональные рекомендации товаров.</p>
        </div>
      ) : null}
    </div>
  );
}

// Кнопка загрузки анализа
function ProcessingScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [mounted, setMounted] = useState(false);
  
  const steps = [
    { text: "Загружаю фото", icon: "📷", duration: 1500 },
    { text: "Распознаю текст", icon: "🔍", duration: 1500 },
    { text: "Анализирую показатели", icon: "🧬", duration: 1500 },
    { text: "Пишу рекомендации", icon: "💊", duration: 1500 },
  ];
  
  useEffect(() => {
    setMounted(true);
    const timers: NodeJS.Timeout[] = [];
    let totalDelay = 0;
    
    steps.forEach((step, index) => {
      if (index > 0) {
        totalDelay += steps[index - 1].duration;
        const timer = setTimeout(() => {
          setCurrentStep(index);
        }, totalDelay);
        timers.push(timer);
      }
    });
    
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const content = (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md transition-all duration-300">
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-md p-6">
        {/* Logo/Icon */}
        <div className="relative mb-10">
          <div className="absolute inset-0 bg-brand-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
          <div className="relative w-24 h-24 bg-gradient-to-br from-brand-400 to-cyan-500 rounded-full shadow-2xl flex items-center justify-center">
            <span className="text-4xl animate-bounce-slight">{steps[currentStep].icon}</span>
          </div>
        </div>
        
        {/* Title */}
        <h2 className="text-white text-2xl font-bold mb-2 text-center">
          Анализирую ваши данные
        </h2>
        <p className="text-gray-400 text-sm mb-10 text-center">
          Примерное время: 20-30 секунд
        </p>
        
        {/* Steps */}
        <div className="w-full space-y-4 mb-8">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isActive = index === currentStep;
            
            return (
              <div 
                key={index}
                className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-500 ${
                  isActive 
                    ? 'bg-white/10 border border-white/20 shadow-lg scale-105' 
                    : isCompleted 
                      ? 'bg-brand-500/10 border border-brand-500/20' 
                      : 'opacity-30'
                }`}
              >
                {/* Step indicator */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 ${
                  isCompleted 
                    ? 'bg-brand-500' 
                    : isActive 
                      ? 'bg-gradient-to-br from-purple-500 to-blue-500 animate-pulse' 
                      : 'bg-white/10'
                }`}>
                  {isCompleted ? (
                    <span className="text-white text-lg">✓</span>
                  ) : (
                    <span className="text-2xl">{step.icon}</span>
                  )}
                </div>
                
                {/* Step text */}
                <div className="flex-1">
                  <div className={`font-semibold transition-colors ${
                    isCompleted ? 'text-brand-400' : isActive ? 'text-white' : 'text-gray-500'
                  }`}>
                    {step.text}
                  </div>
                  {isActive && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-ping"></div>
                      <span className="text-xs text-gray-400">Выполняется...</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-brand-400 to-cyan-400 h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
        
        <p className="text-gray-500 text-xs mt-6 text-center">
          Пожалуйста, не закрывайте приложение
        </p>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}

function UploadAnalysisButton({ onBeforeUpload, onSuccess, onUploadStart, onUploadSuccess }: { 
  onBeforeUpload?: () => boolean; 
  onSuccess?: () => void;
  onUploadStart?: () => void;
  onUploadSuccess?: (id: number) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleClick = () => {
    // Check if profile is filled before allowing upload
    if (onBeforeUpload && !onBeforeUpload()) {
      return; // Modal will be shown, don't proceed
    }
    fileInputRef.current?.click();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Уведомляем глобальный стейт - заставка появится через Portal
    if (onUploadStart) onUploadStart();
    
    setUploading(true);
    const startTime = Date.now();
    
    try {
      const newAnalysis = await analysesApi.upload(file);
      console.log('Upload started:', newAnalysis.id);
      
      // Polling: проверяем готовность анализа каждые 2 секунды (макс 30 сек)
      let attempts = 0;
      const maxAttempts = 15; // 15 * 2 = 30 секунд макс
      let analysisReady = false;
      
      while (attempts < maxAttempts && !analysisReady) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Ждём 2 секунды
        
        try {
          const updated = await analysesApi.getById(newAnalysis.id);
          console.log(`[Polling #${attempts + 1}] Analysis status:`, updated.status);
          
          if (updated.status === 'completed') {
            analysisReady = true;
            console.log('✅ Analysis ready!');
            break;
          } else if (updated.status === 'failed') {
            console.error('❌ Analysis failed');
            throw new Error('Обработка анализа не удалась');
          }
        } catch (pollErr) {
          console.warn('Polling error:', pollErr);
        }
        
        attempts++;
      }
      
      // Минимум 6 секунд показываем заставку (для UX)
      const elapsed = Date.now() - startTime;
      if (elapsed < 6000) {
        await new Promise(resolve => setTimeout(resolve, 6000 - elapsed));
      }

      // Notify parent about new processing item
      if (onUploadSuccess) onUploadSuccess(newAnalysis.id);
      
      // Переходим на вкладку Анализы
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка загрузки');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={uploading}
        className="w-full bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 text-left hover:bg-gray-50 disabled:opacity-50"
      >
        <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
          {uploading ? <LoaderIcon size={24} /> : <UploadIcon size={24} />}
        </div>
        <div className="flex-1">
          <div className="font-bold text-gray-900">Загрузить анализ</div>
          <div className="text-sm text-gray-500">PDF, JPG или фото</div>
        </div>
        <ChevronRightIcon size={20} className="text-gray-400" />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleUpload}
        className="hidden"
      />
    </>
  );
}

// ===== UI Components =====

// Компактный виджет аналитики для страницы Анализов
function AnalyticsWidget({ analyses }: { analyses: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedBiomarker, setSelectedBiomarker] = useState<string>('');
  const [period, setPeriod] = useState<'7d' | '14d' | '30d' | '3m' | '6m' | '1y' | 'all'>('all');

  // Определяем временной диапазон данных
  const dataRange = useMemo(() => {
    if (analyses.length === 0) return { days: 0, months: 0, hasData: false };
    
    const dates = analyses
      .filter(a => a.created_at)
      .map(a => new Date(a.created_at).getTime())
      .sort((a, b) => a - b);
    
    if (dates.length === 0) return { days: 0, months: 0, hasData: false };
    
    const oldest = dates[0];
    const newest = dates[dates.length - 1];
    const diffMs = newest - oldest;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const diffMonths = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30));
    
    return { days: diffDays, months: diffMonths, hasData: true };
  }, [analyses]);

  // Собираем все уникальные биомаркеры
  const allBiomarkers = useMemo(() => {
    const biomarkerMap = new Map<string, string>();
    analyses.forEach(a => {
      if (Array.isArray(a.biomarkers)) {
        a.biomarkers.forEach((b: any) => {
          const code = b.biomarker_code || b.code || b.name;
          const name = b.biomarker_name || b.name || code;
          if (code && !biomarkerMap.has(code)) {
            biomarkerMap.set(code, name);
          }
        });
      }
    });
    return Array.from(biomarkerMap.entries()).map(([code, name]) => ({ code, name }));
  }, [analyses]);

  // Автовыбор первого показателя
  useEffect(() => {
    if (!selectedBiomarker && allBiomarkers.length > 0) {
      setSelectedBiomarker(allBiomarkers[0].code);
    }
  }, [allBiomarkers, selectedBiomarker]);

  // Статичные периоды
  const periods = [
    { value: 'all', label: 'Все' },
    { value: '1y', label: 'Год' },
    { value: '6m', label: '6 мес' },
    { value: '3m', label: '3 мес' },
  ] as const;

  // Данные для графика
  const chartData = useMemo(() => {
    if (!selectedBiomarker) return [];
    
    const now = new Date();
    let periodStart: Date;
    
    switch (period) {
      case '7d':
        periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '14d':
        periodStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3m':
        periodStart = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case '6m':
        periodStart = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        break;
      case '1y':
        periodStart = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default:
        periodStart = new Date(0);
    }
    
    const data: { date: string; value: number; status: string; unit?: string }[] = [];
    
    analyses.forEach(a => {
      const analysisDate = new Date(a.created_at);
      if (analysisDate < periodStart) return;
      
      if (Array.isArray(a.biomarkers)) {
        const biomarker = a.biomarkers.find((b: any) => 
          (b.biomarker_code || b.code || b.name) === selectedBiomarker
        );
        if (biomarker) {
          data.push({
            date: a.created_at.split('T')[0],
            value: biomarker.value,
            status: biomarker.status,
            unit: biomarker.unit
          });
        }
      }
    });
    
    return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [analyses, selectedBiomarker, period]);

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  // Если нет биомаркеров - не показываем виджет
  if (allBiomarkers.length === 0) return null;

  // Компактный график SVG
  const renderMiniChart = () => {
    if (chartData.length === 0) {
      return <p className="text-xs text-gray-400 text-center py-4">Выберите показатель</p>;
    }
    if (chartData.length === 1) {
      return (
        <div className="text-center py-4">
          <span className="text-2xl font-bold text-brand-600">{chartData[0].value}</span>
          {chartData[0].unit && <span className="text-sm text-gray-500 ml-1 font-medium">{chartData[0].unit}</span>}
          <span className="text-xs text-gray-400 ml-2">{formatShortDate(chartData[0].date)}</span>
        </div>
      );
    }

    const values = chartData.map(d => d.value);
    const minVal = Math.min(...values) * 0.9;
    const maxVal = Math.max(...values) * 1.1;
    const range = maxVal - minVal || 1;
    
    const width = 260;
    const height = 60;
    const padding = 10;
    
    const points = chartData.map((d, i) => {
      const x = padding + (i / (chartData.length - 1)) * (width - padding * 2);
      const y = height - padding - ((d.value - minVal) / range) * (height - padding * 2);
      return { x, y, ...d };
    });
    
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <defs>
          <linearGradient id="miniGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${linePath} L ${points[points.length-1].x} ${height} L ${points[0].x} ${height} Z`} fill="url(#miniGradient)" />
        <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="white" stroke={p.status === 'normal' ? '#10b981' : '#ef4444'} strokeWidth="2" />
        ))}
      </svg>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header - кликабельный для раскрытия */}
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChartIcon size={18} className="text-brand-500" />
          <span className="font-bold text-gray-900 text-sm">📊 Динамика показателей</span>
        </div>
        <ChevronRightIcon size={18} className={`text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {/* Описание */}
          <div className="mt-3 mb-3 p-2 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-[10px] text-gray-600 leading-relaxed">
              Отслеживайте динамику выбранного показателя: как менялся уровень гемоглобина, витамина D и других биомаркеров во времени
            </p>
          </div>

          {/* Выбор показателя */}
          <div className="flex gap-2">
            <select
              value={selectedBiomarker}
              onChange={(e) => setSelectedBiomarker(e.target.value)}
              className="flex-1 p-2 border border-gray-200 rounded-lg text-xs bg-white"
            >
              <option value="">Выберите показатель...</option>
              {allBiomarkers.map(b => (
                <option key={b.code} value={b.code}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Период */}
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1 mt-3 w-fit">
            {periods.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1 text-xs rounded-md transition-all ${
                  period === p.value 
                    ? 'bg-white shadow text-gray-900 font-medium' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Мини-график */}
          <div className="mt-3">
            {renderMiniChart()}
          </div>

          {/* Статистика */}
          {chartData.length > 1 && (
            <div className="mt-2 flex justify-around text-center border-t border-gray-100 pt-2">
              <div>
                <div className="text-sm font-bold text-gray-900">
                  {Math.min(...chartData.map(d => d.value)).toFixed(1)}
                  {chartData[0].unit && <span className="text-[10px] font-normal text-gray-500 ml-0.5">{chartData[0].unit}</span>}
                </div>
                <div className="text-[9px] text-gray-400">Мин</div>
              </div>
              <div>
                <div className="text-sm font-bold text-brand-600">
                  {(chartData.reduce((s, d) => s + d.value, 0) / chartData.length).toFixed(1)}
                  {chartData[0].unit && <span className="text-[10px] font-normal text-gray-500 ml-0.5">{chartData[0].unit}</span>}
                </div>
                <div className="text-[9px] text-gray-400">Сред</div>
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">
                  {Math.max(...chartData.map(d => d.value)).toFixed(1)}
                  {chartData[0].unit && <span className="text-[10px] font-normal text-gray-500 ml-0.5">{chartData[0].unit}</span>}
                </div>
                <div className="text-[9px] text-gray-400">Макс</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Toast({ message, type = 'success', onClose }: { message: string, type?: 'success' | 'error', onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-20 left-4 right-4 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 ${
      type === 'success' ? 'bg-gray-900 text-white' : 'bg-red-500 text-white'
    }`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
        type === 'success' ? 'bg-brand-500' : 'bg-white/20'
      }`}>
        {type === 'success' ? <CheckCircleIcon size={18} /> : <AlertCircleIcon size={18} />}
      </div>
      <div className="flex-1 font-medium text-sm">{message}</div>
      <button onClick={onClose} className="opacity-70 hover:opacity-100">✕</button>
    </div>
  );
}

// Функция для форматирования markdown текста в JSX
function formatMarkdownText(text: string) {
  if (!text) return null;
  if (typeof text !== 'string') return <span>{String(text)}</span>;
  
  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let key = 0;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Пропускаем пустые строки
    if (!line.trim()) {
      elements.push(<br key={key++} />);
      continue;
    }
    
    // Обрабатываем заголовки (###)
    if (line.startsWith('###')) {
      const headerText = line.replace(/^###\s*/, '').replace(/⚠️|💡|📊|🔬/g, '').trim();
      elements.push(
        <div key={key++} className="font-bold text-sm text-gray-900 mt-3 mb-1">
          {headerText}
        </div>
      );
      continue;
    }
    
    // Обрабатываем элементы списка с ####
    if (line.startsWith('####')) {
      line = line.replace(/^####\s*/, '');
    }
    
    // Обрабатываем жирный текст (**)
    const parts: (string | JSX.Element)[] = [];
    let currentText = line;
    let partKey = 0;
    
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let lastIndex = 0;
    let match;
    
    while ((match = boldRegex.exec(currentText)) !== null) {
      // Добавляем текст до жирного
      if (match.index > lastIndex) {
        parts.push(currentText.substring(lastIndex, match.index));
      }
      // Добавляем жирный текст
      parts.push(<strong key={`bold-${key}-${partKey++}`} className="font-bold text-gray-900">{match[1]}</strong>);
      lastIndex = match.index + match[0].length;
    }
    
    // Добавляем оставшийся текст
    if (lastIndex < currentText.length) {
      parts.push(currentText.substring(lastIndex));
    }
    
    // Если нет жирного текста, просто используем исходную строку
    if (parts.length === 0) {
      parts.push(currentText);
    }
    
    elements.push(
      <div key={key++} className="leading-relaxed">
        {parts}
      </div>
    );
  }
  
  return <>{elements}</>;
}

// === BIOMARKER TABLE PAGE ===
// Таблица анализов (как в health-tracker.ru)
function BiomarkerTablePage({ 
  processingIds = [], 
  onProcessingFound, 
  onUploadStart, 
  onUploadSuccess 
}: {
  processingIds?: number[];
  onProcessingFound?: (ids: number[]) => void;
  onUploadStart?: () => void;
  onUploadSuccess?: (id: number) => void;
}) {
  const { checkAndPromptMedcard } = useMedcard();
  const [biomarkers, setBiomarkers] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [latestAiAnalysis, setLatestAiAnalysis] = useState<any | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedBiomarker, setSelectedBiomarker] = useState<any | null>(null);
  const [aiBlockExpanded, setAiBlockExpanded] = useState(false);
  const [addBiomarkerCategory, setAddBiomarkerCategory] = useState<string | null>(null);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadBiomarkers();
    loadAnalyses();
    loadProducts();
  }, []);

  const prevProcessingIdsRef = useRef<number[]>([]);
  
  // Следим за завершением обработки анализов
  useEffect(() => {
    // Находим ID, которые исчезли из списка (значит, завершились)
    const completedIds = prevProcessingIdsRef.current.filter(id => !processingIds.includes(id));
    
    if (completedIds.length > 0) {
      console.log('Analysis completed, reloading data:', completedIds);
      // Перезагружаем данные без показа лоадера (тихое обновление)
      loadBiomarkers(true);
      loadAnalyses(true);
      setToast({msg: '✅ Данные обновлены', type: 'success'});
    }
    
    prevProcessingIdsRef.current = processingIds;
  }, [processingIds]);

  const loadProducts = async () => {
    try {
      const data = await productsApi.getAll();
      setProducts(data || []);
    } catch (err) {
      console.error("Failed to load products", err);
    }
  };

  // Категории из нового анализа для автораскрытия
  const [categoriesToExpand, setCategoriesToExpand] = useState<string[]>([]);
  
  const loadBiomarkers = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await biomarkersApi.getAll();
      console.log('[LoadBiomarkers] Loaded:', data.items?.length, 'biomarkers');
      setBiomarkers(data.items || []);
    } catch (err) {
      console.error("Failed to load biomarkers", err);
      setToast({msg: 'Ошибка загрузки данных', type: 'error'});
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadAnalyses = async (silent = false) => {
    try {
      const items = await analysesApi.getAll();
      console.log('[BiomarkerTable] Loaded analyses:', items.length, items);
      setAnalyses(items);
      
      // Находим анализы в обработке и уведомляем родителя
      const processing = items.filter((a: any) => a.status === 'processing' || a.status === 'pending');
      if (processing.length > 0 && onProcessingFound) {
        onProcessingFound(processing.map((p: any) => p.id));
      }
      
      // Загружаем полные данные последнего завершенного анализа для AI-комментариев
      const completed = items.filter((a: any) => a.status === 'completed');
      
      if (completed.length > 0) {
        const latestId = completed[0].id;
        // Если это тихое обновление, не спамим логами
        if (!silent) console.log('[BiomarkerTable] Loading full data for analysis:', latestId);
        
        const fullData = await analysesApi.getById(latestId);
        setLatestAiAnalysis(fullData);
      }
    } catch (err) {
      console.error("Failed to load analyses", err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!checkAndPromptMedcard()) return;
    
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setUploading(true);
      if (onUploadStart) onUploadStart();
      
      const newAnalysis = await analysesApi.upload(file);
      
      if (newAnalysis?.id && onUploadSuccess) {
        onUploadSuccess(newAnalysis.id);
      }
      
      setToast({msg: '🚀 Анализ загружен! AI обрабатывает...', type: 'success'});
      
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error("Upload failed", err);
      setToast({msg: `❌ ${err?.message || 'Ошибка загрузки'}`, type: 'error'});
    } finally {
      setUploading(false);
    }
  };
  
  // React to processing completion (via props)
  const prevProcessingRef = useRef<number[]>([]);
  useEffect(() => {
    const prev = prevProcessingRef.current;
    const current = processingIds;
    
    const removed = prev.filter(id => !current.includes(id));
    if (removed.length > 0) {
       // Data refresh logic
       loadBiomarkers();
       loadAnalyses();
       
       // Handle expansion
       removed.forEach(async id => {
          try {
             const detail = await analysesApi.getById(id);
             if (detail.status === 'completed' && detail.biomarkers?.length > 0) {
                 const newCats = detail.biomarkers.map((b: any) => {
                    const cat = b.category?.toUpperCase() || detectCategory(b.name || b.biomarker_name || '', b.code || '');
                    return cat;
                 });
                 // Deduplicate
                 const uniqueCats = Array.from(new Set(newCats)) as string[];
                 setCategoriesToExpand(uniqueCats);
                 setToast({msg: '✅ Анализ обработан!', type: 'success'});
             }
          } catch(e) { console.error(e); }
       });
    }
    prevProcessingRef.current = current;
  }, [processingIds]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all'); // Фильтр категории
  const [filterAbnormal, setFilterAbnormal] = useState(false);
  const [filterFilled, setFilterFilled] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Названия категорий на русском
  const categoryNames: Record<string, string> = {
    'HEMATOLOGY': '🩸 Гематология',
    'BIOCHEMISTRY': '🧪 Биохимия',
    'HORMONES': '⚡ Гормоны',
    'VITAMINS': '💊 Витамины',
    'MINERALS': '🔬 Минералы',
    'LIPIDS': '🫀 Липиды',
    'LIVER': '🫁 Печень',
    'KIDNEY': '💧 Почки',
    'THYROID': '🦋 Щитовидная железа',
    'INFLAMMATION': '🔥 Воспаление',
    'GASTROINTESTINAL': '🍽️ ЖКТ',
    'BONE': '🦴 Костная система',
    'MUSCULOSKELETAL': '💪 Костно-мышечная',
    'ADRENAL': '⚙️ Надпочечники',
    'NERVOUS': '🧠 Нервная система',
    'PANCREAS': '🥞 Поджелудочная железа',
    'PARATHYROID': '🔆 Паращитовидная железа',
    'CARDIOVASCULAR': '❤️ Сердечно-сосудистая',
    'REPRODUCTIVE': '👶 Репродуктивная система',
    'URINARY': '💦 Мочевыделительная',
    'IMMUNE': '🛡️ Иммунная система',
    'COAGULATION': '🩹 Свертываемость крови',
    'OTHER': '📋 Прочее',
  };

  // Автоопределение категории по названию биомаркера
  const detectCategory = (name: string, code: string): string => {
    const n = (name || '').toLowerCase();
    const c = (code || '').toLowerCase();
    
    // Гематология (ПЕРВЫМ - общий анализ крови)
    if (/эритроцит|гемоглобин|гематокрит|лейкоцит|тромбоцит|тромбокрит|нейтрофил|лимфоцит|моноцит|эозинофил|базофил|rdw|mcv|mch|mchc|wbc|rbc|hgb|hct|plt|pct|соэ|esr|цп|цпэ|цветовой|палочкоядер|сегментоядер|юные|ретикулоцит|mpv/i.test(n + c)) {
      return 'HEMATOLOGY';
    }
    // Печень
    if (/алт|аст|alt|ast|билирубин|bilirubin|ггт|ggt|щф|alp|печен/i.test(n + c)) {
      return 'LIVER';
    }
    // Почки
    if (/креатинин|creatinine|мочевин|urea|мочев.*кислот|uric/i.test(n + c)) {
      return 'KIDNEY';
    }
    // Липиды
    if (/холестерин|cholesterol|лпвп|лпнп|hdl|ldl|триглицерид|lipid/i.test(n + c)) {
      return 'LIPIDS';
    }
    // Гормоны (без ТТГ - это щитовидка)
    if (/тестостерон|эстроген|прогестерон|кортизол|инсулин|пролактин|лг|фсг/i.test(n + c)) {
      return 'HORMONES';
    }
    // Щитовидка
    if (/ттг|tsh|т3|т4|t3|t4|тироксин|трийод|щитовид|thyroid/i.test(n + c)) {
      return 'THYROID';
    }
    // Витамины
    if (/витамин|vitamin|b12|b6|d3|фолиев|фолат/i.test(n + c)) {
      return 'VITAMINS';
    }
    // Минералы
    if (/железо|iron|ферритин|ferritin|кальций|calcium|магний|magnesium|калий|potassium|натрий|sodium|цинк|zinc/i.test(n + c)) {
      return 'MINERALS';
    }
    // Воспаление (без СОЭ - это гематология)
    if (/срб|crp|c-реактив|воспал|прокальцитонин/i.test(n + c)) {
      return 'INFLAMMATION';
    }
    // Биохимия (общее)
    if (/глюкоз|glucose|белок|protein|альбумин|albumin|амилаз|amylase|кфк|ck|лдг|ldh/i.test(n + c)) {
      return 'BIOCHEMISTRY';
    }
    
    // Новые категории
    if (/желудок|gastric|пепсин|pepsin|кишечник|intestinal|кальпротектин|calprotectin|эластаза|elastase|хеликобактер|helicobacter|гастрин|gastrin/i.test(n + c)) return 'GASTROINTESTINAL';
    if (/остеокальцин|osteocalcin|дезоксипиридинолин|dpd|crosslaps|костная щелочная/i.test(n + c)) return 'BONE';
    if (/миоглобин|myoglobin|креатинкиназа|creatine kinase|cpk|лактат|lactate/i.test(n + c)) return 'MUSCULOSKELETAL';
    if (/кортизол|cortisol|альдостерон|aldosterone|ренин|renin|адреналин|adrenaline|метанефрин|metanephrine|актг|acth/i.test(n + c)) return 'ADRENAL';
    if (/серотонин|serotonin|дофамин|dopamine|гомоцистеин|homocysteine|ацетилхолин|acetylcholine/i.test(n + c)) return 'NERVOUS';
    if (/амилаза|amylase|липаза|lipase|инсулин|insulin|с-пептид|c-peptide|hba1c|гликированный/i.test(n + c)) return 'PANCREAS';
    if (/паратгормон|parathyroid|pth|паратиреоидный/i.test(n + c)) return 'PARATHYROID';
    if (/тропонин|troponin|bnp|nt-probnp|миокард|cardiac/i.test(n + c)) return 'CARDIOVASCULAR';
    if (/тестостерон|testosterone|эстрадиол|estradiol|прогестерон|progesterone|пролактин|prolactin|лг|lh|фсг|fsh|амг|amh|хгч|hcg|спермограмма/i.test(n + c)) return 'REPRODUCTIVE';
    if (/моча|urine|urinary|альбумин в моче|microalbumin|белок в моче/i.test(n + c)) return 'URINARY';
    if (/иммуноглобулин|immunoglobulin|igg|iga|igm|ige|лимфоцит|cd4|cd8|интерферон|цитокин/i.test(n + c)) return 'IMMUNE';
    if (/протромбин|prothrombin|пти|pt|мно|inr|ачтв|aptt|фибриноген|fibrinogen|д-димер|d-dimer|антитромбин/i.test(n + c)) return 'COAGULATION';

    return 'OTHER';
  };

  // Фильтрация
  const filteredBiomarkers = useMemo(() => {
    let result = biomarkers;

    // Поиск
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(b => 
        b.name?.toLowerCase().includes(query) ||
        b.code?.toLowerCase().includes(query)
      );
    }

    // Только отклонения
    if (filterAbnormal) {
      result = result.filter(b => 
        b.last_status === 'low' || 
        b.last_status === 'high' || 
        b.last_status === 'critical_low' || 
        b.last_status === 'critical_high'
      );
    }

    return result;
  }, [biomarkers, searchQuery, filterAbnormal]);

  const [showCreateModal, setShowCreateModal] = useState(false); // Удалить потом, если не используется

  // Группировка по категориям (с автоопределением)
  const groupedBiomarkers = useMemo(() => {
    // Инициализируем категории
    const groups: Record<string, any[]> = {};
    const orderedCategories = [
      'HEMATOLOGY', 'BIOCHEMISTRY', 'HORMONES', 'VITAMINS', 'MINERALS',
      'LIPIDS', 'LIVER', 'KIDNEY', 'THYROID', 'INFLAMMATION',
      'GASTROINTESTINAL', 'BONE', 'MUSCULOSKELETAL', 'ADRENAL', 'NERVOUS',
      'PANCREAS', 'PARATHYROID', 'CARDIOVASCULAR', 'REPRODUCTIVE', 'URINARY',
      'IMMUNE', 'COAGULATION', 'OTHER'
    ];
    
    // Если выбрана конкретная категория, берем только её
    const categoriesToShow = selectedCategory === 'all' 
      ? orderedCategories 
      : orderedCategories.filter(c => c === selectedCategory);
    
    categoriesToShow.forEach(cat => {
      groups[cat] = [];
    });

    console.log('[GroupBiomarkers] Total biomarkers:', filteredBiomarkers.length);
    
    // Заполняем данными
    filteredBiomarkers.forEach(b => {
      // Используем category из API, если есть, иначе определяем автоматически
      const apiCategory = (b as any).category;
      const cat = apiCategory?.toUpperCase() || detectCategory(b.name || '', b.code || '');
      const targetCat = groups[cat] ? cat : 'OTHER';
      
      console.log(`[GroupBiomarkers] ${b.name}: API category="${apiCategory}" -> "${cat}" -> target="${targetCat}"`);
      
      // Добавляем только если категория отображается
      if (groups[targetCat]) {
        groups[targetCat].push(b);
      }
    });

    // Если идет поиск, включен фильтр "Только заполненные" ИЛИ "Только отклонения" - скрываем пустые категории
    if (searchQuery || filterFilled || filterAbnormal) {
      Object.keys(groups).forEach(key => {
        if (groups[key].length === 0) {
          delete groups[key];
        }
      });
    }

    return groups;
  }, [filteredBiomarkers, searchQuery, filterFilled, selectedCategory]);

  // Автораскрытие папок из нового анализа
  useEffect(() => {
    if (categoriesToExpand.length > 0) {
      console.log('[AutoExpand] Expanding categories from new analysis:', categoriesToExpand);
      
      // Небольшая задержка чтобы данные успели обновиться
      setTimeout(() => {
        setExpandedCategories(prev => {
          const updated = new Set(prev);
          categoriesToExpand.forEach(cat => updated.add(cat));
          console.log('[AutoExpand] Updated expanded categories:', Array.from(updated));
          return updated;
        });
        setCategoriesToExpand([]);
      }, 500);
    }
  }, [categoriesToExpand]);
  
  // Раскрываем все непустые папки при первой загрузке данных
  const hasExpandedOnLoad = useRef(false);
  useEffect(() => {
    if (!hasExpandedOnLoad.current && biomarkers.length > 0 && !loading) {
      hasExpandedOnLoad.current = true;
      
      // Находим все категории с данными
      const filledCats = new Set<string>();
      biomarkers.forEach((b: any) => {
        if (b.last_value !== null && b.last_value !== undefined) {
          const cat = b.category?.toUpperCase() || detectCategory(b.name || '', b.code || '');
          filledCats.add(cat);
        }
      });
      
      console.log('[AutoExpand] Initial load - expanding:', Array.from(filledCats));
      setExpandedCategories(filledCats);
    }
  }, [biomarkers, loading]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  // Открыть детали биомаркера
  const openBiomarkerDetail = async (code: string) => {
    console.log('[BiomarkerTable] Opening detail for code:', code);
    try {
      const data = await biomarkersApi.getDetail(code);
      console.log('[BiomarkerTable] Got detail data:', JSON.stringify(data));
      if (data && data.code) {
        setSelectedBiomarker(data);
      } else {
        console.error('[BiomarkerTable] Invalid data structure:', data);
        setToast({msg: 'Данные не найдены или некорректны', type: 'error'});
      }
    } catch (err: any) {
      console.error("Failed to load biomarker details", err);
      setToast({msg: `Ошибка: ${err?.message || 'Не удалось загрузить детали'}`, type: 'error'});
    }
  };

  if (selectedBiomarker) {
    return <BiomarkerDetailPage 
      biomarker={selectedBiomarker} 
      onBack={() => setSelectedBiomarker(null)} 
      onUpdate={() => {
        loadBiomarkers(); // Перезагрузка списка при обновлении в деталях
      }}
    />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 pb-24">
      {/* Toast */}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Заголовок и кнопка загрузки */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Таблица анализов</h1>
            <p className="text-sm text-gray-500 mt-1">История ваших медицинских показателей</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors disabled:bg-gray-300 flex items-center gap-2 shadow-md"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Загрузка...</span>
              </>
            ) : (
              <>
                <UploadIcon className="w-5 h-5" />
                <span>Загрузить</span>
              </>
            )}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Аналитика */}
        {analyses.length > 0 && <AnalyticsWidget analyses={analyses} />}

        {/* AI Заключение */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Header */}
          <button 
            onClick={() => setAiBlockExpanded(!aiBlockExpanded)}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900">Заключение ИИ</h3>
                {!aiBlockExpanded && latestAiAnalysis?.ai_summary && (
                  <span className="text-xs text-gray-500">Есть рекомендации</span>
                )}
              </div>
            </div>
            <ChevronRightIcon className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${aiBlockExpanded ? 'rotate-90' : ''}`} />
          </button>
          
          {/* Content */}
          <div className={`overflow-hidden transition-all duration-500 ease-in-out ${aiBlockExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="px-5 pb-5 space-y-4 border-t border-gray-100">
              {/* AI Summary */}
              <div className="pt-4">
                <div className="text-sm text-gray-600 leading-relaxed">
                  {latestAiAnalysis?.ai_summary ? (
                    formatMarkdownText(latestAiAnalysis.ai_summary)
                  ) : biomarkers.length > 0 ? (
                    <p>
                      Обнаружено <strong>{biomarkers.filter((b: any) => b.last_status !== 'normal').length}</strong> показателей, 
                      требующих внимания. Рекомендуется консультация с врачом.
                    </p>
                  ) : (
                    <p className="text-gray-400">Загрузите анализы для получения рекомендаций</p>
                  )}
                </div>
              </div>

              {/* AI Recommendations (Список БАДов от AI) */}
              {latestAiAnalysis?.ai_recommendations?.items && latestAiAnalysis.ai_recommendations.items.length > 0 && (
                <div className="pt-4 border-t border-gray-100">
                   <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Рекомендованные добавки (AI)</h4>
                   
                   <div className="space-y-4">
                     {latestAiAnalysis.ai_recommendations.items.map((rec: any, i: number) => {
                       // Используем данные продукта прямо из рекомендации
                       const product = rec.product;
                       
                       if (!product) {
                         return null;
                       }

                       return (
                         <div key={i} className="bg-white rounded-2xl border-2 border-gray-100 shadow-md overflow-hidden">
                           <div className="relative">
                             {/* Placeholder для фото товара */}
                             <div className="w-full h-32 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                               <div className="text-gray-400 text-center">
                                 <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                 </svg>
                                 <div className="text-xs mt-2 font-medium">Фото товара</div>
                               </div>
                             </div>
                             
                             {/* Иконка закладки */}
                             <button className="absolute top-3 right-3 w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors">
                               <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                               </svg>
                             </button>
                           </div>
                           
                           <div className="p-4">
                             {/* Рейтинг */}
                             <div className="flex items-center gap-1 mb-2">
                               <div className="flex items-center gap-0.5 bg-amber-50 px-2 py-1 rounded-lg">
                                 <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                   <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                 </svg>
                                 <span className="text-xs font-bold text-amber-700">5</span>
                               </div>
                             </div>
                             
                             {/* Название товара */}
                             <h5 className="font-bold text-gray-900 text-sm leading-tight mb-2 line-clamp-2">
                               {product.name}
                             </h5>
                             
                             {/* Цена */}
                             <div className="text-2xl font-black text-gray-900 mb-1">
                               {product.price || 0}<span className="text-lg">₽</span>
                             </div>
                             
                             {/* Баллы за покупку (опционально) */}
                             <div className="text-xs text-gray-500 mb-3">
                               +{Math.round((product.price || 0) * 0.03)} баллов за покупку
                             </div>
                             
                             {/* Причина от AI */}
                             <div className="mb-3 flex items-start gap-1.5 text-xs text-indigo-700 bg-indigo-50 p-2.5 rounded-lg">
                               <SparklesIcon size={12} className="mt-0.5 shrink-0" />
                               <span className="font-medium">{rec.reason}</span>
                             </div>
                             
                             {/* Большая зелёная кнопка "В корзину" */}
                             <a
                               href={product.purchase_url || '#'}
                               target="_blank"
                               rel="noopener noreferrer"
                               className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl transition-colors shadow-lg shadow-emerald-200"
                             >
                               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                               </svg>
                               В корзину
                             </a>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                </div>
              )}
              
              {/* Рекомендуемые продукты */}
              {products.length > 0 && (
                <div className="pt-2">
                  <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Рекомендуемые препараты</h4>
                  <div className="space-y-2">
                    {products.slice(0, 3).map((product: any, i: number) => (
                      <div key={product.id || i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                        <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600 font-medium text-sm">
                          {product.name?.charAt(0) || 'V'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate">{product.name}</div>
                          {product.price && (
                            <div className="text-xs text-gray-500">{product.price} ₽</div>
                          )}
                        </div>
                        <a 
                          href={product.purchase_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors"
                        >
                          Купить
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Кнопка обновить */}
              <button
                onClick={() => {
                  loadAnalyses();
                  loadBiomarkers();
                  setToast({msg: 'Данные обновлены', type: 'success'});
                }}
                className="w-full py-2.5 text-gray-600 text-sm font-medium hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Обновить
              </button>
            </div>
          </div>
        </div>

        {/* Поиск и Категория */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Поиск */}
            <div className="relative flex-1 w-full md:w-auto">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск показателей..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:border-brand-500 focus:outline-none transition-all text-sm"
              />
            </div>
            
            {/* Категория */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full md:w-64 px-3 py-2.5 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:border-brand-500 focus:outline-none transition-all text-sm text-gray-700"
            >
              <option value="all">Все категории</option>
              {Object.entries(categoryNames).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>

            {/* Фильтры */}
            <div className="flex gap-4 items-center w-full md:w-auto justify-end md:justify-start">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filterFilled}
                  onChange={(e) => setFilterFilled(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm text-gray-600">Скрыть пустые</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filterAbnormal}
                  onChange={(e) => setFilterAbnormal(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-500"
                />
                <span className="text-sm text-gray-600">Только отклонения</span>
              </label>
            </div>
          </div>
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
          </div>
        )}

        {/* Список показателей по категориям (папкам) */}
        {!loading && (
          <div className="space-y-4">
            {Object.keys(groupedBiomarkers).length === 0 && searchQuery && (
               <div className="text-center py-12 bg-white rounded-xl shadow-sm">
                <div className="text-3xl mb-3">🔍</div>
                <h3 className="text-md font-semibold text-gray-700">Ничего не найдено</h3>
                <p className="text-sm text-gray-500 mt-1">Попробуйте изменить запрос</p>
              </div>
            )}

            {Object.entries(groupedBiomarkers)
              .sort(([, a], [, b]) => (b as any[]).length - (a as any[]).length) // Заполненные папки вверху
              .map(([category, items]) => {
              const isExpanded = expandedCategories.has(category) || expandedCategories.has('all');
              const categoryColors: Record<string, string> = {
                'HEMATOLOGY': 'from-red-500 to-rose-600',
                'BIOCHEMISTRY': 'from-purple-500 to-violet-600',
                'HORMONES': 'from-amber-500 to-orange-600',
                'VITAMINS': 'from-green-500 to-brand-600',
                'MINERALS': 'from-cyan-500 to-teal-600',
                'LIPIDS': 'from-pink-500 to-rose-600',
                'LIVER': 'from-yellow-500 to-amber-600',
                'KIDNEY': 'from-blue-500 to-indigo-600',
                'THYROID': 'from-indigo-500 to-purple-600',
                'INFLAMMATION': 'from-orange-500 to-red-600',
                'GASTROINTESTINAL': 'from-lime-500 to-green-600',
                'BONE': 'from-stone-500 to-gray-600',
                'MUSCULOSKELETAL': 'from-red-600 to-rose-700',
                'ADRENAL': 'from-yellow-600 to-orange-700',
                'NERVOUS': 'from-purple-600 to-indigo-700',
                'PANCREAS': 'from-amber-600 to-yellow-700',
                'PARATHYROID': 'from-sky-500 to-blue-600',
                'CARDIOVASCULAR': 'from-red-500 to-pink-600',
                'REPRODUCTIVE': 'from-pink-600 to-rose-700',
                'URINARY': 'from-cyan-600 to-blue-700',
                'IMMUNE': 'from-brand-500 to-green-700',
                'COAGULATION': 'from-rose-600 to-red-700',
                'OTHER': 'from-gray-500 to-slate-600',
              };
              const gradient = categoryColors[category] || categoryColors['OTHER'];
              
              return (
                <div key={category} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
                  {/* Заголовок категории (папка) */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-4">
                      {/* Иконка папки с градиентом */}
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform`}>
                        <span className="text-2xl filter drop-shadow-sm">
                          {categoryNames[category]?.split(' ')[0] || '📋'}
                        </span>
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-gray-800 text-lg">
                          {categoryNames[category]?.split(' ').slice(1).join(' ') || category}
                        </div>
                        <div className="text-sm text-gray-500">
                          {items.length} {items.length === 1 ? 'показатель' : items.length < 5 ? 'показателя' : 'показателей'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Бейдж с количеством */}
                      <span className={`px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r ${gradient} text-white shadow-md`}>
                        {items.length}
                      </span>
                      {/* Стрелка */}
                      <div className={`w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center transition-all duration-300 ${isExpanded ? 'bg-gray-200 rotate-90' : ''}`}>
                        <ChevronRightIcon className="w-5 h-5 text-gray-600" />
                      </div>
                    </div>
                  </button>
                  
                  {/* Биомаркеры внутри категории */}
                  <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="border-t border-gray-100">
                      {items.map((bio: any, idx: number) => (
                        <button
                          key={bio.code}
                          onClick={() => openBiomarkerDetail(bio.code)}
                          className={`w-full px-5 py-4 hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all text-left flex items-center gap-4 ${idx !== items.length - 1 ? 'border-b border-gray-50' : ''}`}
                        >
                          {/* Индикатор статуса */}
                          <div className={`w-2 h-10 rounded-full ${
                            bio.last_status === 'normal' ? 'bg-green-400' :
                            bio.last_status === 'low' ? 'bg-blue-400' :
                            bio.last_status === 'high' ? 'bg-orange-400' :
                            bio.last_status === 'critical' ? 'bg-red-500' :
                            'bg-gray-200'
                          }`} />
                          
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-800 truncate">{bio.name}</div>
                            <div className="text-sm text-gray-500 mt-0.5 flex items-center gap-2">
                              <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">{bio.unit}</span>
                              <span>•</span>
                              <span>{bio.total_measurements} измерений</span>
                            </div>
                          </div>
                          
                          <div className="text-right flex-shrink-0">
                            {bio.last_value !== null && bio.last_value !== undefined ? (
                              <div>
                                <div className={`text-xl font-bold ${
                                  bio.last_status === 'normal' ? 'text-green-600' :
                                  bio.last_status === 'low' ? 'text-blue-600' :
                                  bio.last_status === 'high' ? 'text-orange-600' :
                                  bio.last_status === 'critical' ? 'text-red-600' :
                                  'text-gray-700'
                                }`}>
                                  {bio.last_value}
                                </div>
                                {bio.last_measured_at && (
                                  <div className="text-xs text-gray-400 mt-1">
                                    {new Date(bio.last_measured_at).toLocaleDateString('ru-RU', {
                                      day: 'numeric',
                                      month: 'short',
                                    })}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400 italic">нет данных</span>
                            )}
                          </div>
                          
                          <ChevronRightIcon className="w-5 h-5 text-gray-300 flex-shrink-0" />
                        </button>
                      ))}
                      {/* Кнопка добавить показатель */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddBiomarkerCategory(category);
                        }}
                        className="w-full px-5 py-3 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 border-t border-gray-100"
                      >
                        <span className="text-lg">+</span>
                        Добавить показатель
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Модалка добавления нового показателя в категорию */}
      {addBiomarkerCategory && (
        <AddNewBiomarkerModal
          category={addBiomarkerCategory}
          categoryName={categoryNames[addBiomarkerCategory] || addBiomarkerCategory}
          onClose={() => setAddBiomarkerCategory(null)}
          onSuccess={async () => {
            // Автоматически раскрываем папку, в которую добавили показатель
            setExpandedCategories(prev => {
              const next = new Set(prev);
              next.add(addBiomarkerCategory);
              return next;
            });
            setAddBiomarkerCategory(null);
            
            // Перезагружаем список
            await loadBiomarkers();
            
            // Показываем уведомление
            setToast({msg: 'Показатель добавлен!', type: 'success'});
          }}
        />
      )}
    </div>
  );
}

// Модалка добавления нового биомаркера в категорию
function AddNewBiomarkerModal({ category, categoryName, onClose, onSuccess }: any) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Список популярных показателей по категориям
  const suggestions: Record<string, string[]> = {
    'HORMONES': ['Тестостерон', 'Эстрадиол', 'Прогестерон', 'Пролактин', 'ЛГ', 'ФСГ', 'Кортизол', 'Инсулин', 'ДГЭА-С'],
    'VITAMINS': ['Витамин D', 'Витамин B12', 'Витамин B6', 'Фолиевая кислота', 'Витамин A', 'Витамин E'],
    'MINERALS': ['Железо', 'Ферритин', 'Цинк', 'Магний', 'Кальций', 'Калий', 'Натрий', 'Селен'],
    'HEMATOLOGY': ['Эритроциты', 'Гемоглобин', 'Гематокрит', 'Лейкоциты', 'Тромбоциты', 'СОЭ', 'Нейтрофилы', 'Лимфоциты'],
    'BIOCHEMISTRY': ['Глюкоза', 'Общий белок', 'Альбумин', 'Мочевая кислота', 'ЛДГ'],
    'LIPIDS': ['Общий холестерин', 'ЛПВП', 'ЛПНП', 'Триглицериды'],
    'LIVER': ['АЛТ', 'АСТ', 'ГГТ', 'Билирубин общий', 'Билирубин прямой', 'Щелочная фосфатаза'],
    'KIDNEY': ['Креатинин', 'Мочевина', 'СКФ', 'Мочевая кислота'],
    'THYROID': ['ТТГ', 'Т3 свободный', 'Т4 свободный', 'АТ-ТПО', 'АТ-ТГ'],
    'INFLAMMATION': ['СРБ', 'Прокальцитонин', 'Интерлейкин-6', 'Ферритин'],
    'GASTROINTESTINAL': ['Кальпротектин', 'Эластаза панкреатическая', 'H. pylori', 'Гастрин'],
    'BONE': ['Остеокальцин', 'Костная щелочная фосфатаза', 'CrossLaps', 'Кальций ионизированный'],
    'MUSCULOSKELETAL': ['Миоглобин', 'Креатинкиназа', 'КФК-МВ', 'Лактат'],
    'ADRENAL': ['Кортизол', 'Альдостерон', 'Ренин', 'АКТГ', 'Метанефрины'],
    'NERVOUS': ['Серотонин', 'Дофамин', 'Гомоцистеин', 'Витамин B12'],
    'PANCREAS': ['Амилаза', 'Липаза', 'Инсулин', 'С-пептид', 'HbA1c'],
    'PARATHYROID': ['Паратгормон', 'Кальций общий', 'Кальций ионизированный', 'Фосфор'],
    'CARDIOVASCULAR': ['Тропонин I', 'Тропонин T', 'NT-proBNP', 'BNP', 'Гомоцистеин'],
    'REPRODUCTIVE': ['Тестостерон', 'Эстрадиол', 'Прогестерон', 'АМГ', 'Ингибин B', 'ХГЧ'],
    'URINARY': ['Креатинин в моче', 'Микроальбумин', 'Белок в моче', 'Глюкоза в моче'],
    'IMMUNE': ['IgG', 'IgA', 'IgM', 'IgE общий', 'CD4', 'CD8', 'Интерферон'],
    'COAGULATION': ['Протромбин', 'МНО', 'АЧТВ', 'Фибриноген', 'Д-димер', 'Антитромбин III'],
    'OTHER': [],
  };

  // Популярные единицы измерения
  const commonUnits = [
    'ммоль/л', 'мкмоль/л', 'нмоль/л', 'пмоль/л',
    'г/л', 'мг/л', 'мкг/л', 'нг/мл', 'пг/мл',
    'Ед/л', 'мЕд/л', 'МЕ/л', 'МЕ/мл',
    '%', 'г/дл', 'мг/дл',
    '10^6/мкл', '10^3/мкл', '10^9/л', '10^12/л',
    'фл', 'пг', 'мм/ч', 'сек',
    'мкг/мл', 'нг/л', 'ед.',
  ];

  const currentSuggestions = suggestions[category] || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!name.trim()) {
      setError('Введите название показателя');
      return;
    }
    if (!value || isNaN(parseFloat(value))) {
      setError('Введите значение');
      return;
    }
    if (!unit) {
      setError('Выберите единицы измерения');
      return;
    }

    try {
      setLoading(true);
      
      // Создаём код из названия
      const code = name.trim().toUpperCase().replace(/\s+/g, '_').substring(0, 20);
      
      await biomarkersApi.addValue(code, {
        value: parseFloat(value),
        unit: unit.trim(),
        measured_at: date,
      });
      
      onSuccess();
    } catch (err: any) {
      console.error("[AddNewBiomarker] Failed:", err);
      setError(err?.message || 'Ошибка при добавлении');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Добавить показатель</h2>
            <p className="text-sm text-gray-500 mt-1">{categoryName?.replace(/^[^\s]+\s/, '')}</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Быстрый выбор */}
        {currentSuggestions.length > 0 && !name && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">Выберите или введите вручную:</label>
            <div className="flex flex-wrap gap-2">
              {currentSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setName(s)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Название */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название показателя</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Например: Тестостерон"
            />
          </div>

          {/* Значение и Единицы в одной строке */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Значение</label>
              <input
                type="text"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Единицы</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Выберите...</option>
                {commonUnits.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Дата */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Дата измерения</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Кнопки */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-3 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200"
              disabled={loading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="py-3 rounded-xl font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400"
              disabled={loading}
            >
              {loading ? 'Добавление...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Детальная страница биомаркера
function BiomarkerDetailPage({ biomarker: initialBiomarker, onBack, onUpdate }: { biomarker: any, onBack: () => void, onUpdate?: () => void }) {
  const [biomarker, setBiomarker] = useState(initialBiomarker);

  useEffect(() => {
    setBiomarker(initialBiomarker);
  }, [initialBiomarker]);

  const [showAddDateModal, setShowAddDateModal] = useState(false);
  const [editingValue, setEditingValue] = useState<any>(null); // Для редактирования
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [period, setPeriod] = useState<'all' | '1y' | '6m' | '3m' | 'custom'>('all');
  const [customRange, setCustomRange] = useState<{start: string, end: string} | null>(null);
  const [showRangePicker, setShowRangePicker] = useState(false);
  
  console.log('[BiomarkerDetail] Rendering with biomarker:', biomarker?.name, biomarker?.history?.length);
  
  // Защита от пустых данных
  if (!biomarker || !biomarker.code) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>Ошибка загрузки данных биомаркера</p>
        <button onClick={onBack} className="text-blue-600 mt-2">Назад</button>
      </div>
    );
  }
  
  const history = biomarker.history || [];

  const deleteValue = async (valueId: number) => {
    if (!confirm('Удалить это значение?')) return;
    
    try {
      await biomarkersApi.deleteValue(valueId);
      setToast({msg: 'Значение удалено', type: 'success'});
      
      try {
        // Перезагрузка данных
        const updated = await biomarkersApi.getDetail(biomarker.code);
        setBiomarker(updated);
      } catch (e: any) {
        // Если данных больше нет (404), значит мы удалили последнее значение
        // Закрываем страницу
        if (onBack) onBack();
      }
      
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Failed to delete value", err);
      setToast({msg: 'Ошибка удаления', type: 'error'});
    }
  };

  const reloadBiomarker = async () => {
    const updated = await biomarkersApi.getDetail(biomarker.code);
    setBiomarker(updated);
    if (onUpdate) onUpdate();
  };

  // График
  const chartData = useMemo(() => {
    if (!history.length) return [];
    
    let data = [...history]
      .filter((h: any) => h.measured_at || h.created_at)
      .sort((a: any, b: any) => {
        const dateA = new Date(a.measured_at || a.created_at).getTime();
        const dateB = new Date(b.measured_at || b.created_at).getTime();
        return dateA - dateB;
      });

    if (period === 'custom' && customRange) {
      const start = new Date(customRange.start);
      const end = new Date(customRange.end);
      // Set end to end of day
      end.setHours(23, 59, 59, 999);
      
      data = data.filter((h: any) => {
        const d = new Date(h.measured_at || h.created_at);
        return d >= start && d <= end;
      });
    } else if (period !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      
      if (period === '1y') cutoff.setFullYear(now.getFullYear() - 1);
      if (period === '6m') cutoff.setMonth(now.getMonth() - 6);
      if (period === '3m') cutoff.setMonth(now.getMonth() - 3);
      
      data = data.filter((h: any) => new Date(h.measured_at || h.created_at) >= cutoff);
    }

    return data;
  }, [history, period]);

  const renderChart = () => {
    if (chartData.length < 2) {
      return (
        <div className="text-center text-sm text-gray-400 py-8 border border-dashed border-gray-200 rounded-lg">
          Недостаточно данных для построения графика.<br/>
          Добавьте еще хотя бы одно значение.
        </div>
      );
    }

    const values = chartData.map((d: any) => d.value);
    const minVal = Math.min(...values, biomarker.min_value || 0);
    const maxVal = Math.max(...values, biomarker.max_value || 100);
    const range = maxVal - minVal || 1;
    
    const width = 300;
    const height = 150;
    const padding = 30;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;

    const points = chartData.map((d: any, i: number) => {
      const x = padding + (i / (chartData.length - 1)) * chartWidth;
      const y = height - padding - ((d.value - minVal) / range) * chartHeight;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto" role="img" aria-label="График динамики">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
          const y = height - padding - frac * chartHeight;
          const val = (minVal + frac * range).toFixed(1);
          return (
            <g key={i}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e0e0e0" strokeWidth="1" />
              <text x={padding - 5} y={y + 3} textAnchor="end" fontSize="10" fill="#999">{val}</text>
            </g>
          );
        })}

        {/* X-axis labels (Dates) */}
        {chartData.map((d: any, i: number) => {
           const showLabel = i === 0 || i === chartData.length - 1 || (chartData.length > 4 && i === Math.floor(chartData.length / 2));
           
           if (!showLabel) return null;

           const x = padding + (i / (chartData.length - 1)) * chartWidth;
           const dateStr = new Date(d.measured_at || d.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
           
           const anchor = i === 0 ? "start" : (i === chartData.length - 1 ? "end" : "middle");
           
           return (
              <text key={`date-${i}`} x={x} y={height - 5} textAnchor={anchor} fontSize="10" fill="#999">{dateStr}</text>
           );
        })}

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="#10b981"
          strokeWidth="2"
        />
        {/* Points */}
        {chartData.map((d: any, i: number) => {
          const x = padding + (i / (chartData.length - 1)) * chartWidth;
          const y = height - padding - ((d.value - minVal) / range) * chartHeight;
          return (
            <circle key={i} cx={x} cy={y} r="4" fill="#10b981" />
          );
        })}
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 pb-24">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Кнопка назад */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-blue-600 font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Назад
        </button>

        {/* Заголовок */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <h1 className="text-xl font-bold text-gray-800">{biomarker.name || biomarker.code || 'Биомаркер'}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {biomarker.unit || history.find((h: any) => h.unit)?.unit || '—'}
          </p>
          
          {/* Статистика */}
          {(() => {
            // Ищем последние доступные референсные значения
            const lastRefMin = history.find((h: any) => h.ref_min != null)?.ref_min;
            const lastRefMax = history.find((h: any) => h.ref_max != null)?.ref_max;
            const hasRef = lastRefMin !== undefined && lastRefMax !== undefined;
            // Ищем единицу измерения (у биомаркера или в истории)
            const displayUnit = biomarker.unit || history.find((h: any) => h.unit)?.unit;
            
            return (
              <div className="grid grid-cols-4 gap-2 mt-4" role="region" aria-label="Статистика">
                <div className="text-center">
                  <div className="text-[10px] text-gray-500 font-medium whitespace-nowrap mb-0.5">Реф. знач.</div>
                  <div className="text-sm font-bold text-gray-900 leading-tight">
                    {hasRef ? (
                      <span>
                        {lastRefMin}–{lastRefMax}
                        {displayUnit && <span className="text-[10px] font-normal text-gray-500 ml-0.5">{displayUnit}</span>}
                      </span>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-gray-500 font-medium whitespace-nowrap mb-0.5">Минимум</div>
                  <div className="text-lg font-bold text-blue-600 leading-none">
                    {biomarker.min_value?.toFixed(1) ?? '—'}
                    {biomarker.min_value !== undefined && <span className="text-[10px] font-normal text-gray-500 ml-0.5">{displayUnit}</span>}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-gray-500 font-medium whitespace-nowrap mb-0.5">Среднее</div>
                  <div className="text-lg font-bold text-gray-700 leading-none">
                    {biomarker.avg_value?.toFixed(1) ?? '—'}
                    {biomarker.avg_value !== undefined && <span className="text-[10px] font-normal text-gray-500 ml-0.5">{displayUnit}</span>}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-gray-500 font-medium whitespace-nowrap mb-0.5">Максимум</div>
                  <div className="text-lg font-bold text-red-600 leading-none">
                    {biomarker.max_value?.toFixed(1) ?? '—'}
                    {biomarker.max_value !== undefined && <span className="text-[10px] font-normal text-gray-500 ml-0.5">{displayUnit}</span>}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* График */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-md font-semibold text-gray-700">Динамика</h2>
            <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
              {(['all', '1y', '6m', '3m'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => { setPeriod(p); setCustomRange(null); }}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${
                    period === p ? 'bg-white shadow text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {p === 'all' ? 'Все' : p === '1y' ? 'Год' : p === '6m' ? '6 мес' : '3 мес'}
                </button>
              ))}
              <button
                onClick={() => setShowRangePicker(true)}
                className={`px-2 py-1 text-xs rounded-md transition-all flex items-center ${
                  period === 'custom' ? 'bg-white shadow text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Выбрать период"
              >
                📅
              </button>
            </div>
          </div>
          {renderChart()}
        </div>

        {/* История */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 flex items-center justify-between border-b border-gray-200">
            <h2 className="text-md font-semibold text-gray-700">История значений:</h2>
            <button
              onClick={() => setShowAddDateModal(true)}
              className="text-blue-600 text-sm font-medium flex items-center gap-1"
            >
              <span className="text-lg">+</span>
              Добавить значение
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {history.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-500">
                Нет данных. Добавьте первое значение.
              </div>
            )}
            {history.map((item: any) => (
              <div key={item.id} className="px-4 py-3 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${
                        item.status === 'normal' ? 'text-green-600' :
                        item.status === 'low' || item.status === 'high' ? 'text-orange-600' :
                        'text-red-600'
                      }`}>
                        {item.value}
                      </span>
                      <span className="text-sm text-gray-500">{item.unit}</span>
                      {item.ref_min && item.ref_max && (
                        <span className="text-xs text-gray-400">({item.ref_min}–{item.ref_max})</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-1">
                      <span>{new Date(item.measured_at || item.created_at).toLocaleDateString('ru-RU', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}</span>
                      {item.lab_name && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">{item.lab_name}</span>
                      )}
                      {item.analysis_title && (
                        <span>• {item.analysis_title}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Кнопка редактирования - для ВСЕХ значений */}
                    <button
                      onClick={() => setEditingValue(item)}
                      className="text-blue-500 hover:text-blue-700 p-1"
                      title="Редактировать"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {/* Кнопка удаления */}
                    <button
                      onClick={() => deleteValue(item.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Удалить"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Модалка выбора периода */}
      {showRangePicker && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          onClick={(e) => e.target === e.currentTarget && setShowRangePicker(false)}
        >
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-4 text-gray-900">Выбрать период</h3>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const start = formData.get('start') as string;
              const end = formData.get('end') as string;
              
              if (start && end) {
                setCustomRange({ start, end });
                setPeriod('custom');
                setShowRangePicker(false);
              }
            }} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Начало</label>
                <input 
                  name="start" 
                  type="date" 
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Конец</label>
                <input 
                  name="end" 
                  type="date" 
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRangePicker(false)}
                  className="py-3 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="py-3 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Применить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка добавления значения */}
      {showAddDateModal && (
        <AddDateModal
          biomarkerCode={biomarker.code || ''}
          biomarkerName={biomarker.name || biomarker.code || 'Показатель'}
          biomarkerUnit={biomarker.unit || 'ед.'}
          onClose={() => { setShowAddDateModal(false); }}
          onSuccess={async () => {
            setShowAddDateModal(false);
            setToast({msg: 'Значение добавлено', type: 'success'});
            await reloadBiomarker();
            if (onUpdate) onUpdate(); // Обновляем глобальный список
          }}
        />
      )}

      {/* Модалка редактирования */}
      {editingValue && (
        <EditValueModal
          item={editingValue}
          biomarkerUnit={biomarker.unit || 'ед.'}
          onClose={() => setEditingValue(null)}
          onSuccess={async () => {
            setEditingValue(null);
            setToast({msg: 'Значение обновлено', type: 'success'});
            await reloadBiomarker();
          }}
        />
      )}
    </div>
  );
}


// Модалка "Добавить дату"
function AddDateModal({ biomarkerCode, biomarkerName, biomarkerUnit, onClose, onSuccess }: any) {
  const [value, setValue] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [lab, setLab] = useState('');
  const [refMin, setRefMin] = useState('');
  const [refMax, setRefMax] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
    setValue(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const numValue = parseFloat(value);
    
    if (!value || isNaN(numValue)) {
      setError('Введите корректное значение');
      return;
    }
    if (!date) {
      setError('Выберите дату');
      return;
    }

    try {
      setLoading(true);
      
      await biomarkersApi.addValue(biomarkerCode, {
        value: numValue,
        unit: biomarkerUnit || 'ед.',
        measured_at: date,
        lab_name: lab || undefined,
        ref_min: refMin ? parseFloat(refMin) : undefined,
        ref_max: refMax ? parseFloat(refMax) : undefined,
      });
      
      onSuccess();
    } catch (err: any) {
      console.error("[AddDateModal] Failed:", err);
      setError(err?.message || 'Ошибка при добавлении значения');
    } finally {
      setLoading(false);
    }
  };

  // Helper to format date for display
  const formattedDate = new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl transform transition-all scale-100 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">Добавить значение</h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">{biomarkerName || biomarkerCode}</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-all -mr-2 -mt-2"
          >
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium flex items-center gap-2">
            <span>⚠️</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Значение */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
              Значение <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={value}
                onChange={handleValueChange}
                className="w-full bg-gray-50 border-2 border-transparent focus:bg-white focus:border-brand-500 rounded-2xl px-4 py-4 text-xl font-bold text-gray-900 placeholder-gray-400 outline-none transition-all pr-20"
                placeholder="0.0"
                autoFocus
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                {biomarkerUnit || 'ед.'}
              </span>
            </div>
          </div>

          {/* Дата */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
              Дата измерения <span className="text-red-500">*</span>
            </label>
            <div className="relative group">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
              />
              <div className="w-full bg-gray-50 border-2 border-transparent group-hover:bg-white group-hover:border-brand-200 rounded-2xl px-4 py-3.5 flex items-center justify-between text-gray-900 transition-all cursor-pointer">
                <span className="font-medium text-base">
                  {formattedDate}
                </span>
                <CalendarIcon className="text-gray-400 group-hover:text-brand-500 transition-colors" size={20} />
              </div>
            </div>
          </div>

          {/* Лаборатория и референсы */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-2xl">
            <p className="text-xs text-gray-500 font-medium">Данные лаборатории (опционально)</p>
            
            <input
              type="text"
              value={lab}
              onChange={(e) => setLab(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-500 transition-all placeholder-gray-400"
              placeholder="Лаборатория: Инвитро, КДЛ..."
            />
            
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={refMin}
                onChange={(e) => setRefMin(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
                className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand-500 transition-all placeholder-gray-400"
                placeholder="Норма от"
              />
              <span className="self-center text-gray-400">—</span>
              <input
                type="text"
                inputMode="decimal"
                value={refMax}
                onChange={(e) => setRefMax(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
                className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand-500 transition-all placeholder-gray-400"
                placeholder="Норма до"
              />
            </div>
            <p className="text-[10px] text-gray-400">Укажите норму из бланка для точного определения статуса</p>
          </div>

          {/* Кнопки */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="py-3.5 rounded-2xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all"
              disabled={loading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="py-3.5 rounded-2xl font-bold text-white bg-brand-500 hover:bg-brand-600 active:scale-95 disabled:bg-brand-300 disabled:scale-100 transition-all shadow-lg shadow-brand-200 flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Модалка "Редактировать значение"
function EditValueModal({ item, biomarkerUnit, onClose, onSuccess }: any) {
  const [value, setValue] = useState(String(item.value || ''));
  const [date, setDate] = useState(item.measured_at ? item.measured_at.split('T')[0] : new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
    setValue(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const numValue = parseFloat(value);
    
    if (!value || isNaN(numValue)) {
      setError('Введите корректное значение');
      return;
    }

    try {
      setLoading(true);
      
      await biomarkersApi.updateValue(item.id, {
        value: numValue,
        measured_at: date,
      });
      
      onSuccess();
    } catch (err: any) {
      console.error("[EditValueModal] Failed:", err);
      setError(err?.message || 'Ошибка при обновлении');
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">Редактировать</h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">Изменить значение показателя</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-all -mr-2 -mt-2"
          >
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium flex items-center gap-2">
            <span>⚠️</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Значение */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
              Значение <span className="text-red-500">*</span>
            </label>
            <div className="relative flex items-center group">
              <input
                type="text"
                inputMode="decimal"
                value={value}
                onChange={handleValueChange}
                className="w-full bg-gray-50 border-2 border-transparent focus:bg-white focus:border-blue-500 rounded-2xl px-4 py-3.5 text-lg font-semibold text-gray-900 placeholder-gray-400 outline-none transition-all pr-16"
                placeholder="0.0"
                autoFocus
              />
              <span className="absolute right-4 text-gray-400 font-medium pointer-events-none">
                {biomarkerUnit || 'ед.'}
              </span>
            </div>
          </div>

          {/* Дата */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
              Дата измерения <span className="text-red-500">*</span>
            </label>
            <div className="relative group">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
              />
              <div className="w-full bg-gray-50 border-2 border-transparent group-hover:bg-white group-hover:border-blue-200 rounded-2xl px-4 py-3.5 flex items-center justify-between text-gray-900 transition-all cursor-pointer">
                <span className="font-medium text-base">
                  {formattedDate}
                </span>
                <CalendarIcon className="text-gray-400 group-hover:text-blue-500 transition-colors" size={20} />
              </div>
            </div>
          </div>

          {/* Кнопки */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="py-3.5 rounded-2xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all"
              disabled={loading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="py-3.5 rounded-2xl font-bold text-white bg-blue-500 hover:bg-blue-600 active:scale-95 disabled:bg-blue-300 disabled:scale-100 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Страница анализов
function AnalysesPage() {
  const { isProfileFilled, checkAndPromptMedcard } = useMedcard();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedBiomarkers, setExpandedBiomarkers] = useState<number | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Track IDs that are currently processing
  const [processingIds, setProcessingIds] = useState<number[]>([]);

  // Раскрытие/сворачивание карточки анализа
  const toggleExpand = async (item: any) => {
    if (expandedId === item.id) {
      // Сворачиваем
      setExpandedId(null);
    } else {
      // Раскрываем и загружаем детали
      setExpandedId(item.id);
      
      // Загружаем полные данные если анализ готов и у нас еще нет ai_summary
      if (item.status === 'completed' && !item.ai_summary) {
        setLoadingDetails(true);
        try {
          const fullData = await analysesApi.getById(item.id);
          // Обновляем анализ в списке
          setAnalyses(prev => prev.map(a => a.id === item.id ? fullData : a));
        } catch (err) {
          console.error("Failed to load details", err);
        } finally {
          setLoadingDetails(false);
        }
      }
    }
  };

  useEffect(() => {
    loadAnalyses();
  }, []);

  // Polling logic for processing analyses
  useEffect(() => {
    if (processingIds.length === 0) return;

    const interval = setInterval(async () => {
      console.log('Polling status for:', processingIds);
      
      for (const id of processingIds) {
        try {
          // Check status using the detailed endpoint to get full data if ready
          const detail = await analysesApi.getById(id);
          
          if (detail.status === 'completed') {
            // Success!
            setProcessingIds(prev => prev.filter(pid => pid !== id));
            
            // Reload list silently to ensure data consistency
            loadAnalyses(true);
            
            setToast({ 
              msg: `✅ Анализ "${detail.title}" готов! Найдено показателей: ${detail.biomarkers?.length || 0}`, 
              type: 'success' 
            });
          } else if (detail.status === 'failed') {
            // Failed
            setProcessingIds(prev => prev.filter(pid => pid !== id));
            loadAnalyses(true); // Also reload on error to show correct status
            setToast({ 
              msg: `❌ Ошибка обработки: ${detail.error_message || 'Не удалось распознать'}`, 
              type: 'error' 
            });
          }
          // If still processing/pending, do nothing and wait for next poll
        } catch (e) {
          console.error("Poll error", e);
        }
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [processingIds]);

  const loadAnalyses = (silent = false) => {
    if (!silent) setLoading(true);
    analysesApi.getAll()
      .then(data => {
        setAnalyses(data);
        // Add any pending/processing items to poll list
        const pending = data.filter(a => a.status === 'pending' || a.status === 'processing').map(a => a.id);
        if (pending.length > 0) setProcessingIds(prev => [...new Set([...prev, ...pending])]);
      })
      .catch(console.error)
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  const handleUploadClick = () => {
    if (!checkAndPromptMedcard()) return;
    fileInputRef.current?.click();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const newAnalysis = await analysesApi.upload(file);
      // Add to list immediately with "pending" status
      setAnalyses(prev => [newAnalysis, ...prev]);
      // Start polling
      setProcessingIds(prev => [...prev, newAnalysis.id]);
      
      setToast({ msg: '🚀 Анализ загружен! AI начал обработку...', type: 'success' });
    } catch (err: any) {
      console.error(err);
      setToast({ msg: "Ошибка загрузки: " + (err.message || "Попробуйте позже"), type: 'error' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ... rest of the component (demoAnalyses, render logic) ...
  // Need to patch the return statement to include Toast and updated card rendering


  // Демо данные если API не вернул данные
  const demoAnalyses = [
    { 
      id: 1, 
      title: "Биохимия крови", 
      analysis_date: "28.11.2024", 
      status: "completed",
      ai_summary: "⬇️ Выявлен дефицит железа и ферритина. Рекомендуется прием препаратов железа и консультация терапевта.",
      biomarkers: [
        { name: "Железо", value: 8.2, unit: "мкмоль/л", status: "low", ref_min: 12.5, ref_max: 32.2 },
        { name: "Ферритин", value: 12, unit: "нг/мл", status: "low", ref_min: 20, ref_max: 250 },
        { name: "Гемоглобин", value: 125, unit: "г/л", status: "normal", ref_min: 120, ref_max: 160 },
      ],
      ai_recommendations: {
        items: [
          { product: { id: 1, name: "Железо хелат 25мг", price: 890 }, reason: "Восполнение дефицита железа" },
          { product: { id: 2, name: "Витамин С 1000мг", price: 590 }, reason: "Улучшает усвоение железа" },
        ]
      }
    },
    { 
      id: 2, 
      title: "Общий анализ крови", 
      analysis_date: "28.11.2024", 
      status: "completed",
      ai_summary: "✅ Все показатели в пределах нормы. Продолжайте поддерживать здоровый образ жизни!",
      biomarkers: [
        { name: "Эритроциты", value: 4.8, unit: "×10¹²/л", status: "normal", ref_min: 4.0, ref_max: 5.5 },
        { name: "Лейкоциты", value: 6.2, unit: "×10⁹/л", status: "normal", ref_min: 4.0, ref_max: 9.0 },
        { name: "Тромбоциты", value: 245, unit: "×10⁹/л", status: "normal", ref_min: 180, ref_max: 320 },
      ],
      ai_recommendations: { items: [] }
    },
    { 
      id: 3, 
      title: "Витамин D", 
      analysis_date: "15.11.2024", 
      status: "completed",
      ai_summary: "⬇️ Уровень витамина D ниже нормы. Рекомендуется прием витамина D3 в дозировке 2000-4000 МЕ в день.",
      biomarkers: [
        { name: "25-OH Витамин D", value: 18, unit: "нг/мл", status: "low", ref_min: 30, ref_max: 100 },
      ],
      ai_recommendations: {
        items: [
          { product: { id: 3, name: "Витамин D3 5000 МЕ", price: 690 }, reason: "Восполнение дефицита витамина D" },
          { product: { id: 4, name: "Витамин K2 MK-7", price: 790 }, reason: "Улучшает усвоение витамина D" },
        ]
      }
    },
  ];

  const displayAnalyses = analyses.length > 0 ? analyses : demoAnalyses;

  // Считаем количество АНАЛИЗОВ с отклонениями (не показателей!)
  const analysesWithIssues = displayAnalyses.filter((a: any) => 
    Array.isArray(a.biomarkers) && a.biomarkers.some((b: any) => b.status !== 'normal')
  ).length;
  
  // Общее количество показателей вне нормы (для информации)
  const totalBiomarkersOutOfRange = displayAnalyses.reduce((acc, a: any) => 
    acc + (Array.isArray(a.biomarkers) ? a.biomarkers.filter((b: any) => b.status !== 'normal').length : 0), 0
  );

  return (
    <div className="px-4 py-5 space-y-4">
      {/* Banner for unfilled medcard */}
      {!isProfileFilled && (
        <FillMedcardBanner onFill={() => {}} />
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Мои анализы</h1>
        <button
          onClick={handleUploadClick}
          disabled={uploading}
          className="w-10 h-10 rounded-full bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition-colors disabled:opacity-50"
        >
          {uploading ? <LoaderIcon size={20} className="animate-spin" /> : <PlusIcon size={20} />}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleUpload}
          className="hidden"
        />
      </div>

      {analysesWithIssues > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-3">
          <div className="text-rose-500">
            <AlertCircleIcon size={24} />
          </div>
          <div>
            <div className="font-bold text-rose-900 text-sm mb-1">
              Внимание: {analysesWithIssues} {analysesWithIssues === 1 ? 'анализ' : 'анализа'} с отклонениями
            </div>
            <div className="text-xs text-rose-700">
              {totalBiomarkersOutOfRange} {totalBiomarkersOutOfRange === 1 ? 'показатель' : 'показателей'} вне нормы. Нажмите на анализ для просмотра рекомендаций.
            </div>
          </div>
        </div>
      )}

      {/* Компактная аналитика показателей */}
      <AnalyticsWidget analyses={displayAnalyses} />

      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <LoaderIcon size={24} className="text-brand-500 animate-spin" />
          </div>
        ) : displayAnalyses.map((item: any, i) => {
          const isProcessing = item.status === 'pending' || item.status === 'processing';
          const isFailed = item.status === 'failed';
          const biomarkers = Array.isArray(item.biomarkers) ? item.biomarkers : [];
          const hasIssues = biomarkers.some((b: any) => b.status !== 'normal');
          const isExpanded = expandedId === item.id;
          
          // Проверяем, не завис ли анализ (более 5 минут в pending/processing)
          const createdAt = new Date(item.created_at).getTime();
          const now = Date.now();
          const minutesPending = (now - createdAt) / (1000 * 60);
          const isStuck = isProcessing && minutesPending > 5;
          
          return (
            <div 
              key={item.id || i} 
              className={`w-full bg-white rounded-xl border transition-all relative overflow-hidden ${
                isProcessing && !isStuck ? 'border-brand-200 shadow-sm' : 
                isFailed || isStuck ? 'border-red-200 opacity-80' :
                isExpanded ? 'border-brand-300 shadow-lg' :
                'border-gray-200 hover:shadow-md hover:border-brand-200'
              }`}
            >
              {/* Header (всегда видимый, кликабельный) */}
              <button 
                onClick={() => !isProcessing && !isStuck && toggleExpand(item)}
                disabled={isProcessing && !isStuck}
                className="w-full text-left p-4 transition-all"
              >
                {isProcessing && !isStuck && (
                  <div className="absolute inset-0 bg-brand-50/50 flex items-center justify-center z-10 backdrop-blur-[1px]">
                    <div className="flex flex-col items-center gap-2">
                      <LoaderIcon size={24} className="text-brand-500" />
                      <span className="text-xs font-bold text-brand-700 animate-pulse">AI обрабатывает...</span>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-bold text-gray-900 text-sm">{item.title}</div>
                    <div className="text-xs text-gray-400 mt-1">{item.analysis_date || item.created_at?.split('T')[0]}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isProcessing && (
                      <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                        isFailed || isStuck ? "bg-red-100 text-red-600" :
                        !hasIssues ? "bg-brand-50 text-brand-600" : "bg-rose-50 text-rose-600"
                      }`}>
                        {isFailed ? "Ошибка" : isStuck ? "Таймаут" : !hasIssues ? "Норма" : "Отклонение"}
                      </div>
                    )}
                    {!isProcessing && !isFailed && !isStuck && (
                      <ChevronRightIcon 
                        size={16} 
                        className={`text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} 
                      />
                    )}
                  </div>
                </div>
                
                {!isProcessing && !isFailed && !isStuck && !isExpanded && (
                  <div className="flex flex-wrap gap-2">
                    {biomarkers.slice(0, 3).map((b: any, j: number) => (
                      <span key={j} className={`text-xs px-2 py-1 rounded border ${
                        b.status === 'normal' ? 'bg-brand-50 text-brand-600 border-brand-200' :
                        b.status === 'low' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                        'bg-rose-50 text-rose-600 border-rose-200'
                      }`}>
                        {b.name || b.biomarker_code || b.code} {b.status === 'low' ? '↓' : b.status === 'high' ? '↑' : ''}
                      </span>
                    ))}
                    {(biomarkers.length === 0) && (
                      <span className="text-xs text-gray-400 italic">Нет данных о показателях</span>
                    )}
                  </div>
                )}
                
                {(isFailed || isStuck) && (
                  <p className="text-xs text-red-500 mt-2">
                    {isStuck ? "⏱️ Время ожидания истекло. Попробуйте загрузить снова." : (item.error_message || "Сбой обработки")}
                  </p>
                )}

                {!isProcessing && !isFailed && !isStuck && !isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-400">Нажмите для раскрытия</span>
                  </div>
                )}
              </button>

              {/* Раскрытые детали (аккордеон) */}
              {isExpanded && !isProcessing && !isFailed && !isStuck && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  {loadingDetails && (
                    <div className="flex flex-col items-center justify-center py-6 gap-2">
                      <LoaderIcon size={24} className="text-brand-500 animate-spin" />
                      <span className="text-xs font-medium text-gray-500">Загружаем детали...</span>
                    </div>
                  )}

                  {!loadingDetails && item.ai_summary && (
                    <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl p-3 border border-indigo-100">
                      <div className="flex items-center gap-2 mb-2">
                        <SparklesIcon size={14} className="text-indigo-600" />
                        <span className="text-xs font-bold text-indigo-600 uppercase">AI Резюме</span>
                      </div>
                      <div className="text-xs text-gray-700">
                        {typeof item.ai_summary === 'string' ? formatMarkdownText(item.ai_summary) : "Отчет сформирован"}
                      </div>
                    </div>
                  )}

                  {!loadingDetails && biomarkers.length > 0 && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <button 
                        onClick={() => setExpandedBiomarkers(expandedBiomarkers === item.id ? null : item.id)}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition"
                      >
                        <h3 className="text-xs font-bold text-gray-900 uppercase">
                          Показатели ({biomarkers.length})
                        </h3>
                        <ChevronRightIcon 
                          size={14} 
                          className={`text-gray-400 transition-transform ${expandedBiomarkers === item.id ? "rotate-90" : ""}`} 
                        />
                      </button>
                      
                      {expandedBiomarkers === item.id && (
                        <div className="space-y-2 max-h-64 overflow-y-auto p-3 border-t border-gray-200 bg-white">
                          {biomarkers.map((b: any, j: number) => (
                            <div key={b.id || j} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                              <div className="flex-1 pr-2">
                                <div className="font-medium text-xs text-gray-900">{b.name || b.biomarker_name || b.biomarker_code || "Показатель"}</div>
                                <div className="text-[10px] text-gray-400 mt-0.5">
                                  Норма: {b.ref_min ?? "?"} - {b.ref_max ?? "?"} {b.unit || ""}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`font-bold text-xs ${
                                  b.status === 'normal' ? 'text-brand-600' : 
                                  b.status === 'low' ? 'text-amber-600' : 'text-rose-600'
                                }`}>
                                  {b.value} {b.unit || ""}
                                </div>
                                <div className={`text-[10px] ${
                                  b.status === 'normal' ? 'text-brand-500' : 
                                  b.status === 'low' ? 'text-amber-500' : 'text-rose-500'
                                }`}>
                                  {b.status === 'normal' ? '✓ норма' : b.status === 'low' ? '↓ ниже' : '↑ выше'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Рекомендации с продуктами */}
                  {/* TODO: Заказчик должен заменить URL магазина в строке ниже (https://shop.example.com) на свой эндпоинт */}
                  {!loadingDetails && item.ai_recommendations?.items?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <SparklesIcon size={14} className="text-violet-600" />
                        <h3 className="text-xs font-bold text-gray-900 uppercase">AI Рекомендации</h3>
                      </div>
                      <div className="space-y-2">
                        {item.ai_recommendations.items.map((rec: any, k: number) => (
                          <div key={k} className="bg-gray-50 rounded-lg p-2.5">
                            <div className="font-medium text-xs text-gray-900">{rec.product?.name}</div>
                            <div className="text-[10px] text-gray-500 mt-0.5">{rec.reason}</div>
                            {rec.product?.name && (
                              <a 
                                href={`https://shop.example.com/product/${rec.product.id || 'default'}`}
            target="_blank"
            rel="noopener noreferrer"
                                className="inline-block mt-1.5 px-2.5 py-1 bg-brand-500 text-white text-[10px] font-bold rounded-lg hover:bg-brand-600 transition"
                              >
                                💊 Купить {rec.product.price ? `за ${rec.product.price} ₽` : ''}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <a 
                    href="https://telegra.ph/Consultation-08-16" 
            target="_blank"
            rel="noopener noreferrer"
                    className="block w-full bg-cyan-500 text-white rounded-lg py-2 text-xs font-semibold text-center hover:bg-cyan-600 transition-colors"
          >
                    👨‍⚕️ Консультация врача
          </a>
        </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Toast Notifications */}
      {toast && (
        <Toast 
          message={toast.msg} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
}

// Вкладка "О пациенте"
function PatientAboutTab() {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await profileApi.getMyProfile();
      setProfile(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (category: string, data: any) => {
    if (!profile) return;
    try {
      // Map category to profile field
      const fieldMap: Record<string, keyof PatientProfile> = {
        "body": "body_parameters",
        "gender": "gender_health",
        "history": "medical_history",
        "allergies": "allergies",
        "chronic": "chronic_diseases",
        "hereditary": "hereditary_diseases",
        "lifestyle": "lifestyle",
        "additional": "additional_info"
      };
      
      const field = fieldMap[category];
      if (field) {
        await profileApi.update({ [field]: data });
        loadProfile(); // Reload to update counts
        setExpandedCategory(null);
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сохранения");
    }
  };

  if (loading) return <div className="py-10 text-center text-gray-400">Загрузка...</div>;
  
  // Handle API errors gracefully
  if (!profile) {
    return (
      <div className="py-10 text-center text-gray-400">
        <p className="mb-2">Не удалось загрузить профиль</p>
        <button onClick={loadProfile} className="text-brand-500 font-bold">Повторить</button>
      </div>
    );
  }

  const categories = [
    { id: "body", label: "Параметры тела", Icon: RulerIcon, color: "bg-blue-50 text-blue-600", count: Object.keys(profile?.body_parameters || {}).length, total: 3 },
    { id: "gender", label: "Мужское здоровье", Icon: GenderMaleIcon, color: "bg-indigo-50 text-indigo-600", count: Object.keys(profile?.gender_health || {}).length, total: 3 },
    { id: "history", label: "Медицинская история", Icon: MedicalHistoryIcon, color: "bg-violet-50 text-violet-600", count: (profile?.medical_history as any[])?.length || 0, total: 3 },
    { id: "allergies", label: "Аллергические реакции", Icon: AllergyIcon, color: "bg-amber-50 text-amber-600", count: (profile?.allergies as any[])?.length || 0, total: 5 },
    { id: "chronic", label: "Хронические заболевания", Icon: StethoscopeIcon, color: "bg-rose-50 text-rose-600", count: (profile?.chronic_diseases as any[])?.length || 0, total: 0 },
    { id: "hereditary", label: "Наследственные заболевания", Icon: DnaIcon, color: "bg-purple-50 text-purple-600", count: (profile?.hereditary_diseases as any[])?.length || 0, total: 0 },
    { id: "lifestyle", label: "Образ жизни", Icon: AppleIcon, color: "bg-brand-50 text-brand-600", count: Object.keys(profile?.lifestyle || {}).length, total: 5 },
    { id: "additional", label: "Дополнительная информация", Icon: InfoCircleIcon, color: "bg-gray-100 text-gray-600", count: Object.keys(profile?.additional_info || {}).length, total: 6 },
  ];

  return (
    <div className="space-y-3 pb-20">
      <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-4">
        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-xl">👤</div>
        <div>
          <div className="font-bold text-gray-900 text-lg">Пациент</div>
          <div className="text-sm text-gray-500">33 года</div>
        </div>
        <div className="ml-auto text-brand-500">
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </div>
      </div>

      {categories.map(cat => (
        <div key={cat.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button 
            onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cat.color}`}>
                <cat.Icon size={20} />
              </div>
              <span className="font-medium text-gray-900">{cat.label}</span>
            </div>
            <div className="flex items-center gap-2">
              {cat.total > 0 && (
                <span className={`text-sm ${cat.count > 0 ? "text-brand-600 font-bold" : "text-rose-500"}`}>
                  {cat.count}/{cat.total}
                </span>
              )}
              <ChevronRightIcon size={16} className={`text-gray-400 transition-transform ${expandedCategory === cat.id ? "rotate-90" : ""}`} />
            </div>
          </button>
          
          {expandedCategory === cat.id && (
            <div className="p-4 border-t border-gray-100 bg-gray-50">
               <ProfileForm category={cat.id} initialData={profile} onSave={(data) => handleSave(cat.id, data)} />
            </div>
          )}
        </div>
      ))}
      
      <button className="w-full bg-amber-400 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-amber-500 transition-colors">
        Сохранить
      </button>
    </div>
  );
}

function ProfileForm({ category, initialData, onSave }: { category: string, initialData: any, onSave: (data: any) => void }) {
  const [formData, setFormData] = useState<any>({});
  const [listItems, setListItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");
  
  useEffect(() => {
    // Pre-fill logic based on category
    const fieldMap: Record<string, keyof PatientProfile> = {
      "body": "body_parameters",
      "gender": "gender_health",
      "history": "medical_history",
      "allergies": "allergies",
      "chronic": "chronic_diseases",
      "hereditary": "hereditary_diseases",
      "lifestyle": "lifestyle",
      "additional": "additional_info"
    };
    const field = fieldMap[category];
    if (field && initialData && initialData[field]) {
      const data = initialData[field];
      if (Array.isArray(data)) {
        setListItems(data);
      } else {
        setFormData(data);
      }
    }
  }, [category, initialData]);

  const handleChange = (key: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }));
  };

  const addItem = () => {
    if (newItem.trim()) {
      setListItems(prev => [...prev, newItem.trim()]);
      setNewItem("");
    }
  };

  const removeItem = (index: number) => {
    setListItems(prev => prev.filter((_, i) => i !== index));
  };

  // Параметры тела
  if (category === "body") {
    return (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">Рост (см)</label>
          <input type="number" min="100" max="250" value={formData.height || ""} onChange={e => handleChange("height", e.target.value)} className="w-full p-2 rounded border border-gray-300" placeholder="180" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">Вес (кг)</label>
          <input type="number" min="30" max="300" step="0.1" value={formData.weight || ""} onChange={e => handleChange("weight", e.target.value)} className="w-full p-2 rounded border border-gray-300" placeholder="75" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">Обхват талии (см)</label>
          <input type="number" min="40" max="200" value={formData.waist || ""} onChange={e => handleChange("waist", e.target.value)} className="w-full p-2 rounded border border-gray-300" placeholder="80" />
        </div>
        <button onClick={() => onSave(formData)} className="w-full bg-brand-500 text-white py-2 rounded-lg font-bold text-sm">Сохранить раздел</button>
      </div>
    );
  }
  
  // Мужское/Женское здоровье
  if (category === "gender") {
    return (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">Уровень тестостерона (нмоль/л)</label>
          <input type="number" step="0.1" value={formData.testosterone || ""} onChange={e => handleChange("testosterone", e.target.value)} className="w-full p-2 rounded border border-gray-300" placeholder="12.5" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">Жалобы</label>
          <textarea value={formData.complaints || ""} onChange={e => handleChange("complaints", e.target.value)} className="w-full p-2 rounded border border-gray-300" placeholder="Опишите проблемы..." rows={2} />
        </div>
        <button onClick={() => onSave(formData)} className="w-full bg-brand-500 text-white py-2 rounded-lg font-bold text-sm">Сохранить раздел</button>
      </div>
    );
  }

  // Медицинская история (список операций/госпитализаций)
  if (category === "history") {
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-500">Перенесённые операции, госпитализации, серьёзные заболевания</p>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={newItem} 
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            className="flex-1 p-2 rounded border border-gray-300" 
            placeholder="Напр: Аппендэктомия 2019" 
          />
          <button onClick={addItem} className="px-3 py-2 bg-brand-500 text-white rounded-lg font-bold">+</button>
        </div>
        {listItems.length > 0 && (
          <div className="space-y-1">
            {listItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                <span className="flex-1 text-sm">{item}</span>
                <button onClick={() => removeItem(i)} className="text-red-500 text-xs hover:text-red-700">✕</button>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => onSave(listItems)} className="w-full bg-brand-500 text-white py-2 rounded-lg font-bold text-sm">Сохранить раздел</button>
      </div>
    );
  }

  // Аллергические реакции (список)
  if (category === "allergies") {
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-500">Укажите аллергены: лекарства, продукты, вещества</p>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={newItem} 
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            className="flex-1 p-2 rounded border border-gray-300" 
            placeholder="Напр: Пенициллин, орехи" 
          />
          <button onClick={addItem} className="px-3 py-2 bg-brand-500 text-white rounded-lg font-bold">+</button>
        </div>
        {listItems.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {listItems.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 rounded-full px-3 py-1 text-sm">
                {item}
                <button onClick={() => removeItem(i)} className="text-amber-600 hover:text-amber-800">✕</button>
              </span>
            ))}
          </div>
        )}
        <button onClick={() => onSave(listItems)} className="w-full bg-brand-500 text-white py-2 rounded-lg font-bold text-sm">Сохранить раздел</button>
      </div>
    );
  }

  // Хронические заболевания (список)
  if (category === "chronic") {
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-500">Диагностированные хронические заболевания</p>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={newItem} 
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            className="flex-1 p-2 rounded border border-gray-300" 
            placeholder="Напр: Гипертония, Диабет 2 типа" 
          />
          <button onClick={addItem} className="px-3 py-2 bg-brand-500 text-white rounded-lg font-bold">+</button>
        </div>
        {listItems.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {listItems.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 rounded-full px-3 py-1 text-sm">
                {item}
                <button onClick={() => removeItem(i)} className="text-rose-600 hover:text-rose-800">✕</button>
              </span>
            ))}
          </div>
        )}
        <button onClick={() => onSave(listItems)} className="w-full bg-brand-500 text-white py-2 rounded-lg font-bold text-sm">Сохранить раздел</button>
      </div>
    );
  }

  // Наследственные заболевания (список)
  if (category === "hereditary") {
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-500">Заболевания у близких родственников (родители, бабушки, дедушки)</p>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={newItem} 
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            className="flex-1 p-2 rounded border border-gray-300" 
            placeholder="Напр: Онкология (мама), Диабет (дедушка)" 
          />
          <button onClick={addItem} className="px-3 py-2 bg-brand-500 text-white rounded-lg font-bold">+</button>
        </div>
        {listItems.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {listItems.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 rounded-full px-3 py-1 text-sm">
                {item}
                <button onClick={() => removeItem(i)} className="text-purple-600 hover:text-purple-800">✕</button>
              </span>
            ))}
          </div>
        )}
        <button onClick={() => onSave(listItems)} className="w-full bg-brand-500 text-white py-2 rounded-lg font-bold text-sm">Сохранить раздел</button>
      </div>
    );
  }

  // Образ жизни
  if (category === "lifestyle") {
    return (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">Физическая активность</label>
          <select value={formData.activity || ""} onChange={e => handleChange("activity", e.target.value)} className="w-full p-2 rounded border border-gray-300">
            <option value="">Выберите...</option>
            <option value="sedentary">Сидячий образ жизни</option>
            <option value="light">Лёгкая активность (1-2 раза/нед)</option>
            <option value="moderate">Умеренная активность (3-4 раза/нед)</option>
            <option value="active">Активный образ жизни (5+ раз/нед)</option>
            <option value="athlete">Профессиональный спорт</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">Курение</label>
          <select value={formData.smoking || ""} onChange={e => handleChange("smoking", e.target.value)} className="w-full p-2 rounded border border-gray-300">
            <option value="">Выберите...</option>
            <option value="never">Никогда не курил(а)</option>
            <option value="former">Бросил(а) курить</option>
            <option value="occasional">Иногда</option>
            <option value="regular">Регулярно</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">Употребление алкоголя</label>
          <select value={formData.alcohol || ""} onChange={e => handleChange("alcohol", e.target.value)} className="w-full p-2 rounded border border-gray-300">
            <option value="">Выберите...</option>
            <option value="never">Не употребляю</option>
            <option value="rare">Редко (праздники)</option>
            <option value="moderate">Умеренно (1-2 раза/мес)</option>
            <option value="regular">Регулярно</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">Качество сна</label>
          <select value={formData.sleep || ""} onChange={e => handleChange("sleep", e.target.value)} className="w-full p-2 rounded border border-gray-300">
            <option value="">Выберите...</option>
            <option value="excellent">Отличное (7-9 ч, легко засыпаю)</option>
            <option value="good">Хорошее (6-8 ч)</option>
            <option value="average">Среднее (проблемы с засыпанием)</option>
            <option value="poor">Плохое (бессонница, пробуждения)</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">Уровень стресса</label>
          <select value={formData.stress || ""} onChange={e => handleChange("stress", e.target.value)} className="w-full p-2 rounded border border-gray-300">
            <option value="">Выберите...</option>
            <option value="low">Низкий</option>
            <option value="moderate">Умеренный</option>
            <option value="high">Высокий</option>
            <option value="chronic">Хронический стресс</option>
          </select>
        </div>
        <button onClick={() => onSave(formData)} className="w-full bg-brand-500 text-white py-2 rounded-lg font-bold text-sm">Сохранить раздел</button>
      </div>
    );
  }

  // Дополнительная информация
  if (category === "additional") {
    return (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">Группа крови</label>
          <select value={formData.blood_type || ""} onChange={e => handleChange("blood_type", e.target.value)} className="w-full p-2 rounded border border-gray-300">
            <option value="">Выберите...</option>
            <option value="I+">I (O) Rh+</option>
            <option value="I-">I (O) Rh-</option>
            <option value="II+">II (A) Rh+</option>
            <option value="II-">II (A) Rh-</option>
            <option value="III+">III (B) Rh+</option>
            <option value="III-">III (B) Rh-</option>
            <option value="IV+">IV (AB) Rh+</option>
            <option value="IV-">IV (AB) Rh-</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">Принимаемые препараты</label>
          <textarea value={formData.medications || ""} onChange={e => handleChange("medications", e.target.value)} className="w-full p-2 rounded border border-gray-300" placeholder="Перечислите через запятую" rows={2} />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">Витамины и БАДы</label>
          <textarea value={formData.supplements || ""} onChange={e => handleChange("supplements", e.target.value)} className="w-full p-2 rounded border border-gray-300" placeholder="Перечислите через запятую" rows={2} />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">Особенности питания</label>
          <select value={formData.diet || ""} onChange={e => handleChange("diet", e.target.value)} className="w-full p-2 rounded border border-gray-300">
            <option value="">Выберите...</option>
            <option value="regular">Обычное питание</option>
            <option value="vegetarian">Вегетарианство</option>
            <option value="vegan">Веганство</option>
            <option value="keto">Кето-диета</option>
            <option value="low_carb">Низкоуглеводная</option>
            <option value="gluten_free">Безглютеновая</option>
            <option value="lactose_free">Безлактозная</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">Дополнительные заметки</label>
          <textarea value={formData.notes || ""} onChange={e => handleChange("notes", e.target.value)} className="w-full p-2 rounded border border-gray-300" placeholder="Любая важная информация о здоровье" rows={2} />
        </div>
        <button onClick={() => onSave(formData)} className="w-full bg-brand-500 text-white py-2 rounded-lg font-bold text-sm">Сохранить раздел</button>
      </div>
    );
  }

  return (
    <div className="text-center text-gray-500 py-4">
      <p className="mb-2">Форма для этого раздела в разработке</p>
    </div>
  );
}

// Страница медкарты
function MedcardPage() {
  const [activeTab, setActiveTab] = useState("about"); // Default to About as requested

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-4">
        <h1 className="text-xl font-bold text-gray-900 py-3">Электронная медкарта</h1>
        <div className="flex gap-6 overflow-x-auto no-scrollbar">
          {[
            { id: "events", label: "События" },
            { id: "about", label: "О пациенте" },
            { id: "diaries", label: "Дневники" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium whitespace-nowrap transition-colors relative ${
                activeTab === tab.id ? "text-amber-400" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-t-full"></div>
              )}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
        {activeTab === "events" && <MedcardEvents />}
        {activeTab === "about" && <PatientAboutTab />}
        {activeTab === "diaries" && <DiariesSection />}
      </div>
    </div>
  );
}

function MedcardEvents() {
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<MedicalDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    medcardApi.getAll()
      .then(setDocuments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Проверка типа файла
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      alert('⚠️ Пожалуйста, загрузите файл в формате PDF, JPG или PNG');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    // Проверка размера (макс 50 МБ)
    if (file.size > 50 * 1024 * 1024) {
      alert('⚠️ Размер файла не должен превышать 50 МБ');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    setUploading(true);
    try {
      const title = file.name.replace(/\.[^/.]+$/, '');
      const newDoc = await medcardApi.upload(file, title, 'other');
      setDocuments(prev => [newDoc, ...prev]);
      
      // Показываем успешное уведомление
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      alert(`❌ Ошибка загрузки: ${err.message || 'Попробуйте позже'}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileTextIcon size={18} />;
    if (type.includes('image')) return <ImageIcon size={18} />;
    return <ArchiveIcon size={18} />;
  };

  const formatSize = (bytes: number) => {
    if (bytes > 1000000) return `${(bytes / 1000000).toFixed(1)} MB`;
    return `${(bytes / 1000).toFixed(0)} KB`;
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Сегодня';
    if (diffDays === 1) return 'Вчера';
    
    const day = date.getDate();
    const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return `${day} ${months[date.getMonth()]}`;
  };

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Медкарта</h1>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
        >
          {uploading ? <LoaderIcon size={20} /> : <UploadIcon size={20} />}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleUpload}
          className="hidden"
        />
      </div>
      
      {/* Описание раздела */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          Сюда Вы можете загружать все анализы, результаты исследований, назначения врачей и прочую важную информацию.
        </p>
      </div>
      
      <div className="relative">
        <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input 
          type="text" 
          placeholder="Поиск документов..." 
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Недавние</h2>
          {documents.length > 0 && (
            <button className="text-sm font-semibold text-brand-600">Все</button>
          )}
        </div>
        
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoaderIcon size={24} className="text-brand-500 animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8 text-center border-2 border-dashed border-gray-300">
              <div className="w-20 h-20 bg-white rounded-full mx-auto flex items-center justify-center mb-4 shadow-sm">
                <FolderIcon size={36} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Документов пока нет</h3>
              <p className="text-sm text-gray-500 mb-4 max-w-xs mx-auto">
                Загрузите заключения врачей, результаты обследований и другие медицинские документы
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-500 text-white font-bold text-sm rounded-xl hover:bg-brand-600 transition-colors shadow-lg shadow-brand-200"
              >
                <UploadIcon size={18} />
                Загрузить документ
              </button>
            </div>
          ) : (
            documents.map((doc: any) => (
              <div 
                key={doc.id} 
                onClick={() => setSelectedDoc(doc)}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:shadow-md hover:border-brand-200 transition-all cursor-pointer active:scale-[0.98]"
              >
                <div className="w-11 h-11 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-200 text-gray-500">
                  {getFileIcon(doc.file_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-900 text-sm truncate">{doc.title}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {doc.document_date ? formatDate(doc.document_date) : (doc.created_at ? formatDate(doc.created_at) : 'Дата неизвестна')} • {formatSize(doc.file_size)}
                  </div>
                </div>
                <ChevronRightIcon size={18} className="text-gray-300" />
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Document viewer modal (Telegram-style) */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setSelectedDoc(null)}>
          <div 
            className="bg-white rounded-t-2xl w-full max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-5 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-base">{selectedDoc.title}</h3>
              <button 
                onClick={() => setSelectedDoc(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <XIcon size={18} />
              </button>
            </div>

            {/* Document info */}
            <div className="p-4 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500">
                  {getFileIcon(selectedDoc.file_type)}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 text-sm mb-1">{selectedDoc.title}</div>
                  <div className="text-xs text-gray-400">
                    {formatSize(selectedDoc.file_size)} • {selectedDoc.file_type.split('/')[1].toUpperCase()}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Загружен: {selectedDoc.created_at ? formatDate(selectedDoc.created_at) : 'неизвестно'}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    window.open(medcardApi.getDownloadUrl(selectedDoc.id), '_blank');
                    setSelectedDoc(null);
                  }}
                  className="w-full py-3.5 bg-brand-500 text-white font-bold rounded-xl hover:bg-brand-600 transition-colors flex items-center justify-center gap-2"
                >
                  <FileTextIcon size={18} />
                  Открыть документ
                </button>

                <button
                  onClick={async () => {
                    const url = medcardApi.getDownloadUrl(selectedDoc.id);
                    if (navigator.share) {
                      try {
                        await navigator.share({
                          title: selectedDoc.title,
                          text: `Документ: ${selectedDoc.title}`,
                          url: url
                        });
                      } catch (err) {
                        console.log('Share cancelled');
                      }
                    } else {
                      // Fallback: copy link
                      navigator.clipboard.writeText(url);
                      alert('✅ Ссылка скопирована в буфер обмена');
                    }
                    setSelectedDoc(null);
                  }}
                  className="w-full py-3.5 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                >
                  <UploadIcon size={18} />
                  Поделиться
                </button>

                <button
                  onClick={async () => {
                    if (confirm(`Удалить документ "${selectedDoc.title}"?`)) {
                      try {
                        await medcardApi.delete(selectedDoc.id);
                        setDocuments(prev => prev.filter(d => d.id !== selectedDoc.id));
                        setSelectedDoc(null);
                      } catch (err: any) {
                        alert(`❌ Ошибка удаления: ${err.message || 'Попробуйте позже'}`);
                      }
                    }
                  }}
                  className="w-full py-3 text-red-600 font-medium hover:bg-red-50 rounded-xl transition-colors"
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success notification */}
      {uploadSuccess && (
        <div className="fixed bottom-20 left-4 right-4 z-50 p-4 bg-brand-500 text-white rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <CheckCircleIcon size={18} />
          </div>
          <div className="flex-1 font-medium text-sm">✅ Документ успешно загружен!</div>
        </div>
      )}
    </div>
  );
}

// Страница календаря
function CalendarPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [customBiomarkers, setCustomBiomarkers] = useState<string>("");
  const [availableBiomarkers, setAvailableBiomarkers] = useState<any[]>([]);
  const [selectedBiomarkerCodes, setSelectedBiomarkerCodes] = useState<Set<string>>(new Set());
  
  // Устанавливаем время по умолчанию на текущее + 1 час
  const getDefaultTime = () => {
    const now = new Date();
    let hours = now.getHours() + 1;
    let minutes = Math.ceil(now.getMinutes() / 5) * 5; // Округляем до ближайших 5 минут
    
    // Если минуты = 60, переходим на следующий час
    if (minutes >= 60) {
      minutes = 0;
      hours += 1;
    }
    
    // Если часы >= 24, сбрасываем на 0
    if (hours >= 24) {
      hours = 0;
    }
    
    return { 
      hour: hours.toString().padStart(2, '0'), 
      minute: minutes.toString().padStart(2, '0') 
    };
  };
  
  const [selectedHour, setSelectedHour] = useState(getDefaultTime().hour);
  const [selectedMinute, setSelectedMinute] = useState(getDefaultTime().minute);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const upcomingRef = useRef<HTMLDivElement>(null);

  // Категории биомаркеров
  const biomarkerCategories: Record<string, string> = {
    '': '—  Без категории',
    'HEMATOLOGY': '🩸 Гематология',
    'BIOCHEMISTRY': '🧪 Биохимия',
    'HORMONES': '⚡ Гормоны',
    'VITAMINS': '💊 Витамины',
    'MINERALS': '🔬 Минералы',
    'LIPIDS': '🫀 Липиды',
    'LIVER': '🫁 Печень',
    'KIDNEY': '💧 Почки',
    'THYROID': '🦋 Щитовидная железа',
    'INFLAMMATION': '🔥 Воспаление',
    'OTHER': '📋 Прочее',
  };

  useEffect(() => {
    calendarApi.getAll()
      .then(setReminders)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Загружаем биомаркеры для выбранной категории
  useEffect(() => {
    if (selectedCategory && selectedCategory !== '') {
      biomarkersApi.getAll()
        .then((response: any) => {
          // API возвращает объект { items: [...], total: N }
          const allBiomarkers = response.items || response || [];
          const filtered = allBiomarkers.filter((b: any) => b.category === selectedCategory);
          setAvailableBiomarkers(filtered);
        })
        .catch(console.error);
    } else {
      setAvailableBiomarkers([]);
      setSelectedBiomarkerCodes(new Set());
    }
  }, [selectedCategory]);

  const handleAddReminder = async () => {
    if (!newTitle || !selectedDate) {
      alert("⚠️ Заполните название и дату");
      return;
    }
    
    // Проверка на прошедшую дату/время
    const selectedDateTime = new Date(`${selectedDate}T${selectedHour.padStart(2, '0')}:${selectedMinute.padStart(2, '0')}:00`);
    const now = new Date();
    
    if (selectedDateTime < now) {
      alert("⏰ Нельзя создать напоминание на прошедшее время");
      return;
    }
    
    try {
      const timeStr = `${selectedHour.padStart(2, '0')}:${selectedMinute.padStart(2, '0')}:00`;
      
      // Формируем description с категорией и биомаркерами
      let description = "";
      if (selectedCategory) {
        // Собираем названия выбранных биомаркеров
        const selectedNames = availableBiomarkers
          .filter(b => selectedBiomarkerCodes.has(b.code))
          .map(b => b.name)
          .join(', ');
        
        const metadata = {
          category: selectedCategory,
          biomarkers: selectedNames || customBiomarkers.trim() || null
        };
        description = JSON.stringify(metadata);
      }
      
      const reminder = await calendarApi.create({
        title: newTitle,
        scheduled_date: selectedDate,
        scheduled_time: timeStr,
        reminder_type: selectedCategory ? "analysis" : "custom",
        description: description,
        frequency: "once"
      } as any);
      setReminders(prev => [...prev, reminder]);
      setShowAddForm(false);
      setNewTitle("");
      setSelectedDate("");
      setSelectedCategory("");
      setCustomBiomarkers("");
      setAvailableBiomarkers([]);
      setSelectedBiomarkerCodes(new Set());
      const defaultTime = getDefaultTime();
      setSelectedHour(defaultTime.hour);
      setSelectedMinute(defaultTime.minute);
    } catch (err) {
      console.error(err);
      alert("❌ Ошибка при создании напоминания");
    }
  };

  // Форматирование даты как "12 декабря"
  const formatDateRussian = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    const months = ["января", "февраля", "марта", "апреля", "мая", "июня", 
                    "июля", "августа", "сентября", "октября", "ноября", "декабря"];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  };

  // Фильтруем только будущие напоминания
  const now = new Date();
  const upcomingReminders = reminders.filter(r => {
    const reminderDateTime = new Date(`${r.scheduled_date}T${r.scheduled_time || '00:00:00'}`);
    return reminderDateTime >= now;
  }).sort((a, b) => {
    const dateA = new Date(`${a.scheduled_date}T${a.scheduled_time || '00:00:00'}`);
    const dateB = new Date(`${b.scheduled_date}T${b.scheduled_time || '00:00:00'}`);
    return dateA.getTime() - dateB.getTime();
  });

  const displayReminders = reminders.length > 0 ? reminders : [];

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

  // Получаем напоминания для текущего месяца с датами (безопасный парсинг)
  const getRemindersForMonth = () => {
    return displayReminders.filter(r => {
      if (!r.scheduled_date) return false;
      const parts = r.scheduled_date.toString().split('T')[0].split('-');
      if (parts.length < 3) return false;
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // 0-indexed
      return month === currentMonth.getMonth() && year === currentMonth.getFullYear();
    });
  };
  
  const monthReminders = getRemindersForMonth();
  const reminderDaysMap = new Map<number, Reminder[]>();
  monthReminders.forEach(r => {
    const parts = r.scheduled_date.toString().split('T')[0].split('-');
    const day = parseInt(parts[2]);
    if (!reminderDaysMap.has(day)) reminderDaysMap.set(day, []);
    reminderDaysMap.get(day)!.push(r);
  });

  const today = new Date().getDate();
  const isCurrentMonth = currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear();

  const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

  // Клик по дню с напоминанием - открыть и прокрутить к нему
  const handleDayClick = (day: number) => {
    const dayReminders = reminderDaysMap.get(day);
    if (dayReminders && dayReminders.length > 0) {
      setSelectedReminder(dayReminders[0]);
      // Прокрутить к секции "Предстоящие"
      setTimeout(() => {
        upcomingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  return (
    <div className="px-4 py-5 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Календарь здоровья</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <ChevronLeftIcon size={16} />
          </button>
          <span className="text-sm font-semibold text-gray-900">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </span>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <ChevronRightIcon size={16} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(d => (
            <div key={d} className="py-1.5 text-gray-400 font-medium">{d}</div>
          ))}
          {Array.from({ length: adjustedFirstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="py-2"></div>
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const hasReminder = reminderDaysMap.has(day);
            const isToday = isCurrentMonth && day === today;
            return (
              <button
                key={day}
                onClick={() => handleDayClick(day)}
                className={`py-2 rounded-lg font-medium text-sm transition-colors ${
                  isToday ? "bg-brand-500 text-white" :
                  hasReminder ? "bg-pink-100 text-pink-600 font-bold hover:bg-pink-200" :
                  "text-gray-900 hover:bg-gray-50"
                }`}
              >
                {day}
                {hasReminder && !isToday && (
                  <div className="w-1 h-1 bg-pink-500 rounded-full mx-auto mt-0.5"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3" ref={upcomingRef}>
        <h2 className="text-base font-bold text-gray-900">Предстоящие</h2>
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoaderIcon size={24} className="text-brand-500" />
            </div>
          ) : upcomingReminders.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-6 text-center border-2 border-dashed border-gray-200">
              <div className="w-16 h-16 bg-white rounded-full mx-auto flex items-center justify-center mb-3 shadow-sm">
                <CalendarIcon size={28} className="text-gray-400" />
              </div>
              <p className="text-sm text-gray-500">Нет предстоящих напоминаний</p>
              <p className="text-xs text-gray-400 mt-1">Нажмите "+" чтобы создать</p>
            </div>
          ) : upcomingReminders.map((r) => {
            // Правильное объединение даты и времени
            const dateTimeStr = `${r.scheduled_date}T${r.scheduled_time || '00:00:00'}`;
            const dateTime = new Date(dateTimeStr);
            const isSelected = selectedReminder?.id === r.id;
            
            // Форматируем дату и время отдельно
            const dateStr = dateTime.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
            const timeStr = r.scheduled_time ? r.scheduled_time.substring(0, 5) : '00:00'; // HH:MM
            
            // Парсим metadata из description
            let metadata = null;
            try {
              if (r.description) {
                metadata = JSON.parse(r.description);
              }
            } catch (e) {
              // Ignore parse errors
            }

            return (
              <div 
                key={r.id} 
                className={`bg-white border rounded-xl p-3 flex items-center gap-3 transition-all ${
                  isSelected ? "border-pink-400 ring-2 ring-pink-100 shadow-md" : "border-gray-200"
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isSelected ? "bg-pink-100 text-pink-600" : "bg-brand-50 text-brand-600"
                }`}>
                  <CalendarIcon size={18} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900">{r.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {dateStr} • {timeStr}
                  </div>
                  {metadata?.category && (
                    <div className="mt-2 text-xs">
                      <span className="inline-block px-2 py-1 bg-gradient-to-r from-brand-50 to-teal-50 border border-brand-200 rounded-lg text-brand-700 font-medium">
                        {biomarkerCategories[metadata.category] || metadata.category}
                      </span>
                      {metadata.biomarkers && (
                        <div className="text-gray-500 mt-1 leading-relaxed">
                          {metadata.biomarkers}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showAddForm ? (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-lg">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-center">Новое напоминание</h3>
          </div>
          
          <div className="p-4 space-y-4">
            {/* Название */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Название</label>
              <input
                type="text"
                placeholder="Например: Сдать анализ крови"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full p-3 bg-gray-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
              />
            </div>

            {/* Категория биомаркеров */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Категория анализов (необязательно)</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-3 bg-gray-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
              >
                {Object.entries(biomarkerCategories).map(([key, name]) => (
                  <option key={key} value={key}>{name}</option>
                ))}
              </select>
              {selectedCategory && (
                <p className="text-xs text-gray-500 mt-2">
                  Будет напоминание сдать все анализы из категории "{biomarkerCategories[selectedCategory]}"
                </p>
              )}
            </div>

            {/* Список биомаркеров для выбора */}
            {selectedCategory && availableBiomarkers.length > 0 && (
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">
                  Выберите показатели ({selectedBiomarkerCodes.size} из {availableBiomarkers.length})
                </label>
                <div className="bg-gray-50 rounded-xl p-3 max-h-64 overflow-y-auto space-y-2">
                  {availableBiomarkers.map((bio: any) => (
                    <label
                      key={bio.code}
                      className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBiomarkerCodes.has(bio.code)}
                        onChange={(e) => {
                          const newSet = new Set(selectedBiomarkerCodes);
                          if (e.target.checked) {
                            newSet.add(bio.code);
                          } else {
                            newSet.delete(bio.code);
                          }
                          setSelectedBiomarkerCodes(newSet);
                        }}
                        className="w-4 h-4 text-brand-600 bg-white border-gray-300 rounded focus:ring-brand-500 focus:ring-2"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{bio.name}</div>
                        <div className="text-xs text-gray-500">{bio.unit}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedBiomarkerCodes(new Set(availableBiomarkers.map((b: any) => b.code)))}
                    className="text-xs text-brand-600 font-medium hover:text-brand-700"
                  >
                    Выбрать все
                  </button>
                  <span className="text-gray-300">•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedBiomarkerCodes(new Set())}
                    className="text-xs text-gray-500 font-medium hover:text-gray-700"
                  >
                    Снять выбор
                  </button>
                </div>
              </div>
            )}

            {/* Текстовое поле для ручного ввода (если нет готовых биомаркеров) */}
            {selectedCategory && availableBiomarkers.length === 0 && (
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">
                  Показатели (необязательно)
                </label>
                <textarea
                  placeholder="Например: Тестостерон, Эстрадиол, Пролактин"
                  value={customBiomarkers}
                  onChange={(e) => setCustomBiomarkers(e.target.value)}
                  rows={3}
                  className="w-full p-3 bg-gray-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Перечислите конкретные показатели через запятую
                </p>
              </div>
            )}
            
            {/* Время отправки - единый стиль */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-400 uppercase mb-3">Дата и время</p>
              
              <div className="flex items-center gap-2">
                {/* Дата */}
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="flex-1 bg-white rounded-lg px-3 py-2 border border-gray-200 text-sm font-medium text-gray-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none h-10"
                />
                
                <span className="text-gray-400 text-sm">в</span>
                
                {/* Время */}
                <div className="flex items-center bg-white rounded-lg border border-gray-200 px-2 h-10">
                  <select
                    value={selectedHour}
                    onChange={(e) => setSelectedHour(e.target.value)}
                    className="bg-transparent text-sm font-medium text-gray-900 outline-none cursor-pointer"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i.toString().padStart(2, '0')}>
                        {i.toString().padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                  <span className="text-gray-400 mx-0.5">:</span>
                  <select
                    value={selectedMinute}
                    onChange={(e) => setSelectedMinute(e.target.value)}
                    className="bg-transparent text-sm font-medium text-gray-900 outline-none cursor-pointer"
                  >
                    {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
          
          {/* Кнопки как в Telegram */}
          <div className="flex border-t border-gray-200">
            <button 
              onClick={() => {
                setShowAddForm(false);
                setNewTitle("");
                setSelectedDate("");
                setSelectedCategory("");
                setCustomBiomarkers("");
                setAvailableBiomarkers([]);
                setSelectedBiomarkerCodes(new Set());
                const defaultTime = getDefaultTime();
                setSelectedHour(defaultTime.hour);
                setSelectedMinute(defaultTime.minute);
              }}
              className="flex-1 py-3.5 text-gray-500 font-medium hover:bg-gray-50 transition-colors border-r border-gray-200"
            >
              Отмена
            </button>
            <button 
              onClick={handleAddReminder}
              disabled={!newTitle || !selectedDate}
              className="flex-1 py-3.5 text-brand-600 font-bold hover:bg-brand-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Запланировать
            </button>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setShowAddForm(true)}
          className="w-full bg-brand-500 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 hover:bg-brand-600 transition-colors"
        >
          <PlusIcon size={18} />
          Добавить напоминание
        </button>
      )}
    </div>
  );
}

// Раздел дневников
function DiariesSection() {
  // Загружаем историю из localStorage при инициализации
  const [entries, setEntries] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('diary_entries');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<{ type: string; value: string; note: string }>({ type: "mood", value: "", note: "" });
  const [error, setError] = useState("");

  // Сохраняем в localStorage при изменении
  useEffect(() => {
    if (entries.length > 0) {
      localStorage.setItem('diary_entries', JSON.stringify(entries));
    }
  }, [entries]);

  // Демо данные (показываем если нет реальных записей)
  const demoEntries = [
    { id: 1, date: "2024-12-09", type: "mood", value: "4", note: "Хорошее настроение после тренировки" },
    { id: 2, date: "2024-12-08", type: "sleep", value: "7.5", note: "Спал крепко" },
    { id: 3, date: "2024-12-08", type: "water", value: "2.5", note: "Пил больше воды" },
    { id: 4, date: "2024-12-07", type: "mood", value: "3", note: "Обычный день" },
    { id: 5, date: "2024-12-07", type: "weight", value: "74.5", note: "" },
  ];

  const displayEntries = entries.length > 0 ? entries : demoEntries;

  const diaryTypes = [
    { id: "mood", label: "Настроение", icon: "😊", unit: "/ 5", color: "bg-amber-50 text-amber-600", min: 0, max: 5, step: 1 },
    { id: "sleep", label: "Сон", icon: "😴", unit: "ч", color: "bg-indigo-50 text-indigo-600", min: 0, max: 24, step: 0.5 },
    { id: "water", label: "Вода", icon: "💧", unit: "л", color: "bg-cyan-50 text-cyan-600", min: 0, max: 10, step: 0.1 },
    { id: "weight", label: "Вес", icon: "⚖️", unit: "кг", color: "bg-brand-50 text-brand-600", min: 20, max: 300, step: 0.1 },
    { id: "pressure", label: "Давление", icon: "❤️", unit: "мм рт.ст.", color: "bg-rose-50 text-rose-600", min: 0, max: 300, step: 1 },
    { id: "sugar", label: "Сахар", icon: "🩸", unit: "ммоль/л", color: "bg-red-50 text-red-600", min: 0, max: 30, step: 0.1 },
  ];

  const getTypeInfo = (type: string) => diaryTypes.find(t => t.id === type) || diaryTypes[0];

  // Валидация по типу записи
  const validateValue = (type: string, value: string): string | null => {
    const typeInfo = getTypeInfo(type);
    
    if (type === "pressure") {
      // Проверка формата давления ###/##
      if (!/^\d{2,3}\/\d{2,3}$/.test(value)) {
        return "Формат: 120/80";
      }
      const [sys, dia] = value.split('/').map(Number);
      if (sys < 60 || sys > 250 || dia < 40 || dia > 150) {
        return "Некорректные значения давления";
      }
      return null;
    }
    
    const num = parseFloat(value);
    if (isNaN(num)) return "Введите число";
    if (num < typeInfo.min) return `Минимум: ${typeInfo.min}`;
    if (num > typeInfo.max) return `Максимум: ${typeInfo.max}`;
    
    return null;
  };

  // Обработка ввода давления с маской ###/##
  const handlePressureInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^\d/]/g, ''); // Только цифры и /
    
    // Автоматическая вставка /
    if (value.length === 3 && !value.includes('/')) {
      value = value + '/';
    }
    
    // Ограничение длины
    if (value.length > 7) value = value.slice(0, 7);
    
    setFormData(prev => ({ ...prev, value }));
    setError("");
  };

  // Обработка обычного числового ввода
  const handleNumberInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, value }));
    setError("");
  };

  const handleSave = () => {
    const validationError = validateValue(formData.type, formData.value);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    const newEntry = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      type: formData.type,
      value: formData.value,
      note: formData.note
    };
    
    // Добавляем к существующим записям (накопительно!)
    setEntries(prev => [newEntry, ...prev]);
    setShowForm(false);
    setFormData({ type: "mood", value: "", note: "" });
    setError("");
  };

  const openForm = (type: string) => {
    setFormData({ type, value: "", note: "" });
    setShowForm(true);
    setError("");
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="grid grid-cols-3 gap-2">
        {diaryTypes.map(type => (
          <button
            key={type.id}
            onClick={() => openForm(type.id)}
            className={`p-3 rounded-xl border border-gray-200 flex flex-col items-center gap-1 hover:shadow-md transition-all ${type.color}`}
          >
            <span className="text-2xl">{type.icon}</span>
            <span className="text-xs font-medium">{type.label}</span>
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Новая запись</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-3xl">{getTypeInfo(formData.type).icon}</span>
            <div className="flex-1">
              <div className="font-medium text-gray-900">{getTypeInfo(formData.type).label}</div>
              
              {/* Специальный инпут для давления */}
              {formData.type === "pressure" ? (
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.value}
                  onChange={handlePressureInput}
                  placeholder="120/80"
                  className={`w-full p-2 border rounded-lg mt-1 ${error ? 'border-red-400' : 'border-gray-200'}`}
                />
              ) : formData.type === "mood" ? (
                // Специальный инпут для настроения (0-5)
                <div className="flex items-center gap-2 mt-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setFormData(prev => ({ ...prev, value: String(n) }))}
                      className={`w-10 h-10 rounded-lg font-bold text-lg transition-colors ${
                        formData.value === String(n) 
                          ? 'bg-amber-500 text-white' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              ) : (
                // Обычный числовой инпут
                <input
                  type="number"
                  step={getTypeInfo(formData.type).step}
                  min={getTypeInfo(formData.type).min}
                  max={getTypeInfo(formData.type).max}
                  value={formData.value}
                  onChange={handleNumberInput}
                  placeholder={`${getTypeInfo(formData.type).min} - ${getTypeInfo(formData.type).max}`}
                  className={`w-full p-2 border rounded-lg mt-1 ${error ? 'border-red-400' : 'border-gray-200'}`}
                />
              )}
              
              {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            </div>
            <span className="text-gray-400">{getTypeInfo(formData.type).unit}</span>
          </div>
          <textarea
            value={formData.note}
            onChange={e => setFormData(prev => ({ ...prev, note: e.target.value }))}
            placeholder="Заметка (опционально)"
            className="w-full p-2 border border-gray-200 rounded-lg"
            rows={2}
          />
          <button
            onClick={handleSave}
            disabled={!formData.value}
            className="w-full py-2 bg-brand-500 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Сохранить
          </button>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">История записей</h3>
          <span className="text-xs text-gray-400">{displayEntries.length} записей</span>
        </div>
        {displayEntries.map(entry => {
          const typeInfo = getTypeInfo(entry.type);
          return (
            <div key={entry.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
              <div className={`w-11 h-11 rounded-lg flex items-center justify-center text-xl ${typeInfo.color}`}>
                {typeInfo.icon}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{typeInfo.label}</div>
                <div className="text-xs text-gray-400">{entry.date} {entry.note && `• ${entry.note}`}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-900">{entry.value}</div>
                <div className="text-xs text-gray-400">{typeInfo.unit}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Страница профиля
function ProfilePage() {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Данные из родительского приложения (только для отображения)
  const userName = "Александр Иванов"; // Получать из parent app
  
  useEffect(() => {
    analysesApi.getAll().then(setAnalyses).catch(console.error);
  }, []);

  // Вычисляем статистику
  const totalAnalyses = analyses.length;
  const normalCount = analyses.reduce((acc, a) => 
    acc + (Array.isArray(a.biomarkers) ? a.biomarkers.filter((b: any) => b.status === 'normal').length : 0), 0
  );
  const totalBiomarkers = analyses.reduce((acc, a) => acc + (Array.isArray(a.biomarkers) ? a.biomarkers.length : 0), 0);
  const normalPercent = totalBiomarkers > 0 ? Math.round((normalCount / totalBiomarkers) * 100) : 0;
  
  // Вычисляем срок использования раздела
  const firstAnalysis = analyses.length > 0 
    ? analyses.reduce((min, a) => new Date(a.created_at) < new Date(min.created_at) ? a : min)
    : null;
  const monthsUsing = firstAnalysis 
    ? Math.max(1, Math.round((Date.now() - new Date(firstAnalysis.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)))
    : 0;

  // Меню профиля (убраны "Личные данные" и "Уведомления" - они в основном приложении)
  const menu = [
    { id: "history", Icon: HistoryIcon, label: "История анализов" },
    { id: "privacy", Icon: ShieldIcon, label: "Конфиденциальность" },
  ];

  // Удаление всех медицинских данных
  const handleDeleteAllData = async () => {
    setDeleting(true);
    try {
      // Удаляем все анализы
      for (const analysis of analyses) {
        await analysesApi.delete(analysis.id);
      }
      // Очищаем localStorage
      localStorage.removeItem('diary_entries');
      localStorage.removeItem('medcard_skipped');
      
      setAnalyses([]);
      setShowDeleteConfirm(false);
      alert("✅ Все медицинские данные удалены");
    } catch (err) {
      console.error(err);
      alert("Ошибка при удалении данных");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
        <div className="w-20 h-20 rounded-xl bg-brand-500 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-3">
          {userName.split(' ').map(n => n[0]).join('')}
        </div>
        <h2 className="text-lg font-bold text-gray-900">{userName}</h2>
        <p className="text-sm text-gray-400 mt-1">Раздел Health Tracker</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button 
          onClick={() => setActiveSection(activeSection === "history" ? null : "history")}
          className="bg-white border border-gray-200 rounded-xl p-3 text-center hover:border-brand-300 hover:shadow-sm transition-all"
        >
          <p className="text-2xl font-bold text-gray-900">{totalAnalyses}</p>
          <p className="text-[10px] text-gray-400 mt-1">Анализов</p>
        </button>
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-brand-600">{normalPercent}%</p>
          <p className="text-[10px] text-gray-400 mt-1">В норме</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center relative group">
          <p className="text-2xl font-bold text-gray-900">{monthsUsing || '—'}</p>
          <p className="text-[10px] text-gray-400 mt-1">Мес. в разделе</p>
          {/* Подсказка */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Срок использования раздела анализов
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {menu.map((item, i) => (
          <div key={item.id}>
            <button
              onClick={() => setActiveSection(activeSection === item.id ? null : item.id)}
              className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors ${
                i !== menu.length - 1 && activeSection !== item.id ? "border-b border-gray-200" : ""
              }`}
            >
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                <item.Icon size={18} />
              </div>
              <span className="flex-1 font-medium text-sm text-gray-900">{item.label}</span>
              <ChevronRightIcon size={16} className={`text-gray-400 transition-transform ${activeSection === item.id ? "rotate-90" : ""}`} />
            </button>
            
            {activeSection === item.id && (
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                {item.id === "history" && (
                  <div className="space-y-3">
                    <HistoryStatsClickable analyses={analyses} />
                  </div>
                )}
                {item.id === "privacy" && (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-600">
                      <p className="mb-2">🔒 Ваши медицинские данные защищены и хранятся в зашифрованном виде.</p>
                      <p className="text-xs text-gray-400">Данные доступны только вам и используются для персонализированных рекомендаций.</p>
                    </div>
                    
                    <div className="border-t border-gray-200 pt-4">
                      <h4 className="font-bold text-sm text-gray-900 mb-2">Удаление данных</h4>
                      <p className="text-xs text-gray-500 mb-3">
                        Будут удалены: все загруженные анализы, записи дневников, история напоминаний.
                        Данные основного профиля (имя, email) не затрагиваются.
                      </p>
                      
                      {showDeleteConfirm ? (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                          <p className="text-sm font-bold text-red-700">Вы уверены?</p>
                          <p className="text-xs text-red-600">Это действие нельзя отменить.</p>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => setShowDeleteConfirm(false)}
                              className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600"
                            >
                              Отмена
                            </button>
                            <button 
                              onClick={handleDeleteAllData}
                              disabled={deleting}
                              className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                            >
                              {deleting ? "Удаление..." : "Удалить"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setShowDeleteConfirm(true)}
                          className="text-red-500 font-medium text-sm hover:text-red-600"
                        >
                          🗑️ Удалить все медицинские данные
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Ссылка на настройки основного приложения */}
      <p className="text-xs text-gray-400 text-center px-4">
        Личные данные и уведомления настраиваются в основном профиле приложения
      </p>
    </div>
  );
}

// Компонент кликабельной статистики истории
function HistoryStatsClickable({ analyses }: { analyses: Analysis[] }) {
  const [view, setView] = useState<'stats' | 'list' | 'analytics'>('stats');
  const [scrollTarget, setScrollTarget] = useState<'first' | 'last' | null>(null);
  const [selectedBiomarker, setSelectedBiomarker] = useState<string>('');
  const [period, setPeriod] = useState<'3m' | '6m' | '1y' | 'all'>('all');
  const listRef = useRef<HTMLDivElement>(null);
  
  const sortedAnalyses = [...analyses].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
  const firstAnalysis = sortedAnalyses[sortedAnalyses.length - 1]; // Самый старый
  const lastAnalysis = sortedAnalyses[0]; // Самый новый

  // Собираем все уникальные биомаркеры из истории
  const allBiomarkers = useMemo(() => {
    const biomarkerMap = new Map<string, string>();
    analyses.forEach(a => {
      if (Array.isArray(a.biomarkers)) {
        a.biomarkers.forEach((b: any) => {
          const code = b.biomarker_code || b.code || b.name;
          const name = b.biomarker_name || b.name || code;
          if (code && !biomarkerMap.has(code)) {
            biomarkerMap.set(code, name);
          }
        });
      }
    });
    return Array.from(biomarkerMap.entries()).map(([code, name]) => ({ code, name }));
  }, [analyses]);

  // Данные для графика выбранного показателя
  const chartData = useMemo(() => {
    if (!selectedBiomarker) return [];
    
    const now = new Date();
    const periodStart = period === '3m' ? new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()) :
                        period === '6m' ? new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()) :
                        period === '1y' ? new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()) :
                        new Date(0);
    
    const data: { date: string; value: number; status: string }[] = [];
    
    analyses.forEach(a => {
      const analysisDate = new Date(a.created_at);
      if (analysisDate < periodStart) return;
      
      if (Array.isArray(a.biomarkers)) {
        const biomarker = a.biomarkers.find((b: any) => 
          (b.biomarker_code || b.code || b.name) === selectedBiomarker
        );
        if (biomarker) {
          data.push({
            date: a.created_at.split('T')[0],
            value: biomarker.value,
            status: biomarker.status
          });
        }
      }
    });
    
    return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [analyses, selectedBiomarker, period]);

  // Прокрутка к нужному анализу после переключения view
  useEffect(() => {
    if (view === 'list' && scrollTarget && listRef.current) {
      setTimeout(() => {
        if (scrollTarget === 'first') {
          listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
        } else if (scrollTarget === 'last') {
          listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }
        setScrollTarget(null);
      }, 100);
    }
  }, [view, scrollTarget]);
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  // Простой SVG график
  const renderChart = () => {
    if (chartData.length === 0) {
      return (
        <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
          Нет данных за выбранный период
        </div>
      );
    }

    if (chartData.length === 1) {
      return (
        <div className="h-40 flex items-center justify-center">
          <div className="text-center">
            <div className="text-3xl font-bold text-brand-600">{chartData[0].value}</div>
            <div className="text-xs text-gray-400 mt-1">{formatShortDate(chartData[0].date)}</div>
          </div>
        </div>
      );
    }

    const values = chartData.map(d => d.value);
    const minVal = Math.min(...values) * 0.9;
    const maxVal = Math.max(...values) * 1.1;
    const range = maxVal - minVal || 1;
    
    const width = 280;
    const height = 120;
    const padding = 20;
    
    const points = chartData.map((d, i) => {
      const x = padding + (i / (chartData.length - 1)) * (width - padding * 2);
      const y = height - padding - ((d.value - minVal) / range) * (height - padding * 2);
      return { x, y, ...d };
    });
    
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return (
      <div className="relative">
        <svg width="100%" viewBox={`0 0 ${width} ${height + 30}`} className="overflow-visible">
          {/* Gradient fill */}
          <defs>
            <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          
          {/* Area */}
          <path d={areaPath} fill="url(#chartGradient)" />
          
          {/* Line */}
          <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          
          {/* Points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill="white" stroke={p.status === 'normal' ? '#10b981' : '#ef4444'} strokeWidth="2" />
              <text x={p.x} y={height + 15} textAnchor="middle" className="text-[9px] fill-gray-400">
                {formatShortDate(p.date)}
              </text>
            </g>
          ))}
        </svg>
        
        {/* Min/Max labels */}
        <div className="absolute left-0 top-2 text-[10px] text-gray-400">{maxVal.toFixed(1)}</div>
        <div className="absolute left-0 bottom-8 text-[10px] text-gray-400">{minVal.toFixed(1)}</div>
      </div>
    );
  };

  // View: Analytics
  if (view === 'analytics') {
    return (
      <div className="space-y-3">
        <button 
          onClick={() => setView('stats')}
          className="flex items-center gap-1 text-brand-600 text-sm font-medium"
        >
          <ChevronLeftIcon size={16} />
          Назад
        </button>
        
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <BarChartIcon size={18} className="text-brand-500" />
            Динамика показателя
          </h4>
          
          {/* Выбор показателя */}
          <div className="mb-3">
            <label className="text-xs text-gray-500 block mb-1">Показатель</label>
            <select
              value={selectedBiomarker}
              onChange={(e) => setSelectedBiomarker(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <option value="">Выберите показатель...</option>
              {allBiomarkers.map(b => (
                <option key={b.code} value={b.code}>{b.name}</option>
              ))}
            </select>
          </div>
          
          {/* Выбор периода */}
          <div className="flex gap-1 mb-4">
            {[
              { value: '3m', label: '3 мес' },
              { value: '6m', label: '6 мес' },
              { value: '1y', label: 'Год' },
              { value: 'all', label: 'Всё' },
            ].map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value as any)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  period === p.value 
                    ? 'bg-brand-500 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          
          {/* График */}
          {selectedBiomarker ? renderChart() : (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
              Выберите показатель для отображения графика
            </div>
          )}
          
          {/* Статистика */}
          {chartData.length > 1 && (
            <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-gray-900">{Math.min(...chartData.map(d => d.value)).toFixed(1)}</div>
                <div className="text-[10px] text-gray-400">Мин</div>
              </div>
              <div>
                <div className="text-lg font-bold text-brand-600">
                  {(chartData.reduce((s, d) => s + d.value, 0) / chartData.length).toFixed(1)}
                </div>
                <div className="text-[10px] text-gray-400">Среднее</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">{Math.max(...chartData.map(d => d.value)).toFixed(1)}</div>
                <div className="text-[10px] text-gray-400">Макс</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // View: List
  if (view === 'list') {
    return (
      <div className="space-y-2">
        <button 
          onClick={() => setView('stats')}
          className="flex items-center gap-1 text-brand-600 text-sm font-medium mb-2"
        >
          <ChevronLeftIcon size={16} />
          Назад к статистике
        </button>
        <div ref={listRef} className="max-h-64 overflow-y-auto space-y-2 scroll-smooth">
          {sortedAnalyses.length === 0 ? (
            <p className="text-gray-400 text-sm">Нет загруженных анализов</p>
          ) : (
            sortedAnalyses.map((a, i) => (
              <div 
                key={a.id} 
                id={i === sortedAnalyses.length - 1 ? 'first-analysis-item' : i === 0 ? 'last-analysis-item' : undefined}
                className={`bg-white border rounded-lg p-2 flex items-center gap-2 ${
                  (scrollTarget === 'first' && i === sortedAnalyses.length - 1) || 
                  (scrollTarget === 'last' && i === 0) 
                    ? 'border-brand-400 ring-2 ring-brand-100' 
                    : 'border-gray-200'
                }`}
              >
                <ClipboardIcon size={16} className="text-brand-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{a.title}</p>
                  <p className="text-xs text-gray-400">{formatDate(a.created_at)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // View: Stats (default)
  return (
    <div className="space-y-2">
      {/* Кнопка аналитики */}
      <button 
        onClick={() => setView('analytics')}
        className="w-full text-left p-2 rounded-lg bg-gradient-to-r from-brand-50 to-teal-50 border border-brand-200 hover:from-brand-100 hover:to-teal-100 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <BarChartIcon size={18} className="text-brand-600" />
          <span className="font-bold text-brand-700">📊 Аналитика показателей →</span>
        </div>
        <p className="text-xs text-brand-600 mt-1">Графики изменения показателей во времени</p>
      </button>
      
      <button 
        onClick={() => setView('list')}
        className="w-full text-left p-2 rounded-lg hover:bg-gray-100 transition-colors group"
      >
        <span className="text-sm text-gray-600">Всего загружено: </span>
        <span className="font-bold text-brand-600 group-hover:underline">{analyses.length} анализов →</span>
      </button>
      
      {firstAnalysis && (
        <button 
          onClick={() => { setView('list'); setScrollTarget('first'); }}
          className="w-full text-left p-2 rounded-lg hover:bg-gray-100 transition-colors group"
        >
          <span className="text-sm text-gray-600">Первый анализ: </span>
          <span className="font-bold text-gray-900 group-hover:underline">{formatDate(firstAnalysis.created_at)} →</span>
        </button>
      )}
      
      {lastAnalysis && (
        <button 
          onClick={() => { setView('list'); setScrollTarget('last'); }}
          className="w-full text-left p-2 rounded-lg hover:bg-gray-100 transition-colors group"
        >
          <span className="text-sm text-gray-600">Последний анализ: </span>
          <span className="font-bold text-gray-900 group-hover:underline">{formatDate(lastAnalysis.created_at)} →</span>
        </button>
      )}
    </div>
  );
}

