var Cell = require('./Cell');

function Food() {
    Cell.apply(this, Array.prototype.slice.call(arguments));

    this.cellType = 1;
    this.shouldSendUpdate = false;

    //if (this.gameServer.config.foodMassGrow &&
    //    this.gameServer.config.foodMassGrowPossiblity > Math.floor(Math.random() * 101)) {
    //    this.grow();
    //}
}

module.exports = Food;
Food.prototype = new Cell();

Food.prototype.getSize = function() {
    // Calculates radius based on cell mass
    //return this.mass * 0.5
    return 10;
    //return Math.ceil((-8484.93574 + 8354.33821 * Math.pow(this.mass,0.01))/2);
    //return Math.ceil(Math.sqrt(100 * this.mass));
};


Food.prototype.calcMove = null; // Food has no need to move

// Main Functions

//Food.prototype.grow = function() {
//    setTimeout(function() {
//        this.mass++; // food mass increased, we need to recalculate its size and squareSize, and send update to client side
//        this.size = Math.ceil(Math.sqrt(100 * this.mass));
//        this.shouldSendUpdate = true;
//
//        if (this.mass < this.gameServer.config.foodMassLimit) {
//            this.grow();
//        }
//    }.bind(this), this.gameServer.config.foodMassTimeout * 1000);
//};

Food.prototype.sendUpdate = function() {
    // Whether or not to include this cell in the update packet
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
