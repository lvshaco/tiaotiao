var WebSocket = require('ws');
var http = require('http');
var fs = require("fs");
var ini = require('./modules/ini.js');

var PlayerTracker = require('./PlayerTracker');
var PacketHandler = require('./PacketHandler');
var Entity = require('./entity');
var Logger = require('./modules/log');

function GameServer() {
    this.run = true;
    this.lastNodeId = 1;
    this.lastPlayerId = 1;
    this.clients = [];
    this.nodes = [];
    this.nodesVirus = []; 
    this.nodesEjected = [];
    this.nodesPlayer = [];

    this.currentFood = 0;
    this.movingNodes = [];

    this.log = new Logger();

    this.time = +new Date;
    this.tick = 0;
    this.fullTick = 0;
    this.tickSpawn = 0;

    this.config = {
        // server
        serverMaxConnections: 64, 
        serverPort: 1448,
        serverLogLevel: 1,

        // viewbox
        serverViewBaseX: 1024,
        serverViewBaseY: 592,

        // border
        borderLeft: 0,
        borderRight: 6000, 
        borderTop: 0, 
        borderBottom: 6000,
       
        // food
        foodSpawnAmount: 12,
        foodStartAmount: 500,
        foodMaxAmount: 2000,
        foodMass: 1, 
       
        // virus
        virusMinAmount: 10,
        virusMaxAmount: 50,
        virusStartMass: 100,

        // eject
        ejectMass: 14, 
        ejectMassCooldown: 50, // ms
        ejectSpeed: 100, 

        // player
        playerStartMass: 10,
        playerMaxMass: 22500,
        playerMinMassEject: 32,
        playerMinMassSplit: 36,
        playerMaxCells: 16,

        playerRecombineTime: 8, // second
        playerMassDecayRate: .006, // per second
        playerMinMassDecay: 11, 
        playerMaxNickLength: 15,
    };
    this.loadConfig();
}

module.exports = GameServer;

GameServer.prototype.start = function() {
    this.log.setup(this);

    this.socketServer = new WebSocket.Server({
        port: this.config.serverPort,
        perMessageDeflate: false
    }, function() {
        this.startingFood();

        setInterval(this.mainLoop.bind(this), 1);

        console.log("Listening on port " + this.config.serverPort);
    
    }.bind(this));

    this.socketServer.on('connection', connectionEstablished.bind(this));

    this.socketServer.on('error', function err(e) {
        switch (e.code) {
            case "EADDRINUSE":
                console.log("[Error] Bind address is in use");
                break;
            case "EACCES":
                console.log("[Error] The port need root privileges.");
                break;
            default:
                console.log("[Error] Unhandled error code: " + e.code);
                break;
        }
        process.exit(1); 
    });

    function connectionEstablished(ws) {
        console.log("New connection: "+ws.upgradeReq.headers.origin);
        if (this.clients.length >= this.config.serverMaxConnections) { 
            console.log("[Warn] Connection is full:" + this.clients.length);
            ws.close();
            return;
        }
        function close(error) {
            console.log("Close by error:"+ error);
            this.server.log.onDisconnect(this.socket.remoteAddress);

            var client = this.socket.playerTracker;
            var len = this.socket.playerTracker.cells.length;
            for (var i = 0; i < len; i++) {
                var cell = this.socket.playerTracker.cells[i];
                if (!cell) {
                    continue;
                }
                cell.calcMove = function() {
                    return;
                }; 
            }
            client.disconnect = 0;
            this.socket.sendPacket = function() {
                return;
            };
        }
        ws.remoteAddress = ws._socket.remoteAddress;
        ws.remotePort = ws._socket.remotePort;
        this.log.onConnect(ws.remoteAddress); 

        ws.playerTracker = new PlayerTracker(this, ws);
        ws.packetHandler = new PacketHandler(this, ws);
        ws.on('message', ws.packetHandler.handleMessage.bind(ws.packetHandler));

        var bindObject = {
            server: this,
            socket: ws
        };
        ws.on('error', close.bind(bindObject));
        ws.on('close', close.bind(bindObject));
        this.clients.push(ws);
    }
};

// helper
GameServer.prototype.getNextNodeId = function() {
    if (this.lastNodeId > 2147483647) {
        this.lastNodeId = 1;
    }
    return this.lastNodeId++;
};

GameServer.prototype.getNewPlayerID = function() {
    if (this.lastPlayerId > 2147483647) {
        this.lastPlayerId = 1;
    }
    return this.lastPlayerId++;
};

GameServer.prototype.getRandomPosition = function() {
    return {
        x: Math.floor(Math.random() * (this.config.borderRight - 
                       this.config.borderLeft)) + this.config.borderLeft,
        y: Math.floor(Math.random() * (this.config.borderBottom - 
                    this.config.borderTop)) + this.config.borderTop
    };
};

