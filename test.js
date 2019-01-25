/**
 * Created by shaobinli on 1/21/19.
 */

var fs = require('fs');// 引入fs 模块
var readline = require('readline');
var filename = "/stratum/grin-pool.log"
//var filename = "log.log";
var logsArr = new Array();
var listenArr = new Array();
var opt = {
    interval: 10 * 1000,
    persistent: true
};

function init() {
    sendHisLogs(filename, listenLogs);
}
function sendHisLogs(filename, listenLogs) {
    listenLogs(filename);
}
function generateLog(str) {
    var regExp = /(\[.+?\])/g;//(\\[.+?\\])
    var res = str.match(regExp);
    console.log(res);
    for (i = 0; i < res.length; i++) {
        res[i] = res[i].replace('[', '').replace(']', ''); //发送历史日志
    }
}
var listenLogs = function (filePath) {
    console.log('日志监听中...');
    var fileOPFlag = "a+";
    fs.watchFile(filePath, opt, function (curr, prev) {
        if (curr.mtime > prev.mtime) {
            var now = new Date();
            var local_t = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000);
            var year = local_t.getFullYear();
            fs.open(filePath, fileOPFlag, function (error, fd) {
                var buffer;
                var remainder = null;
                buffer = new Buffer(curr.size - prev.size);
                fs.read(fd, buffer, 0, (curr.size - prev.size), prev.size, function (err, bytesRead) {
                    generateTxt(buffer.toString(),year);
                });
            });

        } else {
        }
    });

    function generateTxt(str,year) {
        var regExp = /.*Got share at height\s*\d*\s*with nonce\s*\d*\s*with difficulty\s*\d*\s*from worker\s*.*\n/g;
        var temp = str.match(regExp);
        for (var s in temp) {
            console.log(s, temp[s]);
            var reg_time = /\w{3}\s+\d{2}\s+\d{2}:\d{2}:\d{2}/;
            var reg_num = /\s+\d+\s+/g;
            var reg_worker = /from worker\s+.*/;
            var time = temp[s].match(reg_time);
            var num = temp[s].match(reg_num);
            var tem_worker = temp[s].match(reg_worker);

            var tem_time = time[0].split(' ');
            var tem_time_s = tem_time[0] + " " + tem_time[1] + " " + year + " " + tem_time[2];
            var share_t = new Date(tem_time_s);
            var height = num[1];
            var nonce = num[2];
            var difficulty = num[3];
            var worker_ = tem_worker[0].split(' ')[2];
            //  ****@***/worker
            var tem = worker_.split('/');
            var miner = tem[0];
            var worker = tem[1];
            console.log(s,share_t, height,nonce,difficulty, miner,worker);
            
            
            
            
            
        }
    }
}
function getNewLog(path) {
    console.log('做一些解析操作');
}
init();

console.log(filename + ' 被监听中...');

