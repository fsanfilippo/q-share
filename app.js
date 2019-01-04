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

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser());

app.get('/login', function(req, res) {
    auth.login(req, res);
});

app.get('/callback', function(req, res) {
  auth.callback(req, res);
 
});

app.get('/refresh_token', function(req, res) {
  auth.refreshToken(req, res);
});

console.log('Listening on 8888');
app.listen(8888);
