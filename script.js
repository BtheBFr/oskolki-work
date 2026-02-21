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

// Константы для ключей localStorage
const STORAGE_KEYS = {
    AUTH: 'oskolkiAuth',
    HOLIDAYS: 'oskolkiHolidays',
    VACANCIES: 'oskolkiVacancies',
    CHAT: 'oskolkiChat'
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async function() {
    // Загружаем данные из Google Sheets
    await loadAllData();
    
    // Загружаем локальные данные
    loadLocalData();
    
    // Назначаем обработчики
    setupEventListeners();
    
    // Проверяем авторизацию
    checkAuth();
    
    // Обновляем баннер с праздником
    updateHolidayBanner();
    
    // Показываем актуальные вакансии
    renderPublicVacancies();
    
    // Запускаем проверку новых сообщений каждые 10 секунд
    if (isAdmin) {
        setInterval(checkNewMessages, 10000);
    }
    
    // Запускаем проверку статуса заявок для пользователя
    checkUserApplicationStatus();
});

// Загрузка всех данных из Google Sheets
async function loadAllData() {
    try {
        // Загружаем заявки
        const appsResponse = await fetch(`${APPS_SCRIPT_URL}?sheet=Заявки&t=${Date.now()}`);
        const appsData = await appsResponse.json();
        if (appsData.success) {
            applications = appsData.data || [];
            localStorage.setItem('oskolkiApplications', JSON.stringify(applications));
        }
        
        // Загружаем праздники
        const holResponse = await fetch(`${APPS_SCRIPT_URL}?sheet=Праздники&t=${Date.now()}`);
        const holData = await holResponse.json();
        if (holData.success) {
            const serverHolidays = holData.data || [];
            const localHolidays = JSON.parse(localStorage.getItem(STORAGE_KEYS.HOLIDAYS) || '[]');
            
            const holidaysMap = new Map();
            [...serverHolidays, ...localHolidays].forEach(h => holidaysMap.set(h.id, h));
            holidays = Array.from(holidaysMap.values());
        }
        
        // Загружаем сообщения чата
        const chatResponse = await fetch(`${APPS_SCRIPT_URL}?sheet=Чат&t=${Date.now()}`);
        const chatData = await chatResponse.json();
        if (chatData.success) {
            const messages = chatData.data || [];
            messages.forEach(msg => {
                if (!chatMessages[msg.applicationId]) {
                    chatMessages[msg.applicationId] = [];
                }
                chatMessages[msg.applicationId].push(msg);
            });
        }
        
    } catch (error) {
        console.error('Ошибка загрузки из Google Sheets:', error);
        loadLocalData();
    }
}

// Загрузка локальных данных
function loadLocalData() {
    const savedApps = localStorage.getItem('oskolkiApplications');
    if (savedApps) {
        try {
            applications = JSON.parse(savedApps);
        } catch (e) {
            applications = [];
        }
    }
    
    const savedHolidays = localStorage.getItem(STORAGE_KEYS.HOLIDAYS);
    if (savedHolidays) {
        try {
            holidays = JSON.parse(savedHolidays);
        } catch (e) {
            holidays = [];
        }
    }
    
    const savedVacancies = localStorage.getItem(STORAGE_KEYS.VACANCIES);
    if (savedVacancies) {
        try {
            vacancies = JSON.parse(savedVacancies);
        } catch (e) {
            vacancies = [];
        }
    } else {
        // Вакансии по умолчанию
        vacancies = [
            {
                id: '1',
                title: 'Обвальщик',
                description: 'Опыт работы от 1 года, сменный график',
                salaryMin: 70000,
                salaryMax: 90000
            },
            {
                id: '2',
                title: 'Фаршесоставитель',
                description: 'Знание рецептур, работа с оборудованием',
                salaryMin: 65000,
                salaryMax: 85000
            },
            {
                id: '3',
                title: 'Упаковщик',
                description: 'Внимательность, работа на линии',
                salaryMin: 50000,
                salaryMax: 65000
            }
        ];
        localStorage.setItem(STORAGE_KEYS.VACANCIES, JSON.stringify(vacancies));
    }
    
    const savedChat = localStorage.getItem(STORAGE_KEYS.CHAT);
    if (savedChat) {
        try {
            chatMessages = JSON.parse(savedChat);
        } catch (e) {
            chatMessages = {};
        }
    }
}

