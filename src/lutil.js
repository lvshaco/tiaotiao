var config = require('../config');

var lutil = {};

var lastNodeId = 1;
lutil.getNextNodeId = function() {
    if (lastNodeId > 2147483647) {
        lastNodeId = 1;
    }
    return lastNodeId++;
};

lutil.redirect = function(msg) {
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
    console.log(Y+'-'+M+'-'+D+' '+h+':'+m+':'+s+' '+msg);
}

lutil.getRandomPosition = function(size) {
    var L = config.borderLeft + size;
    var R = config.borderRight - size;
    var T = config.borderTop + size;
    var B = config.borderBottom - size;
    return {
        x: Math.floor(Math.random() * (R - L)) + L,
        y: Math.floor(Math.random() * (B - T)) + T
    };
}

lutil.getRandomColor = function() {
    var rand = Math.floor(Math.random() * 3);
    if (rand == 0)
        return {
            r: 255,
            b: Math.random() * 255,
            g: 0
        };
    else if (rand == 1)
        return {
            r: 0,
            b: 255,
            g: Math.random() * 255
        };
    else
        return {
            r: Math.random() * 255,
            b: 0,
            g: 255
        };
};

lutil.getSizeFromMass = function(mass) {
    //return Math.ceil((2.64965 * Math.pow(mass,0.7) + 50.72030)/2);
    return 12 + Math.sqrt(mass) * 6;
};

lutil.getSpeedFromMass = function(mass) {
    //return Math.ceil((-5297.01638750265 + 5611.24781004064 * Math.pow(mass,-0.005))/25);
    return (mass/(mass*0.000001004+0.0025)/mass/20);
};

module.exports = lutil;
