/**
 * Created by shaobinli on 1/21/19.
 */

var fs = require('fs');// 引入fs 模块
var readline = require('readline');
var async = require('async');
var bignum = require('bignum');
var mysql = require("mysql");

var pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'guesswhat',
    database: 'pool',
    connectionLimit: 20
});

var query = function (sql, data, callback) {
    pool.getConnection(function (err, conn) {
        if (err) {
            callback(err, null, null);
        } else {
            conn.query(sql, data, function (qerr, vals, fields) {
                //释放连接
                conn.release();
                //事件驱动回调
                callback(qerr, vals, fields);
            });
        }
    });
};

var filename = "/stratum/grin-pool.log";
//var filename = "log.log";
var logsArr = new Array();
var listenArr = new Array();
var opt = {
    interval: 10 * 1000,
    persistent: true
};

var shares = {};
var worker = {};
var minerdiff = {};
var height_old = 0;
var height_new = 0;
var block_diff_old = 0;

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
                    generateTxt(buffer.toString(), year);
                });
            });

        } else {
        }
    });
    function generateTxt(str, year) {
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

            //      ********.*******
            var tem = worker_.split('.');
            var miner = tem[0];
            var worker = tem[1];
            console.log(s, share_t, height, nonce, difficulty, miner, worker);
            if (shares[height + ""]) {
                if (shares[height + ""][worker_]) {
                    shares[height + ""][worker_].difficulty = shares[height + ""][worker_].difficulty + parseInt(difficulty);
                    shares[height + ""][worker_].timestamp = share_t;
                } else {
                    shares[height + ""][worker_] = {
                        difficulty: parseInt(difficulty),
                        timestamp: share_t
                    }
                }
            } else {
                shares[height + ""] = {};
                shares[height + ""][worker_] = {
                    difficulty: parseInt(difficulty),
                    timestamp: share_t
                }
            }
            if (minerdiff[height + ""]) {
                if (minerdiff[height + ""][miner]) {
                    minerdiff[height + ""][miner] = minerdiff[height + ""][miner] + parseInt(difficulty);
                } else {
                    minerdiff[height + ""][miner] = parseInt(difficulty);
                }
            } else {
                minerdiff[height + ""] = {};
                minerdiff[height + ""][miner] = parseInt(difficulty);
            }
            height_new = parseInt(height);
        }
        if (height_new > height_old) {
            writedb();
        }
    }
}
function writedb() {
    var data = [];
    var miners = [];
    var h_s = [];

    if (height_old == 0) {
        height_old = height_new;
    } else {
        if(block_diff_old == 0){
            query("select total_difficulty from blocks where height=? or height=?",
                [height_old - 2, height_old - 3], function (err, rows, fields) {
                    if (err) {
                        console.log(err);
                    } else {
                        if(rows.length == 2){
                            block_diff_old = Math.abs(rows[0].total_difficulty - rows[1].total_difficulty);
                        }
                        else{
                            block_diff_old = 2000000000;
                        }
                    }
                })
        }
        for (var h = height_old; h < height_new; h++) {
            console.log("height:", height_old, "shares[h]", shares[h + ""]);
            if (shares[h + ""]) {
                for (var i in shares[h + ""]) {
                    data.push([h, i, shares[h + ""][i].timestamp, shares[h + ""][i].difficulty]);
                    //h_s.push(h);
                }
                h_s.push(h);
            }
            if(minerdiff[h + ""]){
                for(var i in minerdiff[h + ""]){
                    miners.push([h,i,minerdiff[h + ""][i]])
                }
            }
        }
        async.auto({
            getblockdiff: function (callback) {
                query("select total_difficulty from blocks where height=? or height=?",
                    [h-1, h - 2], function (err, rows, fields) {
                        if (err) {
                            console.log(err);
                            callback(err);
                        } else {
                            console.log(rows);
                            var block_diff = 0;
                            if(rows.length == 2){
                                block_diff = Math.abs(rows[0].total_difficulty - rows[1].total_difficulty);
                                block_diff_old = block_diff;
                            }else{
                                block_diff = block_diff_old;
                            }
                            callback(null,block_diff);
                        }
                    })
            },
            minershare:["getblockdiff",function (result, callback) {
                var block_diff = result.getblockdiff.toString();
                async.mapLimit(miners, 10, function (miner, callback1) {
                    var score = bignum(miner[2]).mul(bignum.pow(10,10)).div(bignum(block_diff));
                    query('insert into miner_shares_test (height,miner,difficulty,block_diff,score) values (?,?,?,?,?)',
                        [miner[0], miner[1], miner[2], block_diff.toString(),score.toString()], function (err, rows, fields) {
                            if (err) {
                                callback1(err);
                            } else {
                                callback1(null, "success");
                            }
                        });
                }, function (err, result) {
                    if (err) {
                        console.log(err);
                        callback(err);
                    } else {
                        console.log("insert minershare success, heighht:", h_s);
                        callback(null, "success");
                    }
                });
            }],
            workershare:["getblockdiff",function (result, callback) {
                var block_diff = result.getblockdiff.toString();
                async.mapLimit(data, 10, function (share, callback1) {
                    query('insert into worker_shares_test (height,worker,timestamp,difficulty,block_diff) values (?,?,?,?,?)',
                        [share[0], share[1], share[2], share[3], block_diff], function (err, rows, fields) {
                            if (err) {
                                callback1(err);
                            } else {
                                callback1(null, "success");
                            }
                        });
                }, function (err, result) {
                    if (err) {
                        console.log(err);
                        callback(err);
                    } else {
                        console.log("insert workershare success, heighht:", h_s);
                        callback(null, "success");
                    }
                });
            }]
        }, function (err,results) {
            if(err){
                console.log(err);
            }else{
                height_old = height_new;
                for(var i in h_s){
                    delete shares[h_s[i] + ""];
                    delete minerdiff[h_s[i] + ""];
                }
                console.log(shares);
                console.log(minerdiff);
                console.log(results);
            }
        });
       /* query("select total_difficulty from blocks where height=? or height=?",
            [h-1, h - 2], function (err, rows, fields) {
                if (err) {
                    console.log(err);
                } else {
                    console.log(rows);
                    var block_diff = rows[0].total_difficulty - rows[1].total_difficulty;
                    async.mapLimit(data, 10, function (share, callback) {
                        query('insert into worker_shares_test (height,worker,timestamp,difficulty,block_diff) values (?,?,?,?,?)',
                            [share[0], share[1], share[2], share[3], block_diff], function (err, rows, fields) {
                                if (err) {
                                    callback(err);
                                } else {
                                    callback(null, "success");
                                }
                            });
                    }, function (err, result) {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log("insert seccess, heighht:", h_s);
                            height_old = height_new;
                        }
                    });
                }
            })*/

    }


}
function getNewLog(path) {
    console.log('做一些解析操作');
}
init();

