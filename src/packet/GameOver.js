const assert = require('assert');

function GameOver(my, clients) {
    var cl = clients.slice(0);
    var idx = cl.indexOf(my);
    if (idx !=-1) {
        cl.splice(idx,1);
    }
    cl.push(my);
    this.clients = cl;
}

module.exports = GameOver;
/*
struct GameOver {
    struct {
        uint32_t rank;
        uint32_t roleid;
        uint32_t sex;
        uint32_t province;
        uint32_t city;
        uint32_t mass;
        uint32_t eat;
        uint32_t copper;
        uint32_t exp;
        uint8_t name_len; // 名字的长度
        name bytes;// 名字字节
    } vector;
} */
GameOver.prototype.build = function() {
    var count = this.clients.length;
    var len = 0;
    for (var i=0; i<count; ++i) {
        var c = this.clients[i]
        len = len + 36+c.getName().length + 1;
    }
    var buflen = 3 + len;

    var buf = new ArrayBuffer(buflen);
    var view = new DataView(buf);

    view.setUint8(0, 18, true); // Packet ID
    var offset = 1;
    view.setUint16(offset, count, true); offset += 2;
    for (var i=0; i<count; ++i) {
        var c = this.clients[i];
        view.setUint32(offset, c.rank, true); offset += 4;
        view.setUint32(offset, c.info.roleid, true); offset += 4;
        view.setUint32(offset, c.info.sex, true); offset += 4;
        view.setUint32(offset, c.info.province, true); offset += 4;
        view.setUint32(offset, c.info.city, true); offset += 4;
        view.setUint32(offset, c.score, true); offset += 4;
        view.setUint32(offset, c.eat, true); offset += 4;
        view.setUint32(offset, c.copper, true); offset += 4;
        view.setUint32(offset, c.exp, true); offset += 4;

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
    console.log("GameOver offset="+offset+" buflen="+buflen);
    }
    console.log("GameOver size="+buflen);
    return buf;
};
