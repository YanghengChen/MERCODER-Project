const express = require('express');
const cookieParser = require('cookie-parser');
const sessions = require('express-session');
const https = require('https')
const mysql = require('mysql');
const bodyParser = require('body-parser');
const { ECDH } = require('crypto');
const bcrypt = require('bcrypt');
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
        username: session.username ? session.username : "",
        loggedIn: session.loggedIn ? true : false
    });
})

// GET for login/registration page
app.get('/login', function (req, res) {
    session=req.session;
    if(session.username) {
        res.redirect('/');
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

//functions for bycrpyt hashing
async function hashPassword(plaintextPassword,userName,role) {
    const hash = await bcrypt.hash(plaintextPassword, 10);
    // Store hash in the database
    let query = `insert into Users(userName,pass,roleID) values('${userName}','${hash}',${role})`;
    con.query(
        query,
        function (err) {
            if (err) {
                console.log(`Error occurred in SQL request: ${err.message}`);
            }
        }
    );
}

// compare password
async function comparePassword(plaintextPassword, hash) {
    const myPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve('Promise resolved');
        }, 1000);
    });
    const result = await bcrypt.compare(plaintextPassword, hash);
    //console.log(result);
    return result;
    
}
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
            `SELECT * FROM Users WHERE userName = '${loginUsername}'`,
            async function (err, result) {
                console.log(err);
                console.log(result);
                console.log("result below");
                let test;
                console.log(result[0].pass);
                console.log(loginPassword);
                test = await comparePassword(loginPassword,result[0].pass);
                console.log(test);
                //console.log(result[0].pass);
                if (err) {
                    console.log(`Error occurred in SQL request: ${err.message}`);
                } else {
                    if(!result || result.length === 0) {
                        console.log("Account not found!");
                        res.render('pages/login', {
                            loggedIn: session.loggedIn ? true : false,
                            confirm: "Account with this username does not exist.",
                            error: "",
                            activeTab: "login"
                        })
                    } else if (test === true) {
                        console.log("Redirecting to home page!");
                        session.userID = result[0].userID;
                        session.fullName = result[0].name;
                        session.schoolID = result[0].schoolID;
                        session.roleID = result[0].roleID;
                        session.username = loginUsername;
                        session.loggedIn = true;
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
                            hashPassword(registerPassword,registerUsername,roleSelection);
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
    var solutionData=[];
    var query = `SELECT * FROM Users INNER JOIN Schools ON Users.schoolID = Schools.schoolID WHERE Users.userID = ANY (SELECT userID FROM Answers WHERE questionID = ${probID})`;
    con.query(
        query, 
        function (err, result) {
            if (err) {
                console.log(`Error in SQL request: ${err.message}`);
                return;
            }
            for(var i = 0; i < result.length; i++){
                var entry = {
                    username: result[i].userName,
                    answer: result[i].answer,
                    lat: result[i].latit,
                    lng: result[i].longit
                }; 
                solutionData.push(entry);
            }
            solutionData = JSON.stringify(solutionData);
            res.render('pages/map', {
                loggedIn: session.loggedIn ? true : false,
                solutionData: JSON.stringify(solutionData)
            })  
        }   
    )
})

app.get("/problem/view/:probID", async (req, res) => {
    session = req.session;
    let probID = req.params.probID;

    con.query(
        `SELECT Problems.*, Users.name, Users.userName
        FROM Problems
        LEFT JOIN Users
        ON Users.userID = Problems.userID
        WHERE Problems.questionID = ${probID}`, 
        (err, result) => {
            if (err) {
                console.log(`Error in SQL request: ${err.message}`);
                return;
            }

            if (result.length === 0) {
                res.redirect('/error')
            }

            // Convert Date to Readable String
            function sqlDateToStr(sqlDate) {
                let date = new Date(sqlDate);
                let month = date.toLocaleDateString('en-US', {month: 'long'});
                let day = date.getDate();
                let year = date.getFullYear();
                let weekday = date.toLocaleDateString('en-US', {weekday: 'long'});
                date = weekday + ' ' + month + ' ' + day + ' '  + year
                return date
            }
            
            result[0].creationDate = sqlDateToStr(result[0].creationDate)

            let problemData = result[0]
            var solutionData = new Array();
            con.query(
            `SELECT * FROM Users
            INNER JOIN Schools ON Users.schoolID = Schools.schoolID 
            INNER JOIN Answers ON Users.userID = Answers.userID
            WHERE Users.userID = ANY (SELECT userID FROM Answers WHERE questionID = ${probID})`, 
            (err, result) => {
                if (err) {
                    console.log(`Error in SQL request 275: ${err.message}`);
                    return;
                }

                for(var i = 0; i < result.length; i++){
                    var entry = {
                        username: result[i].userName,
                        answer: result[i].answer,
                        date: sqlDateToStr(result[i].creationDate),
                        lat: result[i].latit,
                        lng: result[i].longit
                    }; 
                    solutionData.push(entry);
                }
                console.log(solutionData)
                res.render('pages/problem/problem-view', {
                    loggedIn: session.loggedIn ? true : false,
                    problemData: problemData,
                    roleID: session.roleID,
                    userID: session.userID,
                    solutionData: solutionData
                })
            })
        }
    )
});

// GET for question creation page
app.get('/problem/create', function (req, res) {
    session = req.session;
    if (!session.roleID || session.roleID == 0) {
        console.log("User does not have permission!");
        res.redirect('/');
        return;
    }
    res.render('pages/problem/edit', {
        loggedIn: session.loggedIn ? true : false,
        newProblem: true
    })
})

// POST for question creation form
app.post('/problem/create', function (req, res) {
    session = req.session;
    var userID = session.userID;
    var title = req.body.title;
    var description = req.body.description;
    var inputDesc = req.body.inputDesc;
    var inputSample = req.body.inputSample;
    var outputDesc = req.body.outputDesc;
    var outputSample = req.body.outputSample;
    var solutionLink = req.body.solutionLink;
    var date = new Date();
    var day = date.getDate();
    var month = date.getMonth()+1;
    var year = date.getFullYear();
    var currDate = year + "-" + month + "-" + day;
    //sql to query for inserting values of variables gotten from form into database
    var query = `insert into Problems(userID,title,creationDate,description,answer,sampleInput,sampleOutput,inputDescription,outputDescription) values('${userID}','${title}','${currDate}','${description}','${solutionLink}','${inputSample}','${outputSample}','${inputDesc}','${outputDesc}')`;
    con.query(
        query,
        function (err, result) {
            if (err) {
                console.log(`Error in SQL request: ${err.message}`);
                return;
            }
            
        }
    )

    con.query(
        `SELECT questionID FROM Problems ORDER BY questionID DESC LIMIT 1`,
        (err, result) => {
            res.redirect(`/problem/view/${result[0].questionID}`)
        }
    )
})

// GET for question editing
app.get('/problem/edit/:problemID', function (req, res) {
    session = req.session;
    if (!(session.roleID) || session.roleID == 0) {
        res.redirect('/');
        return;
    }
    let probID = req.params.problemID;
    let query = `SELECT * FROM Problems WHERE questionID = ${probID}`;
    con.query(
    query,
    function (err, result) {
        if (err) {
            console.log(`Error in SQL resquest: ${err.message}`);
            return;
        }

        if (result[0].userID != session.userID) {
            res.redirect('/list')
            return
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
    session = req.session;
    let probID = req.params.problemID;
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

    res.redirect(`/problem/view/${probID}`)
})

// GET for account page
app.get('/account', function (req, res) {
    session = req.session;
    let schoolName = "No School";
    if (session.schoolID != null) {
        let query = `SELECT schoolName FROM Schools WHERE schoolID = ${session.schoolID}`;
        con.query(
            query,
            function (err, result) {
                if (err) {
                    console.log(`Error in SQL resquest: ${err.message}`);
                    return;
                }
                schoolName = result[0].schoolName;
            }
        )
    }
    let schools = [];
    let query = `SELECT schoolName from Schools`;
        con.query(
            query,
            function (err, result) {
                if (err) {
                    console.log(`Error in SQL resquest: ${err.message}`);
                    return;
                }
                for(let i = 0; i < result.length; i++){
                    schools.push(result[i].schoolName);
                }
                res.render('pages/account', {
                    loggedIn: session.loggedIn ? true : false,
                    fullName: session.fullName,
                    school: schoolName,
                    roleID: session.roleID,
                    username: session.username,
                    schools: schools
                });
            }
        )

        
})

// GET for problem list page
app.get('/list', function (req, res) {
    session = req.session;
    // var questions = [];
    var query = 'SELECT title, description, questionID FROM Problems';
    con.query(
        query, 
        function (err, result) {
            if (err) {
                console.log(`Error in SQL request: ${err.message}`);
                return;
            }
            res.render('pages/list', {
                userRole: session.roleID ? session.roleID : 3,
                loggedIn: session.loggedIn ? true : false,
                questions: result
            })  
        }   
    )
})

//function that gives value and forces program to wait for result of query
function executeQuery(query) {
    return new Promise((resolve, reject) => {
      con.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
}
  
app.post('/account/edit', async function (req, res) {
    session = req.session;
    let school = {name:" "};
    let realName;
    var schoolID = [];
    school.name = req.body.school;
    if(school.name === "Select School"){
      return;
    }
    console.log(session.roleID);
    //check if logged in user is a student
    if (session.roleID === 0){
      var query = `select schoolID from Schools where schoolName = "${school.name}"`;
      try {
        const result = await executeQuery(query);
        schoolID.push(result[0].schoolID);
        session.schoolID = schoolID;
        //console.log(school.ID);
        query = `update Users set schoolID = ${schoolID[0]} where userID = ${session.userID}`;
        con.query(
        query,
        function(err, result) {
            if (err) {
                console.log(`Error in SQL request: ${err.message}`);
                return;
            }
            
        }
    )
      } catch (error) {
        console.log(`Error in SQL request: ${error.message}`);
      }
    }
    //check if the role of the user is a teacher.
    if(session.roleID === 1){
        school.name = req.body.newSchool;
        query = `select schoolID from Schools where schoolName = "${school.name}"`;
        realName = req.body.fullName;
        const result = await executeQuery(query);
        if (result.length === 0){
            //string manipulation for the URL to be sent to google
            var address = req.body.address;
            var city = req.body.city;
            var state = req.body.state;
            var gAddress = `${address} ${city} ${state}`
            gAddress = gAddress.replace(/ /g,'%20');
            var path = "/maps/api/geocode/json?address=" + gAddress + "&key=AIzaSyBns3Cd20dcOsq-JPFkAIRkHsZ_-wAULeU";
            const options = {
                hostname: 'maps.googleapis.com',
                path: path,
                method: 'GET'
            };

            //get lat and long from address
            const geocode_req = await new Promise((resolve, reject) => {
                const req = https.request(options, (res) => {
                    let data = ''
                    
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    
                    // Ending the response 
                    res.on('end', () => {
                        data = JSON.parse(data);
                        resolve(data);
                    });
                    
                }).on("error", (err) => {
                    console.log("Error: ", err);
                }).end()
            });

            let lat = geocode_req.results[0].geometry.location.lat;
            let lng = geocode_req.results[0].geometry.location.lng;
            query = `insert into Schools(schoolName, address, latit, longit) values("${school.name}","${address}","${lat}","${lng}")`;
            con.query(
                query,
                function(err, result) {
                    if (err) {
                        console.log(`Error in SQL request: ${err.message}`);
                        return;
                    }
                }
            )
        }
        else{
            schoolID.push(result[0].schoolID);
            session.fullName = realName;
            session.schoolID = schoolID;
            query = `update Users set schoolID = ${schoolID[0]}, name = "${realName}" where userID = ${session.userID}`;
            con.query(
            query,
            function(err, result) {
                if (err) {
                    console.log(`Error in SQL request: ${err.message}`);
                    return;
                }
                
            }
        )}
    }
    req.session.save();
    res.redirect('/account');
});

app.post('/problem/submitSolution/:probID', (req, res) => {
    let probID = req.params.probID;
    let answer = req.body.answer;
    con.query(
        `INSERT INTO Answers (questionID, answer, userID, answerStatus, creationDate)
        VALUES (${probID}, '${answer}', ${session.userID}, 1, NOW())`,
        (err, result) => {
            if (err) {
                console.log(`Error in SQL request: ${err.message}`);
                return;
            }

            console.log("Solution successfully added.")
        }
    )

    res.redirect(`/problem/view/${probID}`)
})

//get for loading error 404
app.get('*', function(req, res){
        res.status(404).send(
            "<h1> Error 404: Page Not Found </h1>"
        );
    
});
