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
    }
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

    // Recuperar mensajes previos solo si el cliente no está en recuperación
    if (!socket.recovered) {
        try {
            const results = await messages.findAll({
                order: [['createdAt', 'ASC']], // Ordenar por fecha de creación
            });
            results.forEach((msg) => {
                socket.emit('chat message', msg.content, msg.user);
            });
        } catch (error) {
            console.error('Error fetching messages:', error);
        }
    }

    socket.on('chat message', async (msg, senderId) => {
        try {
            const newMessage = await messages.create({
                content: msg,
                user: senderId,
            });
            io.emit('chat message', newMessage.content, senderId);
        } catch (error) {
            console.error('Error saving message:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

app.use(logger('dev'));

app.get('/', (req, res) => {
    res.sendFile(process.cwd() + '/client/index.html');
});

server.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
});