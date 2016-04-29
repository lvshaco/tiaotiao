var Cell = require('./Cell');

function EjectedMass() {
    Cell.apply(this, Array.prototype.slice.call(arguments));

    this.cellType = 3;
    this.addedAntiTeam = false; // Not to affect anti-teaming two times
}

module.exports = EjectedMass;
EjectedMass.prototype = new Cell();

// Override functions that use 'owner' variable
EjectedMass.prototype.getName = function() {
    return "";
};

EjectedMass.prototype.addMass = function(n) {
    return; // Do nothing, this is an ejected cell
};

EjectedMass.prototype.calcMove = null; // Only for player controlled movement

// Main Functions

EjectedMass.prototype.sendUpdate = function() {
    // Whether or not to include this cell in the update packet
    // Always true since ejected cells can collide with themselves
    return true;
};

EjectedMass.prototype.onRemove = function(gameServer) {
    var index = gameServer.nodesEjected.indexOf(this);
    if (index != -1) {
        gameServer.nodesEjected.splice(index, 1);
    }
};

EjectedMass.prototype.onConsume = function(consumer, gameServer) {
    // Adds mass to consumer
    consumer.addMass(this.mass);
};

EjectedMass.prototype.onAutoMove = function(gameServer) {
    if (gameServer.nodesVirus.length < gameServer.config.virusMaxAmount) {
        var v = gameServer.getNearestVirus(this);
        if (v) { // Feeds the virus if it exists
            v.feed(this, gameServer);
            return true;
        }
    }
};

EjectedMass.prototype.moveDone = function(gameServer) {
    // Always apply anti-teaming
    this.owner.actionMult += 0.02;
    this.addedAntiTeam = true;
};
