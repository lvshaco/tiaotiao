var Packet = require('./packet');

function PacketHandler(gameServer, socket) {
    this.gameServer = gameServer;
    this.socket = socket;
    // Detect protocol version - we can do something about it later
    this.protocol = 0;

    this.pressQ = false;
    this.pressW = false;
    this.pressSpace = false;
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

    // Discard empty messages
    if (message.length == 0) {
        console.log("================= skip message len=0");
        return;
    }

    var buffer = stobuf(message);
    var view = new DataView(buffer);
    var packetId = view.getUint8(0, true);

    console.log("handleMessage:"+packetId+ " len:"+view.byteLength);

    switch (packetId) {
        //case 0:
        //    // Check for invalid packets
        //    if ((view.byteLength + 1) % 2 == 1) {
        //        break;
        //    }

        //    // Set Nickname
        //    var nick = "";
        //    var maxLen = this.gameServer.config.playerMaxNickLength * 2; // 2 bytes per char
        //    for (var i = 1; i < view.byteLength && i <= maxLen; i += 2) {
        //        var charCode = view.getUint16(i, true);
        //        if (charCode == 0) {
        //            break;
        //        }

        //        nick += String.fromCharCode(charCode);
        //    }
        //    //this.setNickname(nick);
        //    break;
        //case 1:
        //    // Spectate mode
        //    if (this.socket.playerTracker.cells.length <= 0) {
        //        // Make sure client has no cells
        //        this.socket.playerTracker.spectate = true;
        //    }
        //    break;
        case 16:
            // Set Target
            //if (view.byteLength == 13) {
            if (view.byteLength >= 9) {
                var client = this.socket.playerTracker;
                client.mouse.x = view.getInt32(1, true) - client.scrambleX;
                client.mouse.y = view.getInt32(5, true) - client.scrambleY;
            }
            break;
        case 17:
            // Space Press - Split cell
            this.pressSpace = true;
            break;
        //case 18:
        //    // Q Key Pressed
        //    this.pressQ = true;
        //    break;
        //case 19:
        //    // Q Key Released
        //    break;
        case 21:
            // W Press - Eject mass
            this.pressW = true;
            break;
        case 255:
            // Connection Start
            if (view.byteLength >= 7) {
                this.protocol = view.getUint32(1, true);
                var index = view.getUint8(5, true);
                var name_len = view.getUint8(6, true);
                var nick = "";
                var maxLen = this.gameServer.config.playerMaxNickLength * 2; // 2 bytes per char
                for (var i=7; i<view.byteLength && i<=maxlen; i+=1) {
                    var charCode = view.getUint8(i,true);
                    if (charCode == 0) {
                        break;
                    }
                    nick += String.fromCharCode(charCode);
                }
                this.enterBoard(nick, index);
                // Send SetBorder packet first
                var c = this.gameServer.config;
                console.log('sendAddNode');
                this.socket.sendPacket(new Packet.SetBorder(
                    c.borderLeft + this.socket.playerTracker.scrambleX,
                    c.borderRight + this.socket.playerTracker.scrambleX,
                    c.borderTop + this.socket.playerTracker.scrambleY,
                    c.borderBottom + this.socket.playerTracker.scrambleY
                ));
            }
            break;
        default:
            break;
    }
};

PacketHandler.prototype.enterBoard = function(newNick, index) {
    var client = this.socket.playerTracker;
    if (client.cells.length < 1) {
        // Set name first
        client.setName(newNick);
        client.picture = index;
        // If client has no cells... then spawn a player
        this.gameServer.gameMode.onPlayerSpawn(this.gameServer, client);

        // Turn off spectate mode
        client.spectate = false;
    }
};
