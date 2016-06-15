const assert = require('assert');
function UpdateNodes(destroyQueue, nodes, nonVisibleNodes) {
    this.destroyQueue = destroyQueue;
    this.nodes = nodes;
    this.nonVisibleNodes = nonVisibleNodes;
}

module.exports = UpdateNodes;

UpdateNodes.prototype.build = function() {
    var nodesLength = 0;
    for (var i = 0; i < this.nodes.length; i++) {
        var node = this.nodes[i];
        if (typeof node == "undefined") {
            continue;
        }
        var playerlen=1;
        if (node.owner) {
            playerlen += 4*6;
        }
        nodesLength = nodesLength + playerlen+23 + (node.getName().length); 
    }

    var buflen = 1 +
            2+this.destroyQueue.length * 8 + 
            2+this.nonVisibleNodes.length * 4 +
            2+nodesLength;

    var buf = new ArrayBuffer(buflen);
    var view = new DataView(buf);

    view.setUint8(0, 16, true); // Packet ID
    view.setUint16(1, this.destroyQueue.length, true); 
    //console.log("destroylen:"+this.destroyQueue.length+" unvisible:"+this.nonVisibleNodes.length+" nodes:"+this.nodes.length);
    var offset = 3;
    for (var i = 0; i < this.destroyQueue.length; i++) {
        var node = this.destroyQueue[i];

        if (!node) {
            console.log("================== invalid destorynode");
            continue;
        }

        var killer = 0;
        if (node.getKiller()) {
            killer = node.getKiller().nodeId;
        }

        view.setUint32(offset, killer, true); // Killer ID
        view.setUint32(offset + 4, node.nodeId, true); // Node ID

        //console.log("D--------------------------------i:"+i+" eatId:"+killer+" eatedId:"+node.nodeId);
        offset += 8;
    }

    var len = this.nonVisibleNodes.length
    view.setUint16(offset, len, true); 
    offset += 2;

    for (var i = 0; i < this.nonVisibleNodes.length; i++) {
        var node = this.nonVisibleNodes[i];

        if (!node) {
            console.log("================== invalid unvisiblenode");
            continue;
        }

        view.setUint32(offset, node.nodeId, true);
        //console.log("U--------------------------------i:"+i+" id:"+node.nodeId);
        offset += 4;
    }

    var len = this.nodes.length
    view.setUint16(offset, len, true); // non-visible nodes to destroy
    offset += 2;
    for (var i = 0; i < this.nodes.length; i++) {
        var node = this.nodes[i];

        if (typeof node == "undefined") {
            continue;
        }

        view.setUint32(offset, node.nodeId, true); // Node ID
        view.setInt32(offset + 4, node.position.x, true); // X position
        view.setInt32(offset + 8, node.position.y, true); // Y position
        //console.log("node:"+node.nodeId+" "+node.position.x+","+node.position.y);
        view.setInt16(offset + 12, node.getSize(), true);
        view.setUint16(offset + 14, node.getIcon(), true); 
        view.setUint8(offset + 16, node.color.r, true); // Color (R)
        view.setUint8(offset + 17, node.color.g, true); // Color (G)
        view.setUint8(offset + 18, node.color.b, true); // Color (B)
        view.setUint8(offset + 19, node.spiked, true); // 
        view.setUint16(offset + 20, node.mass, true); // Mass 
        offset += 22;

        var player = node.owner
        if (player) { 
            var info = player.info
            view.setUint8(offset, 1, true);offset+=1; // is player
            view.setUint32(offset, info.heroid, true);offset+=4;
            view.setUint32(offset, info.herolevel, true);offset+=4;
            view.setUint32(offset, info.guanghuan, true);offset+=4;
            view.setUint32(offset, info.baozi, true);offset+=4;
            view.setUint32(offset, info.canying, true);offset+=4;
            view.setUint32(offset, info.huahuan, true);offset+=4;
        } else {
            view.setUint8(offset, 0, true); // not player
            offset += 1;
        }
        //console.log("N--------------------------------i:"+i+" nodeid:"+node.nodeId+" x:"+node.position.x+" y:"+node.position.y);
        var name = node.getName();
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
    console.log("offset="+offset+" buflen="+buflen);
    }
    return buf;
};
