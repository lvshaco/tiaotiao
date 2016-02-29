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
        nodesLength = nodesLength + 19; 
    }

    var buf = new ArrayBuffer(1 +
            2+this.destroyQueue.length * 8 + 
            4+this.nonVisibleNodes.length * 4 +
            nodesLength;
    var view = new DataView(buf);

    view.setUint8(0, 16, true); // Packet ID
    view.setUint16(1, this.destroyQueue.length, true); // Nodes to be destroyed

    var offset = 3;
    for (var i = 0; i < this.destroyQueue.length; i++) {
        var node = this.destroyQueue[i];

        if (!node) {
            continue;
        }

        var killer = 0;
        if (node.getKiller()) {
            killer = node.getKiller().nodeId;
        }

        view.setUint32(offset, killer, true); // Killer ID
        view.setUint32(offset + 4, node.nodeId, true); // Node ID

        offset += 8;
    }

    var len = this.nonVisibleNodes.length
    view.setUint32(offset, len, true); // # of non-visible nodes to destroy

    offset += 4;

    for (var i = 0; i < this.nonVisibleNodes.length; i++) {
        var node = this.nonVisibleNodes[i];

        if (!node) {
            continue;
        }

        view.setUint32(offset, node.nodeId, true);
        offset += 4;
    }

    for (var i = 0; i < this.nodes.length; i++) {
        var node = this.nodes[i];

        if (typeof node == "undefined") {
            continue;
        }

        view.setUint32(offset, node.nodeId, true); // Node ID
        view.setInt32(offset + 4, node.position.x + this.scrambleX, true); // X position
        view.setInt32(offset + 8, node.position.y + this.scrambleY, true); // Y position
        view.setInt16(offset + 12, node.getSize(), true); // Mass formula: Radius (size) = (mass * mass) / 100
        view.setUint8(offset + 14, node.color.r, true); // Color (R)
        view.setUint8(offset + 15, node.color.g, true); // Color (G)
        view.setUint8(offset + 16, node.color.b, true); // Color (B)
        view.setUint8(offset + 17, node.spiked, true); // Flags
        offset += 18;

        view.setUint8(offset, 0, true);
        offset += 1;
        //var name = node.getName();
        //if (name) {
        //    for (var j = 0; j < name.length; j++) {
        //        var c = name.charCodeAt(j);
        //        if (c) {
        //            view.setUint16(offset, c, true);
        //        }
        //        offset += 2;
        //    }
        //}

        //view.setUint16(offset, 0, true); // End of string
        //offset += 2;
    }

    //var len = this.nonVisibleNodes.length + this.destroyQueue.length;
    //view.setUint32(offset, 0, true); // End
    //view.setUint32(offset + 4, len, true); // # of non-visible nodes to destroy

    //offset += 8;

    //// Destroy queue + nonvisible nodes
    //for (var i = 0; i < this.destroyQueue.length; i++) {
    //    var node = this.destroyQueue[i];

    //    if (!node) {
    //        continue;
    //    }

    //    view.setUint32(offset, node.nodeId, true);
    //    offset += 4;
    //}
    //for (var i = 0; i < this.nonVisibleNodes.length; i++) {
    //    var node = this.nonVisibleNodes[i];

    //    if (!node) {
    //        continue;
    //    }

    //    view.setUint32(offset, node.nodeId, true);
    //    offset += 4;
    //}

    return buf;
};
