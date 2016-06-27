var Packet = require('./packet');
var GameServer = require('./GameServer');
var SocketNone = require('./SocketNone');
var config = require('../config');

function PlayerTracker(room, socket) {
    this.info = {
        mode: 0,
        life: 0,
        roleid: 0,
        sex:0,
        icon:0,
        province: 0,
        city: 0,
        heroid:0,
        herolevel:0,
        guanghuan:0,
        baozi:0,
        canying:0,
        huahuan:0,
        name: "",
    };
    this.eat = 0;
    this.copper = 0;
    this.exp = 0;

    this.wait_rebirth = false;
    this.offline = false;
    this.room = room;
    this.live = 0;
    this.lasttime = new Date();
    this.name = "";
    this.icon = 0;
    this.score = 0;
    this.rank = 0;
    this.socket = socket;
    this.nodeAdditionQueue = [];
    this.nodeDestroyQueue = [];
    this.visibleNodes = [];
    this.cells = [];
    this.mouse = {
        x: 0,
        y: 0
    };
    this.movedir = {
        x: 0,
        y: 0
    };
    this.tick = 0;

    this.sightRangeX = 0;
    this.sightRangeY = 0;
    this.viewBox = {
        topY: 0,
        bottomY: 0,
        leftX: 0,
        rightX: 0,
        width: 0, 
        height: 0
    };

    this.centerPos = { 
        x: (config.borderLeft - config.borderRight) / 2,
        y: (config.borderTop - config.borderBottom) / 2
    };
    this.lastEject = 0;    

    this.pressEjectMass = false;
    this.pressSplitCell = false;
}

module.exports = PlayerTracker;

PlayerTracker.prototype.startLive = function() {
    this.lasttime = new Date();
}
PlayerTracker.prototype.calcLive = function() {
    this.live += new Date() - this.lasttime;
}
PlayerTracker.prototype.setName = function(name) {
    this.name = name;
};

PlayerTracker.prototype.getName = function() {
    return this.name;
};
PlayerTracker.prototype.getAcc = function() {
    return this.info.name;
}
PlayerTracker.prototype.calcScore = function() {
    var s = 0;
    for (var i = 0; i < this.cells.length; i++) {
        s += this.cells[i].mass;
    }
    this.score = s
};

PlayerTracker.prototype.setColor = function(color) {
    this.color.r = color.r;
    this.color.b = color.b;
    this.color.g = color.g;
};

PlayerTracker.prototype.isdeath = function() {
    //return true;
    return this.info.mode == 1 && this.info.life <= 0;
}
PlayerTracker.prototype.update = function() {
    // update by 50ms
    if (this.isdeath()) {
        return;
    }
    // rebirth
    if (this.cells.length == 0) {
        if (this.info.life > 0) {
            this.info.life = this.info.life - 1;
            console.log("UpdateLife:"+this.info.life);
            this.socket.sendPacket(new Packet.UpdateLife(this.info.life));
            if (this.isdeath()) {
                return;
            }
        }
        this.room.spawnPlayer(this);
        this.calcLive();
        this.startLive();
    }
   
    if (!this.offline) {
        // split cell
        if (this.pressSplitCell) {
            this.room.splitCells(this);
            this.pressSplitCell = false;
        }

        // eject mass
        if (this.pressEjectMass) {
            this.room.ejectMass(this);
            this.pressEjectMass = false;
        }
     
        // sync destroy node
        var i = 0;
        while (i < this.nodeDestroyQueue.length) {
            var index = this.visibleNodes.indexOf(this.nodeDestroyQueue[i]);
            if (index > -1) {
                this.visibleNodes.splice(index, 1);
                i++;
            } else {
                this.nodeDestroyQueue.splice(i, 1);
            }
        }


        // sync non visible node && update node
        var nonVisibleNodes = []; 
        var updateNodes = []; 

        if (this.tick%3==0) {
            var newVisible = this.calcViewBox();
            try { 
                for (var i = 0; i < this.visibleNodes.length; i++) {
                    var index = newVisible.indexOf(this.visibleNodes[i]);
                    if (index == -1) {
                        nonVisibleNodes.push(this.visibleNodes[i]);
                    }
                }
                for (var i = 0; i < newVisible.length; i++) {
                    var index = this.visibleNodes.indexOf(newVisible[i]);
                    if (index == -1) {
                        updateNodes.push(newVisible[i]);
                    }
                }
            } finally {} 

            this.visibleNodes = newVisible;
        } else {
            for (var i = 0; i < this.nodeAdditionQueue.length; i++) {
                var node = this.nodeAdditionQueue[i];
                this.visibleNodes.push(node);
                updateNodes.push(node);
            }
        }

        for (var i = 0; i < this.visibleNodes.length; i++) {
            var node = this.visibleNodes[i];
            if (node.sendUpdate()) {
                updateNodes.push(node);
            }
        }

        // to client
        if (this.nodeDestroyQueue.length > 0 || 
            updateNodes.length > 0 ||
            nonVisibleNodes.length > 0) {
            this.socket.sendPacket(new Packet.UpdateNodes(
                this.nodeDestroyQueue,
                updateNodes,
                nonVisibleNodes
            ));
        } else {
            console.log("None UpdateNodes");
        }

        this.nodeDestroyQueue = [];
        this.nodeAdditionQueue = []; 

        // rank
        if (this.tick%10 == 0) {
            var pack = this.room.rankpacket;
            if(pack) {
                this.socket.sendPacket(pack);
            }
        }

        //
    }
    this.tick += 1;
};

