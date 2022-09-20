console.log("Starting Server...")
require('dotenv').config()

/**
 * Loading Node Modules
 */
const express = require('express'),
      cookies = require('cookie-session'),
      favicon = require('serve-favicon'),
      timeout = require('connect-timeout'),
      session = require('express-session'),
      mongodb  = require('mongodb'),
      path = require('path'),
      passport = require('passport'),
      GitHubStrategy = require('passport-github2').Strategy,
      app = express()
const { profileEnd } = require('console');
const { MongoClient, ServerApiVersion } = require('mongodb');

/**
 * MongoDB setting up connection variables
 */
const uri = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASS}@${process.env.MONGODB_HOST}`
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

//Connect-Timeout on timeout
const haltOnTimeout =  function(req, res, next) 
{
  if(!req.timedout)
    next();
}

/**
 * MongoDB Connecting to database
 */
let collection = null;
client.connect()
  .then(() => {
    return client.db('a3-inventory').collection('inventory')
  })
  .then(__collection => {
    collection = __collection;

    return collection.find({ }).toArray()
}).then(console.log)

/**
 * Loading Express Middlewears
 */
 app.use( (req,res,next) => {
  if( collection !== null ) {
    next()
  }else{
    res.status( 503 ).send()
  }
})

app.use(timeout('5s'))
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))
app.use(haltOnTimeout)
app.use(express.static('public'))
app.use(haltOnTimeout)
app.use(express.static('views'))
app.use(haltOnTimeout)
app.use(express.json())
app.use(haltOnTimeout)
app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());


passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

/**
 * Github O-Auth with passport
 */
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: "http://142.93.202.135/auth/github/callback"
},
  function(accessToken, refreshToken, profile, done) {
    process.nextTick(function () {
      
      // To keep the example simple, the user's GitHub profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the GitHub account with a user record in your database,
      // and return that user instead.

      return collection.find({githubID:profile.id})
      .then(userData => {
          if(user == null) {
            collection.insert({githubID:profile.id, items:[]})
            .then(() => {
                return collection.find({githubID:profile.id})})
          }
          else
            return userData;
      })
      .then(toArray)
      .then(userData => {
        console.log(userData)
        console.log("ID:" + userData._id)
        return done(userData._id)
      })
      /*
      if(user == null) {
        collection.insert({githubID:profile.id, items:[]})
        user = collection.find({githubID:profile.id})
      }*/
    });
    /*({ githubId: profile.id }, function (err, user) {
      return done(err, user);
    });*/
  }
));


/**
 * Github Auth Requests
 */
app.get('/auth/github',
  passport.authenticate('github', { scope: [ 'user:email' ] }));

app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    console.log("Logged in")
    // Successful authentication, redirect home.
    res.redirect('/dataview.html');
});

app.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', { user: req.user });
});

app.get('/login', function(req, res){
  res.render('login', { user: req.user });
})

/**
 * When user want's personal data
 */
app.get('/items', (req, res) => {

  collection.find({_id:mongodb.ObjectId(req.query._id)})
  .project({_id:0, items:1}).toArray()
  .then(result => res.json(result));
})

/**
 * When new data is submitted
 */
 app.post( '/add', (req,res) => {
  // assumes only one object to insert
  let body = {_itemID:mongodb.ObjectId(),
              name: req.body.name,
              price:req.body.price,
              quantity:req.body.quantity
            }

  collection.updateOne({_id:mongodb.ObjectId(req.body._id)}, 
                       {$push:{items:body}})
            .then(result => res.json(result))
})

/**
 * Handle Data Modification
 */
 app.post( '/update', (req,res) => {

  let updatedItem = {_itemID:mongodb.ObjectId(req.body._itemID),
    name: req.body.name,
    price:req.body.price,
    quantity:req.body.quantity
  }

  collection
    .updateOne(
      { _id:mongodb.ObjectId( req.body._id ), "items._itemID":mongodb.ObjectId(req.body._itemID)},
      { $set:{ "items.$":updatedItem} }
    )
    .then( result => res.json( result ) )
})

/**
 * Handle Data Deletion
 */
 app.post( '/remove', (req,res) => {
  
  collection
    .updateOne(
      {_id:mongodb.ObjectId(req.body._id)},
      {$pull: {items: {_itemID:mongodb.ObjectId(req.body._itemID)}}}
    ).then(result => res.json(result))
})

/**
 * Get autogenerated field
 */
 function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}

app.listen(3001)