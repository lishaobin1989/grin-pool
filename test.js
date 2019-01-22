/**
 * Created by shaobinli on 1/21/19.
 */
var mysql=require("mysql");
var pool = mysql.createPool({
    host     : '127.0.0.1',
    user     : 'root',
    password : 'guesswhat',
    database : 'pool',
    connectionLimit:20
});
var query=function(sql,data,callback){
    pool.getConnection(function(err,conn){
        if(err){
            callback(err,null,null);
        }else{
            conn.query(sql,data,function(qerr,vals,fields){
                //释放连接  
                conn.release();
                //事件驱动回调  
                callback(qerr,vals,fields);
            });
        }
    });
};

function test() {
    query('',[],function (err,rows,fields) {

    })
}
var fs = require('fs');// 引入fs 模块
var filePath = "";
fs.watch(filePath, function (event, filename) {
    console.log('event is: ' + event);
    if (filename) {
        console.log('filename provided: ' + filename);
        //readTxt();
    } else {
        console.log('filename not provided');
    }
}
});
console.log(filePath + ' 被监听中...');