GameServer.prototype.getRandomSpawn = function() {
    var pos;
    if (this.currentFood > 0) {
        for (var i = (this.nodes.length - 1); i > -1; i--) {
            var node = this.nodes[i];
            if (!node || node.inRange) {
                continue;
            }
            if (node.getType() == 1) {
                pos = {
                    x: node.position.x,
                    y: node.position.y
                };
                this.removeNode(node);
                break;
            }
        }
    }
    if (!pos) {
        pos = this.getRandomPosition();
    }
    return pos;
};

GameServer.prototype.getRandomColor = function() {
    var rand = Math.floor(Math.random() * 3);
    if (rand == 0)
        return {
            r: 255,
            b: Math.random() * 255,
            g: 0
        };
    else if (rand == 1)
        return {
            r: 0,
            b: 255,
            g: Math.random() * 255
        };
    else
        return {
            r: Math.random() * 255,
            b: 0,
            g: 255
        };
};

GameServer.prototype.getSizeFromMass = function(mass) {
    return Math.ceil((-8484.93574 + 8354.33821 * Math.pow(mass,0.01))/2);
};

GameServer.prototype.getSpeedFromMass = function(mass) {
    return Math.ceil((-5297.01638750265 + 5611.24781004064 * Math.pow(mass,-0.005))/10);
};

// node
GameServer.prototype.addNode = function(node) {
    this.nodes.push(node);

    node.onAdd(this);

    // add to visible nodes
    for (var i = 0; i < this.clients.length; i++) {
        client = this.clients[i].playerTracker;
        if (!client) {
            continue;
        }
        if (node.visibleCheck(client.viewBox, client.centerPos)) {
            client.nodeAdditionQueue.push(node);
        }
    }
};

GameServer.prototype.removeNode = function(node) {
    var index = this.nodes.indexOf(node);
    if (index != -1) {
        this.nodes.splice(index, 1);
    }
    index = this.movingNodes.indexOf(node);
    if (index != -1) {
        this.movingNodes.splice(index, 1);
    }
    node.onRemove(this);

    for (var i = 0; i < this.clients.length; i++) {
        client = this.clients[i].playerTracker;
        if (!client) {
            continue;
        }
        client.nodeDestroyQueue.push(node);
    }
};

// loop
GameServer.prototype.mainLoop = function() {
    var local = new Date();
    this.tick += (local - this.time);
    this.time = local;
    
    if (!this.run) return;

    if (this.tick >= 25) {
        this.fullTick++;
        setTimeout(this.updateMoveEngine.bind(this, this.fullTick >= 2), 0);

        if (this.fullTick >= 2) {
            setTimeout(this.spawnTick.bind(this), 0);
            setTimeout(this.updateCells.bind(this), 0);

            this.updateClients();

            this.fullTick = 0;
        }

        this.tick = 0;
    }
};

GameServer.prototype.spawnTick = function() {
    this.tickSpawn++;
    if (this.tickSpawn >= 20) {
        this.updateFood();
        this.updateVirus();
        
        this.tickSpawn = 0;
    }
};

GameServer.prototype.updateClients = function() {
    for (var i = 0; i < this.clients.length; i++) {
        if (typeof this.clients[i] == "undefined") {
            continue;
        }
        var playerTracker = this.clients[i].playerTracker;
        if (playerTracker.gaming) {
            playerTracker.update();
        }
    }
};

// food
GameServer.prototype.startingFood = function() {
    for (var i = 0; i < this.config.foodStartAmount; i++) {
        this.spawnFood();
    }
};

GameServer.prototype.updateFood = function() {
    var toSpawn = Math.min(this.config.foodSpawnAmount, 
            (this.config.foodMaxAmount - this.currentFood));
    for (var i = 0; i < toSpawn; i++) {
        this.spawnFood();
    }
};

GameServer.prototype.spawnFood = function() {
    var f = new Entity.Food(this.getNextNodeId(), null, 
            this.getRandomPosition(), this.config.foodMass, this);
    f.setColor(this.getRandomColor());

    //console.log("spawnFood:"+f.nodeId+" x:"+f.position.x+" y:"+f.position.y)
    this.addNode(f);
    this.currentFood++;
};

GameServer.prototype.spawnPlayer = function(player) {
    player.color = this.getRandomColor();

    var pos = this.getRandomSpawn();
    //pos.x=1000;
    //pos.y=1000;

    var mass = this.config.playerStartMass;

    var cell = new Entity.PlayerCell(this.getNextNodeId(), player, pos, mass, this);
    this.addNode(cell);

    player.mouse = {
        x: pos.x,
        y: pos.y
    };
};

