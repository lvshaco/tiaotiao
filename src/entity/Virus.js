var Cell = require('./Cell');

function Virus() {
    Cell.apply(this, Array.prototype.slice.call(arguments));
    this.cellType = 2;
    this.spiked = 1;
}

module.exports = Virus;
Virus.prototype = new Cell();

Virus.prototype.calcMove = null;

Virus.prototype.feed = function(feeder, gameServer) {
    if (this.moveEngineTicks == 0) 
        this.setAngle(feeder.getAngle());
    this.mass += feeder.mass;
    gameServer.removeNode(feeder);

    if (this.mass >= 200) { 
        this.mass = gameServer.config.virusStartMass; 
        gameServer.shootVirus(this);
    }

};

Virus.prototype.onConsume = function(consumer, gameServer) {
    var client = consumer.owner;
    consumer.addMass(this.mass);

    var numSplits = gameServer.config.playerMaxCells - client.cells.length;
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
        gameServer.createPlayerCell(client, consumer, angle, splitMass);
    }
    
    consumer.calcMergeTime(gameServer.config.playerRecombineTime);
    consumer.setMoveEngineData(0, 4, 0.70);
};

Virus.prototype.onAdd = function(gameServer) {
    gameServer.nodesVirus.push(this);
};

Virus.prototype.onRemove = function(gameServer) {
    var index = gameServer.nodesVirus.indexOf(this);
    if (index != -1) {
        gameServer.nodesVirus.splice(index, 1);
    } 
};
