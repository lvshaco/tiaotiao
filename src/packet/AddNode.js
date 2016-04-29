function AddNode(item) {
    this.item = item;
}

module.exports = AddNode;

AddNode.prototype.build = function() {
    var buf = new ArrayBuffer(5);
    var view = new DataView(buf);

    view.setUint8(0, 32, true);
    view.setUint32(1, this.item.nodeId, true);

    return buf;
};