GameServer.prototype.updateVirus = function() {
    if (this.nodesVirus.length < this.config.virusMinAmount) {
        var pos = this.getRandomPosition();
        var v = new Entity.Virus(this.getNextNodeId(), null, pos, 
                this.config.virusStartMass, this);
        this.addNode(v);
    }
};

GameServer.prototype.updateMoveEngine = function(moveCells) {

    // control by client
    var len = this.nodesPlayer.length;
    for (var i = 0; i < len; i++) {
        var cell = this.nodesPlayer[i];
        if (!cell) {
            continue;
        }
        var client = cell.owner;

        cell.calcMove(client.mouse.x, client.mouse.y, this, moveCells);

        var list = this.getCellsInRange(cell);
        for (var j = 0; j < list.length; j++) {
            var check = list[j];

            // nodesPlayer element fix i, len
            if (check.cellType == 0) {
                len--;
                if (check.nodeId < cell.nodeId) {
                    i--;
                }
            }

            check.onConsume(cell, this);
            check.setKiller(cell);
            this.removeNode(check);
        }
    }

    // uncontrol nodes
    len = this.movingNodes.length;
    for (var i = 0; i < len; i++) {
        var check = this.movingNodes[i];

        while ((typeof check == "undefined") && (i < this.movingNodes.length)) {
            this.movingNodes.splice(i, 1);
            check = this.movingNodes[i];
        }
        if (i >= this.movingNodes.length) {
            continue;
        }
        if (check.moveEngineTicks > 0) {
            check.onAutoMove(this);
            check.calcMovePhys(this.config);
        } else {
            check.moveDone(this);
            var index = this.movingNodes.indexOf(check);
            if (index != -1) {
                this.movingNodes.splice(index, 1);
            }
        }
    }

    len = this.nodesPlayer.length;
    for (var i = 0; i < len; i++) {
        var check = this.nodesPlayer[i];

        while ((typeof check == "undefined") && (i < this.nodesPlayer.length)) {
            this.nodesPlayer.splice(i, 1);
            check = this.nodesPlayer[i];
        }

        if (i >= this.nodesPlayer.length) {
            continue;
        }

        check.onAutoMove(this);
        check.calcMovePhys(this.config);
    }
};

GameServer.prototype.setAsMovingNode = function(node) {
    this.movingNodes.push(node);
};

GameServer.prototype.splitCells = function(client) {
    var len = client.cells.length;
    for (var i = 0; i < len; i++) {
        var cell = client.cells[i];
        if (client.cells.length < this.config.playerMaxCells &&
            cell.mass >= this.config.playerMinMassSplit) {
            var deltaY = client.mouse.y - cell.position.y;
            var deltaX = client.mouse.x - cell.position.x;
            var angle = Math.atan2(deltaX, deltaY);
            if (angle == 0) angle = cell.lastMoveAngle;
            this.createPlayerCell(client, cell, angle, cell.mass / 2);
        }
    }
};

GameServer.prototype.createPlayerCell = function(client, parent, angle, mass) {
    // todo just test formula
    var splitSpeed = 15 * this.getSpeedFromMass(mass);
    var newPos = {
        x: parent.position.x,
        y: parent.position.y
    }

    var newCell = new Entity.PlayerCell(this.getNextNodeId(), client, newPos, mass, this);
    newCell.setAngle(angle);
    newCell.setMoveEngineData(splitSpeed, 6, 0.70);
    newCell.calcMergeTime(this.config.playerRecombineTime);
    parent.mass -= mass; 

    this.addNode(newCell);
    return true;
};

GameServer.prototype.canEjectMass = function(client) {
    if (this.time - client.lastEject >= this.config.ejectMassCooldown) {
        client.lastEject = this.time;
        return true;
    } else
        return false;
};

GameServer.prototype.ejectMass = function(client) {
    if (!this.canEjectMass(client))
        return;
    for (var i = 0; i < client.cells.length; i++) {
        var cell = client.cells[i];

        if (!cell) {
            continue;
        }
        if (cell.mass < this.config.playerMinMassEject) {
            continue;
        }
        var deltaY = client.mouse.y - cell.position.y;
        var deltaX = client.mouse.x - cell.position.x;
        var angle = Math.atan2(deltaX, deltaY);
       
        var size = cell.getSize() + 0.5;
        var startPos = {
            x: cell.position.x + ((size + this.config.ejectMass) * Math.sin(angle)),
            y: cell.position.y + ((size + this.config.ejectMass) * Math.cos(angle))
        };

        cell.mass -= this.config.ejectMass;
 
        var ejected = new Entity.EjectedMass(this.getNextNodeId(), 
                client, startPos, this.config.ejectMass, this);
        ejected.setAngle(angle);
        ejected.setMoveEngineData(this.config.ejectSpeed, 20, 0.85);
        ejected.setColor(cell.getColor());

        this.nodesEjected.push(ejected);
        this.addNode(ejected);
        this.setAsMovingNode(ejected);
    }
};

