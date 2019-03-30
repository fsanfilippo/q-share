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
var queues = new Map();
var selectedQueue = new Map();

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
  console.log('NEW CONNECTION!');

  connection.on('message', function (message) {
    if (message.type === 'utf8') {
      let utf8Data = JSON.parse(message.utf8Data);
      let data = utf8Data.data;
      switch (utf8Data.event) {
        case ('create-queue'): {
          console.log('queue created');
          handleCreateQueueEvent(data, connection);
          break;
        }
        case ('add-to-queue'): {
          handleAddToQueueEvent(data, connection);
          break;
        }
        case ('subscribe-to-queue'): {
          handleSubscribeToQueuEvent(data, connection);
          break;
        }
        case ('delete-queue'): {
          handleDeleteQueueEvent(data, connection);
          break;
        }
        case ('update-queue'): {
          handleUpdateQueueEvent(data, connection);
          break;
        }
        case ('reserve-queue'): {
          handleReserveQueueEvent(data, connection);
          break;
        }
        default: {
          console.log('Unknown event');
          break;
        }

      }
    }
  });

  connection.on('close', function (connection) {
    let queue = selectedQueue.get(connection);
    if (!queue) return;
    console.log('CONNECTION CLOSED. The following queue was deleted: ' + queue.key);
    if (queue.owned) {
      deleteQueue(queue.key);
    }
    else {
      let subs = subsAndSongs.get(queue.key);
      subs.remove(connection);
    }
    selectedQueue.delete(connection);

  });
});

function broadcastUpdate(subsAndSongs, key) {
  subsAndSongs.subscribers.forEach(connection => {
    console.log('sent update to: ' + connection.remoteAddress);
    sendEvent('update', connection, { selectedQueue: key, songs: subsAndSongs.songs });
  });
}

function broadCastDeletion(subs) {
  subs.forEach(connection => {
    connection.send({ event: 'stale-queue' })
  });
}

function unselectQueue(subs) {
  subs.forEach(sub => {
    selectedQueue.set(sub, null);
  })
}

function deleteQueue(key) {
  if (!key) return;
  let subsAndSongs = queue.get(key)
  let subs = subsAndSongs.subscribers;
  unselectQueue(subs);
  queue.delete(key);
  broadCastDeletion(subs, key);
}

/*

    ~~~~~~~~ MESSAGE EVENTS ~~~~~~~~~

*/
function handleCreateQueueEvent(data, connection) {
  let key = data.queueKey;

  //Is there queue key?
  if (!key) {
    sendEvent('error', connection, 'Create queue event with emtpy queueKey');
    return;
  }

  //Does the queue already exist
  if (!queues.get(key)) {
    sendEvent('error', connection, 'You must first reserve the queue');
    return;
  }

  //Did somebody reserve it? probably you
  if (!queues.get(key).reserved) {
    sendEvent('error', connection, 'Queue is not resereved');
    return;
  }

  //Make the queue and add yourself to subscriber list
  let subscribers = new Array();
  subscribers.push(connection);
  queues.set(key, { subscribers, songs: new Array() });
  selectedQueue.set(connection, { key: key, owner: true });
}

function handleAddToQueueEvent(data, connection) {
  let key = data.queueKey;
  let song = data.songData;


  if (!key) {
    sendEvent('error', connection, 'The queue key was not provided on add to queue');
    return;
  }

  let subsAndSongs = queues.get(key);
  if (!subsAndSongs) return;
  subsAndSongs.songs.push(song);
  broadcastUpdate(subsAndSongs, key);

  console.log('new songs added to queue!');
  break;
}

function handleSubscribeToQueuEvent(data, connection) {
  console.log('new subscription added!');
  let key = data.queueKey;
  if (!key) return;
  let subsAndSongs = queues.get(key);
  if (!subsAndSongs) return;
  subsAndSongs.subscribers.push(connection);
  selectedQueue.set(connection, { key: key, owner: false });
  msgStr = JSON.stringify({ event: 'update', data: { selectedQueue: key, songs: subsAndSongs.songs } });
  connection.send(msgStr);
}


function handleDeleteQueueEvent(data, connection) {
  let key = data.queueKey;
  if (!key) return;
  deleteQueue(data.queueKey);
}

function handleUpdateQueueEvent(data, connection) {
  let key = data.queueKey;
  if (!key) return;
  let newQueue = data.newQueue;
  if (!newQueue) return;
  let subsAndSongs = queues.get(key);
  if (!subsAndSongs) return;
  subsAndSongs.songs = newQueue;
  broadcastUpdate(subsAndSongs, key);
}

function handleReserveQueueEvent(data, connection) {

  let key = data.queueKey;
  if (!key) return;
  if (queues.get(key)) {
    sendEvent('error', connection, { success: false });
    return;
  }
  console.log('Reserved a queue');
  queues.set(key, { reserved: true });
  sendEvent('success', connection, { success: true });

}
function sendEvent(event, connection, data) {
  let msgStr = JSON.stringify({ event, data });
  connection.send(msgStr);
}

/**
 * HTTP API
 */
var app = express();

app.use(express.static(__dirname + '/public', { index: false, extensions: ['html'] }))
  .use(cors())
  .use(cookieParser())

app.get('/', function (req, res) {
  res.redirect('homepage');
})

app.get('/login', function (req, res) {
  auth.login(req, res);
});

app.get('/callback', function (req, res) {
  auth.callback(req, res);
});

app.get('/refresh_token', function (req, res) {
  auth.refreshToken(req, res);
});


console.log('Listening on 8888');
app.listen(HTTP_API_PORT);