/**
 * q-share server that saves the state of created queues and controls requests to change
 * the queue state.
 *
 * Author: Francis San Filippo
 */

var express = require('express'); // Express web server framework
var cors = require('cors');
var auth = require('./auth');
var cookieParser = require('cookie-parser');
var request = require('request'); // "Request" library
var session = require('express-session');

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
  .use(cors())
  .use(cookieParser())
  .use(session({ secret: "sometimes I pee in the shower" }));

app.get('/login', function (req, res) {
  auth.login(req, res);
});

app.get('/callback', function (req, res) {
  auth.callback(req, res);
});

app.get('/refresh_token', function (req, res) {
  auth.refreshToken(req, res);
});

app.get('/test', function (req, res) {
  if (req.session.page_views) {
    req.session.page_views++;
    res.send("You visited this page " + req.session.page_views + " times");
  } else {
    req.session.page_views = 1;
    res.send("Welcome to this page for the first time!");
  }
});

console.log('Listening on 8888');
app.listen(8888);