PlayerTracker.prototype.updateSightRange = function() {
    var totalSize = 1.0;
    var len = this.cells.length;

    for (var i = 0; i < len; i++) {
        if (!this.cells[i]) {
            continue;
        }
        totalSize += this.cells[i].getSize();
    }
    // todo just test
    var factor = Math.pow(Math.min(64.0 / totalSize, 1), 0.4);
    this.sightRangeX = config.serverViewBaseX / factor;
    this.sightRangeY = config.serverViewBaseY / factor;
};

PlayerTracker.prototype.updateCenter = function() { 
    var len = this.cells.length;
    if (len <= 0) return;
    var X = 0;
    var Y = 0;
    for (var i = 0; i < len; i++) {
        if (!this.cells[i]) {
            continue;
        }
        X += this.cells[i].position.x;
        Y += this.cells[i].position.y;
    }
    this.centerPos.x = X / len;
    this.centerPos.y = Y / len;
};

PlayerTracker.prototype.calcViewBox = function() {
    this.updateSightRange();
    this.updateCenter();

    this.viewBox.topY = this.centerPos.y - this.sightRangeY;
    this.viewBox.bottomY = this.centerPos.y + this.sightRangeY;
    this.viewBox.leftX = this.centerPos.x - this.sightRangeX;
    this.viewBox.rightX = this.centerPos.x + this.sightRangeX;
    this.viewBox.width = this.sightRangeX;
    this.viewBox.height = this.sightRangeY;

    return this.calcVisibleNodes();
};

PlayerTracker.prototype.calcVisibleNodes = function() {
    var newVisible = [];
    for (var i = 0; i < this.room.nodes.length; i++) {
        node = this.room.nodes[i];
        if (!node)
            continue;
        if (node.owner == this ||
            node.visibleCheck(this.viewBox, this.centerPos)) {
            newVisible.push(node);
        }
    }
    return newVisible;
};

PlayerTracker.prototype.socketUnattach = function() {
    this.socket = new SocketNone();
    this.offline = true;
    this.wait_rebirth = false;
    this.visibleNodes = [];
};

PlayerTracker.prototype.socketAttach = function(ws) {
    this.socket = ws;
    this.offline = false;
    this.wait_rebirth = false;
//    this.visibleNodes = [];
    
    var cells = this.cells;
    for (var i=0; i<cells.length; ++i) {
        var c = cells[i];
        console.log('sendAddNode');
        ws.sendPacket(new Packet.AddNode(c));
    }
};

PlayerTracker.prototype.canop = function(ws) {
    return !this.wait_rebirth;
}