// Сохранение в Google Sheets
async function saveToSheet(sheetName, data) {
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sheet: sheetName,
                data: data
            })
        });
        
        // Дублируем в localStorage
        if (sheetName === 'Заявки') {
            localStorage.setItem('oskolkiApplications', JSON.stringify(applications));
        } else if (sheetName === 'Праздники') {
            localStorage.setItem(STORAGE_KEYS.HOLIDAYS, JSON.stringify(holidays));
        } else if (sheetName === 'Чат') {
            localStorage.setItem(STORAGE_KEYS.CHAT, JSON.stringify(chatMessages));
        }
        
        return true;
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        // Сохраняем локально
        if (sheetName === 'Заявки') {
            localStorage.setItem('oskolkiApplications', JSON.stringify(applications));
        } else if (sheetName === 'Праздники') {
            localStorage.setItem(STORAGE_KEYS.HOLIDAYS, JSON.stringify(holidays));
        } else if (sheetName === 'Чат') {
            localStorage.setItem(STORAGE_KEYS.CHAT, JSON.stringify(chatMessages));
        }
        return false;
    }
}

// Настройка обработчиков
function setupEventListeners() {
    // Клик по празднику (секретный вход)
    document.getElementById('holidayBanner').addEventListener('click', function() {
        clickCount++;
        
        if (clickTimer) clearTimeout(clickTimer);
        
        clickTimer = setTimeout(() => {
            clickCount = 0;
        }, 3000);
        
        if (clickCount >= 15) {
            showAlert('🔓 Секретный вход активирован!', 'success');
            isAdmin = true;
            localStorage.setItem(STORAGE_KEYS.AUTH, 'true');
            updateAdminUI();
            showEasterEgg();
            clickCount = 0;
        }
    });
    
    // Выход
    document.getElementById('logoutBtn').addEventListener('click', function() {
        isAdmin = false;
        localStorage.setItem(STORAGE_KEYS.AUTH, 'false');
        updateAdminUI();
        showAlert('Вы вышли из админ-панели', 'success');
    });
    
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
            } else if (tabId === 'statsTab') {
                renderStatistics();
            } else if (tabId === 'vacanciesTab') {
                renderAdminVacancies();
            }
        });
    });
    
    // Отправка формы заявки
    document.getElementById('applicationForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const fullName = document.getElementById('fullName').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const position = document.getElementById('position').value;
        const salary = document.getElementById('salary').value;
        
        if (!fullName || !email || !phone || !position || !salary) {
            showAlert('Пожалуйста, заполните все поля', 'error');
            return;
        }
        
        const newApplication = {
            timestamp: new Date().toISOString(),
            fullName,
            email,
            phone,
            position,
            salary,
            status: 'новая',
            notes: '',
            rating: ''
        };
        
        applications.unshift(newApplication);
        
        // Сохраняем
        const sheetData = [
            newApplication.timestamp,
            newApplication.fullName,
            newApplication.email,
            newApplication.phone,
            newApplication.position,
            newApplication.salary,
            newApplication.status,
            newApplication.notes,
            newApplication.rating
        ];
        
        await saveToSheet('Заявки', sheetData);
        
        // Очищаем форму
        document.getElementById('fullName').value = '';
        document.getElementById('email').value = '';
        document.getElementById('phone').value = '';
        document.getElementById('position').value = '';
        document.getElementById('salary').value = '';
        
        showAlert('Спасибо! Ваша заявка принята. Мы скоро свяжемся с вами.', 'success');
        playNotificationSound();
        
        // Сохраняем email пользователя для проверки статуса
        localStorage.setItem('userEmail', email);
        localStorage.setItem('lastApplicationTime', Date.now().toString());
        
        if (isAdmin) {
            renderApplications();
        }
    });
    
    // Добавление праздника
    document.getElementById('addHolidayBtn').addEventListener('click', async function() {
        const name = document.getElementById('holidayName').value.trim();
        const date = document.getElementById('holidayDate').value;
        
        if (!name || !date) {
            showHolidayAlert('Заполните название и дату праздника', 'error');
            return;
        }
        
        const newHoliday = {
            id: Date.now().toString(),
            name,
            date,
            createdAt: new Date().toISOString()
        };
        
        holidays.push(newHoliday);
        
        const sheetData = [
            newHoliday.id,
            newHoliday.name,
            newHoliday.date,
            newHoliday.createdAt
        ];
        
        await saveToSheet('Праздники', sheetData);
        
        document.getElementById('holidayName').value = '';
        document.getElementById('holidayDate').value = '';
        
        renderHolidays();
        updateHolidayBanner();
        showHolidayAlert('Праздник добавлен!', 'success');
    });
    
    // Экспорт в Excel
    document.getElementById('exportExcelBtn').addEventListener('click', function() {
        exportToExcel();
    });
    
    // Экспорт в CSV
    document.getElementById('exportCsvBtn').addEventListener('click', function() {
        exportToCSV();
    });
    
    // Добавление вакансии
    document.getElementById('addVacancyBtn').addEventListener('click', function() {
        const title = document.getElementById('vacancyTitle').value.trim();
        const desc = document.getElementById('vacancyDesc').value.trim();
        const salaryMin = document.getElementById('vacancySalaryMin').value;
        const salaryMax = document.getElementById('vacancySalaryMax').value;
        
        if (!title || !desc || !salaryMin || !salaryMax) {
            showAlert('Заполните все поля вакансии', 'error');
            return;
        }
        
        const newVacancy = {
            id: Date.now().toString(),
            title,
            description: desc,
            salaryMin: parseInt(salaryMin),
            salaryMax: parseInt(salaryMax)
        };
        
        vacancies.push(newVacancy);
        localStorage.setItem(STORAGE_KEYS.VACANCIES, JSON.stringify(vacancies));
        
        document.getElementById('vacancyTitle').value = '';
        document.getElementById('vacancyDesc').value = '';
        document.getElementById('vacancySalaryMin').value = '';
        document.getElementById('vacancySalaryMax').value = '';
        
        renderAdminVacancies();
        renderPublicVacancies();
        showAlert('Вакансия добавлена', 'success');
    });
    
    // Модалка удаления
    document.getElementById('cancelDeleteBtn').addEventListener('click', function() {
        document.getElementById('deleteConfirmModal').classList.remove('active');
        deleteTarget = null;
    });
    
    document.getElementById('confirmDeleteBtn').addEventListener('click', async function() {
        if (deleteTarget) {
            holidays = holidays.filter(h => h.id !== deleteTarget);
            
            // Удаляем из Google Sheets (в реальности нужно отправлять запрос на удаление)
            await saveToSheet('Праздники', ['DELETE', deleteTarget]);
            
            renderHolidays();
            updateHolidayBanner();
            document.getElementById('deleteConfirmModal').classList.remove('active');
            deleteTarget = null;
            showHolidayAlert('Праздник удален', 'success');
        }
    });
    
    // Закрытие модалок
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });
}

