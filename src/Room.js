var config = require('../config');
var lutil = require('./lutil');
var Ctx = require('./Ctx');
var Packet = require('./packet');
var PlayerTracker = require('./PlayerTracker');
var Entity = require('./entity');

var ROOMID = 1;

function Room(mode, gamesvr) {
    this.run = true;
    this.mode = mode; // 0: free mode; 1: live mode
    this.roomid = ROOMID;
    ROOMID++;

    this.clients = {};
    this.nclient = 0;
    this.nodes = [];
    this.nodesVirus = []; 
    this.nodesEjected = [];
    this.nodesPlayer = [];

    this.currentFood = 0;
    this.movingNodes = [];

    this.recommend = {};
    this.rankpacket;

    var now = new Date().getTime();
    this.now = now;
    this.tick = 0;
    this.fullTick = 0;
    this.starttime = now;

    this.gamesvr = gamesvr;

    this.startingFood();

    console.log("Room Start: "+this.roomid+" "+this.mode);
}

module.exports = Room;

Room.prototype.onHallConnect = function(ws) {
    var rolelist = [];
    var clients = this.clients;
    for (var roleid in clients) {
        var c = clients[roleid];
        if (c.info.roleid > 0) {
            rolelist.push(c.info.roleid);
        }
    }
    if (rolelist.length>0) {
        console.log("send SyncState")
        ws.sendJson(2, rolelist);
    }
}

Room.prototype.isFull = function() {
    return this.nclients >= config.maxMember;
}

Room.prototype.foreachClient = function(func) {
    var clients = this.clients;
    for (var roleid in clients) {
        var c = clients[roleid];
        func(c);
    }
}
Room.prototype.joinClient = function(ws, info, nick, icon) {
    var roleid = info.roleid;
    var player = this.clients[roleid];
    if (!player) {
        player = new PlayerTracker(this, ws);
        ws.playerTracker = player;
        player.info = info
        player.setName(nick);
        player.icon = icon;

        this.clients[roleid] = player;
        this.nclient ++; 
        this.spawnPlayer(player);
        player.startLive();
    } else {
        player.socketAttach(ws);
    }
    console.log("Room joinClient: "+this.roomid+
            " roleid:"+roleid+" key:"+info.key+" reenter:"+info.reenter);
    var now = new Date().getTime();
    var starttime = this.starttime;
    var elapsed = now-starttime;
    ws.sendPacket(new Packet.SetBorder(
        config.borderLeft, 
        config.borderRight,
        config.borderTop,
        config.borderBottom,
        config.gameTime-elapsed,
        player.info.life
    ));
}

Room.prototype.unjoinPlayer = function(player) {
    var ws = player.socket;
    ws.playerTracker = null;
    var roleid = player.info.roleid;
    player = this.clients[roleid];
    if (!player) {
        return 1;
    }
    console.log("Room unjoinPlayer: "+this.roomid+" roleid:"+roleid);
    // remove cells, removeNode will call PlayerCell::onRemove, will splice cells array
    var cells = player.cells;
    while (cells.length > 0) {
        var c = cells.splice(0, 1);
        this.removeNode(c[0]);
    }
    delete this.clients[roleid];
    this.nclient--;

    player.mode = 0;
    player.room = null;
    return 0;
}

Room.prototype.afkClient = function(ws) {
    var player = ws.playerTracker;
    if (!player) {
        return;
    }
    ws.playerTracker = null;
    var roleid = player.info.roleid;
    player = this.clients[roleid];
    if (!player) {
        return 1;
    }
    console.log("Room afkClient: "+this.roomid+" roleid:"+roleid);
    player.socketUnattach();
}

Room.prototype.addNode = function(node) {
    this.nodes.push(node);

    node.onAdd(this);

    // add to visible nodes
    var clients = this.clients;
    for (var roleid in clients) {
        var client = clients[roleid];
        if (node.visibleCheck(client.viewBox, client.centerPos)) {
            if (!client.offline)
                client.nodeAdditionQueue.push(node);
        }
    }
};

Room.prototype.removeNode = function(node) {
    var index = this.nodes.indexOf(node);
    if (index != -1) {
        this.nodes.splice(index, 1);
    }
    index = this.movingNodes.indexOf(node);
    if (index != -1) {
        this.movingNodes.splice(index, 1);
    }
    node.onRemove(this);

    var clients = this.clients;
    for (var roleid in clients) {
        var client = clients[roleid];
        if (!client.offline)
            client.nodeDestroyQueue.push(node);
    }
};

