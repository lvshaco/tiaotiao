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

//    console.log("handleMessage:"+packetId+ " len:"+view.byteLength);

    switch (packetId) {
        case 16:
            // Set Target
            //if (view.byteLength == 13) {
            if (view.byteLength >= 9) {
                var client = this.socket.playerTracker;
                client.mouse.x = view.getInt32(1, true);
                client.mouse.y = view.getInt32(5, true);
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
            if (view.byteLength >= 7) {
                this.protocol = view.getUint32(1, true);
                var index = view.getUint8(5, true);
                var name_len = view.getUint8(6, true);
                var nick = "";
                var maxLen = this.gameServer.config.playerMaxNickLength * 2; // 2 bytes per char
                for (var i=7; i<view.byteLength && i<=maxLen; i+=1) {
                    var charCode = view.getUint8(i,true);
                    if (charCode == 0) {
                        break;
                    }
                    nick += String.fromCharCode(charCode);
                }
                this.enterBoard(nick, index);
                
                var c = this.gameServer.config;
                console.log('sendSetBorder');
                this.socket.sendPacket(new Packet.SetBorder(
                    c.borderLeft, 
                    c.borderRight,
                    c.borderTop,
                    c.borderBottom
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
       
        client.setName(newNick);
        client.picture = index;
        client.gaming = true;
        
        this.gameServer.spawnPlayer(client);
    }
};
