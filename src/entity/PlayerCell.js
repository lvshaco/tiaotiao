var Cell = require('./Cell');
var Packet = require('../packet');

function PlayerCell() {
    Cell.apply(this, Array.prototype.slice.call(arguments));

    this.cellType = 0;
    this.recombineTicks = 0;
    this.shouldRecombine = false; 
}

module.exports = PlayerCell;
PlayerCell.prototype = new Cell();

PlayerCell.prototype.visibleCheck = function(box, centerPos) {
    if (this.mass < 100) {
        return this.collisionCheck(box.bottomY, box.topY, box.rightX, box.leftX);
    } else {
        var cellSize = this.getSize();
        var lenX = cellSize + box.width >> 0;
        var lenY = cellSize + box.height >> 0;
        return (this.abs(this.position.x - centerPos.x) < lenX) && 
               (this.abs(this.position.y - centerPos.y) < lenY);
    }
};

PlayerCell.prototype.calcMergeTime = function(base) {
    this.shouldRecombine = this.recombineTicks >= base;
};

PlayerCell.prototype.calcMove = function(x2, y2, gameServer, moveCell) {
    if (moveCell) {
        // move angle
        var deltaY = y2 - this.position.y;
        var deltaX = x2 - this.position.x;
        var angle = Math.atan2(deltaX, deltaY);
        if (isNaN(angle)) {
            return;
        }

        this.lastMoveAngle = angle;
        var dist = this.getDist(this.position.x, this.position.y, x2, y2);
        var speed = Math.min(this.getSpeed(), dist)/2;

        // Move cell
        this.position.x += Math.sin(angle) * speed;
        this.position.y += Math.cos(angle) * speed;
    }

    this.collision(gameServer);
};

PlayerCell.prototype.collision = function(gameServer) {
    var config = gameServer.config;
    var r = this.getSize(); 

    var x1 = this.position.x;
    var y1 = this.position.y;

    for (var i = 0; i < this.owner.cells.length; i++) {
        var cell = this.owner.cells[i];
        if (this.nodeId == cell.nodeId) {
            continue;
        }
        if ((!cell.shouldRecombine) || (!this.shouldRecombine)) {
            var collisionDist = cell.getSize() + r; 
            dist = this.getDist(x1, y1, cell.position.x, cell.position.y);
            if (dist < collisionDist) { 
                var c1Speed = this.getSpeed();
                var c2Speed = cell.getSpeed();
                var Tmult = (c1Speed / c2Speed) / 2;
                var dY = y1 - cell.position.y;
                var dX = x1 - cell.position.x;
                var newAngle = Math.atan2(dX, dY);
                var Tmove = (collisionDist - dist) * Tmult;
                x1 += (Tmove * Math.sin(newAngle)) >> 0;
                y1 += (Tmove * Math.cos(newAngle)) >> 0;

                dist = this.getDist(x1, y1, cell.position.x, cell.position.y);
                var Cmult = (c2Speed / c1Speed) / 2;
                var Cmove = (collisionDist - dist) * Cmult;
                cell.position.x -= (Cmove * Math.sin(newAngle)) >> 0;
                cell.position.y -= (Cmove * Math.cos(newAngle)) >> 0;
            }
        }
    }
    if (x1 < config.borderLeft + r) {
        x1 = config.borderLeft + r;
    }
    if (x1 > config.borderRight - r) {
        x1 = config.borderRight - r;
    }
    if (y1 < config.borderTop + r) {
        y1 = config.borderTop + r;
    }
    if (y1 > config.borderBottom - r) {
        y1 = config.borderBottom - r;
    }
    this.position.x = x1 >> 0;
    this.position.y = y1 >> 0;
}

PlayerCell.prototype.onConsume = function(consumer, gameServer) {
    consumer.addMass(this.mass);
};

PlayerCell.prototype.onAdd = function(gameServer) {
    this.setColor(this.owner.color);
    this.owner.cells.push(this);

    console.log('sendAddNode');
    this.owner.socket.sendPacket(new Packet.AddNode(this));
    
    gameServer.nodesPlayer.push(this);
};

PlayerCell.prototype.onRemove = function(gameServer) {
    var index;
    index = this.owner.cells.indexOf(this);
    if (index != -1) {
        this.owner.cells.splice(index, 1);
    }
    index = gameServer.nodesPlayer.indexOf(this);
    if (index != -1) {
        gameServer.nodesPlayer.splice(index, 1);
    }
};

PlayerCell.prototype.abs = function(x) {
    return x < 0 ? -x : x;
};

PlayerCell.prototype.getDist = function(x1, y1, x2, y2) {
    var xs = x2 - x1;
    xs = xs * xs;
    var ys = y2 - y1;
    ys = ys * ys;
    return Math.sqrt(xs + ys);
};

PlayerCell.prototype.addMass = function(n) {
    this.mass += n;
    // max mass
    if (this.mass > this.gameServer.config.playerMaxMass)
        this.mass = this.gameServer.config.playerMaxMass;

};