console.log(filename + ' 被监听中...');
/*
 shares:

 var s = {
 height1:{
 miner1.worker1:{
 difficulty:difficulty,
 share_t:share_t
 },
 miner1.worker2:{
 difficulty:difficulty,
 share_t:share_t
 }
 },
 height2:{
 miner1.worker1:{
 difficulty:difficulty,
 share_t:share_t
 },
 miner1.worker2:{
 difficulty:difficulty,
 share_t:share_t
 }
 }
 }


 CREATE TABLE `worker_shares_test` (
 `id` bigint(20) NOT NULL AUTO_INCREMENT,
 `height` bigint(20) NOT NULL,
 `worker` varchar(1024) DEFAULT NULL,
 `timestamp` datetime DEFAULT NULL,
 `difficulty` int(20) DEFAULT NULL,
 PRIMARY KEY (`id`)
 )CHARSET=utf8;


 CREATE TABLE `miner_shares_test` (
 `id` bigint(20) NOT NULL AUTO_INCREMENT,
 `height` bigint(20) NOT NULL,
 `miner` varchar(1024) DEFAULT NULL,
 `difficulty` int(20) DEFAULT NULL,
 `block_diff` int(20) DEFAULT NULL,
 `score` int(20) DEFAULT NULL,
 PRIMARY KEY (`id`)
 )CHARSET=utf8;

 redisClient.hdel(coin + ':earn:roundCurrent', addresse, function (error, result) {


 */


//height difficulty

h2.diff = h2.total_difficulty - h1.total_difficulty