// Пасхалка
function showEasterEgg() {
    const egg = document.createElement('div');
    egg.className = 'easter-egg';
    egg.innerHTML = '🍖 МЯСНОЙ КОРОЛЬ 👑';
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
    
    setTimeout(() => {
        egg.remove();
    }, 3000);
}

// Звук уведомления
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
    } catch (e) {
        console.log('Аудио не поддерживается');
    }
}

// Проверка новых сообщений
async function checkNewMessages() {
    if (!isAdmin) return;
    
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?sheet=Чат&t=${Date.now()}`);
        const data = await response.json();
        
        if (data.success) {
            const oldCount = Object.values(chatMessages).flat().length;
            const newMessages = data.data || [];
            
            if (newMessages.length > oldCount) {
                playNotificationSound();
                showAlert('📩 Новое сообщение в чате!', 'success');
                
                chatMessages = {};
                newMessages.forEach(msg => {
                    if (!chatMessages[msg.applicationId]) {
                        chatMessages[msg.applicationId] = [];
                    }
                    chatMessages[msg.applicationId].push(msg);
                });
                
                const activeChat = document.querySelector('.chat-window.active');
                if (activeChat) {
                    const appId = activeChat.dataset.appId;
                    renderChat(appId);
                }
                
                if (document.getElementById('adminTab').classList.contains('active')) {
                    renderApplications();
                }
            }
        }
    } catch (error) {
        console.error('Ошибка проверки сообщений:', error);
    }
}

// Проверка статуса заявки пользователя
function checkUserApplicationStatus() {
    const userEmail = localStorage.getItem('userEmail');
    const lastTime = localStorage.getItem('lastApplicationTime');
    
    if (!userEmail || !lastTime) return;
    
    const userApps = applications.filter(app => 
        app.email === userEmail && 
        new Date(app.timestamp).getTime() > parseInt(lastTime) - 60000
    );
    
    if (userApps.length > 0) {
        const latest = userApps[0];
        const statusDiv = document.getElementById('userStatus');
        const statusText = document.getElementById('userStatusText');
        
        if (latest.status === 'одобрено') {
            statusDiv.style.display = 'flex';
            statusText.textContent = 'Ваша заявка ОДОБРЕНА! Ждём вас!';
            statusDiv.style.background = 'rgba(46, 204, 113, 0.1)';
            statusDiv.style.color = '#2ecc71';
            playNotificationSound();
        } else if (latest.status === 'отказ') {
            statusDiv.style.display = 'flex';
            statusText.textContent = 'К сожалению, отказано';
            statusDiv.style.background = 'rgba(231, 76, 60, 0.1)';
            statusDiv.style.color = '#e74c3c';
        }
    }
}

// Обновление баннера с праздником
function updateHolidayBanner() {
    const today = new Date().toISOString().split('T')[0];
    const todayHolidays = holidays.filter(h => h.date === today);
    const banner = document.getElementById('holidayBanner');
    const holidayText = document.getElementById('holidayText');
    
    if (todayHolidays.length > 0) {
        const names = todayHolidays.map(h => h.name).join(', ');
        holidayText.textContent = `🎉 Праздник сегодня: ${names}`;
        banner.style.background = 'linear-gradient(135deg, rgba(243,156,18,0.2), rgba(231,76,60,0.2))';
    } else {
        const upcoming = holidays
            .filter(h => h.date >= today)
            .sort((a, b) => a.date.localeCompare(b.date))[0];
        
        if (upcoming) {
            const daysUntil = Math.ceil((new Date(upcoming.date) - new Date()) / (1000 * 60 * 60 * 24));
            if (daysUntil === 1) {
                holidayText.textContent = `📅 Завтра: ${upcoming.name}`;
            } else if (daysUntil <= 7) {
                holidayText.textContent = `📅 Через ${daysUntil} дня: ${upcoming.name}`;
            } else {
                holidayText.textContent = `📅 Ближайший: ${upcoming.name} (${formatDate(upcoming.date)})`;
            }
        } else {
            holidayText.textContent = '📅 Рабочие будни';
        }
        banner.style.background = '';
    }
}

// Форматирование даты
function formatDate(dateString) {
    const options = { day: 'numeric', month: 'long' };
    return new Date(dateString).toLocaleDateString('ru-RU', options);
}

// Проверка авторизации
function checkAuth() {
    const auth = localStorage.getItem(STORAGE_KEYS.AUTH);
    isAdmin = auth === 'true';
    updateAdminUI();
}

// Обновление интерфейса админа
function updateAdminUI() {
    const adminTabs = document.getElementById('adminTabs');
    
    if (isAdmin) {
        adminTabs.style.display = 'flex';
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.dataset.tab === 'adminTab') {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById('adminTab').classList.add('active');
        
        renderApplications();
        renderHolidays();
    } else {
        adminTabs.style.display = 'none';
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById('formTab').classList.add('active');
    }
}

// Показ уведомлений
function showAlert(message, type) {
    const alert = document.getElementById('formAlert');
    if (alert) {
        alert.textContent = message;
        alert.className = `alert ${type}`;
        alert.style.display = 'flex';
        
        setTimeout(() => {
            alert.style.display = 'none';
        }, 5000);
    }
}

function showHolidayAlert(message, type) {
    const alert = document.getElementById('holidayAlert');
    if (alert) {
        alert.textContent = message;
        alert.className = `alert ${type}`;
        alert.style.display = 'flex';
        
        setTimeout(() => {
            alert.style.display = 'none';
        }, 3000);
    }
}

// Отрисовка заявок
function renderApplications() {
    const tbody = document.getElementById('applicationsList');
    if (!tbody) return;
    
    if (applications.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty-message">Пока нет ни одной заявки</td></tr>';
        return;
    }
    
    tbody.innerHTML = applications.map(app => {
        const date = new Date(app.timestamp).toLocaleString('ru-RU');
        
        return `
            <tr>
                <td>${date}</td>
                <td>${app.fullName || ''}</td>
                <td>${app.email || ''}</td>
                <td>${app.phone || ''}</td>
                <td>${app.position || ''}</td>
                <td>${app.salary || ''} ₽</td>
                <td>
                    <select onchange="updateStatus('${app.timestamp}', this.value)" class="status-select ${app.status || 'новая'}">
                        <option value="новая" ${app.status === 'новая' ? 'selected' : ''}>🆕 Новая</option>
                        <option value="просмотрено" ${app.status === 'просмотрено' ? 'selected' : ''}>👀 Просмотрено</option>
                        <option value="одобрено" ${app.status === 'одобрено' ? 'selected' : ''}>✅ Одобрено</option>
                        <option value="отказ" ${app.status === 'отказ' ? 'selected' : ''}>❌ Отказ</option>
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
                    <button class="btn-chat" onclick="openChat('${app.timestamp}', '${app.fullName || ''}')">
                        💬
                        ${chatMessages[app.timestamp] ? 
                          `<span class="chat-badge">${chatMessages[app.timestamp].filter(m => !m.isRead && m.sender === 'user').length}</span>` 
                          : ''}
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    const newApps = applications.filter(a => a.status === 'новая').length;
    const badge = document.getElementById('newAppsBadge');
    if (badge) {
        if (newApps > 0) {
            badge.textContent = newApps;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }
    }
}

