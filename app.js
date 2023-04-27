const express = require('express');
const cookieParser = require('cookie-parser');
const sessions = require('express-session');
const mysql = require('mysql');
const bodyParser = require('body-parser');
require('ejs');
const app = express();
const port = 8080;

app.use(express.static(__dirname));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// Start node server
var server = app.listen(port, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log(`Server started on host ${host}`);
    console.log(`Server started on port ${port}`);
})

// Database configuration
const con = mysql.createConnection({
    host: "34.150.146.151",
    user: "app",
    password: "password",
    database: "csc325proj1",
    port: 3306
})

// Attempt to connect to database
con.connect(function (err) {
    if (err) {
        console.log(`Error occurred in SQL connection: ${err.message}`);
        return;
    }
})
console.log("Connected to database!");

// Session configuration
var session;
const oneDay = 1000 * 60 * 60 * 24;
app.use(sessions({
    secret: "Thisismysupersecretsecret",
    saveUninitialized: true,
    cookie: { maxAge: oneDay },
    resave: true
}));

// GET for landing page
app.get('/', function (req, res) {
    session = req.session;
    res.render('pages/home', {
        loggedIn: session.loggedIn ? true : false
    });
})

// GET for login/registration page
app.get('/login', function (req, res) {
    session=req.session;
    if(session.username) {
        res.render('pages/home', {
            loggedIn: session.loggedIn ? true : false,
            user: session.username
        });
    } else {
        res.render('pages/login', {
            loggedIn: session.loggedIn ? true : false,
            confirm: "",
            error: "",
            activeTab: "login"
        });
    }
})

// GET for logout
app.get('/logout', function (req, res) {
    session=req.session;
    session.destroy();
    res.redirect('/login');
})

// POST for login/registration
app.post('/login', (req, res) => {
    session = req.session;
    var loginUsername = req.body.loginUsername;
    var loginPassword = req.body.loginPassword;
    var registerUsername = req.body.registerUsername;
    var registerPassword = req.body.registerPassword;
    var registerRepeatPassword = req.body.registerRepeatPassword;
    var roleSelection = req.body.roleSelection;
    console.log(`
        ${loginUsername}
        ${loginPassword}
        ${registerUsername}
        ${registerPassword}
        ${registerRepeatPassword}
        ${roleSelection}
    `);

    if (loginUsername) {
        con.query(
            `SELECT pass, userID FROM Users WHERE userName = '${loginUsername}'`,
            function (err, result) {
                console.log(result[0].pass);
                if (err) {
                    console.log(`Error occurred in SQL request: ${err.message}`);
                } else {
                    if(result === "") {
                        console.log("Account not found!");
                        res.render('pages/login', {
                            loggedIn: session.loggedIn ? true : false,
                            confirm: "Account with this username does not exist.",
                            error: "",
                            activeTab: "login"
                        })
                    } else if (result[0].pass === loginPassword) {
                        console.log("Redirecting to home page!");
                        session.userID = result[0].userID;
                        session.loggedIn = true;
                        session.username = loginUsername;
                        res.redirect("/");
                    } else {
                        console.log("Password incorrect!");
                        res.render('pages/login', {
                            loggedIn: session.loggedIn ? true : false,
                            confirm: "Password is incorrect.",
                            error: "",
                            activeTab: "login"
                        })
                    }
                }
            }
        );
    } else if (registerUsername) {
        if (registerPassword === registerRepeatPassword && !(roleSelection == null)) {
            con.query(
                `SELECT * FROM \`Users\` WHERE \`userName\` = '${registerUsername}'`,
                function (err, result) {
                    if (err) {
                        console.log(`Error occurred in SQL request: ${err.message}`);
                    } else {
                        if (result.length === 0) {
                            con.query(
                                `INSERT INTO \`Users\`(\`userName\`, \`pass\`, \`roleID\`) VALUES ('${registerUsername}', '${registerPassword}', ${roleSelection})`,
                                function (err) {
                                    if (err) {
                                        console.log(`Error occurred in SQL request: ${err.message}`);
                                    } else {
                                        console.log(`Added new user ${registerUsername} to database!`);
                                    }
                                }
                            );
                            res.render('pages/login', {
                                loggedIn: session.loggedIn ? true : false,
                                confirm: "Account successfully created",
                                error: "",
                                activeTab: "login"
                            });
                        } else {
                            console.log("Name already exists in database!");
                            const errMessage = "Account with that name already exists.";
                            res.render('pages/login', {
                                loggedIn: session.loggedIn ? true : false,
                                confirm: "",
                                error: errMessage,
                                activeTab: "register"
                            });
                        }
                    }
                }
            );
        } else if (registerPassword != registerRepeatPassword) {
            console.log("Passwords do not match!");
            const errMessage = "Passwords must match.";
            res.render('pages/login', {
                loggedIn: session.loggedIn ? true : false,
                confirm: "",
                error: errMessage,
                activeTab: "register"
            });
        } else {
            console.log("User did not select role!");
            const errMessage = "Must select role.";
            res.render('pages/login', {
                loggedIn: session.loggedIn ? true : false,
                confirm: "",
                error: errMessage,
                activeTab: "register"
            });
        }
    }
})

