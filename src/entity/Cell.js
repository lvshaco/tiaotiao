function Cell(nodeId, owner, position, mass, gameServer) {
    this.nodeId = nodeId;
    this.owner = owner; 
    this.color = {
        r: 0,
        g: 255,
        b: 0
    };
    if (owner) {
        // do null
    } else {
        this.icon = Math.floor(Math.random()*65535);
    }
    this.lastMoveAngle = 0;
    this.position = position;
    this.mass = mass;
    this.cellType = -1; // 0 = Player Cell, 1 = Food, 2 = Virus, 3 = Ejected Mass
    this.spiked = 0; // 1 = has spike

    this.killedBy; 
    this.gameServer = gameServer;

    this.moveEngineSpeed = 0; // move speed
    this.moveEngineTicks = 0; // move tick 
    this.moveDecay = 0.85;
    this.angle = 0; // move angle
}

module.exports = Cell;

Cell.prototype.getName = function() {
    if (this.owner) {
        return this.owner.name;
    } else {
        return "";
    }
};

Cell.prototype.getIcon = function() {
    if (this.owner) {
        return this.owner.icon;
    } else {
        return this.icon;
    }
};

Cell.prototype.setColor = function(color) {
    this.color.r = color.r;
    this.color.b = color.b;
    this.color.g = color.g;
};

Cell.prototype.getColor = function() {
    return this.color;
};

Cell.prototype.getType = function() {
    return this.cellType;
};

Cell.prototype.getSize = function() {
    return this.gameServer.getSizeFromMass(this.mass);
};

Cell.prototype.getSquareSize = function() {
    return this.getSize() * this.getSize();
};

Cell.prototype.addMass = function(n) {
    this.mass += n;
};

Cell.prototype.getSpeed = function() {
    return this.gameServer.getSpeedFromMass(this.mass);
};

Cell.prototype.setAngle = function(radians) {
    this.angle = radians;
};

Cell.prototype.getAngle = function() {
    return this.angle;
};

Cell.prototype.setMoveEngineData = function(speed, ticks, decay) {
    this.moveEngineSpeed = speed;//ticks;
    this.moveEngineTicks = ticks;
    this.moveDecay = isNaN(decay) ? 0.75 : decay;
};

Cell.prototype.getKiller = function() {
    return this.killedBy;
};

Cell.prototype.setKiller = function(cell) {
    this.killedBy = cell;
};

Cell.prototype.collisionCheck = function(bottomY, topY, rightX, leftX) {
    if (this.position.y > bottomY) {
        return false;
    }
    if (this.position.y < topY) {
        return false;
    }
    if (this.position.x > rightX) {
        return false;
    }
    if (this.position.x < leftX) {
        return false;
    }
    return true;
};

Cell.prototype.collisionCheck2 = function(objectSquareSize, objectPosition) {
    var dx = this.position.x - objectPosition.x;
    var dy = this.position.y - objectPosition.y;
    return (dx * dx + dy * dy + this.getSquareSize() <= objectSquareSize);
};

Cell.prototype.visibleCheck = function(box, centerPos) {
    return this.collisionCheck(box.bottomY, box.topY, box.rightX, box.leftX);
};

Cell.prototype.calcMovePhys = function(config) {
    // Move, twice as slower
    //var X = this.position.x + ((this.moveEngineSpeed / 2) * Math.sin(this.angle));
    //var Y = this.position.y + ((this.moveEngineSpeed / 2) * Math.cos(this.angle));

    var X = this.position.x + (this.moveEngineSpeed * Math.sin(this.angle));
    var Y = this.position.y + (this.moveEngineSpeed * Math.cos(this.angle));

    // Movement engine
    if (this.moveEngineSpeed <= this.moveDecay * 3) this.moveEngineSpeed = 0;
    var speedDecrease = this.moveEngineSpeed - this.moveEngineSpeed * this.moveDecay;
    //var speedDecrease = this.moveEngineSpeed / this.moveEngineTicks;
    this.moveEngineSpeed -= speedDecrease; // Decaying speed twice as slower
    //this.moveEngineTicks -= 0.5; // Ticks passing twice as slower
    this.moveEngineTicks -= 1;
    if (this.moveEngineTicks <= 0) 
    {
        this.moveEngineSpeed = 0;
    }

    // border check
    var radius = this.getSize();
    if ((this.position.x - radius) < config.borderLeft) {
        this.angle = 6.28 - this.angle;
        X = config.borderLeft + radius;
    }
    if ((this.position.x + radius) > config.borderRight) {
        this.angle = 6.28 - this.angle;
        X = config.borderRight - radius;
    }
    if ((this.position.y - radius) < config.borderTop) {
        this.angle = (this.angle <= 3.14) ? 3.14 - this.angle : 9.42 - this.angle;
        Y = config.borderTop + radius;
    }
    if ((this.position.y + radius) > config.borderBottom) {
        this.angle = (this.angle <= 3.14) ? 3.14 - this.angle : 9.42 - this.angle;
        Y = config.borderBottom - radius;
    }
    this.position.x = X >> 0;
    this.position.y = Y >> 0;
};

Cell.prototype.sendUpdate = function() {
    return true;
};

Cell.prototype.onConsume = function(consumer, gameServer) {
};

Cell.prototype.onAdd = function(gameServer) {
};

Cell.prototype.onRemove = function(gameServer) {
};

Cell.prototype.onAutoMove = function(gameServer) {
};

Cell.prototype.moveDone = function(gameServer) {
};

Cell.prototype.abs = function(x) {
    return x < 0 ? -x : x;
};

Cell.prototype.getDist = function(x1, y1, x2, y2) {
    var xs = x2 - x1;
    xs = xs * xs;

    var ys = y2 - y1;
    ys = ys * ys;

    return Math.sqrt(xs + ys);
};
