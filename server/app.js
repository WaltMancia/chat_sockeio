import express from 'express';
import logger from 'morgan';
import { Server } from 'socket.io';
import { createServer } from 'node:http';
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;

const app = express();

const server = createServer(app);
const io = new Server(server, {
    connectionStateRecovery: true,
});

// Database connection
const sequelize = new Sequelize(process.env.DATABASE_NAME, process.env.DATABASE_USER, process.env.DATABASE_PASSWORD, {
    host: process.env.DATABASE_HOST,
    dialect: 'mysql',
    port: process.env.DATABASE_PORT,
});

//definimos el modelo
const messages = sequelize.define('messages', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    content: {
        type: Sequelize.TEXT,
    },
    user: {
        type: Sequelize.TEXT,
    },
    senderId: {
        type: Sequelize.STRING, // Almacena el identificador del cliente
    },
},
    {
        timestamps: true,
    }
);

sequelize.authenticate().then(() => {
    console.log('Database connected');
    sequelize.sync();
}).catch((err) => {
    console.log('Error: ' + err);
});

io.on('connection', async (socket) => {
    console.log('A user connected');
    const clientId = socket.handshake.auth.clientId || `client-${Date.now()}`;  // Generate a new clientId if not provided
    console.log(`Cliente conectado con ID persistente: ${clientId}`);

    socket.clientId = clientId;

    try {
        // Get the last 20 messages
        const results = await messages.findAll({
            order: [['id', 'DESC']],
            limit: 20,
        });

        const orderedResults = results.reverse();

        // Emit the initial message history
        orderedResults.forEach((msg) => {
            socket.emit('chat message', msg.content, msg.senderId, msg.id);
        });
    } catch (error) {
        console.log('Error fetching messages: ', error);
    }

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });

    socket.on('chat message', async (msg, senderId) => {
        try {
            const newMessage = await messages.create({
                content: msg,
                user: `User-${socket.id}`,  // Usuario único basado en el ID del socket
                senderId,  // Almacenar el ID persistente del cliente
            });
            io.emit('chat message', newMessage.content, newMessage.senderId, newMessage.id);
        } catch (error) {
            console.log('Error saving message: ', error);
        }
    });
});

app.use(logger('dev'));

app.get('/', (req, res) => {
    res.sendFile(process.cwd() + '/client/index.html');
});

server.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
});