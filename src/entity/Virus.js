var Cell = require('./Cell');

function Virus() {
    Cell.apply(this, Array.prototype.slice.call(arguments));

    this.cellType = 2;
    this.spiked = 1;
    this.fed = 0;
    this.isMotherCell = false; // Not to confuse bots
}

module.exports = Virus;
Virus.prototype = new Cell();

Virus.prototype.calcMove = null; // Only for player controlled movement

Virus.prototype.feed = function(feeder, gameServer) {
    if (this.moveEngineTicks == 0) this.setAngle(feeder.getAngle()); // Set direction if the virus explodes
    this.mass += feeder.mass;
    this.fed++; // Increase feed count
    gameServer.removeNode(feeder);

    // Check if the virus is going to explode
    //if (this.fed >= gameServer.config.virusFeedAmount) {
    if (this.mass >= 200) { 
        this.mass = gameServer.config.virusStartMass; // Reset mass
        this.fed = 0;
        gameServer.shootVirus(this);
    }

};

// Main Functions

Virus.prototype.onConsume = function(consumer, gameServer) {
    var client = consumer.owner;

    // Cell consumes mass before any calculation
    consumer.addMass(this.mass);

    var numSplits = gameServer.config.playerMaxCells - client.cells.length; // Get number of splits
    numSplits = Math.min(numSplits, 9); // max split is 9
    if (numSplits <= 0)
        return;

    var splitMass = consumer.mass / (numSplits + 1); // Maximum size of new splits
    if (splitMass < 1) 
        return;

    for (var k = 0; k < numSplits; k++) {
        var angle = Math.random() * 6.28; // Random directions
        gameServer.createPlayerCell(client, consumer, angle, splitMass);
    }

    // Prevent consumer cell from merging with other cells
    consumer.calcMergeTime(gameServer.config.playerRecombineTime);
    client.virusMult += 0.6; // Account for anti-teaming
};

Virus.prototype.onAdd = function(gameServer) {
    gameServer.nodesVirus.push(this);
};

Virus.prototype.onRemove = function(gameServer) {
    var index = gameServer.nodesVirus.indexOf(this);
    if (index != -1) {
        gameServer.nodesVirus.splice(index, 1);
    } else {
        console.log("[Warning] Tried to remove a non existing virus!");
    }
};
