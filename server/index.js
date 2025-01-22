import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import { wordService } from './wordService.js';
import connectDB from './config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Подключение к базе данных
connectDB();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: '/socket.io/',
  cors: {
    origin: ["https://spellingbeerus.github.io", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true,
  cookie: {
    name: "socket.io",
    httpOnly: true,
    sameSite: "none",
    secure: true
  }
});

const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ["https://spellingbeerus.github.io", "http://localhost:3000"],
  credentials: true,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
  optionsSuccessStatus: 200
}));

// Добавим заголовки безопасности
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://spellingbeerus.github.io');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use(express.json());
app.use(express.static(join(__dirname, '../dist')));

// Добавим логирование для отладки
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

// Хранилище игровых комнат
const gameRooms = new Map();

// Структура комнаты
class GameRoom {
  constructor(id, maxPlayers = 2) {
    this.id = id;
    this.players = new Map();
    this.spectators = new Set();
    this.maxPlayers = maxPlayers;
    this.gameState = {
      difficulty: 'easy',
      currentWord: null,
      scores: new Map(),
      isActive: false
    };
  }

  addPlayer(playerId, playerName) {
    if (this.players.size >= this.maxPlayers) {
      return false;
    }
    this.players.set(playerId, {
      id: playerId,
      name: playerName,
      score: 0,
      streak: 0,
      isAlive: true
    });
    this.gameState.scores.set(playerId, 0);
    return true;
  }

  addSpectator(spectatorId) {
    this.spectators.add(spectatorId);
    return true;
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    this.gameState.scores.delete(playerId);
  }

  removeSpectator(spectatorId) {
    this.spectators.delete(spectatorId);
  }

  isRoomFull() {
    return this.players.size >= this.maxPlayers;
  }

  getGameState() {
    return {
      ...this.gameState,
      players: Array.from(this.players.values()),
      spectators: Array.from(this.spectators)
    };
  }
}

// Функция для начала игры
async function startGame(roomId) {
  const room = gameRooms.get(roomId);
  if (!room) return;

  room.gameState.isActive = true;
  room.gameState.difficulty = 'easy';
  wordService.setDifficulty('easy');
  await nextWord(roomId);
  
  io.to(roomId).emit('game_started', room.getGameState());
}

// Функция для выбора следующего слова
async function nextWord(roomId) {
  const room = gameRooms.get(roomId);
  if (!room) return;

  // Увеличиваем сложность по мере прогресса
  const alivePlayers = Array.from(room.players.values()).filter(p => p.isAlive);
  const maxStreak = Math.max(...alivePlayers.map(p => p.streak));
  
  if (maxStreak >= 10) {
    room.gameState.difficulty = 'hard';
    wordService.setDifficulty('hard');
  } else if (maxStreak >= 5) {
    room.gameState.difficulty = 'normal';
    wordService.setDifficulty('normal');
  }

  const word = await wordService.getRandomWord();
  if (word) {
    room.gameState.currentWord = word;
    io.to(roomId).emit('new_word', { word });
  }
}

// Обработка WebSocket соединений
io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);

  socket.on('create_room', ({ playerName }) => {
    const roomId = uuidv4();
    const room = new GameRoom(roomId);
    
    if (room.addPlayer(socket.id, playerName)) {
      gameRooms.set(roomId, room);
      socket.join(roomId);
      socket.emit('room_created', { roomId, gameState: room.getGameState() });
    }
  });

  socket.on('join_room', ({ roomId, playerName }) => {
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    socket.join(roomId);

    if (!room.isRoomFull()) {
      if (room.addPlayer(socket.id, playerName)) {
        socket.emit('joined_as_player', { gameState: room.getGameState() });
        io.to(roomId).emit('game_state_updated', room.getGameState());

        if (room.isRoomFull()) {
          startGame(roomId);
        }
      }
    } else {
      room.addSpectator(socket.id);
      socket.emit('joined_as_spectator', { gameState: room.getGameState() });
      io.to(roomId).emit('game_state_updated', room.getGameState());
    }
  });

  socket.on('submit_answer', async ({ roomId, answer }) => {
    const room = gameRooms.get(roomId);
    if (!room || !room.gameState.isActive) return;

    const player = room.players.get(socket.id);
    if (!player || !player.isAlive) return;

    const currentWord = room.gameState.currentWord;
    if (!currentWord) return;

    const normalizedAnswer = wordService.validateInput(answer);
    const normalizedWord = wordService.validateInput(currentWord.text);

    if (normalizedAnswer === normalizedWord) {
      player.streak++;
      player.score += 10;
      await nextWord(roomId);
    } else {
      player.isAlive = false;
      const alivePlayers = Array.from(room.players.values()).filter(p => p.isAlive);
      
      if (alivePlayers.length <= 1) {
        const winner = alivePlayers[0];
        io.to(roomId).emit('game_over', { winner });
        gameRooms.delete(roomId);
      } else {
        await nextWord(roomId);
      }
    }

    io.to(roomId).emit('game_state_updated', room.getGameState());
  });

  socket.on('disconnect', () => {
    for (const [roomId, room] of gameRooms.entries()) {
      if (room.players.has(socket.id)) {
        room.removePlayer(socket.id);
        if (room.players.size === 0) {
          gameRooms.delete(roomId);
        } else {
          io.to(roomId).emit('game_state_updated', room.getGameState());
        }
      } else if (room.spectators.has(socket.id)) {
        room.removeSpectator(socket.id);
        io.to(roomId).emit('game_state_updated', room.getGameState());
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 