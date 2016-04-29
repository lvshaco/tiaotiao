var Cell = require('./Cell');

function EjectedMass() {
    Cell.apply(this, Array.prototype.slice.call(arguments));
    this.cellType = 3;
}

module.exports = EjectedMass;
EjectedMass.prototype = new Cell();

EjectedMass.prototype.getName = function() {
    return "";
};

EjectedMass.prototype.addMass = function(n) {
    return; 
};

EjectedMass.prototype.calcMove = null; 

EjectedMass.prototype.sendUpdate = function() {
    return true;
};

EjectedMass.prototype.onRemove = function(gameServer) {
    var index = gameServer.nodesEjected.indexOf(this);
    if (index != -1) {
        gameServer.nodesEjected.splice(index, 1);
    }
};

EjectedMass.prototype.onConsume = function(consumer, gameServer) {
    consumer.addMass(this.mass);
};

EjectedMass.prototype.onAutoMove = function(gameServer) {
    if (gameServer.nodesVirus.length < gameServer.config.virusMaxAmount) {
        // feed virus
        var v = gameServer.getNearestVirus(this);
        if (v) { 
            v.feed(this, gameServer);
            return true;
        }
    }
};
