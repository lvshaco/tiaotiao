var Packet = require('./packet');

function PacketHandler(gameServer, socket) {
    this.gameServer = gameServer;
    this.socket = socket;
    this.protocol = 0; // reserve

    this.pressEjectMass = false;
    this.pressSplitCell = false;
}

module.exports = PacketHandler;

PacketHandler.prototype.handleMessage = function(message) {
    function stobuf(buf) {
        var length = buf.length;
        var arrayBuf = new ArrayBuffer(length);
        var view = new Uint8Array(arrayBuf);

        for (var i = 0; i < length; i++) {
            view[i] = buf[i];
        }

        return view.buffer;
    }

    if (message.length == 0) {
        console.log("================= skip message len=0");
        return;
    }

    var buffer = stobuf(message);
    var view = new DataView(buffer);
    var packetId = view.getUint8(0, true);

    //console.log("handleMessage:"+packetId+ " len:"+view.byteLength);

    switch (packetId) {
        case 16:
            // Set Target
            //if (view.byteLength == 13) {
            if (view.byteLength >= 9) {
                var client = this.socket.playerTracker;
                client.mouse.x = view.getInt32(1, true);
                client.mouse.y = view.getInt32(5, true);

                client.movedir.x = view.getInt32(9, true)/100;
                client.movedir.y = view.getInt32(13, true)/100;
                //console.log(" mouse:"+client.mouse.x+" "+client.mouse.y);
            }
            break;
        case 17: // split cell
            this.pressSplitCell = true;
            break;
        case 21: // eject mass
            this.pressEjectMass = true;
            break;
        case 255: // enter
            if (view.byteLength >= 15) {
                this.protocol = view.getUint32(1, true);
                var icon = view.getUint8(5, true);
                var roleid = view.getUint32(6, true);
                var key = view.getUint32(10, true);
                var name_len = view.getUint8(14, true);
                var nick = "";
                var maxLen = this.gameServer.config.playerMaxNickLength * 2; // 2 bytes per char
                for (var i=15; i<view.byteLength && i<=maxLen; i+=1) {
                    var charCode = view.getUint8(i,true);
                    if (charCode == 0) {
                        break;
                    }
                    nick += String.fromCharCode(charCode);
                }

                // check has in loginPlayers, todo check has enter state
                var player = this.gameServer.loginPlayers[roleid];
                if (!player || 
                    player.key != key) {
                    console.log("Invalid player enter: "+roleid+","+key);
                    player = null;
                }
                this.enterBoard(player, nick, icon);
                
                var c = this.gameServer.config;
                console.log('sendSetBorder');
                var starttime = this.gameServer.starttime;
                var now = new Date();
                this.socket.sendPacket(new Packet.SetBorder(
                    c.borderLeft, 
                    c.borderRight,
                    c.borderTop,
                    c.borderBottom,
                    c.gameTime-(now-starttime)
                ));
            }
            break;
        default:
            break;
    }
};

PacketHandler.prototype.enterBoard = function(player, newNick, icon) {
    var client = this.socket.playerTracker;
    if (client.cells.length < 1) {
        if (player) {
            client.info = player;
        }
        console.log("player:");
        console.log(player);
        console.log(client.info);
        client.setName(newNick);
        client.icon = icon;
        client.gaming = true;
        
        this.gameServer.spawnPlayer(client);
    }
};
