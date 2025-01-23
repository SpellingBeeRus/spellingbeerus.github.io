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
  constructor(id, maxPlayers = 4) {
    this.id = id;
    this.players = new Map();
    this.spectators = new Set();
    this.maxPlayers = maxPlayers;
    this.hostId = null;
    this.gameState = {
      isActive: false,
      timer: 0.0,
      playerWords: new Map(),
      scores: new Map(),
      roundNumber: 0
    };
    this.timerInterval = null;
    this.roundDuration = 15000; // 15 секунд в миллисекундах
  }

  getDifficultyTime(streak) {
    if (streak >= 10) {
      return 12; // Сложный уровень - 12 секунд
    } else if (streak >= 5) {
      return 8; // Средний уровень - 8 секунд
    }
    return 5; // Легкий уровень - 5 секунд
  }

  addPlayer(playerId, playerName, isHost = false) {
    if (this.players.size >= this.maxPlayers) {
      return false;
    }
    this.players.set(playerId, {
      id: playerId,
      name: playerName,
      score: 0,
      streak: 0,
      isAlive: true,
      isHost: isHost
    });
    if (isHost) {
      this.hostId = playerId;
    }
    this.gameState.scores.set(playerId, 0);
    this.gameState.playerWords.set(playerId, null);
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

  startTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    
    const startTime = Date.now();
    this.gameState.timer = 0.0;

    this.timerInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      this.gameState.timer = Number((elapsed / 1000).toFixed(1));
      
      // Получаем максимальное время из всех активных игроков
      const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);
      const maxTime = Math.max(...alivePlayers.map(p => this.getDifficultyTime(p.streak)));
      
      io.to(this.id).emit('timer_update', { timer: this.gameState.timer });
      
      if (this.gameState.timer >= maxTime) {
        clearInterval(this.timerInterval);
        this.handleRoundEnd();
      }
    }, 100);
  }

  handleRoundEnd() {
    const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);
    alivePlayers.forEach(player => {
      if (!player.hasAnswered) {
        player.isAlive = false;
      }
      player.hasAnswered = false;
    });

    const remainingPlayers = Array.from(this.players.values()).filter(p => p.isAlive);
    if (remainingPlayers.length <= 1) {
      const winner = remainingPlayers[0] || { name: "Нет победителя" };
      io.to(this.id).emit('game_over', { winner });
      gameRooms.delete(this.id);
    } else {
      this.startNextRound();
    }
  }

  async startNextRound() {
    this.gameState.roundNumber++;
    await this.assignNewWords();
    this.startTimer();
    io.to(this.id).emit('game_state_updated', this.getGameState());
  }

  async assignNewWords() {
    const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);
    for (const player of alivePlayers) {
      const maxStreak = player.streak;
      let difficulty = 'easy';
      if (maxStreak >= 10) {
        difficulty = 'hard';
      } else if (maxStreak >= 5) {
        difficulty = 'normal';
      }
      
      wordService.setDifficulty(difficulty);
      const word = await wordService.getRandomWord();
      this.gameState.playerWords.set(player.id, word);
      
      // Отправляем слово игроку и время для его уровня сложности
      io.to(player.id).emit('new_word', { 
        word,
        autoPlay: true,
        timeLimit: this.getDifficultyTime(maxStreak)
      });
    }

    // Даем 2 секунды на воспроизведение аудио перед стартом таймера
    setTimeout(() => {
      this.startTimer();
      io.to(this.id).emit('start_round');
    }, 2000);
  }

  getGameState() {
    return {
      ...this.gameState,
      players: Array.from(this.players.values()),
      spectators: Array.from(this.spectators),
      hostId: this.hostId
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

// Обновляем обработку WebSocket соединений
io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);

  socket.on('create_room', ({ playerName }) => {
    const roomId = uuidv4();
    const room = new GameRoom(roomId);
    
    if (room.addPlayer(socket.id, playerName, true)) {
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
      }
    } else {
      room.addSpectator(socket.id);
      socket.emit('joined_as_spectator', { gameState: room.getGameState() });
      io.to(roomId).emit('game_state_updated', room.getGameState());
    }
  });

  socket.on('start_game', ({ roomId }) => {
    const room = gameRooms.get(roomId);
    if (!room || room.hostId !== socket.id || room.players.size < 2) {
      socket.emit('error', { message: 'Невозможно начать игру' });
      return;
    }

    room.gameState.isActive = true;
    room.startNextRound();
  });

  socket.on('submit_answer', async ({ roomId, answer }) => {
    const room = gameRooms.get(roomId);
    if (!room || !room.gameState.isActive) return;

    const player = room.players.get(socket.id);
    if (!player || !player.isAlive) return;

    const currentWord = room.gameState.playerWords.get(socket.id);
    if (!currentWord) return;

    if (!player.hasAnswered) {
      const normalizedAnswer = wordService.validateInput(answer);
      const normalizedWord = wordService.validateInput(currentWord.text);

      if (normalizedAnswer === normalizedWord) {
        player.streak++;
        player.score += 10;
        player.hasAnswered = true;
      } else {
        player.isAlive = false;
      }

      io.to(roomId).emit('game_state_updated', room.getGameState());
    }
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