// GET for map page
app.get('/map/:problem', function (req, res) {
    var probID = req.params.problem;
    console.log(probID);
    var mapData=[];
    var query = "SELECT * FROM Users INNER JOIN Schools ON Users.schoolID = Schools.schoolID WHERE Users.userID = ANY (SELECT userID FROM Answers WHERE questionID = " + String(probID) + ")";
    console.log(query);
    con.query(
        query, 
        function (err, result) {
            if (err) {
                console.log(`Error in SQL request: ${err.message}`);
                return;
            }
            console.log(result.length);
            for(var i = 0; i < result.length; i++){
                var entry = {
                    username: result[i].userName,
                    lat: result[i].latit,
                    lng: result[i].longit
                }; 
                console.log(entry);
                mapData.push(entry);
            }
            mapData = JSON.stringify(mapData);
            console.log(mapData);
            res.render('pages/map', {
                loggedIn: session.loggedIn ? true : false,
                mapData: JSON.stringify(mapData)
            })  
        }   
    )
})

// GET for question creation page
app.get('/problem/create', function (req, res) {
    session = req.session;
    res.render('pages/problem/edit', {
        loggedIn: session.loggedIn ? true : false,
        newProblem: true
    })
})

// POST for question creation form
app.post('/problem/create', function (req, res) {
    console.log("food");
    session = req.session;
    var userID = 8; //needs to be replaced by userID session variable later
    var title = req.body.title;
    var description = req.body.description;
    var inputDesc = req.body.inputDesc;
    var inputSample = req.body.inputSample;
    var outputDesc = req.body.outputDesc;
    var outputSample = req.body.outputSample;
    var solutionLink = req.body.solutionLink;
    var date = new Date();
    console.log(date);
    var day = date.getDate();
    var month = date.getMonth()+1;
    var year = date.getFullYear();
    var currDate = year + "-" + month + "-" + day;
    console.log(currDate);
    console.log(title);
    
    //sql to query for inserting values of variables gotten from form into database
    var query = `insert into Problems(userID,title,creationDate,description,answer,sampleInput,sampleOutput,inputDescription,outputDescription) values('${userID}','${title}','${currDate}','${description}','${solutionLink}','${inputSample}','${outputSample}','${inputDesc}','${outputDesc}')`;
    console.log(query);
    con.query(
        query,
        function (err, result) {
            if (err) {
                console.log(`Error in SQL request: ${err.message}`);
                return;
            }
            
        }
    )
    
})

// GET for question editing
app.get('/problem/edit/:problemID', function (req, res) {
    session = req.session;
    let probID = req.params.problemID;
    let query = `SELECT * FROM Problems WHERE questionID = ${probID}`;
    con.query(
        query,
        function (err, result) {
            if (err) {
                console.log(`Error in SQL resquest: ${err.message}`);
                return;
            }
            res.render('pages/problem/edit', {
                loggedIn: session.loggedIn ? true : false,
                newProblem: false,
                probID: probID,
                title: result[0].title,
                description: result[0].description,
                inputDesc: result[0].inputDescription,
                inputSample: result[0].sampleInput,
                outputDesc: result[0].outputDescription,
                outputSample: result[0].sampleOutput,
                solutionLink: result[0].answer
            })
        })
})

app.post('/problem/edit/:problemID', function (req, res) {
    console.log("food2");
    session = req.session;
    let probID = req.params.problemID;
    console.log(probID);
    let title = req.body.title;
    let description = req.body.description;
    let inputDesc = req.body.inputDesc;
    let inputSample = req.body.inputSample;
    let outputDesc = req.body.outputDesc;
    let outputSample = req.body.outputSample;
    let solutionLink = req.body.solutionLink;
    //sql query for updating table
    let query = `update Problems set title ='${title}', description = '${description}', inputDescription = '${inputDesc}', sampleInput = '${inputSample}', outputDescription = '${outputDesc}', sampleOutput = '${outputSample}', answer = '${solutionLink}' where questionID = '${probID}'`
    console.log(query);
    con.query(
        query,
        function (err, result) {
            if (err) {
                console.log(`Error in SQL resquest: ${err.message}`);
                return;
            }
        }
    )
})

// GET for account page
app.get('/account', function (req, res) {
    session = req.session;
    res.render('pages/account', {
        loggedIn: session.loggedIn ? true : false,
        FullName: "Jaron Anderson",
        username: "jarbean",
        Role: "Student"
    });
})

// GET for problem list page
app.get('/list', function (req, res) {
    session = req.session;
    // var questions = [];
    var query = 'SELECT title, description FROM Problems';
    con.query(
        query, 
        function (err, result) {
            if (err) {
                console.log(`Error in SQL request: ${err.message}`);
                return;
            }
            console.log(result);
            res.render('pages/list', {
                loggedIn: session.loggedIn ? true : false,
                questions: result
            })  
        }   
    )
})