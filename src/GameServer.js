var WebSocket = require('ws');
var redis = require ("redis");

var config = require('../config');
var Ctx = require('./Ctx')
var HallHandler = require('./HallHandler');
var PacketHandler = require('./PacketHandler');
var Room = require('./Room');

function GameServer() {
    this.loginPlayers = [];
    this.clients = [];
    this.rooms = [];
}

module.exports = GameServer;

GameServer.prototype.start = function() {
    var hallHost = config.hallHost;
    var serverId = config.serverId;
    var serverIp = config.serverIp;
    var serverPort = config.serverPort;
    var gamesvr = this;

    var rdPort = config.redisPort;
    var rdHost = config.redisHost;
    var rdPasswd = config.redisPasswd;

    function connectRedis() {
        console.log("Redis connect ... "+rdHost+":"+rdPort) 
        var rd = redis.createClient(rdPort, rdHost);
        rd.on("error", function(err) {
            console.log("Redis error: "+err);
        });
        rd.on("connect", function(err) {
            console.log("Redis connect ok: "+rdHost+":"+rdPort);
            rd.auth(rdPasswd, function(err, res) {
                if (err) {
                    console.log("Redis auth fail: "+err);
                } else {
                    console.log("Redis auth: "+res);
                }
            });
            Ctx.redis = rd;
        });
    }
    function connectHall() {
        console.log("Hall connect ... "+hallHost) 
        var ws = new WebSocket('ws://'+hallHost);
        Ctx.nodeServer = ws;
        ws.onopen = function(e) {
            console.log("Hall connect ok: "+hallHost);
            ws.sendJson(1, {
                    serverid: serverId,
                    serverip: serverIp,
                    serverport: serverPort,
                });
            // sync rooms
            var rooms = gamesvr.rooms;
            for (var i=0; i<rooms.length; ++i) {
                var r = rooms[i];
                r.onHallConnect(ws);
            }
        }
        ws.onclose = function(e) {
            console.log("Hall disconnect");
            Ctx.nodeServer = null;
            setTimeout(connectHall, 1000);
        }
        ws.onerror = function(e) {
            console.log("Hall connection error: "+e.code);
            setTimeout(connectHall, 1000);
        }
        var hallHandler = new HallHandler(gamesvr, ws)
        ws.onmessage = function(e) {
            hallHandler.handleMessage(e.data)
        }
    }
   
    connectRedis();
    connectHall();

    this.socketServer = new WebSocket.Server({
        port: config.serverPort,
        perMessageDeflate: false
    }, function() {

        setInterval(this.mainLoop.bind(this), 1);

        console.log("Listening on port " + config.serverPort);
    
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
        console.log("Conn: "+ws._socket.remoteAddress);
        if (this.clients.length >= config.serverMaxConnections) { 
            console.log("[Warn] Connection is full:" + this.clients.length);
            ws.close();
            return;
        }
        function close(error) {
            console.log("Conn close: "+ this.socket._socket.remoteAddress+" "+error);
            gamesvr.logoutClient(this);
        }

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

// login
GameServer.prototype.loginClient = function(ws, roleid, key, nick, icon) {
    // check has in loginPlayers, todo check has enter state
    var info = this.loginPlayers[roleid];
    if (!info || 
        info.key != key) {
        console.log("Invalid player enter: "+roleid+","+key);
        info = null;
    }
    if (ws.playerTracker) { // has call Room joinClient
        return;
    }
    var mode = 0;
    if (info) {
        mode = info.mode;
    }    
    var room = this.findRoom(mode);
    room.joinClient(ws, info, nick, icon);
}

GameServer.prototype.findRoom = function(mode) {
    var rooms = this.rooms;
    for (var i=0; i<rooms.length; ++i) {
        var r = rooms[i];
        if (r.mode == mode) {
            if (r.clients.length < config.maxMember) {
                return r;
            }
        }
    }
    var r = new Room(mode);
    rooms.push(r);
    return r;
};

GameServer.prototype.logoutClient = function(ws) {
    var player = ws.playerTracker;
    if (player) {
        player.room.unjoinClient(ws);
    }
    var index = this.clients.indexOf(ws);
    if (index != -1) {
        this.clients.splice(index, 1);
    }
}

// loop
GameServer.prototype.mainLoop = function() {
    var now = new Date().getTime();
    var rooms = this.rooms;
    for (var i=0; i<rooms.length; ) {
        var r = rooms[i];
        r.update(now);
        
        if (!r.run) {
            var clients = r.clients;
            for (var j=0; j<client.length; ++j) {
                var c = clients[j];

                var index = this.clients.indexOf(c);
                if (index != -1) {
                    this.clients.splice(index, 1);
                }

                var roleid = c.playerTracker.info.roleid;
                if (roleid > 0) {
                    delete this.loginPlayers[roleid];
                }
            }
            rooms.splice(i,1);
        } else {
            i++;
        }
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

WebSocket.prototype.sendJson = function(msgid, v) {
    this.send(JSON.stringify({id: msgid, body: v}))
}
