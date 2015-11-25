var express = require('express');
var mysql = require('mysql');
var squel = require("squel");
var session = require('express-session')
var bodyParser = require('body-parser');

var vldt = require('validator');

var MongoStore = require('connect-mongo')(session);
var mongojs = require('mongojs');
var mongoURL = 'mongodb://localhost/proj5';
db = mongojs(mongoURL,['productdata', 'users', 'orders'], {authMechanism: 'ScramSHA1'});



var app = express();
app.set('view engine', 'jade');

var sess = {
    key: 'keyboard',
    secret: 'keyboard cat',
    cookie: {
        httpOnly: true,
        maxAge: 15 * 60 * 1000,
        expires: false
    },
    store: new MongoStore({
        db: 'proj5session',
        host: 'localhost',
        collection: 'session',
        autoReconnect: true
    }),
    resave: true,
    saveUninitialized: false,
    rolling: true
}


app.use(session(sess));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));


app.get('/', function(req, res){
    res.json({'message':'Server 1'});

});

app.post('/registerUser', function(req, res) {
    var r = req.body;
    var ret = {};
    if (r.fname.length < 2 || r.lname.length < 2 || r.fname == null || r.lname == null || r.address == null || r.city == null || r.state == null || r.email == null || r.username == null || r.password == null){
        ret['message'] = "there was a problem with your registration";
        res.json(ret);
    }else if (r.fname == '' || r.lname == '' || r.address == '' || r.city == '' || r.state == '' || r.email == '' || r.username == '' || r.password == ''){
        ret['message'] = "there was a problem with your registration";
        res.json(ret);
    }else if(!vldt.isEmail(r.email)){
        ret['message'] = "there was a problem with your registration";
        res.json(ret);
    }else{
        var collection = db.collection('users');
        collection.find({$or: [{$and: [{"fname": r.fname, "lname": r.lname}]}, {$and: [{"uname": r.username, "pword": r.password}]}]}).toArray(function (err, results) {
            if(results.length == 0){
                collection.insert({"uname": r.username, "pword": r.password, "email": r.email, "fname": r.fname, "lname": r.lname, "address": r.address, "city": r.city, "state": r.state, "admin": "FALSE"}, function (err, rows) {
                    if (!err) {
                        ret['message'] = "Your account has been registered";
                    } else {
                        ret['message'] = "there was a problem with your registration";
                    }
                    res.json(ret);
                });
            }else{
                ret['message'] = "there was a problem with your registration";
                res.json(ret);
            }
        });
    }
});

