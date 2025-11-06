// Получаем доступ к холсту (canvas)
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 800;
canvas.height = 600;

// --- ИГРОВЫЕ ПЕРЕМЕННЫЕ ---
const playerMaxHP = 100; // Максимум здоровья
let playerHP = playerMaxHP; // Текущее здоровье
let lastHitTime = 0; // Время последнего полученного удара
let wood = 0;
let meat = 0;
let axeCount = 1;
let axeUpgradeCost = 10;
let autoBuyPurchased = false;
let autoBuyEnabled = false;

// --- ИГРОВЫЕ ОБЪЕКТЫ ---
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 30,
    color: '#0077be',
    speed: 3
};

let trees = [];
const treeSize = 40;
const treeColor = '#006400';
const maxTrees = 15;

let enemies = [];
const enemySize = 35;
const enemyColor = '#8b4513';
const maxEnemies = 3;

let axes = [];
const axeRotationSpeed = 0.05;

let stations = [];
const stationSize = 50;

// --- ЗВУКИ (ЗАГЛУШКИ) ---
// !!! ВАМ НУЖНО СОЗДАТЬ ЭТИ ФАЙЛЫ И ПОЛОЖИТЬ ИХ РЯДОМ С .js !!!
let snd_hit_tree, snd_hit_enemy, snd_buy, snd_game_over;

function loadSounds() {
    console.log("Loading sounds...");
    // Создайте файлы: hit.mp3, buy.mp3, gameover.mp3
    try {
        snd_hit_tree = new Audio('hit.mp3'); 
        snd_hit_enemy = new Audio('hit.mp3'); 
        snd_buy = new Audio('buy.mp3');
        snd_game_over = new Audio('gameover.mp3');
        // Настраиваем тихие звуки
        snd_hit_tree.volume = 0.3;
        snd_hit_enemy.volume = 0.4;
    } catch (e) {
        console.warn("Could not load sounds. Make sure sound files (hit.mp3, buy.mp3, gameover.mp3) exist.");
    }
}
// Функция для безопасного проигрывания (чтобы звук мог прервать сам себя)
function playSound(sound) {
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(e => console.warn("Audio play failed. User interaction might be required.", e));
    }
}

// --- ДЖОЙСТИК (Мышь + Касания) ---
const joystick = {
    active: false,
    moved: false,
    baseX: 0, baseY: 0,
    knobX: 0, knobY: 0,
    radius: 50, knobRadius: 20,
    angle: 0, magnitude: 0
};

// --- УПРАВЛЕНИЕ ---

// !!! ИСПРАВЛЕННАЯ ФУНКЦИЯ getPos !!!
function getPos(canvasEl, evt) {
    const rect = canvasEl.getBoundingClientRect();
    
    // Вычисляем, во сколько раз CSS сжал наш холст
    const scaleX = canvasEl.width / rect.width;   // e.g. 800 / 390 = 2.05
    const scaleY = canvasEl.height / rect.height; // e.g. 600 / 292 = 2.05

    const touch = evt.touches ? evt.touches[0] : evt;
    
    // Берем "CSS-координаты" касания и умножаем на коэф. масштабирования
    return {
        x: (touch.clientX - rect.left) * scaleX, // Получаем настоящие 800px-координаты
        y: (touch.clientY - rect.top) * scaleY   // Получаем настоящие 600px-координаты
    };
}

// 1. НАЧАЛО (Мышь или Палец)
function onStart(e) {
    e.preventDefault();
    const pos = getPos(canvas, e);
    joystick.active = true;
    joystick.moved = false; // Сбрасываем флаг "движения"
    joystick.baseX = pos.x;
    joystick.baseY = pos.y;
    joystick.knobX = pos.x;
    joystick.knobY = pos.y;
}

// 2. ДВИЖЕНИЕ (Мышь или Палец) - ИСПРАВЛЕННАЯ ВЕРСИЯ (с "мертвой зоной")
function onMove(e) {
    e.preventDefault();
    if (!joystick.active) return;

    const pos = getPos(canvas, e);
    const dx = pos.x - joystick.baseX;
    const dy = pos.y - joystick.baseY;
    const dist = Math.hypot(dx, dy);

    // "Мертвая зона" для клика
    const CLICK_DEADZONE = 5;
    if (dist > CLICK_DEADZONE) {
        joystick.moved = true;
    }
    
    // --- Остальная логика джойстика ---
    joystick.angle = Math.atan2(dy, dx);

    if (dist > joystick.radius) {
        joystick.knobX = joystick.baseX + Math.cos(joystick.angle) * joystick.radius;
        joystick.knobY = joystick.baseY + Math.sin(joystick.angle) * joystick.radius;
        joystick.magnitude = 1;
    } else {
        joystick.knobX = pos.x;
        joystick.knobY = pos.y;
        joystick.magnitude = dist / joystick.radius;
    }
}

