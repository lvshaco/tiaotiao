function HallHandler(gameServer, socket) {
    this.gameServer = gameServer;
    this.socket = socket;
}

module.exports = HallHandler;

HallHandler.prototype.handleMessage = function(data) {
    console.log("Hall msg: "+data);
    var msg = JSON.parse(data);
    var body = msg.body
    switch (msg.id) {
    case 1:
        if (body.code != 0) {
            console.log("register fail: "+body.code);
            process.exit(1); 
        }
        break;
    case 10:
        var players = this.gameServer.loginPlayers;
        var roleid = body.roleid;
        var old = players[roleid];
        if (old) {
            old.reenter = body.reenter;
            body = old;
            code = 1;
        } else if (body.reenter) {
            code = 2;
        } else {
            body.roomid = 0;
            players[roleid] = body;
            code = 0;
        }
        this.socket.sendJson(10, {code:code, key:body.key});
    default:
        break;
    }
}
