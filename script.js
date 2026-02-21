// КОНФИГУРАЦИЯ
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxzY9lc4F9QlGVF3H_4Gu-6WoArOR_RqJ5yO-ugKlSw2VHn5jLfh2Nyg-JSG17GEJL9/exec';

// Состояние приложения
let isAdmin = false;
let applications = [];
let holidays = [];
let vacancies = [];
let chatMessages = {};
let deleteTarget = null;
let clickCount = 0;
let clickTimer = null;
let audioContext = null;

// Константы
const STORAGE_KEYS = {
    AUTH: 'oskolkiAuth',
    AUTH_EXPIRY: 'oskolkiAuthExpiry',
    HOLIDAYS: 'oskolkiHolidays',
    VACANCIES: 'oskolkiVacancies',
    CHAT: 'oskolkiChat'
};

// Инициализация
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Сайт Осколки загружается...');
    
    // СНАЧАЛА проверяем авторизацию (до загрузки данных)
    checkStoredAuth();
    
    // Загружаем данные
    await loadAllData();
    loadLocalData();
    setupEventListeners();
    
    // Обновляем UI
    updateAdminUI();
    updateHolidayBanner();
    renderPublicVacancies();
    
    console.log('Авторизация:', isAdmin ? 'Админ' : 'Пользователь');
});

// ПРОВЕРКА СОХРАНЕННОЙ АВТОРИЗАЦИИ (НАВСЕГДА)
function checkStoredAuth() {
    try {
        // Смотрим, есть ли запись об авторизации
        const savedAuth = localStorage.getItem(STORAGE_KEYS.AUTH);
        
        if (savedAuth === 'true') {
            console.log('✅ Найдена сохраненная авторизация! Входим автоматически');
            isAdmin = true;
            
            // Дополнительная проверка (на всякий случай)
            const expiry = localStorage.getItem(STORAGE_KEYS.AUTH_EXPIRY);
            if (expiry && Date.now() > parseInt(expiry)) {
                console.log('Авторизация истекла');
                localStorage.removeItem(STORAGE_KEYS.AUTH);
                isAdmin = false;
            }
        } else {
            console.log('❌ Авторизация не найдена');
            isAdmin = false;
        }
    } catch (e) {
        console.error('Ошибка проверки авторизации:', e);
        isAdmin = false;
    }
}

// Загрузка данных
async function loadAllData() {
    try {
        const appsResponse = await fetch(`${APPS_SCRIPT_URL}?sheet=Заявки&t=${Date.now()}`);
        const appsData = await appsResponse.json();
        if (appsData.success) {
            applications = appsData.data || [];
            localStorage.setItem('oskolkiApplications', JSON.stringify(applications));
        }
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        loadLocalData();
    }
}

function loadLocalData() {
    const savedApps = localStorage.getItem('oskolkiApplications');
    if (savedApps) {
        try {
            applications = JSON.parse(savedApps);
        } catch (e) {
            applications = [];
        }
    }
}

// Настройка обработчиков
function setupEventListeners() {
    // СЕКРЕТНЫЙ ВХОД (15 кликов)
    document.getElementById('holidayBanner').addEventListener('click', function() {
        clickCount++;
        console.log('Кликов:', clickCount);
        
        if (clickTimer) clearTimeout(clickTimer);
        
        clickTimer = setTimeout(() => {
            clickCount = 0;
            console.log('Сброс счетчика');
        }, 3000);
        
        if (clickCount >= 15) {
            console.log('🎉 15 кликов! Показываем форму входа');
            clickCount = 0;
            showLoginModal();
        }
    });
    
    // Кнопка выхода
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            console.log('Выход из админки');
            isAdmin = false;
            localStorage.removeItem(STORAGE_KEYS.AUTH);
            localStorage.removeItem(STORAGE_KEYS.AUTH_EXPIRY);
            updateAdminUI();
            showAlert('Вы вышли из админ-панели', 'success');
        });
    }
    
    // Переключение вкладок
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const tabId = this.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabId).classList.add('active');
            
            if (tabId === 'adminTab') {
                renderApplications();
                renderHolidays();
            }
        });
    });
    
    // Отправка заявки
    document.getElementById('applicationForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
            timestamp: new Date().toISOString(),
            fullName: document.getElementById('fullName').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            position: document.getElementById('position').value,
            salary: document.getElementById('salary').value,
            status: 'новая',
            notes: '',
            rating: ''
        };
        
        applications.unshift(formData);
        localStorage.setItem('oskolkiApplications', JSON.stringify(applications));
        
        document.getElementById('fullName').value = '';
        document.getElementById('email').value = '';
        document.getElementById('phone').value = '';
        document.getElementById('position').value = '';
        document.getElementById('salary').value = '';
        
        showAlert('Спасибо! Ваша заявка принята!', 'success');
        playNotificationSound();
        
        if (isAdmin) renderApplications();
    });
}

