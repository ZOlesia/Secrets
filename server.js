const   express = require("express"),
        app = express(),
        path = require("path"),
        bodyParser = require('body-parser'),
        session = require('express-session'),
        mongoose = require('mongoose'),
        flash = require('express-flash'),
        uniqueValidator = require('mongoose-unique-validator'),
        bcrypt = require('bcrypt'),
        saltRounds = 10;


app.use(session({
    secret: 'keyboardkitteh',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60000 }
}))
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "./static")));
app.set('views', path.join(__dirname, './views'));
app.set('view engine', 'ejs');
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost/secret_mongoose');
app.use(flash());


var CommentSchema = new mongoose.Schema({
    comment: {type: String, required: [true, 'Comment field cannot be empty']}
}, {timestamps: true})

var SecretSchema = new mongoose.Schema({
    secret: {type: String, required: [true, 'Secret field cannot be empty'], minlength: 5},
    comments: [{type: CommentSchema, ref: Comment}]
}, {timestamps: true})

var UserSchema = new mongoose.Schema({
    first_name :{type: String, required: [true, 'First Name field at least 2 characters'], minlength: 2},
    last_name :{type: String, required: [true, 'Last Name field at least 2 characters'], minlength: 2},
    email :{type: String, required: [true, 'Email is required'], uniqueCaseInsensitive: true, unique: true},
    password: {type: String, required: true, minlength: 6},
    dob :{type: Date},
    secrets: [{type: SecretSchema, ref: 'Secret'}]
}, {timestamps: true})

UserSchema.plugin(uniqueValidator, { message: '{PATH} is already in use' });
var Comment = mongoose.model('Comment', CommentSchema);
var Secret = mongoose.model('Secret', SecretSchema);
var User = mongoose.model('User', UserSchema);



app.get('/' , function(req, res){
    res.render('index');
})

app.post('/register', function(req, res){
    bcrypt.hash(req.body.password, saltRounds, function(err, hash){
        if(req.body.password !== req.body.conf_password){
            req.flash("password_match", "passwords must match");
            console.log('***************PASSWORD DOESNT MATCH***************');
            res.redirect('/');
        }
        else{
            console.log(req.body);
            var newUser = new User({first_name: req.body.firstname, 
                                    last_name: req.body.lastname, 
                                    email: req.body.email, 
                                    password: hash,
                                    dob: req.body.dob
                                });
            console.log(newUser);
            console.log(newUser.password + " ********************");
            newUser.save(function(err){
                if(err){
                    console.log('ERROR REGISTER');
                    for(var key in err.errors){
                        req.flash("registration", err.errors[key].message)
                    }
                    
                    // req.flash("usedemail", "Email is already in use");
                    res.redirect('/');
                }
                else{
                    console.log('YOU SAVED NEW USER');
                    console.log(newUser.password);
                    req.session.current_user = newUser._id;
                    res.redirect('/secrets');
                }
            })

        }
    })
})



app.post('/login', (req, res) => {
    User.findOne({email: req.body.loginemail}, (err, user) => {
        console.log(user);
        if(user == null || err){
            console.log('******NO USER********');
            req.flash("loginemail", "Please check your email otherwise go to register");
            res.redirect('/');
        }
        else{
            bcrypt.compare(req.body.loginpw, user.password, (err, psw) => {
                if(psw){
                    req.session.current_user = user._id;
                    res.redirect('/secrets');                }
                else{
                    console.log('***************PASSWORD IS INCORRECT************');
                    req.flash("loginpw", "Password is incorrect");
                    res.redirect('/');
                }
            });
        }
    })
})

app.get('/secrets', function(req, res){
    if(req.session.current_user == null){
        res.redirect('/');
    }
    else{
        Secret.find({}, function(err, secrets){
        if(err){
                console.log(err);
            } else{
                User.findOne({_id: req.session.current_user}, function(err, user){
                    if(err){
                        console.log(err);
                    }
                    else{
                        res.render('success', {all_secrets: secrets, currentUserSecrets:user.secrets});
                    }
                })
            }
        })
    }
})

app.post('/add/secret', function(req, res){
    var newSecret = new Secret({
        secret: req.body.secret
    });
    User.findOne({_id: req.session.current_user}, function(err, user){
        if(err){
            console.log(err);
        }
        else{
            user.secrets.push(newSecret);
            user.save(user);
            newSecret.save(function(err){
                if(err){
                    for(var key in err.errors){
                        req.flash("secret_creation", err.errors[key].message)
                    }
                    res.redirect('/secrets');
                    console.log(err);
                } 
                else{
                    res.redirect('/secrets');
                }
            })
        }
    })
})

app.get('/delete/:id', function(req, res){
    if(req.session.current_user == null){
        res.redirect('/');
    }
    else{
        Secret.findByIdAndRemove(req.params.id, function(err, secret){
            if(err){
                console.log(err);
            }
            else{
                res.redirect('/secrets');
            }
        });
    }
})

app.get('/secret/:id', function(req, res){
    if(req.session.current_user == null){
        res.redirect('/');
    }
    else{
        Secret.findById({_id: req.params.id}, function(err, secret){
            if(err){
                console.log(err);
            }
            else{
                res.render('comments', {secret:secret, comments:secret.comments});
            }
        })
    }
})


app.post('/add/comment', function(req, res){
    var newComment = new Comment({comment: req.body.comment});
    Secret.findOne({_id: req.body.secretId}, function(err, secret){
        if(err){
            console.log(err);
        }
        else{
            secret.comments.push(newComment);
            secret.save(secret);
            newComment.save(function(err){
                if(err){
                    console.log(err);
                    for(var key in err.errors){
                        req.flash("comment_creation", err.errors[key].message)
                    }
                    res.redirect('/secret/' + req.body.secretId);
                } 
                else{
                    console.log(secret);
                    console.log(newComment);
                    res.redirect('/secret/' + req.body.secretId);
                }
            })
        }
    })
})


app.get('/logout', function(req, res){
    req.session.destroy();
    res.redirect('/');
})
// app.post('/add/comment')
app.listen(1337, function() {
    console.log("listening on port 1337");
});


