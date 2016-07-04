const assert = require('assert');

function RebirthNotify(name, tick) {
    this.name = name;
    this.tick = tick;
}

module.exports = RebirthNotify;

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

RebirthNotify.prototype.build = function() {
    var len = 1 +1+ 1+this.name.length;
    var buf = new ArrayBuffer(len);
    var view = new DataView(buf);

    view.setUint8(0, 34, true); // Packet ID
    view.setUint8(1, this.tick, true); // tick
    packname(view, 2, this.name);
    console.log("RebirthNotify");
    return buf;
};
