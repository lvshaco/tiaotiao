function SetBorder(left, right, top, bottom) {
    this.left = left;
    this.right = right;
    this.top = top;
    this.bottom = bottom;
}

module.exports = SetBorder;

SetBorder.prototype.build = function() {
    var buf = new ArrayBuffer(17);
    var view = new DataView(buf);

    view.setUint8(0, 64, true);
    view.setInt32(1, this.left, true);
    view.setInt32(5, this.top, true);
    view.setInt32(9, this.right, true);
    view.setInt32(13, this.bottom, true);

    return buf;
};
