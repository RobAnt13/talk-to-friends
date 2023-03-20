const express = require('express');
const app = express();
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Message = require('./models/Message');
const ws = require('ws');
const fs = require('fs');

dotenv.config();
mongoose.connect(process.env.MONGO_URL, (err) => {
    if (err) throw err;
});
const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = bcrypt.genSaltSync(10);

const corsOptions = {
  origin: ['https://robant-chat-app.netlify.app', 'https://640b474f06d4cc237d0274e3--robant-chat-app.netlify.app/'],
  credentials: true,
};

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'PUT, POST, PATCH, DELETE, GET');
    return res.status(200).json({});
  }
  next();
});


app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use('/uploads', express.static(__dirname + '/uploads'));
app.use(express.json());
app.use(cookieParser());


app.get('/test', (req,res) => {
    res.json('test ok');
});

app.get('/profile', cors(corsOptions), (req,res) => {
  // ...
});

app.post('/login', cors(corsOptions), async (req,res) => {
  // ...
});

app.post('/register', cors(corsOptions), async (req,res) => {
  // ...
});

app.get('/messages/:userId', async (req,res) => {
    const{userId} = req.params;
    /* const userData = await getUserDataFromRequest(req);
    const ourUserId = userData.userId; */
    const messages = await Message.find({
        sender:{$in:[userId,ourUserId]},
        recipient:{$in:[userId,ourUserId]},
    }).sort({createdAt: 1});
    res.json(messages);
});

app.get('/people', async (req,res) => {
    const users = await User.find({}, {'_id':1,username:1});
    res.json(users);
});

module.exports = app;


const server = app.listen(8080);

const wss = new ws.WebSocketServer({server});
wss.on('connection', (connection, req) => {

    function notifyAboutOnlinePeople() {
        [...wss.clients].forEach(client => {
            client.send(JSON.stringify({
                online: [...wss.clients].map(c => ({userId:c.userId,username:c.username})),
            }));
        });
    }

    connection.isAlive = true;

    connection.timer = setInterval(() => {
        connection.ping();
        connection.deathTimer = setTimeout(() => {
            connection.isAlive = false;
            clearInterval(connection.timer);
            connection.terminate();
            notifyAboutOnlinePeople();
            console.log('dead');
        }, 1000);
    }, 5000);

    connection.on('pong', () => {
        clearTimeout(connection.deathTimer);
    });

    // read username and id form the cookie for this connection
   const cookies = req.headers.cookie;
   if (cookies) {
       const tokenCookieString = cookies.split(';').find(str => str.startsWith('token='));
       if (tokenCookieString) {
        const token = tokenCookieString.split('=')[1];
        if (token) {
            jwt.verify(token, jwtSecret, {}, (err, userData) => {
                if (err) throw err;
                const {userId, username} = userData;
                connection.userId = userId;
                connection.username = username;
            });
        }
      }
   }

   connection.on('message', async (message) => {
    const messageData = JSON.parse(message.toString());
    const {recipient, text, file} = messageData;
    let filename = null;
    if (file) {
        console.log('size', file.data.length);
        const parts = file.name.split('.');
        const ext = parts[parts.length - 1];
        filename = Date.now() + '.'+ext;
        const path = __dirname + '/uploads/' + filename;
        const bufferData = new Buffer(file.data.split(',')[1], 'base64');
        fs.writeFile(path, bufferData, () => {
            console.log('file saved:'+path);
        });
    }
    if (recipient && (text || file)) {
        const messageDoc = await Message.create({
            sender:connection.userId,
            recipient,
            text,
            file: file ? filename : null,
        });
        console.log('created message');
        [...wss.clients]
            .filter(c => c.userId === recipient)
            .forEach(c => c.send(JSON.stringify({
                text,
                sender:connection.userId, 
                recipient,
                file: file ? filename : null, 
                _id:messageDoc._id,
            })));
    }
   });

   // notify everyone about online people (when soneone connects)
   notifyAboutOnlinePeople();
});

// Vladiator123