Room.prototype.spawnPlayer = function(player) {
    player.color = lutil.getRandomColor();

    var pos = this.getRandomSpawn();
    //pos.x=1000;
    //pos.y=1000;

    var mass = config.playerStartMass;

    var cell = new Entity.PlayerCell(lutil.getNextNodeId(), player, pos, mass);
    this.addNode(cell);

    player.mouse = {
        x: pos.x,
        y: pos.y
    };
};

Room.prototype.getRandomSpawn = function() {
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
        pos = lutil.getRandomPosition(50); // just simple
    }
    return pos;
};

// food
Room.prototype.startingFood = function() {
    for (var i = 0; i < config.foodStartAmount; i++) {
        this.spawnFood();
    }
};

Room.prototype.updateFood = function() {
    var toSpawn = Math.min(config.foodSpawnAmount, 
            (config.foodMaxAmount - this.currentFood));
    for (var i = 0; i < toSpawn; i++) {
        this.spawnFood();
    }
};

Room.prototype.spawnFood = function() {
    var f = new Entity.Food(lutil.getNextNodeId(), null, 
            lutil.getRandomPosition(10), config.foodMass);
    f.setColor(lutil.getRandomColor());

    //console.log("spawnFood:"+f.nodeId+" x:"+f.position.x+" y:"+f.position.y)
    this.addNode(f);
    this.currentFood++;
};

