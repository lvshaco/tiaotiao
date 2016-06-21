function UpdateLife(life) {
    this.life = life;
}

module.exports = UpdateLife;

UpdateLife.prototype.build = function() {
    var buf = new ArrayBuffer(2);
    var view = new DataView(buf);

    view.setUint8(0, 33, true);
    view.setUint8(1, this.life, true);
    return buf;
};