// ПОКАЗ ФОРМЫ ВХОДА (после 15 кликов)
function showLoginModal() {
    // Создаем модальное окно
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'adminLoginModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 350px;">
            <h3 style="margin-bottom: 20px; color: var(--accent-primary);">
                <i class="fas fa-lock"></i> Вход для администратора
            </h3>
            <input type="email" id="loginEmail" placeholder="Email" value="admin@admin" 
                   style="width: 100%; padding: 12px; margin-bottom: 10px; border-radius: 10px;">
            <input type="password" id="loginPassword" placeholder="Пароль" value="admin@admin" 
                   style="width: 100%; padding: 12px; margin-bottom: 20px; border-radius: 10px;">
            <div style="display: flex; gap: 10px;">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()" style="flex: 1;">
                    Отмена
                </button>
                <button class="btn-primary" onclick="handleLogin()" style="flex: 1;">
                    Войти
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// ОБРАБОТКА ВХОДА (глобальная функция)
window.handleLogin = function() {
    const modal = document.getElementById('adminLoginModal');
    const email = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;
    
    console.log('Попытка входа:', email);
    
    if (email === 'admin@admin' && password === 'admin@admin') {
        console.log('✅ Успешный вход! Сохраняем НАВСЕГДА');
        
        // СОХРАНЯЕМ АВТОРИЗАЦИЮ НАВСЕГДА
        localStorage.setItem(STORAGE_KEYS.AUTH, 'true');
        
        // Ставим метку на 10 лет вперед (можно и навсегда)
        const tenYearsFromNow = Date.now() + (10 * 365 * 24 * 60 * 60 * 1000);
        localStorage.setItem(STORAGE_KEYS.AUTH_EXPIRY, tenYearsFromNow.toString());
        
        isAdmin = true;
        
        if (modal) modal.remove();
        
        updateAdminUI();
        showAlert('🔓 Добро пожаловать, администратор!', 'success');
        showEasterEgg();
    } else {
        console.log('❌ Неверный пароль');
        alert('Неверный email или пароль');
    }
};

// ПРОВЕРКА АВТОРИЗАЦИИ (при каждой загрузке)
function checkAuth() {
    // Уже проверили в checkStoredAuth, просто возвращаем
    return isAdmin;
}

// Обновление интерфейса
function updateAdminUI() {
    const adminTabs = document.getElementById('adminTabs');
    const formTab = document.getElementById('formTab');
    const adminTab = document.getElementById('adminTab');
    
    if (!adminTabs || !formTab || !adminTab) return;
    
    if (isAdmin) {
        console.log('👑 Показываем админку');
        adminTabs.style.display = 'flex';
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.dataset.tab === 'adminTab') {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        formTab.classList.remove('active');
        adminTab.classList.add('active');
        
        renderApplications();
        renderHolidays();
    } else {
        console.log('👤 Показываем форму');
        adminTabs.style.display = 'none';
        formTab.classList.add('active');
        adminTab.classList.remove('active');
    }
}

// Пасхалка
function showEasterEgg() {
    const egg = document.createElement('div');
    egg.innerHTML = '🍖 АДМИН ОСКОЛКИ 👑';
    egg.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #c43a3a, #e67e22);
        color: white;
        padding: 30px 50px;
        border-radius: 50px;
        font-size: 2rem;
        font-weight: 800;
        z-index: 10000;
        box-shadow: 0 0 100px rgba(196,58,58,0.8);
        animation: bounce 0.5s ease;
        text-align: center;
    `;
    document.body.appendChild(egg);
    
    setTimeout(() => egg.remove(), 3000);
}

// Звук
function playNotificationSound() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {}
}

// Уведомления
function showAlert(message, type) {
    const alert = document.getElementById('formAlert');
    if (alert) {
        alert.textContent = message;
        alert.className = `alert ${type}`;
        alert.style.display = 'flex';
        setTimeout(() => alert.style.display = 'none', 5000);
    }
}

function showHolidayAlert(message, type) {
    const alert = document.getElementById('holidayAlert');
    if (alert) {
        alert.textContent = message;
        alert.className = `alert ${type}`;
        alert.style.display = 'flex';
        setTimeout(() => alert.style.display = 'none', 3000);
    }
}

// Баннер с праздником
function updateHolidayBanner() {
    const today = new Date().toISOString().split('T')[0];
    const todayHolidays = holidays.filter(h => h.date === today);
    const banner = document.getElementById('holidayBanner');
    const holidayText = document.getElementById('holidayText');
    
    if (todayHolidays.length > 0) {
        holidayText.textContent = `🎉 Праздник сегодня: ${todayHolidays.map(h => h.name).join(', ')}`;
        banner.style.background = 'linear-gradient(135deg, rgba(243,156,18,0.2), rgba(231,76,60,0.2))';
    } else {
        holidayText.textContent = '📅 Рабочие будни';
        banner.style.background = '';
    }
}

// Отрисовка заявок
function renderApplications() {
    const tbody = document.getElementById('applicationsList');
    if (!tbody) return;
    
    if (applications.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty-message">Нет заявок</td></tr>';
        return;
    }
    
    tbody.innerHTML = applications.map(app => `
        <tr>
            <td>${new Date(app.timestamp).toLocaleString()}</td>
            <td>${app.fullName || ''}</td>
            <td>${app.email || ''}</td>
            <td>${app.phone || ''}</td>
            <td>${app.position || ''}</td>
            <td>${app.salary || ''} ₽</td>
            <td>
                <select onchange="updateStatus('${app.timestamp}', this.value)" class="status-select ${app.status || 'новая'}">
                    <option value="новая" ${app.status === 'новая' ? 'selected' : ''}>Новая</option>
                    <option value="просмотрено" ${app.status === 'просмотрено' ? 'selected' : ''}>Просмотрено</option>
                    <option value="одобрено" ${app.status === 'одобрено' ? 'selected' : ''}>Одобрено</option>
                    <option value="отказ" ${app.status === 'отказ' ? 'selected' : ''}>Отказ</option>
                </select>
            </td>
            <td>
                <input type="text" value="${app.notes || ''}" placeholder="Заметки" 
                       onchange="addNote('${app.timestamp}', this.value)" class="notes-input">
            </td>
            <td>
                <select onchange="addRating('${app.timestamp}', this.value)" class="rating-select">
                    <option value="">★</option>
                    <option value="1" ${app.rating === '1' ? 'selected' : ''}>★☆☆</option>
                    <option value="2" ${app.rating === '2' ? 'selected' : ''}>★★☆</option>
                    <option value="3" ${app.rating === '3' ? 'selected' : ''}>★★★</option>
                </select>
            </td>
            <td>
                <button class="btn-chat" onclick="openChat('${app.timestamp}', '${app.fullName}')">💬</button>
            </td>
        </tr>
    `).join('');
}

// Остальные функции (можно оставить как есть)
function renderHolidays() { /* ... */ }
function renderPublicVacancies() { /* ... */ }
window.updateStatus = function(id, status) { /* ... */ };
window.addNote = function(id, note) { /* ... */ };
window.addRating = function(id, rating) { /* ... */ };
window.openChat = function(id, name) { /* ... */ };
window.closeChat = function(id) { /* ... */ };
window.confirmDelete = function(id) { /* ... */ };

// Заглушки для остальных функций
function renderHolidays() {
    const container = document.getElementById('holidaysContainer');
    if (container) container.innerHTML = '<p>Праздники скоро</p>';
}

function renderPublicVacancies() {
    const container = document.getElementById('publicVacancies');
    if (container) container.innerHTML = vacancies.map(v => `
        <div class="vacancy-card">
            <div class="vacancy-title">${v.title}</div>
            <div>${v.salaryMin}-${v.salaryMax} ₽</div>
        </div>
    `).join('');
}