// 3. КОНЕЦ (Мышь или Палец)
function onEnd(e) {
    e.preventDefault();
    if (!joystick.active) return;
    
    // Если мы отпустили палец/мышь, но не двигали (т.е. это "клик")
    if (!joystick.moved) {
        handleClick(joystick.baseX, joystick.baseY);
    }
    
    joystick.active = false;
    joystick.magnitude = 0;
}

// Слушатели событий
canvas.addEventListener('mousedown', onStart);
canvas.addEventListener('mousemove', onMove);
canvas.addEventListener('mouseup', onEnd);
canvas.addEventListener('touchstart', onStart, { passive: false });
canvas.addEventListener('touchmove', onMove, { passive: false });
canvas.addEventListener('touchend', onEnd, { passive: false });


// --- ЛОГИКА КЛИКОВ (для кнопок) ---
function handleClick(x, y) {
    // Координаты кнопки "Auto-Buy" (заданы в drawToggleButton)
    const btnX = 20, btnY = 50, btnW = 140, btnH = 40;

    // Проверяем, был ли клик по кнопке
    if (autoBuyPurchased && x > btnX && x < btnX + btnW && y > btnY && y < btnY + btnH) {
        autoBuyEnabled = !autoBuyEnabled; // Переключаем
        console.log("Auto-Buy Toggled:", autoBuyEnabled);
        playSound(snd_buy);
    }
}


// --- СОХРАНЕНИЕ / ЗАГРУЗКА ---
const SAVE_KEY = 'lumberjackSaveData_v1';

