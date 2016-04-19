const assert = require('assert');
function UpdateNodes(destroyQueue, nodes, nonVisibleNodes, scrambleX, scrambleY) {
    this.destroyQueue = destroyQueue;
    this.nodes = nodes;
    this.nonVisibleNodes = nonVisibleNodes;
    this.scrambleX = scrambleX;
    this.scrambleY = scrambleY;
}

module.exports = UpdateNodes;

UpdateNodes.prototype.build = function() {
    // Calculate nodes sub packet size before making the data view
    var nodesLength = 0;
    for (var i = 0; i < this.nodes.length; i++) {
        var node = this.nodes[i];

        if (typeof node == "undefined") {
            continue;
        }

        //nodesLength = nodesLength + 20 + (node.getName().length * 2);
        nodesLength = nodesLength + 21 + (node.getName().length); 
    }

    var buflen = 1 +
            2+this.destroyQueue.length * 8 + 
            2+this.nonVisibleNodes.length * 4 +
            2+nodesLength;

    var buf = new ArrayBuffer(buflen);
    var view = new DataView(buf);

    view.setUint8(0, 16, true); // Packet ID
    view.setUint16(1, this.destroyQueue.length, true); // Nodes to be destroyed
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
    view.setUint16(offset, len, true); // # of non-visible nodes to destroy
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
    view.setUint16(offset, len, true); // # of non-visible nodes to destroy
    offset += 2;
    for (var i = 0; i < this.nodes.length; i++) {
        var node = this.nodes[i];

        if (typeof node == "undefined") {
            continue;
        }

        view.setUint32(offset, node.nodeId, true); // Node ID
        view.setInt32(offset + 4, node.position.x + this.scrambleX, true); // X position
        view.setInt32(offset + 8, node.position.y + this.scrambleY, true); // Y position
        //console.log("node:"+node.nodeId+" "+node.position.x+","+node.position.y);
        view.setInt16(offset + 12, node.getSize(), true); // Mass formula: Radius (size) = (mass * mass) / 100
        view.setUint16(offset + 14, node.getPicture(), true); 
        view.setUint8(offset + 16, node.color.r, true); // Color (R)
        view.setUint8(offset + 17, node.color.g, true); // Color (G)
        view.setUint8(offset + 18, node.color.b, true); // Color (B)
        view.setUint8(offset + 19, node.spiked, true); // Flags
        offset += 20;

        //console.log("N--------------------------------i:"+i+" nodeid:"+node.nodeId+" x:"+node.position.x+" y:"+node.position.y);
        var name = node.getName();
        if (name) {
            //console.log("================== name:"+name+"."+name.length);
            assert(name.length < 255);
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
    assert(offset==buflen, "offset="+offset+" buflen="+buflen);
    return buf;
};