GameServer.prototype.shootVirus = function(parent) {
    var parentPos = {
        x: parent.position.x,
        y: parent.position.y,
    };

    var newVirus = new Entity.Virus(this.getNextNodeId(), null, parentPos, 
            this.config.virusStartMass, this);
    newVirus.setAngle(parent.getAngle());
    newVirus.setMoveEngineData(135, 20, 0.85);

    this.addNode(newVirus);
    this.setAsMovingNode(newVirus);
};

GameServer.prototype.getCellsInRange = function(cell) {
    var list = new Array();
    var squareR = cell.getSquareSize(); 

    var len = cell.owner.visibleNodes.length;
    for (var i = 0; i < len; i++) {
        var check = cell.owner.visibleNodes[i];
        if (typeof check === 'undefined') {
            continue;
        }
        if (check.inRange) {
            continue;
        }
        if (cell.nodeId == check.nodeId) {
            continue;
        }
        if (!check.collisionCheck2(squareR, cell.position)) {
            continue;
        }
        var multiplier = 1.0;
        if (check.getType() == 0) {
            if (check.owner == cell.owner) { // recombine check
                if (!cell.shouldRecombine || !check.shouldRecombine) {
                    continue;
                }
            } else {
                multiplier = 1.25;
            }
        } else if (check.getType() == 2) {
            multiplier = 1.33;
        }

        if ((check.getSize() * multiplier) > cell.getSize()) {
            continue;
        }
        var ctype = check.getType();
        var xs = Math.pow(check.position.x - cell.position.x, 2);
        var ys = Math.pow(check.position.y - cell.position.y, 2);
        var dist = Math.sqrt(xs + ys);
        var eatingRange
        if (check.getType() == 1)
            eatingRange = cell.getSize()-check.getSize()
        else 
            eatingRange = cell.getSize()-(check.getSize()*0.8)
        if (dist <= eatingRange) {
            list.push(check);
            check.inRange = true;
            // recombine only one by one time
            if (check.owner == cell.owner) {
                var cells = cell.owner.cells
                if (cells.length > 2) {
                    for (var i = 0; i < cells.length; i++) {
                        var c = cells[i];
                        if (c != check) {
                            c.shouldRecombine = false;
                            c.recombineTicks = 0;
                        }
                    }
                }
            }
        } 
    }
    return list;
};

GameServer.prototype.getNearestVirus = function(cell) {
    var virus = null;
    var r = 100; 

    var topY = cell.position.y - r;
    var bottomY = cell.position.y + r;

    var leftX = cell.position.x - r;
    var rightX = cell.position.x + r;

    var len = this.nodesVirus.length;
    for (var i = 0; i < len; i++) {
        var check = this.nodesVirus[i];
        if (typeof check === 'undefined') {
            continue;
        }
        if (!check.collisionCheck(bottomY, topY, rightX, leftX)) {
            continue;
        }
        virus = check;
        break; 
    }
    return virus;
};

GameServer.prototype.updateCells = function() {
    for (var i = 0; i < this.nodesPlayer.length; i++) {
        var cell = this.nodesPlayer[i];
        if (!cell) {
            continue;
        }

        // recombine
        if (cell.owner.cells.length > 1) {
            cell.recombineTicks += 0.05;
            cell.calcMergeTime(this.config.playerRecombineTime);
        } else if (cell.owner.cells.length == 1 && cell.recombineTicks > 0) {
            cell.recombineTicks = 0;
            cell.shouldRecombine = false;
        }

        // mass decay
        if (cell.mass >= this.config.playerMinMassDecay) {
            var massDecay = 1 - (this.config.playerMassDecayRate * 0.05);
            cell.mass *= massDecay;
        }
    }
};

GameServer.prototype.loadConfig = function() {
    try {
        var load = ini.parse(fs.readFileSync('./gameserver.ini', 'utf-8'));
        for (var obj in load) {
            this.config[obj] = load[obj];
        }
    } catch (err) {
        console.log("Create new config");
        fs.writeFileSync('./gameserver.ini', ini.stringify(this.config));
    }
};

WebSocket.prototype.sendPacket = function(packet) {
    function getBuf(data) {
        var array = new Uint8Array(data.buffer || data);
        var l = data.byteLength || data.length;
        var o = data.byteOffset || 0;
        var buffer = new Buffer(l);
        for (var i = 0; i < l; i++) {
            buffer[i] = array[o + i];
        }
        return buffer;
    }

    if (this.readyState == WebSocket.OPEN && packet.build) {
        var buf = packet.build();
        this.send(getBuf(buf), {
            binary: true
        });
    } else if (!packet.build) {
        // 
    } else {
        this.readyState = WebSocket.CLOSED;
        this.emit('close');
        this.removeAllListeners();
    }
};
