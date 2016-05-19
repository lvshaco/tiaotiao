// Imports
var WebSocket = require('ws');

function setup(){
var wsServer = 'ws://127.0.0.1:1448';
//var wsServer = 'ws://60.174.233.70:1448';
var ws = new WebSocket(wsServer);
//console.log(showProperties(ws));
ws.on("open", function (e) {
console.log("Connected to WebSocket server.");

var msg = new Buffer(15);
msg.writeUInt8(255, 0);
msg.writeUInt32LE(0, 1);
msg.writeUInt8(0, 5);
msg.writeUInt32LE(1, 6);
msg.writeUInt32LE(0, 10);
msg.writeUInt8(0, 14);
console.log(showProperties(ws));
ws.send(msg);
console.log("EnterBoard...")

//sendMessage("Conan");
}) ;

//ws.onopen = function (e) {
//console.log("Connected to WebSocket server.");
////sendMessage("Conan");
//} ;

ws.onclose = function (e) {
console.log("Disconnected");
} ;

ws.onmessage = function(e) {
var msg = e.data;
//Object.getOwnPropertyNames(msg).sort().forEach(function (val) {console.log(val, '\n')});
var msgid = msg.readUInt8(0);
console.log("RECEIVED: ", msg.length, msgid);
if (msgid == 64) {
    console.log("GetBoarder MoveTo: ...");
     var msg = new Buffer(9);
    msg.writeUInt8(16, 0);
    msg.writeInt32LE(3100, 1);
    msg.writeInt32LE(3100, 5);
    ws.send(msg);
}
//ws.close();
}

ws.onerror = function (e) {
console.log('Error occured: ' + e.data);
} ;

//var sendMessage = function(msg){
//ws.send(msg);
//console.log("SEND : "+ msg);
//}
}

function getObjectClass(obj) {   
    if (obj && obj.constructor && obj.constructor.toString) {   
        var arr = obj.constructor.toString().match(   
            /function\s*(\w+)/);   
  
        if (arr && arr.length == 2) {   
            return arr[1];   
        }   
    }   
  
    return undefined;   
}

function showProperties(obj) {
    var names="";       
    for(var name in obj){
        names+=name+":";
        //names+=name+":"obj[name]+", ";
    } 
    return names
}

setup();
