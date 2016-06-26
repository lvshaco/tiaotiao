var Packet = require('./packet');
var config = require('../config');

function PacketHandler(gameServer, socket) {
    this.gameServer = gameServer;
    this.socket = socket;
    this.protocol = 0; // reserve
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
                if (client) {
                    client.mouse.x = view.getInt32(1, true);
                    client.mouse.y = view.getInt32(5, true);

                    client.movedir.x = view.getInt32(9, true)/100;
                    client.movedir.y = view.getInt32(13, true)/100;
                    //console.log(" mouse:"+client.mouse.x+" "+client.mouse.y);
                }
            }
            break;
        case 17: // split cell
            var client = this.socket.playerTracker;
            if (client) {
                client.pressSplitCell = true;
            }
            break;
        case 21: // eject mass
            var client = this.socket.playerTracker;
            if (client) {
                client.pressEjectMass = true;
            }
            break;
        case 255: // enter
            if (view.byteLength >= 15) {
                this.protocol = view.getUint32(1, true);
                var icon = view.getUint8(5, true);
                var roleid = view.getUint32(6, true);
                var key = view.getUint32(10, true);
                var name_len = view.getUint8(14, true);
                var nick = "";
                var maxLen = config.playerMaxNickLength * 2; // 2 bytes per char
                for (var i=15; i<view.byteLength && i<=maxLen; i+=1) {
                    var charCode = view.getUint8(i,true);
                    if (charCode == 0) {
                        break;
                    }
                    nick += String.fromCharCode(charCode);
                }

                this.gameServer.loginClient(this.socket, roleid, key, nick, icon);
            }
            break;
        default:
            break;
    }
};
