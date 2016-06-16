var fs = require("fs");
var EOL = require('os').EOL;
var util = require('util');

var llog = {}

llog.init = function() {
    if (!fs.existsSync('./logs')) {
        fs.mkdir('./logs');
    }
    logfile = fs.createWriteStream('./logs/console.log', {
        flags: 'w'
    });
    console.log = function(msg) {
        var date = new Date();
        Y = date.getFullYear();
        M = date.getMonth()+1;
        if (M<10) M='0'+M;
        D = date.getDate();
        if (D<10) D='0'+D;
        h = date.getHours();
        if (h<10) h='0'+h;
        m = date.getMinutes();
        if (m<10) m='0'+m;
        s = date.getSeconds(); 
        if (s<10) s='0'+s;
        msg = Y+'-'+M+'-'+D+' '+h+':'+m+':'+s+' '+msg +EOL;
        logfile.write(msg);
        process.stdout.write(msg);
    };
}

module.exports = llog