function saveGame() {
    try {
        const saveData = {
            playerHP: playerHP,
            wood: wood,
            meat: meat,
            axeCount: axeCount,
            axeUpgradeCost: axeUpgradeCost,
            autoBuyPurchased: autoBuyPurchased,
            autoBuyEnabled: autoBuyEnabled
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
        // console.log("Game Saved!");
    } catch (e) {
        console.error("Failed to save game:", e);
    }
}

function loadGame() {
    const data = localStorage.getItem(SAVE_KEY);
    if (!data) {
        console.log("No save data found. Starting new game.");
        return;
    }

    try {
        const saveData = JSON.parse(data);
        playerHP = saveData.playerHP || playerMaxHP;
        wood = saveData.wood || 0;
        meat = saveData.meat || 0;
        axeCount = saveData.axeCount || 1;
        axeUpgradeCost = saveData.axeUpgradeCost || 10;
        autoBuyPurchased = saveData.autoBuyPurchased || false;
        autoBuyEnabled = saveData.autoBuyEnabled || false;
        console.log("Game Loaded!");
    } catch (e) {
        console.error("Failed to load save data:", e);
        localStorage.removeItem(SAVE_KEY); // Очищаем битые данные
    }
}

function handleGameOver() {
    playSound(snd_game_over);
    alert("ИГРА ОКОНЧЕНА!\nВаш прогресс будет сброшен.");
    localStorage.removeItem(SAVE_KEY); // Сброс прогресса
    // Перезагрузка страницы для начала с нуля
    location.reload(); 
}


// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
function updateAxeCount() {
    axes = [];
    for (let i = 0; i < axeCount; i++) {
        const angle = (i / axeCount) * Math.PI * 2;
        axes.push({
            angle: angle, distance: 50, size: 15, color: '#c0c0c0', damage: 1
        });
    }
}

function spawnTree() {
    if (trees.length < maxTrees) {
        trees.push({
            x: Math.random() * (canvas.width - treeSize) + treeSize / 2,
            y: Math.random() * (canvas.height - treeSize) + treeSize / 2,
            size: treeSize, color: treeColor, health: 50
        });
    }
}

function spawnEnemy() {
    if (enemies.length < maxEnemies) {
        const x = Math.random() < 0.5 ? -enemySize : canvas.width + enemySize;
        const y = Math.random() * canvas.height;
        enemies.push({
            x: x, y: y, size: enemySize, color: enemyColor, health: 100, speed: 1.2
        });
    }
}

function drawRect(obj) {
    ctx.fillStyle = obj.color;
    ctx.fillRect(obj.x - obj.size / 2, obj.y - obj.size / 2, obj.size, obj.size);
    if (obj.health) {
        const maxHealth = (obj.color === treeColor) ? 50 : 100;
        const healthPercent = obj.health / maxHealth;
        ctx.fillStyle = '#333';
        ctx.fillRect(obj.x - obj.size / 2, obj.y - obj.size / 2 - 10, obj.size, 5);
        ctx.fillStyle = 'green';
        ctx.fillRect(obj.x - obj.size / 2, obj.y - obj.size / 2 - 10, obj.size * healthPercent, 5);
    }
}

function checkCollision(obj1, obj2) {
    const dist = Math.hypot(obj1.x - obj2.x, obj1.y - obj2.y);
    return dist < obj1.size / 2 + obj2.size / 2;
}

// --- ОТРИСОВКА И ЛОГИКА ---

// Отрисовка станций
function drawStations() {
    stations.forEach(station => {
        // Если станция куплена, не рисуем ее
        if (station.type === 'buy_autobuyer' && autoBuyPurchased) {
            return;
        }

        drawRect(station);
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';

        let label = '';
        if (station.type === 'upgrade_axe') {
            label = `Купить Топор (${axeUpgradeCost} 🌲)`;
        } else if (station.type === 'buy_autobuyer') {
            label = `Авто-Покупка (${station.cost} 🌲)`;
        }
        ctx.fillText(label, station.x, station.y - station.size / 2 - 15);
    });
}

// Логика станций - ИСПРАВЛЕННАЯ ВЕРСИЯ
function handleStationInteractions() {
    stations.forEach(station => {
        if (!checkCollision(player, station)) return; // Игрок не на станции

        // 1. Станция "Апгрейд Топора" (Оранжевая)
        if (station.type === 'upgrade_axe') {
            
            // ЛОГИКА АВТО-ПОКУПКИ (если куплено и включено)
            if (autoBuyPurchased && autoBuyEnabled && wood >= axeUpgradeCost) {
                wood -= axeUpgradeCost;
                axeCount++;
                axeUpgradeCost = Math.floor(axeUpgradeCost * 1.5);
                updateAxeCount();
                playSound(snd_buy);
            }
            // ЛОГИКА "МАНУАЛЬНОЙ" ПОКУПКИ 
            // (Срабатывает, если авто-покупка ЕЩЕ НЕ КУПЛЕНА)
            else if (!autoBuyPurchased && wood >= axeUpgradeCost) {
                wood -= axeUpgradeCost;
                axeCount++;
                axeUpgradeCost = Math.floor(axeUpgradeCost * 1.5);
                updateAxeCount();
                playSound(snd_buy);
            }
        }

        // 2. Станция "Покупка Авто-апгрейда" (Фиолетовая)
        if (station.type === 'buy_autobuyer' && !autoBuyPurchased) {
            if (wood >= station.cost) {
                wood -= station.cost;
                autoBuyPurchased = true;
                playSound(snd_buy);
                console.log("Auto-Buy Purchased!");
            }
        }
    });
}

// Отрисовка кнопки
function drawToggleButton() {
    if (!autoBuyPurchased) return; // Не рисуем, если не куплено

    const btnX = 20, btnY = 50, btnW = 140, btnH = 40;
    
    // Коробка
    ctx.fillStyle = autoBuyEnabled ? 'rgba(0, 200, 0, 0.7)' : 'rgba(200, 0, 0, 0.7)';
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = 'white';
    ctx.strokeRect(btnX, btnY, btnW, btnH);
    
    // Текст
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = autoBuyEnabled ? 'Auto-Buy: ON' : 'Auto-Buy: OFF';
    ctx.fillText(text, btnX + btnW / 2, btnY + btnH / 2);
}

// Отрисовка UI
function drawUI() {
    ctx.textBaseline = 'top'; // Сброс
    
    // Ресурсы
    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`🌲 ${wood}`, canvas.width - 30, 40);
    ctx.fillText(`🥩 ${meat}`, canvas.width - 30, 80);
    
    // Здоровье
    ctx.textAlign = 'left';
    ctx.font = '20px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText('HP:', 20, 15);
    ctx.fillStyle = '#333';
    ctx.fillRect(60, 15, 200, 20);
    ctx.fillStyle = 'red';
    ctx.fillRect(60, 15, (playerHP / playerMaxHP) * 200, 20); // Используем playerMaxHP
}