// virus
Room.prototype.getNearestVirus = function(cell) {
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

Room.prototype.updateVirus = function() {
    if (this.nodesVirus.length < config.virusMinAmount) {
        var mass = config.virusStartMass;
        var pos = lutil.getRandomPosition(lutil.getSizeFromMass(mass));
        var v = new Entity.Virus(lutil.getNextNodeId(), null, pos, mass);
        this.addNode(v);
    }
};

// moving node
Room.prototype.setAsMovingNode = function(node) {
    this.movingNodes.push(node);
};

// cells
Room.prototype.createPlayerCell = function(client, parent, angle, mass) {
    // todo just test formula
    //var splitSpeed = 15 * lutil.getSpeedFromMass(mass);
    var splitSpeed = 2 * lutil.getSizeFromMass(mass)+500;
    var startSpeed = 0;
    var xisum = 0;

    for (var i = 0; i < 8; i++) {
        xisum += Math.pow(0.5,i);
    };
    startSpeed = splitSpeed/xisum;
    var newPos = {
        x: parent.position.x,
        y: parent.position.y
    }

    var newCell = new Entity.PlayerCell(lutil.getNextNodeId(), client, newPos, mass);
    newCell.setAngle(angle);
    newCell.setMoveEngineData(startSpeed, 8, 0.5);
    newCell.calcMergeTime(config.playerRecombineTime);
    parent.mass -= mass; 
    parent.setMoveEngineData(0, 8, 0.5);
    this.addNode(newCell);
    return true;
};

Room.prototype.splitCells = function(client) {
    var len = client.cells.length;
    for (var i = 0; i < len; i++) {
        var cell = client.cells[i];
        if (client.cells.length < config.playerMaxCells &&
            cell.mass >= config.playerMinMassSplit) {
            var deltaY = client.mouse.y - cell.position.y;
            var deltaX = client.mouse.x - cell.position.x;
            var angle = Math.atan2(deltaX, deltaY);
            //var angle = Math.atan2(client.movedir.x, client.movedir.y);
            if (angle == 0) angle = cell.lastMoveAngle;
            this.createPlayerCell(client, cell, angle, cell.mass / 2);
        }
    }
};

Room.prototype.canEjectMass = function(client) {
    if (this.now - client.lastEject >= config.ejectMassCooldown) {
        client.lastEject = this.now;
        return true;
    } else
        return false;
};

Room.prototype.ejectMass = function(client) {
    if (!this.canEjectMass(client))
        return;
    for (var i = 0; i < client.cells.length; i++) {
        var cell = client.cells[i];

        if (!cell) {
            continue;
        }
        if (cell.mass < config.playerMinMassEject) {
            continue;
        }
        var deltaY = client.mouse.y - cell.position.y;
        var deltaX = client.mouse.x - cell.position.x;
        var angle = Math.atan2(deltaX, deltaY);
       
        //var size = cell.getSize();
        //var startPos = {
            //x: cell.position.x + ((size + config.ejectMass) * Math.sin(angle)),
            //y: cell.position.y + ((size + config.ejectMass) * Math.cos(angle))
        //};


        cell.mass -= config.ejectMass;

        var size = lutil.getSizeFromMass(cell.mass);
        var startPos = {
            x: cell.position.x + (size * Math.sin(angle)),
            y: cell.position.y + (size * Math.cos(angle))
        };
        
        var xisum = 0;

        for (var j = 0; j < 8; j++) {
            xisum += Math.pow(0.5,j);
        };
         var startSpeed = 300/xisum;

        var ejected = new Entity.EjectedMass(lutil.getNextNodeId(), 
                client, startPos, config.ejectMass);
        ejected.setAngle(angle);
        //ejected.setMoveEngineData(config.ejectSpeed, 20, 0.85);
        ejected.setMoveEngineData(startSpeed, 8, 0.5);
        ejected.setColor(cell.getColor());

        this.nodesEjected.push(ejected);
        this.addNode(ejected);
        this.setAsMovingNode(ejected);
    }
};

Room.prototype.shootVirus = function(parent) {
    var parentPos = {
        x: parent.position.x,
        y: parent.position.y,
    };

    var startSpeed = 0;
    var xisum = 0;
       
    for (var i = 0; i < 20; i++) {
        xisum += Math.pow(0.85,i);
    };
    startSpeed = 180/xisum;

    var mass = parent.mass/2;
    var newVirus = new Entity.Virus(lutil.getNextNodeId(), null, parentPos, 
            mass);
    parent.mass -= mass;
    newVirus.setAngle(parent.getAngle());
    newVirus.setMoveEngineData(startSpeed, 20, 0.85);

    this.addNode(newVirus);
    this.setAsMovingNode(newVirus);
};

Room.prototype.getCellsInRange = function(cell) {
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
            if (!check.owner.canop()) {
                continue;
            }
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

        var p2p = (check.getType()==0 && cell.getType()==0);

        if (!p2p) {
            //if ((check.getSize() * multiplier) > cell.getSize()) {
            if ((check.mass * multiplier) > cell.mass) {
                continue;
            }
        }
        var ctype = check.getType();
        var xs = Math.pow(check.position.x - cell.position.x, 2);
        var ys = Math.pow(check.position.y - cell.position.y, 2);
        var dist = Math.sqrt(xs + ys);
        var eatingRange
        if (check.getType() == 1)
            eatingRange = cell.getSize()-check.getSize()
        else 
            eatingRange = cell.getSize()-(check.getSize()*0.7)
        if (dist > eatingRange) {
            continue;
        }
        if (p2p) {
            //var me_small = (check.getSize() * multiplier) > cell.getSize();
            //var other_small = (cell.getSize() * multiplier) > check.getSize();
            var me_small = (check.mass * multiplier) > cell.mass;
            var other_small = (cell.mass * multiplier) > check.mass;
            if (me_small) {
                if (other_small) {
                    var player = cell.owner;
                    var other = check.owner;
                    if (player && other) {
                        var myid = player.info.roleid;
                        var opid = other.info.roleid;
                        if (myid > 0 && opid > 0) {
                            this.addRecommend(myid, opid, 2, 0);
                            this.addRecommend(opid, myid, 2, 0);
                        }
                    }
                }
                continue;
            }
        }
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
    return list;
};
// update
Room.prototype.updateMoveEngine = function(moveCells) {
    // 50ms
    // control by client
    var len = this.nodesPlayer.length;
    for (var i = 0; i < len; i++) {
        var cell = this.nodesPlayer[i];
        if (!cell) {
            continue;
        }
        var client = cell.owner;
        if (!client.canop())  {
            continue;
        }
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
            check.calcMovePhys(config);
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
        if (check.moveEngineTicks > 0)
        {
            check.onAutoMove(this);
            check.calcMovePhys(config);
        }else{
            check.collision(this);
        }
    }
};

Room.prototype.updateClients = function() {
    var clients = this.clients;
    for (var roleid in clients) {
        var client = clients[roleid];
        client.update();
    }
};


Room.prototype.updateCells = function() {
    for (var i = 0; i < this.nodesPlayer.length; i++) {
        var cell = this.nodesPlayer[i];
        if (!cell) {
            continue;
        }

        // recombine
        if (cell.owner.cells.length > 1) {
            //cell.recombineTicks += 0.05;
            cell.comTickTime();
            cell.calcMergeTime(config.playerRecombineTime);
        } else if (cell.owner.cells.length == 1 && cell.recombineTicks > 0) {
            cell.recombineTicks = 0;
            cell.shouldRecombine = false;
        }

        // mass decay
        if (cell.mass >= config.playerMinMassDecay) {
            var massDecay = 1 - (config.playerMassDecayRate * 0.05);
            cell.mass *= massDecay;
        }
    }
};

Room.prototype.update = function(now) {
    if (!this.run) return 1; // room can be clear

    if (now - this.starttime >= config.gameTime) {
        this.gameOver();
        this.run = false;

        console.log("Room Over: "+this.roomid+" "+this.mode);
        return;
    }

    this.tick += (now - this.now);
    this.now = now;
    if (this.tick < 25) {
        return;
    }
    this.tick = 0;
    this.fullTick++;

    this.updateMoveEngine(this.fullTick%2==0);

    if (this.fullTick%20==0) {
        this.updateFood();
        this.updateVirus();
    }

    if ((this.fullTick%2)==0) {
        this.updateCells();
        this.updateClients();
    }

    if ((this.fullTick%8)==0) {
        this.updateRank(); 
    }
    if (this.fullTick%40 == 0) { // per second
        console.log("tick");

        var temp = [];
        var clients = this.clients;
        for (var roleid in clients) {
            var c = clients[roleid];
            if (c.isdeath()) {
                temp.push(c);
            }
        }
        for (var i=0; i<temp.length; ++i) {
            var c = temp[i];
            this.gamesvr.logoutPlayer(c);
        }
    }
}
// update rank
Room.prototype.updateRank = function() {
    var ranks = [];
    var clients = this.clients;
    for (var roleid in clients) {
        var c = clients[roleid];
        c.calcScore();
        ranks.push(c);
    }
    ranks.sort(function(a,b) {
        return b.score - a.score;
    });
    var maxRank = config.maxRank || 100;
    if (maxRank > ranks.length)
        maxRank = ranks.length;
    this.rankpacket = new Packet.UpdateRank(ranks, maxRank);
    //ranks = ranks.slice(0, maxRank);
    return {ranks:ranks, currank:maxRank}
}

function rollbox(rank, v) {
  var box1 = false;
  var box2 = false;
  if (rank==1) {
    box1=Math.random() < 0.5;
    box2=Math.random() < 0.1;
  } else if (rank==2) {
    box1=Math.random() < 0.4;
    box2=Math.random() < 0.05;
  } else if (rank>=3 && rank<=5) {
    box1=Math.random() < 0.3;
    box2=Math.random() < 0.025;
  } else if (rank>=6 && rank<=10) {
    box1=Math.random() < 0.2;
  } else if (rank>=11 && rank<=15) {
    box1=Math.random() < 0.1;
  } 
  v.box1 = box1 ? 1:0;
  v.box2 = box2 ? 1:0;
}
Room.prototype.gameOver = function() {
    var r = this.updateRank();
    var ranks = r.ranks;
    var curRank = r.currank;

    var maxRank = config.maxRank || 100;

    for (var i=0; i<curRank; ++i) {
        var c = ranks[i];
        c.rank = i+1;
    }
    for (var i=curRank; i<ranks.length; ++i) {
        var c = ranks[i];
        c.rank = 0;
    }
    var roles = [];
    var clients = this.clients;
    for (var roleid in clients) {
        var c = clients[roleid];
        c.copper = 10;
        c.exp = 160*2;
        if (c.rank != 0) {
            c.exp += (maxRank-c.rank)*3;
        }
        c.calcLive();
        var one = {
            name: c.name,
            rank: c.rank,
            roleid: c.info.roleid,
            copper: c.copper,
            exp: c.exp,
            eat: c.eat,
            mass: c.score, // = score
            //time: c.time,
            live: Math.floor(c.live/1000),
        };
        rollbox(c.rank, one);
        roles.push(one);
    }
    if (Ctx.nodeServer) {
        console.log("send FightResult");
        Ctx.nodeServer.sendJson(11, {roles:roles});
    }
    for (var roleid in clients) {
        var c = clients[roleid];
        var pack = new Packet.GameOver(c, ranks, this);
        c.socket.sendPacket(pack);
        c.socket.close();
    }
}

Room.prototype.addRecommend = function(myid, otherid, type, value) {
    var t = this.recommend[myid];
    if (!t) {
        t = {};
        this.recommend[myid] = t;
    }
    var v = t[otherid];
    if (!v) {
        v = {type:type, value:value};
        t[otherid] = v;
    } else {
        if (v.type > type) {
            v.type = type
        }
        v.value += value
    }
}

Room.prototype.getRecommend = function(myid, otherid) {
    var t = this.recommend[myid];
    if (t) {
        var v = t[otherid];
        if (v) {
            if (v.type == 4 && v.value>=2) {
                return 3;
            }
            return v.type;
        }
    }
    return 0;
}

Room.prototype.findPlayer = function(roleid) {
    return this.clients[roleid];
}
