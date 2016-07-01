var Cell = require('./Cell');
var config = require('../../config');

function Virus() {
    Cell.apply(this, Array.prototype.slice.call(arguments));
    this.cellType = 2;
    this.spiked = 1;
}

module.exports = Virus;
Virus.prototype = new Cell();

Virus.prototype.calcMove = null;

Virus.prototype.feed = function(feeder, room) {
    if (this.moveEngineTicks == 0) 
        this.setAngle(feeder.getAngle());
    this.mass += feeder.mass;
    room.removeNode(feeder);

    this.setMoveEngineData(10, 2, 0.85);
    room.setAsMovingNode(this);

    if (this.mass >= 200) { 
        this.mass = config.virusStartMass; 
        room.shootVirus(this);
    }

};

Virus.prototype.onConsume = function(consumer, room) {
    var client = consumer.owner;
    consumer.addMass(this.mass);

    var numSplits = config.playerMaxCells - client.cells.length;
    numSplits = Math.min(numSplits, 9); // max split is 9
    if (numSplits <= 0)
        return;

    var splitMass = consumer.mass / (numSplits + 1); 
    if (splitMass < 1) 
        return;

    var unitAngle = 6.28/numSplits;
    var angle = consumer.lastMoveAngle;
    for (var k = 0; k < numSplits; k++) {
        angle = angle + unitAngle;
        room.createPlayerCell(client, consumer, angle, splitMass);
    }
    
    consumer.calcMergeTime(config.playerRecombineTime);
    consumer.setMoveEngineData(0, 4, 0.70);
};

Virus.prototype.onAdd = function(room) {
    room.nodesVirus.push(this);
};

Virus.prototype.onRemove = function(room) {
    var index = room.nodesVirus.indexOf(this);
    if (index != -1) {
        room.nodesVirus.splice(index, 1);
    } 
};
