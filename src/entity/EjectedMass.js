var Cell = require('./Cell');
var config = require('../../config');

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

EjectedMass.prototype.onRemove = function(room) {
    var index = room.nodesEjected.indexOf(this);
    if (index != -1) {
        room.nodesEjected.splice(index, 1);
    }
};

EjectedMass.prototype.onConsume = function(consumer, room) {
    consumer.addMass(this.mass);
    var player = this.owner;
    var other = consumer.owner;
    if (player && other) {
        var myid = player.info.roleid;
        var opid = other.info.roleid;
        if (myid > 0 && opid > 0) {
            room.addRecommend(myid, opid, 1, 0);
            room.addRecommend(opid, myid, 1, 0);
        }
    }
};

EjectedMass.prototype.onAutoMove = function(room) {
    if (room.nodesVirus.length < config.virusMaxAmount) {
        // feed virus
        var v = room.getNearestVirus(this);
        if (v) { 
            v.feed(this, room);
            return true;
        }
    }
};
