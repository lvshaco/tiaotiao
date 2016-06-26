var lutil = require('../lutil');
function UpdateRank(clients, count) {
    this.clients = clients;
    this.count = count;
}

module.exports = UpdateRank;

UpdateRank.prototype.build = function() {
    // roleid, name_len, name
    
    var count = this.clients.length;
    if (count > this.count) {
        count = this.count;
    }
    var len = 2;
    for (var i=0; i<count; ++i) {
        var c = this.clients[i]
        len = len + 4+c.getName().length + 1;
    }
    var buflen = 1 + len;

    var buf = new ArrayBuffer(buflen);
    var view = new DataView(buf);

    view.setUint8(0, 17, true); // Packet ID
    var offset = 1;
    view.setUint16(offset, count, true); offset +=2;
    for (var i=0; i<count; ++i) {
        var c = this.clients[i];
        view.setUint32(offset, c.info.roleid, true);
        offset += 4;

        var name = c.getName();
        if (name) {
            view.setUint8(offset, name.length, true);
            offset += 1;
            for (var j = 0; j < name.length; j++) {
                var c = name.charCodeAt(j);
                if (c) {
                    view.setUint8(offset, c, true);
                }
                offset += 1;
            }
        } else {
            view.setUint8(offset, 0, true);
            offset += 1;
        }
    }
    if (offset != buflen) {
    console.log("UpdateRank offset="+offset+" buflen="+buflen);
    }
    //console.log("UpdateRank size="+buflen);
    return buf;
};
