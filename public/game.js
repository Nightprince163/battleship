class BattleshipGame {
    constructor() {
        this.socket = io();
        this.boardSize = 16;
        this.selectedShip = null;
        this.currentPlayer = null;
this.gameState = null;
        this.currentAction = null;
        
        this.shipElements = new Map(); // 存储船只DOM元素
        
        this.initializeGame();
        this.setupEventListeners();
    }

    // 添加消息显示方法
    showMessage(message, type = 'info', duration = 3000) {
        const messageContainer = document.getElementById('message-container');
        if (!messageContainer) return;

        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.innerHTML = `
            <span>${message}</span>
            <button class="message-close" onclick="this.parentElement.remove()">×</button>
        `;

        messageContainer.appendChild(messageElement);

        // 自动移除消息
        if (duration > 0) {
            setTimeout(() => {
                if (messageElement.parentElement) {
                    messageElement.classList.add('fade-out');
                    setTimeout(() => {
                        if (messageElement.parentElement) {
                            messageElement.remove();
                        }
                    }, 300);
                }
            }, duration);
        }
    }

    // 中央大字消息显示（无背景，橙色，默认2秒）
    showCenterMessage(text, duration = 2000) {
        const el = document.getElementById('center-message');
        if (!el) {
            console.warn('未找到center-message元素');
            return;
        }
        el.textContent = text;
        el.classList.remove('show');
        // 强制重绘以重触发动画
        void el.offsetWidth;
        el.classList.add('show');

        if (duration > 0) {
            setTimeout(() => {
                el.classList.remove('show');
                // 在动画结束后清空文本
                //el.textContent = ''; 
            }, duration);
        }
    }

    initializeGame() {
        this.createBoard();
        this.socket.on('gameState', (state) => {
            this.gameState = state;
            this.updateShipSelection();
            this.updateGameDisplay(); // 确保界面根据游戏阶段正确更新
            // 如果当前玩家已选择阵营，保证header颜色与之同步
            if (this.currentPlayer) {
                const header = document.getElementById('header');
                if (header) {
                    header.classList.remove('red', 'blue');
                    header.classList.add(this.currentPlayer);
                }
            }
        });

        this.socket.on('turnChanged', (turn) => {
            this.updateTurnIndicator(turn);
            this.showCenterMessage(`${turn === this.currentPlayer ? '我方' : '对方'}回合`, 2000);
        });

        this.socket.on('gameStarted', (state) => {
            this.gameState = state;
            this.updateGameDisplay(); // 使用updateGameDisplay确保所有界面元素正确更新
        });

        this.socket.on('shipPlaced', (ship) => {
            // 更新游戏状态中的船只数据
            if (this.gameState && this.currentPlayer) {
                const playerShips = this.gameState.ships[this.currentPlayer];
                const shipIndex = playerShips.findIndex(s => s.id === ship.id);
                if (shipIndex !== -1) {
                    playerShips[shipIndex] = { ...ship };
                }
            }
            
            this.placeShipOnBoard(ship);
            this.updateShipSelection();
            this.updateStatusPanel(); // 添加状态面板更新
            this.updateGameDisplay(); // 添加游戏显示更新，确保所有船只都正确显示
        });

        this.socket.on('gameStateUpdate', (state) => {
            this.gameState = state;
            this.updateShipSelection(); // 添加船只选择界面更新
            this.updateGameDisplay();
        });

        this.socket.on('opponentShipPlaced', (data) => {
            // 对手放置船只时也更新显示
            this.updateGameDisplay();
        });

        // 添加动作结果监听
        this.socket.on('actionResult', (result) => {
            if (result.success) {
                this.updateGameDisplay();

                this.showMessage(result.message, 'info', 3000);
            } else {
                this.showMessage(result.message, 'error', 3000); // 替换alert
            }
        });

        // 游戏结束监听
        this.socket.on('gameEnded', (data) => {
            // data: { winner, loser }
            this.gameState = this.gameState || {};
            this.gameState.gamePhase = 'ended';
            
            console.log(`游戏结束！赢家：${data.winner}，输家：${data.loser}`);
            if (this.currentPlayer === data.winner) {
                this.showCenterMessage('胜利', 5000);
            } else {
                    this.showCenterMessage('失败', 5000);
            } 
            
            this.updateGameDisplay();
            // 显示加入界面（允许重新加入）
            const header = document.getElementById('header');
            if (header) {
                const joinButtons = document.createElement('div');
                joinButtons.innerHTML = `
                    <div style="text-align: center; margin: 20px;">
                        <button onclick="joinGame('red')" style="padding: 15px 30px; background: #FF4444; color: white; border: none; border-radius: 5px; margin: 10px; cursor: pointer;">加入红方</button>
                        <button onclick="joinGame('blue')" style="padding: 15px 30px; background: #4444FF; color: white; border: none; border-radius: 5px; margin: 10px; cursor: pointer;">加入蓝方</button>
                    </div>
                `;
                header.appendChild(joinButtons);
                header.classList.remove('red', 'blue');
            }
        });

        // 在 initializeGame() 方法中添加攻击结果监听
        this.socket.on('attackResult', (result) => {
            if (result.success) {
                let text = '';
                if (result.attackPower === 0) {
                    text = 'MISS';
                }
                else {
                    if (result.attackPower == 1) text = '命中';
                    if (result.attackPower == 2) text = '击中要害';
                    if (result.attackPower >= 3) text = '致命一击！！';
                }
                // 显示爆炸动画
                this.showExplosionAnimation(result.targetX, result.targetY, result.attackPower);
                if (text) this.showCenterMessage(text, 2000);
            }
        });

    }

    createBoard() {
        const board = document.getElementById('board');
        board.innerHTML = '';
        board.style.position = 'relative'; // 确保棋盘有相对定位
        
        for (let y = 0; y < this.boardSize; y++) {
            for (let x = 0; x < this.boardSize; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.x = x;
                cell.dataset.y = y;
                
                cell.addEventListener('click', () => this.handleCellClick(x, y));
                board.appendChild(cell);
            }
        }
    }

    setupEventListeners() {
        // 动作按钮
        document.getElementById('move-btn').addEventListener('click', () => this.moveShip());
        document.getElementById('attack-btn').addEventListener('click', () => this.attack());
        document.getElementById('rotate-btn').addEventListener('click', () => this.rotateShip());
        document.getElementById('end-turn-btn').addEventListener('click', () => this.endTurn());
    }

    // 更新船只选择界面
    updateShipSelection() {
        if (!this.gameState || !this.currentPlayer) return;
        
        const shipList = document.getElementById('ship-list');
        shipList.innerHTML = '';
        
        const playerShips = this.gameState.ships[this.currentPlayer];
        
        playerShips.forEach(ship => {
            const shipItem = document.createElement('div');
            shipItem.className = `ship-item ${ship.placed ? 'placed' : ''} ${ship.sunk ? 'sunk' : ''}`;
            shipItem.dataset.shipId = ship.id;
            
            // 创建船只俯视图
            const shipVisual = this.createShipTopView(ship);
            
            shipItem.innerHTML = `
                <div class="ship-info">
                    <strong>${ship.name}</strong>
                    <span class="ship-status">
                        ${ship.placed ? '✓ 已放置' : '未放置'} | 
                        HP: ${ship.health}/${ship.maxHealth} | 
                        ${ship.sunk ? '💀 击沉' : '⚓ 正常'}
                    </span>
                </div>
                <div class="ship-visual">
                    ${shipVisual}
                </div>
            `;
            
            if (!ship.placed && !ship.sunk) {
                shipItem.addEventListener('click', () => this.selectShip(ship.id));
                shipItem.style.cursor = 'pointer';
            } else {
                shipItem.style.cursor = 'default';
            }
            
            shipList.appendChild(shipItem);
        });
    }

    // 创建船只俯视图 - 使用图片
    createShipTopView(ship) {
        // 将船只类型转换为小写，以匹配图片文件名
        const shipType = (ship.type || ship.id.split('-')[0]).toLowerCase();
        const imagePath = `${shipType}.png`;
        
        let visualHTML = '';
        
        if (ship.direction === 'horizontal') {
            visualHTML = `<div class="ship-top-view horizontal" style="width: ${ship.size * 20}px; height: 20px; background-image: url('${imagePath}'); background-size: cover;"></div>`;
        } else {
            // 垂直放置时需要旋转图片
            visualHTML = `<div class="ship-top-view vertical" style="width: 20px; height: ${ship.size * 20}px; background-image: url('${imagePath}'); background-size: cover; transform: rotate(90deg);"></div>`;
        }
        
        return visualHTML;
    }

    getShipCellClass(ship, cellIndex) {
        if (ship.sunk) return 'sunk';
        if (ship.health <= cellIndex) return 'damaged';
        return '';
    }

    selectShip(shipId) {
        this.selectedShip = shipId;
        
        // 更新UI显示选中的船只
        document.querySelectorAll('.ship-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        const selectedItem = document.querySelector(`.ship-item[data-ship-id="${shipId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }
        
        // 更新棋盘上的船只选中状态
        this.updateShipSelectionOnBoard();
    }

    updateShipSelectionOnBoard() {
        // 清除所有船只的选中状态
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('selected-ship');
        });
        
        // 如果有选中的船只，高亮显示
        if (this.selectedShip) {
            const ship = this.getShipById(this.selectedShip);
            if (ship && ship.placed) {
                for (let i = 0; i < ship.size; i++) {
                    const cellX = ship.direction === 'horizontal' ? ship.x + i : ship.x;
                    const cellY = ship.direction === 'vertical' ? ship.y + i : ship.y;
                    
                    const cell = Array.from(document.querySelectorAll('.cell')).find(c => 
                        parseInt(c.dataset.x) === cellX && parseInt(c.dataset.y) === cellY
                    );
                    
                    if (cell) {
                        cell.classList.add('selected-ship');
                    }
                }
            }
        }
    }

    getShipById(shipId) {
        if (!this.gameState || !this.currentPlayer) return null;
        
        const playerShips = this.gameState.ships[this.currentPlayer];
        return playerShips.find(ship => ship.id === shipId);
    }

    handleCellClick(x, y) {
        if (!this.gameState || !this.currentPlayer) return;

        if (this.gameState.gamePhase === 'setup') {
            if (this.selectedShip) {
                this.placeShip(x, y);
            } else {
                this.showMessage('请先选择要放置的船只', 'warning', 2000); // 替换alert
            }
        } else if (this.gameState.gamePhase === 'playing') {
            // 在游戏阶段，点击单元格可以选择船只或执行动作
            // 优先选择己方船只
            if (this.selectShipAtPosition(x, y)) {
                this.currentAction = null; // 选择船只时取消当前操作模式
            } else {
                if (this.currentAction) {
                    this.handleGameAction(x, y);
                } 
            }
        }
    }

    selectShipAtPosition(x, y) {
        const playerShips = this.gameState.ships[this.currentPlayer];
        for (const ship of playerShips) {
            if (!ship.placed || ship.sunk || ship.actionTaken) continue;
            
            for (let i = 0; i < ship.size; i++) {
                const shipX = ship.direction === 'horizontal' ? ship.x + i : ship.x;
                const shipY = ship.direction === 'vertical' ? ship.y + i : ship.y;
                
                if (shipX === x && shipY === y) {
                    this.selectShip(ship.id);
                    return true;
                }
            }
        }
        return false;
    }

    // 创建船只元素（使用单个img元素）
    createShipElement(ship) {
        const shipElement = document.createElement('div');
        const shipType = (ship.type || ship.id.split('-')[0]).toLowerCase();
        const color = ship.id.includes('red') ? 'red' : 'blue';
        
        shipElement.className = `ship-element ${ship.direction} ${color}`;
        shipElement.id = `ship-${ship.id}`;
        shipElement.dataset.shipId = ship.id;
        
        // 创建单个img元素显示船只图片
        const shipImage = document.createElement('img');
        shipImage.src = `${shipType}.png`;
        shipImage.className = 'ship-image';
        shipImage.alt = `${shipType} ship`;
        
        // 根据船只方向设置图片尺寸和旋转
        if (ship.direction === 'horizontal') {
            shipImage.style.width = `${ship.size * 40}px`;
            shipImage.style.height = '40px';
            shipImage.style.transform = 'none';
            //shipImage.style.transformOrigin = 'center center'; // 水平船只使用中心旋转
        } else {
            // 垂直船只：图片尺寸与容器尺寸匹配
            shipImage.style.width = `${ship.size * 40}px`; // 保持原始宽度
            shipImage.style.height = '40px'; // 保持原始高度
            shipImage.style.transform = 'rotate(90deg)';
            shipImage.style.transformOrigin = '20px 20px'; // 垂直船只使用左上角旋转
        }
        
        shipElement.appendChild(shipImage);
        
        // 创建生命值显示元素
        const healthDisplay = document.createElement('div');
        healthDisplay.className = 'ship-health-display';
        healthDisplay.textContent = ship.health;
        
        // 根据生命值设置颜色：满血绿色，不满血红色
        if (ship.health === ship.maxHealth) {
            healthDisplay.classList.add('full-health');
        } else {
            healthDisplay.classList.add('damaged-health');
        }
        
        shipElement.appendChild(healthDisplay);
        
        // 设置船只位置
        this.updateShipElementPosition(shipElement, ship);
        
        // 设置船只状态
        if (ship.sunk) {
            shipElement.classList.add('sunk');
        } else if (ship.health < ship.maxHealth) {
            shipElement.classList.add('damaged');
        }
        
        // 设置船只行动状态
        this.updateShipActionStatus(shipElement, ship);
        
        return shipElement;
    }

    // 更新船只行动状态
    updateShipActionStatus(shipElement, ship) {
        // 移除现有的行动状态类
        shipElement.classList.remove('action-available', 'action-taken');
        
        // 根据行动状态添加相应的类
        if (ship.actionTaken) {
            shipElement.classList.add('action-taken');
        } else {
            shipElement.classList.add('action-available');
        }
    }

    // 更新船只元素位置
    updateShipElementPosition(shipElement, ship) {
        const cellSize = 40; // 假设每个单元格40px
        const board = document.getElementById('board');
        
        if (ship.direction === 'horizontal') {
            shipElement.style.left = `${ship.x * cellSize}px`;
            shipElement.style.top = `${ship.y * cellSize}px`;
            shipElement.style.width = `${ship.size * cellSize}px`;
            shipElement.style.height = `${cellSize}px`;
        } else {
            shipElement.style.left = `${ship.x * cellSize}px`;
            shipElement.style.top = `${ship.y * cellSize}px`;
            shipElement.style.width = `${cellSize}px`;
            shipElement.style.height = `${ship.size * cellSize}px`;
        }
    }

    // 更新船只显示
    updateShipsDisplay() {
        const board = document.getElementById('board');
        
        // 清除所有船只元素
        this.shipElements.forEach((element, shipId) => {
            if (element.parentElement) {
                element.remove();
            }
        });
        this.shipElements.clear();
        
        // 更新船只显示
        ['red', 'blue'].forEach(color => {
            this.gameState.ships[color].forEach(ship => {
                if (ship.placed) {
                    const shipElement = this.createShipElement(ship);
                    board.appendChild(shipElement);
                    this.shipElements.set(ship.id, shipElement);
                    
                    // 更新选中状态
                    if (this.selectedShip === ship.id) {
                        shipElement.classList.add('selected');
                    }
                }
            });
        });
        
        // 清除单元格上的船只相关样式
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            cell.classList.remove('ship-cell', 'damaged', 'sunk', 'selected-ship');
            cell.style.backgroundImage = '';
            cell.style.backgroundSize = '';
            cell.style.backgroundPosition = '';
            cell.style.transform = '';
            cell.style.filter = '';
        });
    }

    // 更新船只选中状态
    updateShipSelectionOnBoard() {
        // 清除所有船只的选中状态
        this.shipElements.forEach((element, shipId) => {
            element.classList.remove('selected');
        });
        
        // 如果有选中的船只，高亮显示
        if (this.selectedShip) {
            const shipElement = this.shipElements.get(this.selectedShip);
            if (shipElement) {
                shipElement.classList.add('selected');
            }
        }
    }

    // 放置船只到棋盘（更新版本）
    placeShipOnBoard(ship) {
        // 如果船只元素已存在，先移除
        const existingElement = this.shipElements.get(ship.id);
        if (existingElement && existingElement.parentElement) {
            existingElement.remove();
        }
        
        // 创建新的船只元素
        const shipElement = this.createShipElement(ship);
        const board = document.getElementById('board');
        board.appendChild(shipElement);
        this.shipElements.set(ship.id, shipElement);
        
        // 更新选中状态
        this.updateShipSelectionOnBoard();
    }

    // 移动船只（添加动画效果）
    moveShipWithAnimation(shipId, newX, newY) {
        const ship = this.getShipById(shipId);
        if (!ship) return;
        
        const shipElement = this.shipElements.get(shipId);
        if (!shipElement) return;
        
        // 更新游戏状态中的船只位置
        ship.x = newX;
        ship.y = newY;
        
        // 应用移动动画
        this.updateShipElementPosition(shipElement, ship);
    }

    // 旋转船只（添加动画效果）
    rotateShipWithAnimation(shipId) {
        const ship = this.getShipById(shipId);
        if (!ship) return;
        
        const shipElement = this.shipElements.get(shipId);
        if (!shipElement) return;
        
        // 切换方向
        ship.direction = ship.direction === 'horizontal' ? 'vertical' : 'horizontal';
        
        // 更新船只元素
        shipElement.className = shipElement.className.replace(/(horizontal|vertical)/, ship.direction);
        
        // 更新图片的尺寸和旋转
        const shipImage = shipElement.querySelector('.ship-image');
        if (shipImage) {
            if (ship.direction === 'horizontal') {
                shipImage.style.width = `${ship.size * 40}px`;
                shipImage.style.height = '40px';
                shipImage.style.transform = 'none';
                //shipImage.style.transformOrigin = 'center center'; // 水平船只使用中心旋转
            } else {
                // 垂直船只：图片尺寸与容器尺寸匹配
                shipImage.style.width = `${ship.size * 40}px`; // 保持原始宽度
                shipImage.style.height = '40px'; // 保持原始高度
                shipImage.style.transform = 'rotate(90deg)';
                shipImage.style.transformOrigin = '20px 20px'; // 垂直船只使用左上角旋转
            }
        }
        
        // 更新位置
        this.updateShipElementPosition(shipElement, ship);
    }

    handleMoveAction(x, y, ship) {
        // 计算船只的新位置
        let newX = ship.x;
        let newY = ship.y;

        if(ship.size == 1) {
            // 单格船只：可以向任意方向移动一格
            if ((x!== ship.x && y!== ship.y) || (x === ship.x && y === ship.y) ) {
                return; // 无效移动，直接返回
            }
            if (x !== ship.x) {
                newX = x > ship.x ? ship.x + 1 : ship.x - 1;
            }
            if (y !== ship.y) {
                newY = y > ship.y ? ship.y + 1 : ship.y - 1;
            }
        }else{
            if (ship.direction === 'horizontal') {
                // 水平船只：只能水平移动，y坐标不变
                if( x === ship.x || y !== ship.y ) {
                    return; // 无效移动，直接返回
                }
                newX = x < ship.x ? ship.x - 1 : ship.x + 1;
            } else {
                // 垂直船只：只能垂直移动，x坐标不变
                if( y === ship.y || x !== ship.x ) {
                    return; // 无效移动，直接返回
                }
                newY = y < ship.y ? ship.y - 1 : ship.y + 1;
            }
        }
        
        // 检查移动是否有效
        const isValid = this.isValidMove(newX, newY, ship);
        if (!isValid) {
            // 提供更详细的错误信息
            let errorMessage = '无效的移动位置。原因：';
            
            // 检查边界
            if (newX < 0 || newX >= this.boardSize || newY < 0 || newY >= this.boardSize) {
                errorMessage += '超出棋盘边界；';
            }
            if (ship.size >1 && ship.direction === 'horizontal' && (newX + ship.size -1 >= this.boardSize)) {
                errorMessage += '超出棋盘边界；';
            }
            if (ship.size >1 && ship.direction === 'vertical' && (newY + ship.size -1 >= this.boardSize)) {
                errorMessage += '超出棋盘边界；';
            }
            
            // 检查障碍物
            if (this.gameState.obstacles.some(obs => {
                for (let i = 0; i < ship.size; i++) {
                    const shipX = ship.direction === 'horizontal' ? newX + i : newX;
                    const shipY = ship.direction === 'vertical' ? newY + i : newY;
                    if (obs.x === shipX && obs.y === shipY) {
                        return true;
                    }
                }
                return false;
            })) {
                errorMessage += '目标位置有障碍物；';
            }
            
            // 检查船只重叠
            const playerShips = this.gameState.ships[this.currentPlayer];
            for (const otherShip of playerShips) {
                if (otherShip.id === ship.id || !otherShip.placed || otherShip.sunk) continue;
                
                for (let i = 0; i < ship.size; i++) {
                    const shipX = ship.direction === 'horizontal' ? newX + i : newX;
                    const shipY = ship.direction === 'vertical' ? newY + i : newY;
                    
                    for (let j = 0; j < otherShip.size; j++) {
                        const otherX = otherShip.direction === 'horizontal' ? otherShip.x + j : otherShip.x;
                        const otherY = otherShip.direction === 'vertical' ? otherShip.y + j : otherShip.y;
                        
                        if (shipX === otherX && shipY === otherY) {
                            errorMessage += `与船只${otherShip.name}重叠；`;
                            break;
                        }
                    }
                }
            }
            
            this.showMessage(errorMessage, 'error', 2000);
            return;
        }

        // 发送移动请求到服务器 - 修复参数名称为targetX和targetY
        console.log(`请求移动船只${ship.id}，原位置(${ship.x}, ${ship.y})到位置(${newX}, ${newY})`);
        this.socket.emit('shipAction', {
            type: 'move',
            shipId: ship.id,
            targetX: newX,  // 修复：改为targetX
            targetY: newY   // 修复：改为targetY
        });

        // 移动后取消选择船只，以便选择其他船只
        this.selectedShip = null;
        this.currentAction = null;
        this.showMessage('船只移动完成', 'info', 2000);
    }

    // 检查移动是否有效
    isValidMove(newX, newY, ship) {
        // 检查边界
        if (newX < 0 || newX >= this.boardSize || newY < 0 || newY >= this.boardSize) {
            return false;
        }
        
        // 检查移动方向限制
        if (ship.size == 1) {
            // 单格船只：可以向任意方向移动一格
            // 只能移动一格
            if (Math.abs(newX - ship.x) > 1 && Math.abs(newY - ship.y) > 1) return false;
        } else {
            if (ship.direction === 'horizontal') {
                // 水平放置的船只只能水平移动（y坐标不变）
                if (newY !== ship.y) return false;
                // 只能移动一格
                if (Math.abs(newX - ship.x) > 1) return false;
            } else {
                // 垂直放置的船只只能垂直移动（x坐标不变）
                if (newX !== ship.x) return false;
                // 只能移动一格
                if (Math.abs(newY - ship.y) > 1) return false;
            }
        }
        
        // 检查障碍物
        for (let i = 0; i < ship.size; i++) {
            const shipX = ship.direction === 'horizontal' ? newX + i : newX;
            const shipY = ship.direction === 'vertical' ? newY + i : newY;
            
            if (this.gameState.obstacles.some(obs => obs.x === shipX && obs.y === shipY)) {
                return false;
            }
        }
        
        // 检查船只重叠
        const playerShips = this.gameState.ships[this.currentPlayer];
        for (const otherShip of playerShips) {
            if (otherShip.id === ship.id || !otherShip.placed || otherShip.sunk) continue;
            
            for (let i = 0; i < ship.size; i++) {
                const shipX = ship.direction === 'horizontal' ? newX + i : newX;
                const shipY = ship.direction === 'vertical' ? newY + i : newY;
                
                for (let j = 0; j < otherShip.size; j++) {
                    const otherX = otherShip.direction === 'horizontal' ? otherShip.x + j : otherShip.x;
                    const otherY = otherShip.direction === 'vertical' ? otherShip.y + j : otherShip.y;
                    
                    if (shipX === otherX && shipY === otherY) {
                        return false;
                    }
                }
            }
        }
        
        return true;
    }

    // 检查攻击是否有效
    isValidAttack(x, y, ship) {
        // 检查边界
        if (x < 0 || x >= this.boardSize || y < 0 || y >= this.boardSize) {
            return false;
        }
        if (!ship) return false;

        // 检查目标位置是否有对方船只
        const opponent = this.currentPlayer === 'red' ? 'blue' : 'red';
        const opponentShips = (this.gameState && this.gameState.ships) ? this.gameState.ships[opponent] : [];
        let targetIsEnemyCell = false;
        for (const otherShip of opponentShips) {
            if (!otherShip.placed || otherShip.sunk) continue;
            for (let i = 0; i < otherShip.size; i++) {
                const ox = otherShip.direction === 'horizontal' ? otherShip.x + i : otherShip.x;
                const oy = otherShip.direction === 'vertical' ? otherShip.y + i : otherShip.y;
                if (ox === x && oy === y) {
                    targetIsEnemyCell = true;
                    break;
                }
            }
            if (targetIsEnemyCell) break;
        }
        if (!targetIsEnemyCell) {
            this.showMessage('目标位置没有对方船只', 'warning', 2000);
            return false;
        }

        // 计算攻击方所有格子，检查是否存在一对格子在同一行或同一列且间距不超过attackRange
        const attackerCells = [];
        for (let i = 0; i < ship.size; i++) {
            const ax = ship.direction === 'horizontal' ? ship.x + i : ship.x;
            const ay = ship.direction === 'vertical' ? ship.y + i : ship.y;
            attackerCells.push({ x: ax, y: ay });
        }

        const range = ship.attackRange || 0;
        for (const a of attackerCells) {
            if (a.y === y && Math.abs(a.x - x) <= range) return true;
            if (a.x === x && Math.abs(a.y - y) <= range) return true;
        }

        this.showMessage('超出攻击范围', 'warning', 2000);
        return false;
    }

    // 更新游戏显示
    updateGameDisplay() {
        this.updateShipsDisplay();
        this.updateObstacles();
        this.updateGamePhaseDisplay();
        this.updateStatusPanel();
        this.updatePlayerStatus();
        this.updateTurnIndicator(this.gameState.currentTurn);
    }

    // 更新障碍物显示
    updateObstacles() {
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            cell.classList.remove('obstacle');
        });
        
        this.gameState.obstacles.forEach(obs => {
            const cell = Array.from(document.querySelectorAll('.cell')).find(c => 
                parseInt(c.dataset.x) === obs.x && parseInt(c.dataset.y) === obs.y
            );
            if (cell) {
                cell.classList.add('obstacle');
            }
        });
    }

    // 更新游戏阶段显示
    updateGamePhaseDisplay() {
        const phaseElement = document.getElementById('game-phase');
        if (phaseElement) {
            phaseElement.textContent = this.gameState.gamePhase === 'setup' ? '放置阶段' : '战斗阶段';
        }
        
        // 根据游戏阶段显示/隐藏相关界面元素
        const shipList = document.getElementById('ship-list');
        const actionButtons = document.getElementById('action-buttons');
        
        if (this.gameState.gamePhase === 'setup') {
            // 放置阶段：显示船只选择列表，隐藏动作按钮
            if (shipList) shipList.style.display = 'block';
            if (actionButtons) actionButtons.style.display = 'none';
        } else {
            // 战斗阶段：隐藏船只选择列表，显示动作按钮
            if (shipList) shipList.style.display = 'none';
            if (actionButtons) actionButtons.style.display = 'block';
            
            // 在战斗阶段，还需要检查是否是当前玩家的回合
            if (this.gameState.currentTurn === this.currentPlayer) {
                // 当前玩家的回合：启用动作按钮
                this.enableActionButtons();
            } else {
                // 对手的回合：禁用动作按钮
                this.disableActionButtons();
            }
        }
    }
    
    // 启用动作按钮
    enableActionButtons() {
        const buttons = document.querySelectorAll('#action-buttons button');
        buttons.forEach(button => {
            button.disabled = false;
            button.style.opacity = '1';
        });
    }
    
    // 禁用动作按钮
    disableActionButtons() {
        const buttons = document.querySelectorAll('#action-buttons button');
        buttons.forEach(button => {
            button.disabled = true;
            button.style.opacity = '0.5';
        });
    }

    showActionButtons() {
        const actionButtons = document.getElementById('action-buttons');
        if (actionButtons) {
            actionButtons.style.display = 'block';
        }
    }

    hideActionButtons() {
        const actionButtons = document.getElementById('action-buttons');
        if (actionButtons) {
            actionButtons.style.display = 'none';
        }
    }

    updateStatusPanel() {
        const statusPanel = document.getElementById('status-panel');
        if (!statusPanel || !this.gameState) return;
        
        statusPanel.innerHTML = `
            <h3>游戏状态</h3>
            <p>阶段: ${this.gameState.gamePhase === 'setup' ? '放置阶段' : '战斗阶段'}</p>
            <p>当前回合: ${this.gameState.currentTurn}</p>
            <p>红方船只: ${this.gameState.ships.red.filter(s => s.placed).length}/${this.gameState.ships.red.length}</p>
            <p>蓝方船只: ${this.gameState.ships.blue.filter(s => s.placed).length}/${this.gameState.ships.blue.length}</p>
        `;
    }

    updatePlayerStatus() {
        const playerStatus = document.getElementById('player-status');
        if (!playerStatus || !this.currentPlayer) return;
        
        playerStatus.textContent = `当前玩家: ${this.currentPlayer === 'red' ? '红方' : '蓝方'}`;
    }

    showActionHint(message) {
        const hintElement = document.getElementById('action-hint');
        if (hintElement) {
            hintElement.textContent = message;
            hintElement.style.display = 'block';
        }
    }

    hideActionHint() {
        const hintElement = document.getElementById('action-hint');
        if (hintElement) {
            hintElement.style.display = 'none';
        }
    }

    handleGameAction(x, y) {
        if (!this.selectedShip) {
            return;
        }
        
        const ship = this.getShipById(this.selectedShip);
        if (!ship || !ship.placed || ship.sunk || ship.actionTaken) {
            this.showMessage('该船不能行动', 'error', 2000);
            return;
        }
        
        if (this.currentAction === 'move') {
            this.handleMoveAction(x, y, ship);
        } else if (this.currentAction === 'attack') {
            this.handleAttackAction(x, y, ship);
        } else if (this.currentAction === 'rotate') {
            this.handleRotateShip(x, y, ship);
        }
    }

    handleAttackAction(x, y, ship) {
        // 检查攻击是否有效
        const isValid = this.isValidAttack(x, y, ship);
        if (!isValid) {
            //this.showMessage('无效的攻击位置', 'error', 2000);
            return;
        }

        // 发送攻击请求到服务器
        console.log(`请求船只${ship.id}攻击位置(${x}, ${y})`);
        this.socket.emit('shipAction', {
            type: 'attack',
            shipId: ship.id,
            targetX: x,
            targetY: y
        });

        this.selectedShip = null;
        this.currentAction = null;
    }

    moveShip() {
        if (!this.selectedShip) {
            this.showMessage('请先选择要移动的船只', 'warning', 2000);
            return;
        }
        
        const ship = this.getShipById(this.selectedShip);
        if (!ship || !ship.placed || ship.sunk || ship.actionTaken) {
            this.showMessage('无法移动该船只', 'error', 2000);
            return;
        }
        
        this.currentAction = 'move';
        this.showMessage('请点击目标位置移动船只', 'info', 3000);
    }

    attack() {
        if (!this.selectedShip) {
            this.showMessage('请先选择要攻击的船只', 'warning', 2000);
            return;
        }
        
        const ship = this.getShipById(this.selectedShip);
        if (!ship || !ship.placed || ship.sunk || ship.actionTaken) {
            this.showMessage('无法使用该船只攻击', 'error', 2000);
            return;
        }
        
        this.currentAction = 'attack';
        this.showMessage('请点击目标位置进行攻击', 'info', 3000);
    }

    rotateShip() {
        if (!this.selectedShip) {
            this.showMessage('请先选择要转向的船只', 'warning', 2000);
            return;
        }
        
        const ship = this.getShipById(this.selectedShip);
        if (!ship || !ship.placed || ship.sunk || ship.actionTaken) {
            this.showMessage('无法旋转该船只', 'error', 2000);
            return;
        }

        if (ship.size === 1) {
            this.showMessage('大小为1的船只不需要旋转', 'error', 2000);
            return;
        }

        this.currentAction = 'rotate';
        this.showMessage('请点击转向方向', 'info', 3000);
    }

    handleRotateShip(x, y, ship) {
        // 计算船只的新位置
        const centerX = ship.x + (ship.direction === 'horizontal' ? ship.size/ 2 : 0.5);
        const centerY = ship.y + (ship.direction === 'vertical' ? ship.size/ 2 : 0.5);
        
        let newX = ship.x;
        let newY = ship.y;

        if (ship.direction === 'horizontal') {
            // 从水平转为垂直
            newX = x >= centerX ? Math.floor(centerX) : Math.ceil(centerX) - 1;
            newY = y >= centerY ? ship.y - Math.ceil(ship.size / 2) + 1 : ship.y - Math.floor(ship.size / 2);
        } else {
            // 从垂直转为水平
            newX = x >= centerX ? ship.x - Math.ceil(ship.size / 2) + 1 : ship.x - Math.floor(ship.size / 2);
            newY = y >= centerY ? Math.floor(centerY) : Math.ceil(centerY) - 1;
        }
        console.log(`船位置(${ship.x}, ${ship.y})，中心点(${centerX}, ${centerY})，点击点(${x}, ${y})，新位置(${newX}, ${newY})`);


        // 发送旋转请求到服务器
        this.socket.emit('shipAction', {
            type: 'rotate',
            shipId: ship.id,
            targetX: newX,
            targetY: newY
        });
    }

    endTurn() {
        this.socket.emit('endTurn', this.currentPlayer);
        this.currentAction = null;
        this.selectedShip = null;
        this.showMessage('回合结束', 'info', 2000);
    }

    placeShip(x, y) {
        if (!this.selectedShip) {
            this.showMessage('请先选择要放置的船只', 'warning', 2000);
            return;
        }

        // 发送放置请求到服务器 - 修复：发送placeShip事件而不是shipAction事件
        this.socket.emit('placeShip', {
            shipId: this.selectedShip,
            x: x,
            y: y,
            direction: 'horizontal' // 添加默认方向
        });
    }

    updateTurnIndicator(turn) {
        const turnElement = document.getElementById('turn-indicator');
        if (turnElement) {
            turnElement.textContent = `当前回合: ${turn}`;
        }
    }

    showDiceResult(value) {
        const diceElement = document.getElementById('dice-result');
        const diceValue = document.getElementById('dice-value');
        
        diceValue.textContent = value;
        diceElement.style.display = 'block';
        
        setTimeout(() => {
            diceElement.style.display = 'none';
        }, 2000);
    }

    // 添加新的爆炸动画方法
    showExplosionAnimation(x, y, attackPower) {
        const board = document.getElementById('board');
        if (!board) return;

        // 创建爆炸动画元素
        const explosionElement = document.createElement('img');
        explosionElement.src = attackPower > 0 ? '/boom.gif' : '/miss.gif';
        explosionElement.className = 'explosion-animation';
        
        // 设置爆炸动画的样式
        explosionElement.style.position = 'absolute';
        explosionElement.style.width = '120px';
        explosionElement.style.height = '120px';
        explosionElement.style.pointerEvents = 'none';
        explosionElement.style.zIndex = '100';
        
        // 计算爆炸位置（中心点位于攻击位置）
        const cellSize = 40; // 与棋盘单元格大小一致
        const offsetX = x * cellSize + cellSize / 2 - 60; // 120/2 = 60
        const offsetY = y * cellSize + cellSize / 2 - 60; // 120/2 = 60
        
        explosionElement.style.left = `${offsetX}px`;
        explosionElement.style.top = `${offsetY}px`;
        
        // 添加到棋盘
        board.appendChild(explosionElement);
        
        // 1.2秒后移除爆炸动画
        setTimeout(() => {
            if (explosionElement.parentElement) {
                explosionElement.remove();
            }
        }, 1200);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.game = new BattleshipGame();
    
    const joinButtons = document.createElement('div');
    joinButtons.innerHTML = `
        <div style="text-align: center; margin: 20px;">
            <button onclick="joinGame('red')" style="padding: 15px 30px; background: #FF4444; color: white; border: none; border-radius: 5px; margin: 10px; cursor: pointer;">加入红方</button>
            <button onclick="joinGame('blue')" style="padding: 15px 30px; background: #4444FF; color: white; border: none; border-radius: 5px; margin: 10px; cursor: pointer;">加入蓝方</button>
        </div>
    `;
    document.getElementById('header').appendChild(joinButtons);
});

function joinGame(color) {
    window.game.currentPlayer = color;
    window.game.socket.emit('joinGame', color);
    // 将页面header设置为对应颜色
    const header = document.getElementById('header');
    if (header) {
        header.classList.remove('red', 'blue');
        header.classList.add(color);
    }
    const joinContainer = document.querySelector('div[style*="text-align: center"]');
    if (joinContainer && joinContainer.parentElement) joinContainer.remove();
}