// Отрисовка джойстика
function drawJoystick() {
    if (!joystick.active) return;
    ctx.beginPath();
    ctx.arc(joystick.baseX, joystick.baseY, joystick.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(128, 128, 128, 0.3)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(joystick.knobX, joystick.knobY, joystick.knobRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(128, 128, 128, 0.7)';
    ctx.fill();
}

// --- ИНИЦИАЛИЗАЦИЯ ИГРЫ ---
function init() {
    loadSounds();
    lastHitTime = Date.now(); // Инициализируем таймер
    loadGame(); // Загружаем прогресс

    // Создаем станции
    stations.push({
        id: 1, type: 'upgrade_axe', x: canvas.width / 2, y: canvas.height / 2 - 60,
        size: stationSize, color: '#FFA500' // Оранжевый
    });
    stations.push({
        id: 2, type: 'buy_autobuyer', x: canvas.width / 2, y: canvas.height / 2 + 60,
        size: stationSize, color: '#8A2BE2', cost: 500 // Фиолетовый
    });

    for (let i = 0; i < 5; i++) spawnTree();
    spawnEnemy();
    updateAxeCount();

    // Авто-сохранение каждые 5 секунд
    setInterval(saveGame, 5000);

    // Запускаем игровой цикл
    gameLoop();
}


// --- ГЛАВНЫЙ ИГРОВОЙ ЦИКЛ ---
function gameLoop() {
    const now = Date.now(); // Фиксируем текущее время

    // 1. Проверка на Game Over
    if (playerHP <= 0) {
        handleGameOver();
        return; // Останавливаем цикл
    }

    // 2. Обновление логики (Update)
    
    // Движение игрока
    if (joystick.active) {
        player.x += Math.cos(joystick.angle) * player.speed * joystick.magnitude;
        player.y += Math.sin(joystick.angle) * player.speed * joystick.magnitude;
    }
    player.x = Math.max(player.size / 2, Math.min(canvas.width - player.size / 2, player.x));
    player.y = Math.max(player.size / 2, Math.min(canvas.height - player.size / 2, player.y));

    // Движение врагов
    enemies.forEach(enemy => {
        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        enemy.x += Math.cos(angle) * enemy.speed;
        enemy.y += Math.sin(angle) * enemy.speed;

        // Враг атакует игрока
        if (checkCollision(player, enemy)) {
            playerHP -= 0.5; // Медведь "кусает"
            lastHitTime = now; // Сбрасываем таймер регенерации
        }
    }); // Конец enemies.forEach

    // --- ЛОГИКА: Регенерация Здоровья ---
    const REGEN_DELAY_MS = 3000; // 3 секунды задержки
    const REGEN_DURATION_SEC = 5; // 5 секунд на полное восполнение
    const REGEN_PER_SEC = playerMaxHP / REGEN_DURATION_SEC; // HP в секунду
    const REGEN_PER_FRAME = REGEN_PER_SEC / 60.0; // HP в кадре (примерно)

    // Если HP неполное и не "мертв"
    if (playerHP > 0 && playerHP < playerMaxHP) {
        // Если прошло 3 секунды с последнего удара
        if (now - lastHitTime > REGEN_DELAY_MS) {
            // Начинаем восполнять здоровье
            playerHP += REGEN_PER_FRAME;
            // Не даем уйти выше максимума
            if (playerHP > playerMaxHP) {
                playerHP = playerMaxHP; 
            }
        }
    }
    // --- Конец Логики Регенерации ---

    // Обновление топоров и их столкновений
    axes.forEach(axe => {
        axe.angle += axeRotationSpeed;
        axe.x = player.x + Math.cos(axe.angle) * axe.distance;
        axe.y = player.y + Math.sin(axe.angle) * axe.distance;

        trees.forEach((tree, index) => {
            if (checkCollision(axe, tree)) {
                tree.health -= axe.damage;
                playSound(snd_hit_tree);
                if (tree.health <= 0) {
                    trees.splice(index, 1); wood += 5; spawnTree();
                }
            }
        });
        enemies.forEach((enemy, index) => {
            if (checkCollision(axe, enemy)) {
                enemy.health -= axe.damage;
                playSound(snd_hit_enemy);
                if (enemy.health <= 0) {
                    enemies.splice(index, 1); meat += 3; spawnEnemy();
                }
            }
        });
    });
    
    handleStationInteractions();

    // 3. Отрисовка (Draw)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawStations(); 
    trees.forEach(drawRect);
    enemies.forEach(drawRect);
    drawRect(player);
    axes.forEach(drawRect);
    drawJoystick();
    drawUI(); 
    drawToggleButton(); // Рисуем кнопку ON/OFF

    // 4. Запрос на следующий кадр
    requestAnimationFrame(gameLoop);
}

// Запускаем игру!
init();
