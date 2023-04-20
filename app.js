const express = require('express');
const cookieParser = require('cookie-parser');
const sessions = require('express-session');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const app = express();
const port = 8080;

app.use(express.static(__dirname));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

const con = mysql.createConnection({
    host: "34.150.146.151",
    user: "app",
    password: "password",
    database: "csc325proj1"
})

const oneDay = 1000 * 60 * 60 * 24;
app.use(sessions({
    secret: "Thisismysupersecretsecret",
    saveUninitialized: true,
    cookie: { maxAge: oneDay },
    resave: true
}));

var session;

app.get('/', function (req, res) {
    res.render('pages/home');
})

app.get('/login', function (req, res) {
    session=req.session;
    if(session.username) {
        res.render('pages/home', {
            user: session.username
        });
    } else {
        res.render('pages/login', {
            confirm: "",
            error: "",
            activeTab: "login"
        });
    };
})

app.get('/logout', function (req, res) {
    session=req.session;
    session.destroy();
    res.redirect('/');
})

var server = app.listen(port, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log(`Server started on port ${port}`);
})

app.post('/login', (req, res) => {
    var loginUsername = req.body.loginUsername;
    var loginPassword = req.body.loginPassword;
    var registerUsername = req.body.registerUsername;
    var registerPassword = req.body.registerPassword;
    var registerRepeatPassword = req.body.registerRepeatPassword;
    console.log(`
        ${loginUsername}
        ${loginPassword}
        ${registerUsername}
        ${registerPassword}
        ${registerRepeatPassword}
    `);

    session = req.session;

    if (loginUsername) {
        con.connect(function (err) {
            if (err) {
                console.log(`Error occurred in SQL connection: ${err.message}`);
            };
        })
        console.log("Connected to database!");
        con.query(
            `SELECT \`Password\` FROM \`Users\` WHERE \`UserName\` = '${loginUsername}'`,
            function (err, result) {
                console.log(result[0].Password);
                if (err) {
                    console.log(`Error occurred in SQL request: ${err.message}`);
                } else {
                    if(result === "") {
                        console.log("Account not found!");
                        res.render('pages/login', {
                            confirm: "Account with this username does not exist.",
                            error: "",
                            activeTab: "login"
                        })
                    } else if (result[0].Password === loginPassword) {
                        console.log("Redirecting to home page!");
                        session.username = loginUsername;
                        res.redirect("/");
                    } else {
                        console.log("Password incorrect!");
                        res.render('pages/login', {
                            confirm: "Password is incorrect.",
                            error: "",
                            activeTab: "login"
                        })
                    };
                };
            }
        );
    } else if (registerUsername) {
        if (registerPassword === registerRepeatPassword) {
            con.connect(function (err) {
                if (err) {
                    console.log(`Error occurred in SQL connection: ${err.message}`);
                };
                console.log("Connected to database!");
                con.query(
                    `SELECT * FROM \`Users\` WHERE \`UserName\` = '${registerUsername}'`,
                    function (err, result) {
                        if (err) {
                            console.log(`Error occurred in SQL request: ${err.message}`);
                        } else {
                            if (result.length === 0) {
                                con.query(
                                    `INSERT INTO \`Users\`(\`UserName\`, \`Password\`) VALUES ('${registerUsername}', '${registerPassword}')`,
                                    function (err, result) {
                                        if (err) {
                                            console.log(`Error occurred in SQL request: ${err.message}`);
                                        } else {
                                            console.log(`Added new user ${registerUsername} to database!`);
                                        };
                                    }
                                );
                                res.render('pages/login', {
                                    confirm: "Account successfully created",
                                    error: "",
                                    activeTab: "login"
                                });
                            } else {
                                console.log("Name already exists in database!");
                                const errMessage = "Account with that name already exists.";
                                res.render('pages/login', {
                                    confirm: "",
                                    error: errMessage,
                                    activeTab: "register"
                                });
                            };
                        };
                    }
                );
            });
        } else {
            console.log("Passwords do not match!");
            const errMessage = "Passwords must match.";
            res.render('pages/login', {
                confirm: "",
                error: errMessage,
                activeTab: "register"
            });
        }
    };
})

app.get('/map/:problem', function (req, res) {
    var probID = req.params.problem;
    con.connect(function (err) {
        if (err) {
            console.log(`Error occurred in SQL connection: ${err.message}`);
        };
    })
    console.log("Connected to database!");
    console.log(probID);
    var mapData=[];
    var query = "SELECT * FROM Users INNER JOIN Schools ON Users.schoolID = Schools.schoolID WHERE Users.userID = ANY (SELECT userID FROM Answers WHERE questionID = " + String(probID) + ")";
    console.log(query);
    con.query(
        query, 
        function (err, result) {
            if (err) {
                console.log(`Error in SQL request: ${err.message}`);
            }
            else {
                console.log("got to foreach");
                result.forEach(row => { 
                  var entry = {
                    name: row.userName,
                    lat: row.latit,
                    lng: row.longit
                  }; 
                  mapData.push(entry);
                });
            }
        }
        
    )
    res.send(mapData);
    
})