var express = require('express');
var mysql = require('mysql');
var squel = require("squel");
var session = require('express-session')
var bodyParser = require('body-parser');
var SessionStore = require('express-mysql-session');
var vldt = require('validator');


var app = express();
app.set('view engine', 'jade');

var options = {
    host: 'localhost',
    user: 'nitin',
    password: '',
    database: 'test',
    port: 3307
};

var sessionStore = new SessionStore(options);

var sess = {
    key: 'keyboard',
    secret: 'keyboard cat',
    cookie: {
        httpOnly: true,
        maxAge: 15 * 60 * 1000,
        expires: false
    },
    store: sessionStore,
    resave: true,
    saveUninitialized: false,
    rolling: true
}


app.use(session(sess));
app.use(bodyParser());
app.use(express.static(__dirname + '/public'));

var connection = mysql.createConnection(options);


connection.connect();

connection.query('drop table if exists users');
connection.query('CREATE TABLE IF NOT EXISTS users(' + 'uName VARCHAR(30),' + 'pWord VARCHAR(30),' + 'admin VARCHAR(30),' + 'fName VARCHAR(60),' + 'lName VARCHAR(60),' + 'address VARCHAR(60),' + 'city VARCHAR(60),' + 'state VARCHAR(60),' + 'zip VARCHAR(60),' + 'email VARCHAR(60),' + 'PRIMARY KEY(uName)' + ')', function(err) {
    if (err) throw err;
    connection.query('INSERT INTO users values ("hsmith","smith","FALSE","Henry", "Smith", "1234 Abcd Ave", "San Francisco", "CA", "12345", "1@gmail.com")');
    connection.query('INSERT INTO users values ("tbucktoo","bucktoo","FALSE","Tim", "Bucktoo", "1234 Abcd Ave", "San Francisco", "CA", "12345", "1@gmail.com")');
        connection.query('INSERT INTO users values ("jadmin","admin","TRUE","Jimmy", "Admin", "1234 Abcd Ave", "San Francisco", "CA", "12345", "1@gmail.com")');
});
//connection.query('drop table if exists productdata');
// connection.query('CREATE TABLE IF NOT EXISTS productdata(' + 'Id VARCHAR(200),' + 'ASIN VARCHAR(200),' + 'title TEXT,' + 'description VARCHAR(100),' + 'categories TEXT,' + 'PRIMARY KEY(Id)' + ')', function(err) {
//     if (err) throw err;
// });

app.post('/registerUser', function(req, res) {
    var r = req.body;
    console.log(req);
    var ret = {};
    if (r.fname == null || r.lname == null || r.address == null || r.city == null || r.state == null || r.zip == null || r.email == null || r.username == null || r.password == null){
        ret['message'] = "there was a problem with your registration";
        res.json(ret);
    }else if(!vldt.isInt(r.zip, {min: 10000, max: 99999}) || !vldt.isEmail(r.email) || !vldt.isAlpha(r.state) || (r.state.length != 2)){
        ret['message'] = "there was a problem with your registration";
        res.json(ret);
    }else{
        var query = squel.insert().into("users").set("uName", r.username).set("pWord", r.password).set("admin", "FALSE").set("fname", r.fname).set("lname", r.lname).set("address", r.address).set("state", r.state).set("city", r.city).set("zip", r.zip).set("email", r.email).toString();
        connection.query(query, function(err, results) {
            if (!err) {
                ret['message'] = "Your account has been registered";
            } else {
                ret['message'] = "there was a problem with your registration";
            }
            res.json(ret);
        });
    }
});

app.post('/login',  function(req, res) {
    var r = req.body;
    var ret = {};
    var user = ['updateInfo', 'getProducts'];
    var admin = ['updateInfo', 'getProducts', 'viewUsers', 'modifyProduct'];
    if (r.username == null || r.password == null){
        ret['err_message'] = "That username and password combination was not correct";
        res.json(ret);
    }else{
        var query = squel.select().from("users").where("uName = ? AND pWord = ?", r.username, r.password).toString();
        connection.query(query, function(err, results) {
            if (!err && results.length > 0) {
                req.session.sessionID = r.username;
                var entry = results[0];
                if (entry.admin == "FALSE") {
                    req.session.admin = false;
                    ret['menu'] = user;
                    res.json(ret);
                } else {
                    req.session.admin = true;
                    ret['menu'] = admin;
                    res.json(ret);
                }
            } else {
                ret['err_message'] = "That username and password combination was not correct";
                res.json(ret);
            }
        });
    }
});
app.post('/logout', function(req, res) {
    var ret = {};
    if (req.session.sessionID == null) {
        ret['message'] = "You are not currently logged in";
    } else {
        ret['message'] = "You have been logged out";
        req.session.destroy();
    }
    //console.log(req.session)
    res.json(ret);
});

