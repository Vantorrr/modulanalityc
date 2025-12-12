"use client";

import { useState, useEffect, useRef, createContext, useContext, useMemo } from "react";
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
  analysesApi, medcardApi, calendarApi, profileApi, biomarkersApi,
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
        <div className="bg-gradient-to-br from-emerald-400 to-teal-500 p-6 text-center">
          <div className="w-20 h-20 bg-white/20 rounded-full mx-auto flex items-center justify-center mb-4">
            <FolderIcon size={40} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Заполните медкарту</h2>
        </div>
        
        {/* Content */}
        <div className="p-6 text-center">
          <p className="text-gray-600 mb-6 leading-relaxed">
            Для получения <span className="font-semibold text-emerald-600">персонализированных рекомендаций</span> и 
            точной расшифровки анализов укажите ваши данные: рост, вес, аллергии и хронические заболевания.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={onFill}
              className="w-full py-3.5 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-200"
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
                <p className="text-xs text-emerald-600 font-semibold">Медицинский ассистент</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
            </div>
          </div>
        </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto">
            {activeTab === "home" && <HomePage onNavigate={setActiveTab} />}
            {activeTab === "analyses" && <BiomarkerTablePage />}
            {activeTab === "medcard" && <MedcardPage />}
            {activeTab === "calendar" && <CalendarPage />}
            {activeTab === "profile" && <ProfilePage />}
          </main>

          {/* Bottom Navigation */}
          <nav className="bg-white border-t border-gray-200 px-2 py-2">
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
                    className={activeTab === tab.id ? "text-emerald-600" : "text-gray-400"}
                  />
                  <span className={`text-[10px] font-semibold ${activeTab === tab.id ? "text-emerald-600" : "text-gray-400"}`}>
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
function HomePage({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { isProfileFilled, checkAndPromptMedcard } = useMedcard();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestRec, setLatestRec] = useState<any>(null);

  useEffect(() => {
    analysesApi.getAll()
      .then(data => {
        setAnalyses(data);
        // Find latest recommendation
        const withRecs = data.find((a: any) => a.ai_recommendations?.items?.length > 0);
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

  // Рассчитываем реальный индекс здоровья на основе показателей
  const totalBiomarkers = analyses.reduce((acc, a) => 
    acc + (Array.isArray(a.biomarkers) ? a.biomarkers.length : 0), 0
  );
  const normalBiomarkers = analyses.reduce((acc, a) => 
    acc + (Array.isArray(a.biomarkers) ? a.biomarkers.filter(b => b.status === 'normal').length : 0), 0
  );
  
  // Индекс здоровья: процент показателей в норме (если нет данных - 0)
  const healthIndex = totalBiomarkers > 0 ? Math.round((normalBiomarkers / totalBiomarkers) * 100) : 0;
  
  // Текст статуса на основе индекса
  const healthStatus = healthIndex >= 90 ? 'Отлично' : 
                       healthIndex >= 75 ? 'Хорошо' : 
                       healthIndex >= 50 ? 'Средне' : 
                       healthIndex > 0 ? 'Требует внимания' : 'Нет данных';
  
  // Цвет карточки в зависимости от индекса
  const healthColor = healthIndex >= 75 ? 'bg-emerald-500 shadow-emerald-200' : 
                      healthIndex >= 50 ? 'bg-amber-500 shadow-amber-200' : 
                      healthIndex > 0 ? 'bg-rose-500 shadow-rose-200' : 'bg-gray-400 shadow-gray-200';

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
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-bold">{healthIndex}</span>
            <span className="text-white/80 text-sm">/ 100</span>
          </div>
          <div className="flex justify-between text-xs text-white/80 mb-2">
            <span>{healthStatus}</span>
            {totalBiomarkers > 0 && (
              <span>{normalBiomarkers} из {totalBiomarkers} в норме</span>
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
  
  const steps = [
    { text: "Загружаю фото", icon: "📷", duration: 1500 },
    { text: "Распознаю текст", icon: "🔍", duration: 1500 },
    { text: "Анализирую показатели", icon: "🧬", duration: 1500 },
    { text: "Пишу рекомендации", icon: "💊", duration: 1500 },
  ];
  
  useEffect(() => {
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

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 z-[9999] flex flex-col items-center justify-center p-6">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500 rounded-full opacity-10 blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500 rounded-full opacity-10 blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-md">
        {/* Logo/Icon */}
        <div className="relative mb-10">
          <div className="absolute inset-0 bg-emerald-400 rounded-full blur-2xl opacity-30 animate-pulse"></div>
          <div className="relative w-24 h-24 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-full shadow-2xl flex items-center justify-center">
            <span className="text-4xl">{steps[currentStep].icon}</span>
          </div>
        </div>
        
        {/* Title */}
        <h2 className="text-white text-2xl font-bold mb-2 text-center">
          Анализирую ваши данные
        </h2>
        <p className="text-gray-400 text-sm mb-10 text-center">
          Это займёт несколько секунд
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
                    ? 'bg-white/10 border border-white/20 shadow-lg' 
                    : isCompleted 
                      ? 'bg-emerald-500/10 border border-emerald-500/20' 
                      : 'opacity-40'
                }`}
              >
                {/* Step indicator */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 ${
                  isCompleted 
                    ? 'bg-emerald-500' 
                    : isActive 
                      ? 'bg-gradient-to-br from-purple-500 to-blue-500 animate-pulse' 
                      : 'bg-white/10'
                }`}>
                  {isCompleted ? (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-2xl">{step.icon}</span>
                  )}
                </div>
                
                {/* Step text */}
                <div className="flex-1">
                  <div className={`font-semibold transition-colors ${
                    isCompleted ? 'text-emerald-400' : isActive ? 'text-white' : 'text-gray-500'
                  }`}>
                    {step.text}
                  </div>
                  {isActive && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-3 h-3 bg-purple-500 rounded-full animate-ping"></div>
                      <span className="text-xs text-gray-400">Выполняется...</span>
                    </div>
                  )}
                  {isCompleted && (
                    <span className="text-xs text-emerald-400">Готово ✓</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-emerald-400 to-cyan-400 h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
        
        <p className="text-gray-500 text-xs mt-6 text-center">
          Пожалуйста, не закрывайте приложение
        </p>
      </div>
    </div>
  );
}

function UploadAnalysisButton({ onBeforeUpload, onSuccess }: { onBeforeUpload?: () => boolean; onSuccess?: () => void }) {
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
    
    setUploading(true);
    const startTime = Date.now();
    
    try {
      await analysesApi.upload(file);
      
      // Показываем заставку минимум 6 секунд (чтобы пользователь видел все этапы)
      const elapsed = Date.now() - startTime;
      if (elapsed < 6000) {
        await new Promise(resolve => setTimeout(resolve, 6000 - elapsed));
      }
      
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
      {uploading && <ProcessingScreen />}
      <button
        onClick={handleClick}
        disabled={uploading}
        className="w-full bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 text-left hover:bg-gray-50 disabled:opacity-50"
      >
        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
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

  // Умные периоды - показываем только доступные
  const availablePeriods = useMemo(() => {
    const periods: Array<{ value: '7d' | '14d' | '30d' | '3m' | '6m' | '1y' | 'all', label: string }> = [];
    
    // Детальные периоды для недавних данных
    if (dataRange.days >= 7) periods.push({ value: '7d', label: '7 дн' });
    if (dataRange.days >= 14) periods.push({ value: '14d', label: '14 дн' });
    if (dataRange.days >= 30) periods.push({ value: '30d', label: '30 дн' });
    
    // Месячные периоды
    if (dataRange.months >= 3) periods.push({ value: '3m', label: '3 мес' });
    if (dataRange.months >= 6) periods.push({ value: '6m', label: '6 мес' });
    if (dataRange.months >= 12) periods.push({ value: '1y', label: 'Год' });
    
    periods.push({ value: 'all', label: 'Все' });
    
    return periods;
  }, [dataRange.days, dataRange.months]);

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
          <span className="text-2xl font-bold text-emerald-600">{chartData[0].value}</span>
          <span className="text-xs text-gray-400 ml-1">{formatShortDate(chartData[0].date)}</span>
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
          <BarChartIcon size={18} className="text-emerald-500" />
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

          {/* Период - только доступные */}
          {availablePeriods.length > 1 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {availablePeriods.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-3 py-1.5 text-[10px] font-medium rounded transition-colors ${
                    period === p.value 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Мини-график */}
          <div className="mt-3">
            {renderMiniChart()}
          </div>

          {/* Статистика */}
          {chartData.length > 1 && (
            <div className="mt-2 flex justify-around text-center border-t border-gray-100 pt-2">
              <div>
                <div className="text-sm font-bold text-gray-900">{Math.min(...chartData.map(d => d.value)).toFixed(1)}</div>
                <div className="text-[9px] text-gray-400">Мин</div>
              </div>
              <div>
                <div className="text-sm font-bold text-emerald-600">{(chartData.reduce((s, d) => s + d.value, 0) / chartData.length).toFixed(1)}</div>
                <div className="text-[9px] text-gray-400">Сред</div>
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">{Math.max(...chartData.map(d => d.value)).toFixed(1)}</div>
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
        type === 'success' ? 'bg-emerald-500' : 'bg-white/20'
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
function BiomarkerTablePage() {
  const { checkAndPromptMedcard } = useMedcard();
  const [biomarkers, setBiomarkers] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [latestAiAnalysis, setLatestAiAnalysis] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedBiomarker, setSelectedBiomarker] = useState<any | null>(null);
  const [showAiBlock, setShowAiBlock] = useState(true);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadBiomarkers();
    loadAnalyses();
  }, []);

  const loadBiomarkers = async () => {
    try {
      setLoading(true);
      const data = await biomarkersApi.getAll();
      setBiomarkers(data.items);
    } catch (err) {
      console.error("Failed to load biomarkers", err);
      setToast({msg: 'Ошибка загрузки данных', type: 'error'});
    } finally {
      setLoading(false);
    }
  };

  const loadAnalyses = async () => {
    try {
      const items = await analysesApi.getAll();
      console.log('[BiomarkerTable] Loaded analyses:', items.length, items);
      setAnalyses(items);
      
      // Загружаем полные данные последнего завершенного анализа для AI-комментариев
      const completed = items.filter((a: any) => a.status === 'completed');
      console.log('[BiomarkerTable] Completed analyses:', completed.length);
      
      if (completed.length > 0) {
        const latestId = completed[0].id;
        console.log('[BiomarkerTable] Loading full data for analysis:', latestId);
        const fullData = await analysesApi.getById(latestId);
        console.log('[BiomarkerTable] Full data:', fullData);
        console.log('[BiomarkerTable] AI Summary:', fullData.ai_summary);
        console.log('[BiomarkerTable] AI Recommendations:', fullData.ai_recommendations);
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

    const startTime = Date.now();
    
    try {
      setUploading(true);
      await analysesApi.upload(file);
      
      // Показываем заставку минимум 6 секунд (чтобы пользователь видел все этапы)
      const elapsed = Date.now() - startTime;
      if (elapsed < 6000) {
        await new Promise(resolve => setTimeout(resolve, 6000 - elapsed));
      }
      
      setToast({msg: '✅ Анализ загружен! Идет распознавание...', type: 'success'});
      
      // Reload data сразу
      loadBiomarkers();
      loadAnalyses();
      
      // Polling - проверяем статус каждые 5 секунд, пока AI не закончит
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount++;
        console.log('[BiomarkerTable] Polling for AI data, attempt:', pollCount);
        await loadAnalyses();
        
        // Останавливаем после 12 попыток (60 секунд)
        if (pollCount >= 12) {
          clearInterval(pollInterval);
        }
      }, 5000);
      
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

  const [searchQuery, setSearchQuery] = useState('');

  // Фильтрация по поиску
  const filteredBiomarkers = useMemo(() => {
    if (!searchQuery.trim()) return biomarkers;
    const query = searchQuery.toLowerCase();
    return biomarkers.filter(b => 
      b.name.toLowerCase().includes(query) ||
      b.code.toLowerCase().includes(query)
    );
  }, [biomarkers, searchQuery]);

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
    return <BiomarkerDetailPage biomarker={selectedBiomarker} onBack={() => setSelectedBiomarker(null)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 pb-24">
      {/* Processing Screen */}
      {uploading && <ProcessingScreen />}
      
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
            className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:bg-gray-300 flex items-center gap-2 shadow-md"
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

        {/* AI Комментарии и Рекомендации */}
        {showAiBlock && (
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-4 border border-purple-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🤖</span>
                <h3 className="font-bold text-gray-800">Заключение ИИ</h3>
              </div>
              <button 
                onClick={() => setShowAiBlock(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>
            
            {/* AI Summary - показываем реальные данные или демо */}
            <div className="bg-white/70 rounded-xl p-4 mb-3 border border-purple-100">
              <div className="text-sm text-gray-700 leading-relaxed">
                {latestAiAnalysis?.ai_summary ? (
                  formatMarkdownText(latestAiAnalysis.ai_summary)
                ) : biomarkers.length > 0 ? (
                  <>
                    <p className="mb-2">📊 <strong>Анализ ваших показателей:</strong></p>
                    <p className="mb-2">
                      Обнаружено {biomarkers.filter((b: any) => b.last_status !== 'normal').length} показателей, 
                      требующих внимания. Рекомендуется консультация с врачом для детальной интерпретации результатов.
                    </p>
                    <p className="text-gray-500 text-xs mt-3">
                      💡 Загрузите новый анализ для получения персональных AI-рекомендаций
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-500">Загрузите анализы для получения AI-рекомендаций</p>
                  </>
                )}
              </div>
            </div>
            
            {/* AI Recommendations - показываем реальные или демо */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">💊</span>
                <span className="text-sm font-semibold text-gray-700">Рекомендуемые витамины</span>
              </div>
              <div className="grid gap-2">
                {(latestAiAnalysis?.ai_recommendations?.items?.length > 0 
                  ? latestAiAnalysis.ai_recommendations.items.slice(0, 3) 
                  : [
                      { product: { name: 'Витамин D3' }, reason: 'Для поддержания иммунитета и костей' },
                      { product: { name: 'Омега-3' }, reason: 'Для сердца и сосудов' },
                      { product: { name: 'Магний B6' }, reason: 'Для нервной системы и сна' },
                    ]
                ).map((rec: any, i: number) => (
                  <div key={i} className="bg-white/70 rounded-xl p-3 border border-purple-100 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                      i === 0 ? 'bg-gradient-to-br from-orange-400 to-pink-500' :
                      i === 1 ? 'bg-gradient-to-br from-blue-400 to-cyan-500' :
                      'bg-gradient-to-br from-green-400 to-emerald-500'
                    }`}>
                      {rec.product?.name?.charAt(0) || 'V'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm truncate">
                        {rec.product?.name || rec.title || 'Витамин'}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {rec.reason || rec.description || 'Для поддержания здоровья'}
                      </div>
                    </div>
                    <a 
                      href="#"
                      className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600 transition-colors"
                    >
                      Купить
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Поиск */}
        {biomarkers.length > 0 && (
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск показателей..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        )}

        {!loading && biomarkers.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Нет данных</h3>
            <p className="text-sm text-gray-500 mb-4">
              Загрузите анализы чтобы увидеть показатели
            </p>
          </div>
        )}

        {/* Список показателей */}
        {!loading && filteredBiomarkers.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-100">
              {filteredBiomarkers.map((bio: any) => (
                <button
                  key={bio.code}
                  onClick={() => openBiomarkerDetail(bio.code)}
                  className="w-full px-4 py-4 hover:bg-gray-50 transition-colors text-left flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{bio.name}</div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                      <span>{bio.unit}</span>
                      <span>•</span>
                      <span>{bio.total_measurements} {bio.total_measurements === 1 ? 'измерение' : 'измерений'}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {bio.last_value !== null && bio.last_value !== undefined ? (
                      <div>
                        <div className={`text-xl font-bold ${
                          bio.last_status === 'normal' ? 'text-green-600' :
                          bio.last_status === 'low' || bio.last_status === 'high' ? 'text-orange-600' :
                          'text-red-600'
                        }`}>
                          {bio.last_value}
                        </div>
                        {bio.last_measured_at && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {new Date(bio.last_measured_at).toLocaleDateString('ru-RU', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit',
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400">—</div>
                    )}
                  </div>
                  <ChevronRightIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && biomarkers.length > 0 && filteredBiomarkers.length === 0 && (
          <div className="text-center py-8 bg-white rounded-xl shadow-sm">
            <div className="text-3xl mb-3">🔍</div>
            <h3 className="text-md font-semibold text-gray-700">Ничего не найдено</h3>
            <p className="text-sm text-gray-500 mt-1">
              Попробуйте изменить запрос
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Детальная страница биомаркера
function BiomarkerDetailPage({ biomarker, onBack }: { biomarker: any, onBack: () => void }) {
  const [showAddDateModal, setShowAddDateModal] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  
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
      // Перезагрузка данных
      const updated = await biomarkersApi.getDetail(biomarker.code);
      biomarker.history = updated.history;
      biomarker.total_measurements = updated.total_measurements;
      biomarker.min_value = updated.min_value;
      biomarker.max_value = updated.max_value;
      biomarker.avg_value = updated.avg_value;
    } catch (err) {
      console.error("Failed to delete value", err);
      setToast({msg: 'Ошибка удаления', type: 'error'});
    }
  };

  // График
  const chartData = useMemo(() => {
    if (!history.length) return [];
    const sorted = [...history]
      .filter((h: any) => h.measured_at)
      .sort((a: any, b: any) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime());
    return sorted;
  }, [history]);

  const renderChart = () => {
    if (chartData.length < 2) return null;

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
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto">
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
          <p className="text-sm text-gray-500 mt-1">{biomarker.unit || '—'}</p>
          
          {/* Статистика */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center">
              <div className="text-xs text-gray-500">Минимум</div>
              <div className="text-lg font-bold text-blue-600">{biomarker.min_value?.toFixed(1) ?? '—'}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500">Среднее</div>
              <div className="text-lg font-bold text-gray-700">{biomarker.avg_value?.toFixed(1) ?? '—'}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500">Максимум</div>
              <div className="text-lg font-bold text-red-600">{biomarker.max_value?.toFixed(1) ?? '—'}</div>
            </div>
          </div>
        </div>

        {/* График */}
        {chartData.length >= 2 && (
          <div className="bg-white rounded-xl shadow-md p-4">
            <h2 className="text-md font-semibold text-gray-700 mb-3">Динамика</h2>
            {renderChart()}
          </div>
        )}

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
                    <div className="text-xs text-gray-500 mt-1">
                      {item.measured_at ? new Date(item.measured_at).toLocaleDateString('ru-RU', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      }) : '—'}
                      {item.analysis_title && (
                        <span className="ml-2">• {item.analysis_title}</span>
                      )}
                    </div>
                  </div>
                  {!item.analysis_id && (
                    <button
                      onClick={() => deleteValue(item.id)}
                      className="text-red-500 hover:text-red-700 ml-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Модалка добавления даты */}
      {showAddDateModal && (
        <AddDateModal
          biomarkerCode={biomarker.code || ''}
          biomarkerName={biomarker.name || biomarker.code || 'Показатель'}
          biomarkerUnit={biomarker.unit || 'ед.'}
          onClose={() => { console.log('[Modal] onClose called'); setShowAddDateModal(false); }}
          onSuccess={async () => {
            setShowAddDateModal(false);
            setToast({msg: 'Значение добавлено', type: 'success'});
            // Перезагрузка данных
            const updated = await biomarkersApi.getDetail(biomarker.code);
            biomarker.history = updated.history;
            biomarker.total_measurements = updated.total_measurements;
            biomarker.min_value = updated.min_value;
            biomarker.max_value = updated.max_value;
            biomarker.avg_value = updated.avg_value;
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
            <div className="relative flex items-center group">
              <input
                type="text"
                inputMode="decimal"
                value={value}
                onChange={handleValueChange}
                className="w-full bg-gray-50 border-2 border-transparent focus:bg-white focus:border-emerald-500 rounded-2xl px-4 py-3.5 text-lg font-semibold text-gray-900 placeholder-gray-400 outline-none transition-all pr-16"
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
              <div className="w-full bg-gray-50 border-2 border-transparent group-hover:bg-white group-hover:border-emerald-200 rounded-2xl px-4 py-3.5 flex items-center justify-between text-gray-900 transition-all cursor-pointer">
                <span className="font-medium text-base">
                  {formattedDate}
                </span>
                <CalendarIcon className="text-gray-400 group-hover:text-emerald-500 transition-colors" size={20} />
              </div>
            </div>
          </div>

          {/* Референсы */}
          <div className="pt-2">
            <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
              Референсные значения <span className="text-gray-400 font-normal">(опционально)</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={refMin}
                  onChange={(e) => setRefMin(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
                  className="w-full bg-gray-50 border-2 border-transparent focus:bg-white focus:border-emerald-500 rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-all text-center placeholder-gray-400"
                  placeholder="Мин"
                />
              </div>
              <span className="text-gray-300 font-bold">—</span>
              <div className="relative flex-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={refMax}
                  onChange={(e) => setRefMax(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
                  className="w-full bg-gray-50 border-2 border-transparent focus:bg-white focus:border-emerald-500 rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-all text-center placeholder-gray-400"
                  placeholder="Макс"
                />
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
              className="py-3.5 rounded-2xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 active:scale-95 disabled:bg-emerald-300 disabled:scale-100 transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
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
          className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors disabled:opacity-50"
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
            <LoaderIcon size={24} className="text-emerald-500 animate-spin" />
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
                isProcessing && !isStuck ? 'border-emerald-200 shadow-sm' : 
                isFailed || isStuck ? 'border-red-200 opacity-80' :
                isExpanded ? 'border-emerald-300 shadow-lg' :
                'border-gray-200 hover:shadow-md hover:border-emerald-200'
              }`}
            >
              {/* Header (всегда видимый, кликабельный) */}
              <button 
                onClick={() => !isProcessing && !isStuck && toggleExpand(item)}
                disabled={isProcessing && !isStuck}
                className="w-full text-left p-4 transition-all"
              >
                {isProcessing && !isStuck && (
                  <div className="absolute inset-0 bg-emerald-50/50 flex items-center justify-center z-10 backdrop-blur-[1px]">
                    <div className="flex flex-col items-center gap-2">
                      <LoaderIcon size={24} className="text-emerald-500" />
                      <span className="text-xs font-bold text-emerald-700 animate-pulse">AI обрабатывает...</span>
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
                        !hasIssues ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
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
                        b.status === 'normal' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
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
                      <LoaderIcon size={24} className="text-emerald-500 animate-spin" />
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
                                  b.status === 'normal' ? 'text-emerald-600' : 
                                  b.status === 'low' ? 'text-amber-600' : 'text-rose-600'
                                }`}>
                                  {b.value} {b.unit || ""}
                                </div>
                                <div className={`text-[10px] ${
                                  b.status === 'normal' ? 'text-emerald-500' : 
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
                                className="inline-block mt-1.5 px-2.5 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-600 transition"
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
        <button onClick={loadProfile} className="text-emerald-500 font-bold">Повторить</button>
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
    { id: "lifestyle", label: "Образ жизни", Icon: AppleIcon, color: "bg-emerald-50 text-emerald-600", count: Object.keys(profile?.lifestyle || {}).length, total: 5 },
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
        <div className="ml-auto text-emerald-500">
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
                <span className={`text-sm ${cat.count > 0 ? "text-emerald-600 font-bold" : "text-rose-500"}`}>
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
        <button onClick={() => onSave(formData)} className="w-full bg-emerald-500 text-white py-2 rounded-lg font-bold text-sm">Сохранить раздел</button>
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
        <button onClick={() => onSave(formData)} className="w-full bg-emerald-500 text-white py-2 rounded-lg font-bold text-sm">Сохранить раздел</button>
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
          <button onClick={addItem} className="px-3 py-2 bg-emerald-500 text-white rounded-lg font-bold">+</button>
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
        <button onClick={() => onSave(listItems)} className="w-full bg-emerald-500 text-white py-2 rounded-lg font-bold text-sm">Сохранить раздел</button>
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
          <button onClick={addItem} className="px-3 py-2 bg-emerald-500 text-white rounded-lg font-bold">+</button>
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
        <button onClick={() => onSave(listItems)} className="w-full bg-emerald-500 text-white py-2 rounded-lg font-bold text-sm">Сохранить раздел</button>
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
          <button onClick={addItem} className="px-3 py-2 bg-emerald-500 text-white rounded-lg font-bold">+</button>
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
        <button onClick={() => onSave(listItems)} className="w-full bg-emerald-500 text-white py-2 rounded-lg font-bold text-sm">Сохранить раздел</button>
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
          <button onClick={addItem} className="px-3 py-2 bg-emerald-500 text-white rounded-lg font-bold">+</button>
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
        <button onClick={() => onSave(listItems)} className="w-full bg-emerald-500 text-white py-2 rounded-lg font-bold text-sm">Сохранить раздел</button>
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
        <button onClick={() => onSave(formData)} className="w-full bg-emerald-500 text-white py-2 rounded-lg font-bold text-sm">Сохранить раздел</button>
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
        <button onClick={() => onSave(formData)} className="w-full bg-emerald-500 text-white py-2 rounded-lg font-bold text-sm">Сохранить раздел</button>
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
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Недавние</h2>
          {documents.length > 0 && (
            <button className="text-sm font-semibold text-emerald-600">Все</button>
          )}
        </div>
        
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoaderIcon size={24} className="text-emerald-500 animate-spin" />
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
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white font-bold text-sm rounded-xl hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-200"
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
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer active:scale-[0.98]"
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
                  className="w-full py-3.5 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
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
        <div className="fixed bottom-20 left-4 right-4 z-50 p-4 bg-emerald-500 text-white rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300">
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

  useEffect(() => {
    calendarApi.getAll()
      .then(setReminders)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
      
      const reminder = await calendarApi.create({
        title: newTitle,
        scheduled_date: selectedDate,
        scheduled_time: timeStr,
        reminder_type: "custom",
        description: "",
        frequency: "once"
      } as any);
      setReminders(prev => [...prev, reminder]);
      setShowAddForm(false);
      setNewTitle("");
      setSelectedDate("");
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
                  isToday ? "bg-emerald-500 text-white" :
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
              <LoaderIcon size={24} className="text-emerald-500" />
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
            
            return (
              <div 
                key={r.id} 
                className={`bg-white border rounded-xl p-3 flex items-center gap-3 transition-all ${
                  isSelected ? "border-pink-400 ring-2 ring-pink-100 shadow-md" : "border-gray-200"
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isSelected ? "bg-pink-100 text-pink-600" : "bg-emerald-50 text-emerald-600"
                }`}>
                  <CalendarIcon size={18} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900">{r.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {dateStr} • {timeStr}
                  </div>
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
                className="w-full p-3 bg-gray-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </div>
            
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
                  className="flex-1 bg-white rounded-lg px-3 py-2 border border-gray-200 text-sm font-medium text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none h-10"
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
              className="flex-1 py-3.5 text-emerald-600 font-bold hover:bg-emerald-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Запланировать
            </button>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setShowAddForm(true)}
          className="w-full bg-emerald-500 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors"
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
    { id: "weight", label: "Вес", icon: "⚖️", unit: "кг", color: "bg-emerald-50 text-emerald-600", min: 20, max: 300, step: 0.1 },
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
            className="w-full py-2 bg-emerald-500 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="w-20 h-20 rounded-xl bg-emerald-500 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-3">
          {userName.split(' ').map(n => n[0]).join('')}
        </div>
        <h2 className="text-lg font-bold text-gray-900">{userName}</h2>
        <p className="text-sm text-gray-400 mt-1">Раздел Health Tracker</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button 
          onClick={() => setActiveSection(activeSection === "history" ? null : "history")}
          className="bg-white border border-gray-200 rounded-xl p-3 text-center hover:border-emerald-300 hover:shadow-sm transition-all"
        >
          <p className="text-2xl font-bold text-gray-900">{totalAnalyses}</p>
          <p className="text-[10px] text-gray-400 mt-1">Анализов</p>
        </button>
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{normalPercent}%</p>
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
            <div className="text-3xl font-bold text-emerald-600">{chartData[0].value}</div>
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
          className="flex items-center gap-1 text-emerald-600 text-sm font-medium"
        >
          <ChevronLeftIcon size={16} />
          Назад
        </button>
        
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <BarChartIcon size={18} className="text-emerald-500" />
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
                    ? 'bg-emerald-500 text-white' 
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
                <div className="text-lg font-bold text-emerald-600">
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
          className="flex items-center gap-1 text-emerald-600 text-sm font-medium mb-2"
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
                    ? 'border-emerald-400 ring-2 ring-emerald-100' 
                    : 'border-gray-200'
                }`}
              >
                <ClipboardIcon size={16} className="text-emerald-500" />
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
        className="w-full text-left p-2 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 hover:from-emerald-100 hover:to-teal-100 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <BarChartIcon size={18} className="text-emerald-600" />
          <span className="font-bold text-emerald-700">📊 Аналитика показателей →</span>
        </div>
        <p className="text-xs text-emerald-600 mt-1">Графики изменения показателей во времени</p>
      </button>
      
      <button 
        onClick={() => setView('list')}
        className="w-full text-left p-2 rounded-lg hover:bg-gray-100 transition-colors group"
      >
        <span className="text-sm text-gray-600">Всего загружено: </span>
        <span className="font-bold text-emerald-600 group-hover:underline">{analyses.length} анализов →</span>
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

