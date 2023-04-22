const express = require("express");
const app = express();
const sessions = require('express-session');
const bcrypt = require("bcrypt") //importing bcrypt hash
const LocalStrategy = require("passport-local").Strategy
const saltRounds = 10;
const bodyParser = require('body-parser');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const randomstring = require('randomstring');
const ejs = require('ejs');
var tokenExpiration = 2* 60 * 1000;
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'evotingproject2080@gmail.com',
    pass: 'tothdngbgmmiswxb'
  }
});

app.set('view engine', 'ejs');
const mysql = require("mysql");

const connection = mysql.createConnection({
    host:"localhost",
    database:"voters",
    user:"root",
    password:"root123"
});
app.use(bodyParser.json());

app.use(express.urlencoded({extended: false}))
app.use(bodyParser.urlencoded({extended: true}));
var PW = generateRandomPassword(10);
app.post("/register", function(req, res) {
    var firstname = req.body.f_name;
    var middlename = req.body.m_name;
    var lastname = req.body.l_name;
    var NID = req.body.nid;
    var emaill = req.body.email;
    var PN = req.body.phone;
   
    console.log('Pass:',PW);
  
    // Check if NID exists in nidcheck vanni table ma //tannai nid haru store huncha
    var sql_check = `SELECT * FROM voters.nidcheck WHERE national_id='${NID}'`;
    connection.query(sql_check, function(error, result) {
      if (error) throw error;
      if (result.length > 0) {
        // NID exists in other table, insert record in unauth_user table
        bcrypt.hash(PW, saltRounds, function(err, hash) {
          if (err) throw err;
  
          var sql_insert = `INSERT INTO voters.unauth_user(first_name, middle_name, last_name, national_id, email, phone_number, password) VALUES('${firstname}', '${middlename}', '${lastname}', '${NID}', '${emaill}', '${PN}', '${hash}')`;
  
          connection.query(sql_insert, function(error, result) {
            if (error) throw error;
            res.redirect("/sregister");
            console.log("success");
          });
        });
        const mailOptions = {
          from: 'evotingproject2080@gmail.com',
          to: emaill,
          subject: 'E-voting security alert',
          text: `Dear ${firstname}, 
          We hope this email finds you well. As a user of E-voting site, we are writing to provide you with a new password to access the E-voting website. This password is needed for you to securely access through and use the features of the app.
          Your password is as follows:
          password : ${PW}
          Please note that this password is automatically generated by our system.
          Thank you for using E-voting.
          Best regards,
          E-voting Project
          evotingproject2080@gmail.com
          `
        };
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log(error);
            res.status(500).send('Error sending email');
          } else {
            console.log('Email sent: ' + info.response);  
          }
        });
      } else {
        // NID does not exist in other table, user is not eligible to vote
        res.redirect("/nregister");
      }
    });
    
  });
  
  app.post('/login', function(req, res) {
    var nid = req.body.nid;
    var email = req.body.Email;
    var pass = req.body.password;
    var secretKey = 'mySecretKey';
     // 1 min in milliseconds
    
    var sql = `SELECT * FROM Voters.unauth_user WHERE national_id = '${nid}' AND email = '${email}'`;
    
    connection.query(sql, function(error, results) {
      if (error) throw error;
    
      if (results.length > 0) {
        var hash = results[0].password;
    
        bcrypt.compare(pass, hash, function(err, match) {
          if (err) throw err;
    
          if (match) {
            // Passwords match
            console.log(match);
            
            // Generate a token with a timestamp
            var timestamp = Date.now();
            var token = email + secretKey + randomstring.generate(10) + timestamp;
            
            // Send email with unique link to voting page
            var mailOptions = {
              from: 'evotingproject2080@gmail.com',
              to: email,
              subject: 'Your unique link to the voting page',
              html: `<p>Hi there,</p><p>Please use the following link to access your voting page:</p><p><a href="http://localhost:4000/vote/${token}">http://localhost:4000/vote/${token}</a></p>`
            };
  
            transporter.sendMail(mailOptions, function(error, info) {
              if (error) {
                console.log(error);
              } else {
                console.log('Email sent: ' + info.response);
              }
            });
  
            // Set a timeout to delete the token after it expires
            setTimeout(function() {
              delete tokens[token];
            }, tokenExpiration);
  
            res.send('Logged in.');
            console.log("logged in");
          } else {
            // Passwords don't match
            res.send('Incorrect password.');
          }
        });
      } else {
        res.send('Incorrect info.');
      }
    });
  });

app.post('/verify', function(req,res)
{
    var nid = req.body.nid;
    var ph = req.body.phone;
    connection.connect(function(error)
    {
        if (error) throw error;
        var sql = `SELECT * FROM Voters.Auth_Voters WHERE NID = '${nid}' AND PH_NO = '${ph}' `;
        connection.query(sql,function(error,result)
        {
            if (error) 
            {
                throw error;
            }
            else if(result.length > 0)
            {

                res.redirect("/yverify");
            }
            else
            {
                res.redirect("/nverify");
            }
            res.end();
        });
    });
})

/*app.post("/register", async (req, res) => {
    try
    {
        //For hashed password and info
        const hashedPassword = await bcrypt.hash(req.body.password)
        users.push({
            id: Date.now().toString(),
            fname: req.body.f_name,
            mname: req.body.m_name,
            lname: req.body.l_name,
            nid: req.body.nid,
            email: req.body.email,
            phone: req.body.phone

        })
        res.redirect("/")
    }
    catch(e)
    {
        console.log(e);
        res.redirect("/register")
    }
})*/

//routes
app.use("/css", express.static("css"));
app.use("/img", express.static("img"));
app.use("/js", express.static("js"));

app.get('/', (req,res) => {
    res.render("index.ejs")
})

app.get('/login', (req,res) => {
    res.render("login.ejs")
})

app.get('/register', (req,res) => {
    res.render("register.ejs")
})

app.get('/aboutus', (req,res) => {
    res.render("aboutus.ejs")
})

app.get('/contactus', (req,res) => {
    res.render("contactus.ejs")
})

app.get('/remember', (req,res) => {
    res.render("for_pass.ejs")
})

app.get('/verify', (req,res) => {
    res.render("verify.ejs")
})

app.get('/yverify', (req,res) => {
    res.render("verified.ejs")
})

app.get('/nverify', (req,res) => {
    res.render("not_verified.ejs")
})

app.get('/sregister', (req,res) => {
    res.render("registered.ejs")
})
app.get('/nregister', (req,res) => {
    res.render("nregistered.ejs")
})
// voting page route
// vote route
app.get('/vote/:token', function(req, res) {
  
  
  var token = req.params.token;
  // var email = token.replace('mySecretKey', '').slice(0, -10);
  if (isValidToken(token)) {
    
  res.render('votingpage', {token: token });
  } else {
    
    res.send('Invalid or expired token.');
  }
});


//end routes
function isValidToken(token) {
  var timestamp = token.substring(token.length - 13);
  var expiration = parseInt(timestamp) + tokenExpiration;
  return Date.now() < expiration;
}


app.listen(4000);
function generateRandomPassword(length) {
  return crypto.randomBytes(Math.ceil(length/2))
          .toString('hex')
          .slice(0,length);
}