app.post('/updateInfo', function(req, res) {
    var ret={};
    if (!req.session.sessionID) {
        req.session.destroy();
        ret['message'] = "There was a problem with this action";
        res.json(ret);
    } else {
        var ret = {};
        var r = req.body;
        var adminsql = (req.session.admin) ? "TRUE" : "FALSE";
        connection.query(squel.select().from("users").where("uName = ?", req.session.sessionID).toString(), function(err, results) {
            var obj = results[0];
            if(!r.username)
                r.username = obj.uName;
            if(!r.password)
                r.password = obj.pWord;
            if(!r.fname)
                r.fname = obj.fName;
            if(!r.lname)
                r.lname = obj.lName;
            if(!r.address)
                r.address = obj.address;
            if(!r.state)
                r.state = obj.state;
            if(!r.city)
                r.city = obj.city;
            if(!r.zip)
                r.zip = obj.zip;
            if(!r.email)
                r.email = obj.email;
            if(!vldt.isInt(r.zip, {min: 10000, max: 99999}) || !vldt.isEmail(r.email) || !vldt.isAlpha(r.state) || (r.state.length != 2)){
                ret['message'] = "There was a problem with this action";
                res.json(ret);
            }else{
                var query = squel.update().table("users").set("uName", r.username).set("pWord", r.password).set("admin", adminsql).set("fName", r.fname).set("lName", r.lname).set("address", r.address).set("state", r.state).set("city", r.city).set("zip", r.zip).set("email", r.email).where("uName = ?", req.session.sessionID).toString();
                req.session.sessionID= r.username;
                connection.query(query, function(err, results) {
                    if (err) {
                        ret['message'] = "There was a problem with this action";
                    } else {
                        ret['message'] = "Your information has been updated";
                    }
                    res.json(ret);
                });
            }
        });
    }
});
app.post('/modifyProduct', function(req, res) {
    var ret = {};
    if (!req.session.sessionID || !req.session.admin) {
        ret['message'] = "There was a problem with this action";
        res.json(ret);
    } else {
        var productID = req.body.productId;
        //to change
        var productDescription = req.body.productDescription;
        var productTitle = req.body.productTitle;
        var query = squel.update().table("productdata").set("description", productDescription).set("title", productTitle).where("Id = ?", productID).toString();
        connection.query(query, function(err, results) {
            //write results data as table for viewing
            if (err) {
                ret['message'] = "There was a problem with this action";
            } else {
                ret['message'] = "The product information has been updated";
            }
            res.json(ret);
        });
    }
});
app.get('/viewUsers', function(req, res) {
    var ret = {}
    if (!req.session.sessionID || !req.session.admin) {
        res.json(ret);
    } else {
        //By default, we want to get all the users if no search
        //term is specified
        var fName = "%";
        var lName = "%";
        if (!(req.param('fname') === undefined || req.param('fname').length === 0)) {
            fName = "%" + req.param('fname').trim() + "%";
        }
        if (!(req.param('lname') === undefined || req.param('lname').length === 0)) {
            lName = "%" + req.param('lname').trim() + "%";
        }
        var query = squel.select().from("users").where("fName LIKE ? AND lName LIKE ?", fName, lName).toString();
        connection.query(query, function(err, rows, fields) {
            //write results data as table for viewing
            //only fname and lname
            ret['user_list'] = rows;
            res.json(ret);
        });
    }
});
app.get('/getProducts', function(req, res) {
    var ret = {};
    var productID = "%";
    var category = "%";
    var keyword = "%";

    if (!(req.param('productId') === undefined || req.param('productId').length === 0)) {
        productID = req.param('productId').trim();
    }
    if (!(req.param('category') === undefined || req.param('category').length === 0)) {
        category = "%" + req.param('category').trim() + "%";
    }
    if (!(req.param('keyword') === undefined || req.param('keyword').length === 0)) {
        keyword = "%" + req.param('keyword').trim() + "%";
    }
    var query = squel.select().from("productdata").field("Id").field("ASIN").field("title").field("description").where("Id LIKE ? AND categories LIKE ? AND (title LIKE ? OR description LIKE ?)", productID, category, keyword, keyword).toString();
    connection.query(query, function(err, rows, fields) {
        //write results data as table for viewing
        ret['product_list'] = rows;
        res.json(ret);
    });
});
var server = app.listen(3000, function() {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Example app listening at http://%s:%s', host, port);
});