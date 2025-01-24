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

    // Capturar último mensaje que el cliente ha visto
    const lastSeenMessageId = socket.handshake.auth.lastSeenMessageId || 0;

    try {
        // Solo enviar mensajes no vistos
        const results = await messages.findAll({
            where: {
                id: {
                    [Sequelize.Op.gt]: lastSeenMessageId,
                },
            },
            order: [['id', 'ASC']],
        });

        // Emitir solo los nuevos mensajes al cliente
        results.forEach((msg) => {
            socket.emit('chat message', msg.content, msg.user, msg.id);
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
                user: senderId,
            });
            io.emit('chat message', newMessage.content, newMessage.user, newMessage.id);
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