// Отрисовка праздников
function renderHolidays() {
    const container = document.getElementById('holidaysContainer');
    const today = new Date().toISOString().split('T')[0];
    
    const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
    
    if (sorted.length === 0) {
        container.innerHTML = '<p class="empty-message">Нет запланированных праздников</p>';
        return;
    }
    
    container.innerHTML = sorted.map(holiday => {
        const isToday = holiday.date === today;
        const dateObj = new Date(holiday.date);
        const formattedDate = dateObj.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        
        return `
            <div class="holiday-item ${isToday ? 'today' : ''}">
                <div class="holiday-info">
                    <span class="holiday-name">${holiday.name}</span>
                    <span class="holiday-date">
                        <i class="far fa-calendar-alt"></i> ${formattedDate}
                    </span>
                    ${isToday ? '<span class="today-badge">СЕГОДНЯ</span>' : ''}
                </div>
                <button class="delete-holiday" onclick="confirmDelete('${holiday.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');
}

// Отрисовка публичных вакансий
function renderPublicVacancies() {
    const container = document.getElementById('publicVacancies');
    if (!container) return;
    
    if (vacancies.length === 0) {
        container.innerHTML = '<p class="empty-message">Скоро появятся новые вакансии</p>';
        return;
    }
    
    container.innerHTML = vacancies.map(vac => `
        <div class="vacancy-card">
            <div class="vacancy-title">${vac.title}</div>
            <div class="vacancy-desc">${vac.description}</div>
            <div class="vacancy-salary">${vac.salaryMin} - ${vac.salaryMax} ₽</div>
        </div>
    `).join('');
}

// Отрисовка вакансий в админке
function renderAdminVacancies() {
    const container = document.getElementById('adminVacanciesList');
    if (!container) return;
    
    if (vacancies.length === 0) {
        container.innerHTML = '<p class="empty-message">Нет активных вакансий</p>';
        return;
    }
    
    container.innerHTML = vacancies.map(vac => `
        <div class="vacancy-card">
            <div class="vacancy-title">${vac.title}</div>
            <div class="vacancy-desc">${vac.description}</div>
            <div class="vacancy-salary">${vac.salaryMin} - ${vac.salaryMax} ₽</div>
            <div class="vacancy-actions">
                <button class="btn-danger" onclick="deleteVacancy('${vac.id}')">Удалить</button>
            </div>
        </div>
    `).join('');
}

// Удаление вакансии
window.deleteVacancy = function(id) {
    vacancies = vacancies.filter(v => v.id !== id);
    localStorage.setItem(STORAGE_KEYS.VACANCIES, JSON.stringify(vacancies));
    renderAdminVacancies();
    renderPublicVacancies();
    showAlert('Вакансия удалена', 'success');
};

// Обновление статуса
window.updateStatus = async function(applicationId, newStatus) {
    const appIndex = applications.findIndex(a => a.timestamp === applicationId);
    if (appIndex !== -1) {
        applications[appIndex].status = newStatus;
        
        const app = applications[appIndex];
        await saveToSheet('Заявки', [
            app.timestamp,
            app.fullName,
            app.email,
            app.phone,
            app.position,
            app.salary,
            app.status,
            app.notes,
            app.rating
        ]);
        
        renderApplications();
        
        if (newStatus === 'одобрено' || newStatus === 'отказ') {
            playNotificationSound();
        }
    }
};

// Добавление заметки
window.addNote = async function(applicationId, note) {
    const appIndex = applications.findIndex(a => a.timestamp === applicationId);
    if (appIndex !== -1) {
        applications[appIndex].notes = note;
        
        const app = applications[appIndex];
        await saveToSheet('Заявки', [
            app.timestamp,
            app.fullName,
            app.email,
            app.phone,
            app.position,
            app.salary,
            app.status,
            app.notes,
            app.rating
        ]);
    }
};

// Добавление рейтинга
window.addRating = async function(applicationId, rating) {
    const appIndex = applications.findIndex(a => a.timestamp === applicationId);
    if (appIndex !== -1) {
        applications[appIndex].rating = rating;
        
        const app = applications[appIndex];
        await saveToSheet('Заявки', [
            app.timestamp,
            app.fullName,
            app.email,
            app.phone,
            app.position,
            app.salary,
            app.status,
            app.notes,
            app.rating
        ]);
    }
};

// Отправка сообщения в чат
window.sendChatMessage = async function(applicationId) {
    const input = document.getElementById(`chatInput_${applicationId}`);
    const text = input.value.trim();
    
    if (!text) return;
    
    const newMessage = {
        messageId: Date.now().toString(),
        applicationId,
        sender: 'admin',
        text: text,
        timestamp: new Date().toISOString(),
        isRead: false
    };
    
    if (!chatMessages[applicationId]) {
        chatMessages[applicationId] = [];
    }
    chatMessages[applicationId].push(newMessage);
    
    const sheetData = [
        newMessage.messageId,
        newMessage.applicationId,
        newMessage.sender,
        newMessage.text,
        newMessage.timestamp,
        newMessage.isRead
    ];
    
    await saveToSheet('Чат', sheetData);
    
    input.value = '';
    renderChat(applicationId);
};

// Открыть чат
window.openChat = function(applicationId, fullName) {
    document.querySelectorAll('.chat-window').forEach(w => {
        w.classList.remove('active');
        setTimeout(() => {
            if (!w.classList.contains('active')) {
                w.remove();
            }
        }, 300);
    });
    
    let chatWindow = document.getElementById(`chatWindow_${applicationId}`);
    
    if (!chatWindow) {
        chatWindow = document.createElement('div');
        chatWindow.id = `chatWindow_${applicationId}`;
        chatWindow.className = 'chat-window active';
        chatWindow.dataset.appId = applicationId;
        chatWindow.innerHTML = `
            <div class="chat-header">
                <span>Чат с ${fullName}</span>
                <button onclick="closeChat('${applicationId}')">✕</button>
            </div>
            <div class="chat-messages" id="chatMessages_${applicationId}"></div>
            <div class="chat-input">
                <input type="text" id="chatInput_${applicationId}" placeholder="Введите сообщение...">
                <button onclick="sendChatMessage('${applicationId}')">➤</button>
            </div>
        `;
        document.body.appendChild(chatWindow);
    }
    
    chatWindow.classList.add('active');
    renderChat(applicationId);
};

// Закрыть чат
window.closeChat = function(applicationId) {
    const chatWindow = document.getElementById(`chatWindow_${applicationId}`);
    if (chatWindow) {
        chatWindow.classList.remove('active');
        setTimeout(() => {
            if (chatWindow && !chatWindow.classList.contains('active')) {
                chatWindow.remove();
            }
        }, 300);
    }
};

// Отрисовка чата
function renderChat(applicationId) {
    const messagesContainer = document.getElementById(`chatMessages_${applicationId}`);
    if (!messagesContainer) return;
    
    const messages = chatMessages[applicationId] || [];
    
    messagesContainer.innerHTML = messages.map(msg => `
        <div class="message ${msg.sender === 'admin' ? 'admin' : 'user'}">
            <div class="message-text">${msg.text}</div>
            <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</div>
        </div>
    `).join('');
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Подтверждение удаления
window.confirmDelete = function(id) {
    const holiday = holidays.find(h => h.id === id);
    if (holiday) {
        document.getElementById('deleteHolidayName').textContent = holiday.name;
        document.getElementById('deleteConfirmModal').classList.add('active');
        deleteTarget = id;
    }
};

// Отрисовка статистики
function renderStatistics() {
    const totalApps = applications.length;
    const newApps = applications.filter(a => a.status === 'новая').length;
    const approvedApps = applications.filter(a => a.status === 'одобрено').length;
    
    const salaries = applications.map(a => parseInt(a.salary)).filter(s => !isNaN(s));
    const avgSalary = salaries.length > 0 
        ? Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length)
        : 0;
    
    document.getElementById('totalApps').textContent = totalApps;
    document.getElementById('newApps').textContent = newApps;
    document.getElementById('approvedApps').textContent = approvedApps;
    document.getElementById('avgSalary').textContent = avgSalary.toLocaleString() + ' ₽';
    
    // Статистика по должностям
    const positions = {};
    applications.forEach(app => {
        positions[app.position] = (positions[app.position] || 0) + 1;
    });
    
    const positionsHtml = Object.entries(positions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([pos, count]) => {
            const percent = (count / totalApps * 100).toFixed(1);
            return `
                <div class="bar-container">
                    <div class="bar" style="height: ${percent * 2}px"></div>
                    <div class="bar-label">${pos}<br>${count} (${percent}%)</div>
                </div>
            `;
        }).join('');
    
    document.getElementById('positionsChart').innerHTML = positionsHtml || '<p>Нет данных</p>';
    
    // Динамика по дням
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const count = applications.filter(a => a.timestamp.startsWith(dateStr)).length;
        last7Days.push({ date: dateStr, count });
    }
    
    const timelineHtml = last7Days.map(day => {
        const maxCount = Math.max(...last7Days.map(d => d.count), 1);
        const height = (day.count / maxCount) * 100;
        return `
            <div class="bar-container">
                <div class="bar" style="height: ${height}px"></div>
                <div class="bar-label">${day.date.slice(5)}<br>${day.count}</div>
            </div>
        `;
    }).join('');
    
    document.getElementById('timelineChart').innerHTML = timelineHtml || '<p>Нет данных</p>';
}

// Экспорт в Excel
function exportToExcel() {
    let csv = 'Дата;ФИО;Email;Телефон;Должность;Зарплата;Статус;Заметки;Рейтинг\n';
    
    applications.forEach(app => {
        csv += `${app.timestamp};${app.fullName};${app.email};${app.phone};${app.position};${app.salary};${app.status};${app.notes};${app.rating}\n`;
    });
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `oskolki_zayavki_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showAlert('Экспорт завершен', 'success');
}

// Экспорт в CSV
function exportToCSV() {
    exportToExcel(); // Пока одинаково
}

// Инициализация
console.log('Сайт Осколки загружен!');
