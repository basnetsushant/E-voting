const express = require("express");
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
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
var tokenExpiration =  60 * 1000;
var tokens = {};

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
    host:"sql12.freesqldatabase.com",
    database:"sql12615458",
    user:"sql12615458",
    password:"zhKv5KC99Q"
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
    var sql_check = `SELECT * FROM sql12615458.nidcheck WHERE national_id='${NID}'`;
    connection.query(sql_check, function(error, result) {
      if (error) throw error;
      if (result.length > 0) {
        var sql = `INSERT INTO sql12615458.verified_users(NID, PH_NO) VALUES('${NID}', '${PN}')`;
        connection.query(sql, function(error, result) {
          if (error) throw error;
          console.log("verified.");
        });
        // NID exists in other table, insert record in unauth_user table
        bcrypt.hash(PW, saltRounds, function(err, hash) {
          if (err) throw err;
          var sql_insert = `INSERT INTO sql12615458.unauth_user(first_name, middle_name, last_name, national_id, email, phone_number, password) VALUES('${firstname}', '${middlename}', '${lastname}', '${NID}', '${emaill}', '${PN}', '${hash}')`;
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
    var tokenExpiration = 1 * 60 * 1000;
    var token;
    
    var sql = `SELECT * FROM sql12615458.unauth_user WHERE national_id = '${nid}' AND email = '${email}'`;
    
    connection.query(sql, function(error, results) {
      if (error) throw error;
      
      if (results.length > 0) {
        var hash = results[0].password;
        
        bcrypt.compare(pass, hash, function(err, match) {
          if (err) throw err;
          
          if (match) {
            // Passwords match
            console.log(match);
            
            // Check if user has already voted
            var votedSql = `SELECT * FROM sql12615458.votedperson WHERE national_id = '${nid}'`;
            
            connection.query(votedSql, function(error, results) {
              if (error) throw error;
              
              if (results.length > 0) {
                // User has already voted
                res.redirect("/alreadyvoted");
              } else {
                // User has not voted yet
                // Insert user into active poll list
                var activePollSql = `INSERT INTO sql12615458.active_poll_list (national_id) VALUES ('${nid}')`;
                
                connection.query(activePollSql, function(error, results) {
                  if (error) throw error;
                  
                  // Generate a token with a timestamp
                  var timestamp = Date.now();
                  token = nid + secretKey + randomstring.generate(10) + timestamp;
                  
                  // Send email with unique link to voting page
                  var mailOptions = {
                    from: 'evotingproject2080@gmail.com',
                    to: email,
                    subject: 'Your unique link to the voting page',
                    html: `<p>Hi there,</p><p>Please use the following link to access your voting page:</p><p><a href="http://localhost:4000/vote/${token}">http://localhost:4000/vote/${token}/</a></p>`
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
                  
                  res.redirect("/loggedin");
                  console.log("logged in");
                });
              }
            });
          } else {
            // Passwords don't match
            res.redirect("/incorrect");
          }
        });
      } else {
        res.redirect("/incorrect");
      }
    });
  });
  

app.post('/verify', function(req,res)
{
    var nid = req.body.nid;
    var ph = req.body.phone;
    connection.query(function(error)
    {
          var sql = `SELECT * FROM sql12615458.verified_users WHERE NID = '${nid}' AND PH_NO = '${ph}' `;
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
app.use("/uploads", express.static("uploads"));

app.get('/', (req,res) => {
    res.render("index.ejs")
})

app.get('/login', (req,res) => {
    res.render("login.ejs")
})

app.get('/register', (req,res) => {
    res.render("register.ejs")
})
app.get('/result', (req, res) => {
  const sql = `SELECT candidate, role, COUNT(*) AS count FROM (
                SELECT president AS candidate, 'president' AS role FROM sql12615458.voted_list
                UNION ALL
                SELECT vicepresident AS candidate, 'vice president' AS role FROM sql12615458.voted_list
                UNION ALL
                SELECT mayor AS candidate, 'mayor' AS role FROM sql12615458.voted_list
                UNION ALL
                SELECT member AS candidate, 'member' AS role FROM sql12615458.voted_list
              ) AS candidates
              GROUP BY candidate, role ORDER BY role, count DESC`;

  connection.query(sql, (error, results) => {
    if (error) {
      console.error('Error retrieving votes from MySQL database:', error);
      res.sendStatus(500);
    } else {
      console.log('Votes retrieved from MySQL database!');
      const presidentResults = results.filter(result => result.role === 'president');
      const vicePresidentResults = results.filter(result => result.role === 'vice president');
      const mayorResults = results.filter(result => result.role === 'mayor');
      const memberResults = results.filter(result => result.role === 'member');
      res.render('result', { presidentResults, vicePresidentResults, mayorResults, memberResults });
    }
  });
});
app.get('/loggedin', (req,res) => {
  res.render("loggedin.ejs")
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
app.get('/invalidtoken', (req,res) => {
  res.render("tokenexpired.ejs")
})

app.get('/nverify', (req,res) => {
    res.render("not_verified.ejs")
})

app.get('/sregister', (req,res) => {
    res.render("registered.ejs")
})
app.get('/adminpage', (req,res) => {
  res.render("adminpage.ejs")
})
app.get('/adminlogin', (req,res) => {
  res.render("admin_login.ejs")
})
app.get('/nregister', (req,res) => {
    res.render("nregistered.ejs")
})
app.get('/incorrect', (req,res) => {
  res.render("incorrectpassword.ejs")
})
app.get('/alreadyvoted', (req,res) => {
  res.render("alreadyvoted.ejs")
})
app.get('/aftervoted', (req,res) => {
  res.render("aftervoted.ejs")
})
// voting page route
// vote route
app.get('/vote/:token', function(req, res) {
  // define variables in outer scope
  let candidates;
  let viceCandidates;
  let mayorCandidates;
  let memberCandidates;

  // retrieve presidential candidates from MySQL database
  connection.query('SELECT * FROM candidates WHERE position = "president"', (err, rows, fields) => {
      if (err) throw err;
      candidates = rows;

      // retrieve vice presidential candidates from MySQL database
      connection.query('SELECT * FROM candidates WHERE position = "vicepresident"', (err, rows, fields) => {
          if (err) throw err;
          viceCandidates = rows;

          // retrieve mayor candidates from MySQL database
          connection.query('SELECT * FROM candidates WHERE position = "mayor"', (err, rows, fields) => {
              if (err) throw err;
              mayorCandidates = rows;

              // retrieve member candidates from MySQL database
              connection.query('SELECT * FROM candidates WHERE position = "member"', (err, rows, fields) => {
                  if (err) throw err;
                  memberCandidates = rows;

                  // get token and nid from request parameters
                  var token = req.params.token;
                  var secretKey = 'mySecretKey';
                  var nid = token.slice(0, -secretKey.length - 23);

                  // check if token is valid and render voting page
                  if (isValidToken(token)) {
                      res.render('votingpage.ejs', {
                          token: token,
                          nid: nid,
                          candidates: candidates,
                          viceCandidates: viceCandidates,
                          mayorCandidates: mayorCandidates,
                          memberCandidates: memberCandidates
                      });
                  } else {
                      res.redirect('/invalidtoken');
                  }
              });
          });
      });
  });
});
app.post('/insert', upload.single('image'), (req, res) => {
  const { name, position, party } = req.body;
  const imagePath = req.file ? req.file.path : null;

  connection.query('INSERT INTO candidates (name, position, party, image) VALUES (?, ?, ?, ?)', [name, position, party, imagePath], (err, result) => {
      if (err) throw err;

      console.log('New candidate added to database');
      res.redirect('/adminpage');
  });
});
app.post('/cdelete', (req, res) => {
  connection.query('DELETE FROM candidates', (err, result) => {
      if (err) throw err;

      console.log('All candidates deleted from database');
      res.redirect('/adminpage');
  });
});
app.post('/vdelete', (req, res) => {
  connection.query('DELETE FROM votedperson', (err, result) => {
      if (err) throw err;

      console.log('All votedperson nid  deleted from database');
      
  });
  connection.query('DELETE FROM voted_list', (err, result) => {
    if (err) throw err;

    console.log('All votedlist data deleted from database');
    
});
res.redirect('/adminpage');
});
app.post('/udelete', (req, res) => {
  connection.query('DELETE FROM unauth_user', (err, result) => {
      if (err) throw err;

      console.log('All user data deleted from database');
      
  });
  connection.query('DELETE FROM verified_users', (err, result) => {
    if (err) throw err;

    console.log('All verified user data deleted from database');
    
});
  res.redirect('/adminpage');
});
app.post('/vote/:token', (req, res) => {
  const nid = req.body.nid;
  const president = req.body.president;
  const vicepresident = req.body.vicepresident;
  const mayor = req.body.mayor;
  const member = req.body.member;
  const sql3 = 'INSERT INTO sql12615458.votedperson (national_id) VALUES (?)';
  const values3 = [nid];
  connection.query(sql3, values3, (error3, result3) => {
    if(error3){console.error('error:',error3)}
  });
  bcrypt.hash(nid, saltRounds, function(err, hashedNid) {
  const sql = 'INSERT INTO sql12615458.voted_list (national_id,president, vicepresident,mayor,member) VALUES (?, ?, ?, ?, ?)';
  const values = [hashedNid,president, vicepresident,mayor,member];

  connection.query(sql, values, (error, result) => {
    if (error) {
      console.error('Error inserting vote into MySQL database:', error);
      res.sendStatus(500);
    } else {
      const sql2 = 'DELETE FROM sql12615458.active_poll_list WHERE national_id = ?';
      const values2 = [nid];
      
      connection.query(sql2, values2, (error2, result2) => {
        if (error2) {
          console.error('Error deleting user from active poll list:', error2);
        } else {
          console.log('User deleted from active poll list');
        }
      });
      console.log('Vote inserted into MySQL database!');
      res.redirect('/aftervoted');
    }
  });
});
});
app.post('/adminlogin', function(req, res) {
  const { u_name, p_name } = req.body;

  const sql = `SELECT * FROM adminlogin WHERE username = ? AND password = ?`;
  const values = [u_name, p_name];

  connection.query(sql, values, function(err, result) {
    if (err) throw err;
    if (result.length > 0) {
      // Login successful
      res.redirect('/adminpage');
    } else {
      // Login failed
      res.send('Invalid username or password');
    }
  });
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