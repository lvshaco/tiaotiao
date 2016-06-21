const assert = require('assert');

function GameOver(my, clients, room) {
    var cl = clients.slice(0);
    var idx = cl.indexOf(my);
    if (idx !=-1) {
        cl.splice(idx,1);
    }
    cl.push(my);
    this.clients = cl;
    this.room = room;
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

function packname(view, offset, name) {
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
    return offset;
}

GameOver.prototype.build = function() {
    var room = this.room;
    var myid = this.clients[0].info.roleid;

    var count = this.clients.length;
    var len = 0;
    for (var i=0; i<count; ++i) {
        var c = this.clients[i]
        len = len + 41+c.getName().length + 1 + c.getAcc().length+1;
    }
    var buflen = 3 + len;

    var buf = new ArrayBuffer(buflen);
    var view = new DataView(buf);

    view.setUint8(0, 18, true); // Packet ID
    var offset = 1;
    view.setUint16(offset, count, true); offset += 2;
    //console.log("count:"+count);
    for (var i=0; i<count; ++i) {
        var c = this.clients[i];
        var otherid = c.info.roleid;
        view.setUint32(offset, c.rank, true); offset += 4;
        view.setUint32(offset, otherid, true); offset += 4;
        view.setUint32(offset, c.info.sex, true); offset += 4;
        view.setUint32(offset, c.info.province, true); offset += 4;
        view.setUint32(offset, c.info.city, true); offset += 4;
        view.setUint32(offset, c.score, true); offset += 4;
        view.setUint32(offset, c.eat, true); offset += 4;
        view.setUint32(offset, c.copper, true); offset += 4;
        view.setUint32(offset, c.exp, true); offset += 4;
        view.setUint32(offset, c.info.icon, true); offset += 4;
        var recommend_type;
        if (i==0) {
            recommend_type = 0;
        } else {
            recommend_type = room.getRecommend(myid, otherid);
        }
        // 1果脯之恩 2天赐良缘 3技艺切磋 4生死之敌
        view.setUint8(offset, recommend_type, true); offset += 1;

        offset = packname(view, offset, c.getName());
        //console.log(c.getName()+" "+offset);
        offset = packname(view, offset, c.getAcc());
        //console.log(c.getAcc()+" "+offset);
    }
    if (offset != buflen) {
    console.log("GameOver offset="+offset+" buflen="+buflen);
    }
    console.log("GameOver size="+buflen);
    return buf;
};
