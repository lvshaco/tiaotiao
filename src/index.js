var GameServer = require('./GameServer');

process.on('SIGHUP', function() {
  console.log('signal SIGHUP.');
});

console.log("Start server")

var gameServer = new GameServer();
gameServer.start();