app.post('/login',  function(req, res) {
    var r = req.body;
    var ret = {};
    var user = ['/updateInfo', '/getProducts', '/buyProduct'];
    var admin = ['/updateInfo', '/getProducts', '/viewUsers', '/modifyProducts', '/buyProduct', '/getOrders'];
    if (r.username == null || r.password == null){
        ret['err_message'] = "That username and password combination was not correct";
        res.json(ret);
    }else{
        var collection = db.collection('users');
        collection.find({$and: [{"uname": r.username}, {"pword": r.password}]}).toArray(function (err, rows) {
            results = rows;
            //console.log(results);
            if (!err && results.length > 0) {
                req.session.sessionID = r.username;
                //console.log(r.username);
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
        var collection = db.collection('users');
        collection.find({'uname': req.session.sessionID}).toArray(function (err, results) {
            if(results.length == 0 || err){
                ret['message'] = "There was a problem with this action";
                res.json(ret);
            }else{
                var obj = results[0];
                if(!r.username)
                    r.username = obj.uname;
                if(!r.password)
                    r.password = obj.pword;
                if(!r.fname)
                    r.fname = obj.fname;
                if(!r.lname)
                    r.lname = obj.lname;
                if(!r.address)
                    r.address = obj.address;
                if(!r.state)
                    r.state = obj.state;
                if(!r.city)
                    r.city = obj.city;
                if(!r.email)
                    r.email = obj.email;
                if(!vldt.isEmail(r.email)){
                    ret['message'] = "There was a problem with this action";
                    res.json(ret);
                }else{
                    collection.update({'uname': req.session.sessionID},{$set:{"uname": r.username, "pword": r.password, "email": r.email, "fname": r.fname, "lname": r.lname, "address": r.address, "city": r.city, "state": r.state, "admin": adminsql }}, {multi: true}, function (err, rows) {
                        if (err) {
                            ret['message'] = "There was a problem with this action";
                        } else {
                            req.session.sessionID = r.username;
                            ret['message'] = "Your information has been updated";
                        }
                        res.json(ret);
                    });
                }
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
        var collection = db.collection('productdata');

        collection.update({Id: parseInt(productID)}, {$set: {title: productTitle, groups: productDescription}}, {multi: true}, function (err, done) {
            //write results data as table for viewing
            if (err || !done) {
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
        var fname = ".*";
        var lname = ".*";
        if (!(req.param('fname') === undefined || req.param('fname').length === 0)) {
            fname = ".*" + req.param('fname').trim() + ".*";
        }
        if (!(req.param('lname') === undefined || req.param('lname').length === 0)) {
            lname = ".*" + req.param('lname').trim() + ".*";
        }
        var collection = db.collection('users');
        collection.find({$and: [{fname: {$regex: fname}}, {lname: {$regex: lname}}]}, {_id: 0, fname: 1, lname: 1}).toArray(function (err, results) {
            //write results data as table for viewing
            //only fname and lname
            ret['user_list'] = results;
            res.json(ret);
        });
    }
});
app.get('/getProducts', function(req, res) {
    var ret = {};
    var productID = ".*";
    var category = ".*";
    var keyword = ".*";
    var exp = {};

    if (!(req.param('productId') === undefined || req.param('productId').length === 0)) {
        productID = req.param('productId').trim();
        exp = {Id: parseInt(productID)};
    }
    if (!(req.param('category') === undefined || req.param('category').length === 0)) {
        category = ".*" + req.param('category').trim() + ".*";
    }
    if (!(req.param('keyword') === undefined || req.param('keyword').length === 0)) {
        keyword = ".*" + req.param('keyword').trim() + ".*";
    }
    //var query = squel.select().from("productdata").field("title").where("Id LIKE ? AND categories LIKE ? AND (title LIKE ? OR description LIKE ?)", productID, category, keyword, keyword).toString();
    var collection = db.collection('productdata');
    //console.log(exp);
    collection.find({$and: [exp, {categories: {$regex: category}}, {$or: [{title: {$regex: keyword}}, {description: {$regex: keyword}}]}]}).toArray(function (err, results) {
        //write results data as table for viewing
        ret['product_list'] = results;
        res.json(ret);
    });
});

app.post('/buyProduct', function(req, res){
	var ret = {};
	if (!req.session.sessionID){
		ret['message'] = "you need to log in prior to buying a product";
		res.json(ret);
	}else{
		var pid = req.body.productId;
		var query = squel.select().from("productdata").field("count").where("Id = ?", pid).toString();

        var collection = db.collection('productdata');

		collection.find({Id: parseInt(pid)}).toArray(function (err, results) {
			var count = results[0].count;
			if(count == 0){
				ret['message'] = "product is out of stock";
				res.json(ret);
			}else{
                collection.update({Id: parseInt(pid)}, {$set: {quantity: (count - 1)}}, {multi: true}, function (err, done) {
                    if(err || !done){
                        ret['message'] = "there was a problem with this action";
                        res.json(ret);
                    }else{
                        db.orders.update({pid: parseInt(pid)}, {pid: parseInt(pid), sold: parseInt(5 - (count - 1))}, {upsert: true}, function (err, rows) {
                            ret['message'] = "purchase has been made successfully";
                            res.json(ret);
                        });
                    }   
                });
		    }
        }); 
	}
});

app.post('/getOrders', function(req, res){
	var ret = {};
	if (!req.session.sessionID || !req.session.admin) {
        ret['message'] = "you need to log in as an admin prior to making the request";
        res.json(ret);
    }else{
    	var query = squel.select().from("orders").toString();
    	var orders = db.collection('orders');
        orders.find().toArray(function (err, results) {
    		ret['list'] = results;
    		ret['message'] = "the request was successful";
    		res.json(ret);
    	});
    }
    return ret;
});


var server = app.listen(3000, function() {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Example app listening at http://%s:%s', host, port);
});