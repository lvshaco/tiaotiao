var Cell = require('./Cell');

function Food() {
    Cell.apply(this, Array.prototype.slice.call(arguments));

    this.cellType = 1;
    this.shouldSendUpdate = false;
}

module.exports = Food;
Food.prototype = new Cell();

Food.prototype.getSize = function() {
    return 10;
};


Food.prototype.calcMove = null; 

Food.prototype.sendUpdate = function() {
    if (this.moveEngineTicks == 0) {
        return false;
    }
    if (this.shouldSendUpdate) {
        this.shouldSendUpdate = false;
        return true;
    }
    return true;
};

Food.prototype.onRemove = function(gameServer) {
    gameServer.currentFood--;
};

Food.prototype.onConsume = function(consumer, gameServer) {
    consumer.addMass(this.mass);
};
