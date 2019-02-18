/**
 * q-share server that saves the state of created queues and controls requests to change
 * the queue state. Handles Spotify Auth also.
 *
 * Author: Francis San Filippo
 */

var HTTP_API_PORT = 8888;
var WEBSOCKET_PORT = 1337;
var express = require('express'); // Express web server framework
var cors = require('cors');
var auth = require('./auth');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var queues = new Map();

var stateKey = 'spotify_auth_state';

/**
 * Websocket Setup
 */
var WebSocketServer = require('websocket').server;
var http = require('http');

var server = http.createServer(function (request, response) { });
server.listen(WEBSOCKET_PORT, function () { });

// create the server
wsServer = new WebSocketServer({
  httpServer: server
});

wsServer.on('request', function (request) {
  var connection = request.accept(null, request.origin);
  console.log("NEW CONNECTION!");

  connection.on('message', function (message) {
    if (message.type === 'utf8') {
      let utf8Data = JSON.parse(message.utf8Data);
      let data = utf8Data.data;
      switch (utf8Data.event) {
        case ('create-queue'): {
          console.log("new queue created!");
          let key = data.queueKey;
          let subscribers = new Array();
          subscribers.push(connection);
          queues.set(key, { subscribers: subscribers, songs: new Array() });
          break;
        }
        case ('add-to-queue'): {
          let key = data.queueKey;
          let song = data.songData;
          let subsAndSongs = queues.get(key);
          if (!subsAndSongs) { return; }
          subsAndSongs.songs.push(song);
          broadcastUpdate(subsAndSongs);
          console.log("new songs added to queue!");
          break;
        }
        case ('subscribe-to-queue'): {
          console.log("new subscription added!");
          let key = data.queueKey;
          //TODO: check for uninstantiated queue
          let subsAndSongs = queues.get(key);
          subsAndSongs.subscribers.push(connection);
          break;
        }
      }
    }
  });

  connection.on('close', function (connection) {
    // close user connection
  });
});

function broadcastUpdate(subsAndSongs) {
  let msgStr = JSON.stringify(subsAndSongs.songs);
  subsAndSongs.subscribers.forEach(connection => {
    connection.send(msgStr)
  });
}

/**
 * End Websocket Setup
 */


/**
 * HTTP API
 */
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
app.listen(HTTP_API_PORT);