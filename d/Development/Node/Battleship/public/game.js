// ... existing code ...

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