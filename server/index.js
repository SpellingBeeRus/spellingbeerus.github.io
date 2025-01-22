import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { wordService } from '../src/services/wordService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../dist')));

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

// Обработка WebSocket соединений
io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);

  // Создание новой комнаты
  socket.on('create_room', ({ playerName }) => {
    const roomId = uuidv4();
    const newRoom = new GameRoom(roomId);
    newRoom.addPlayer(socket.id, playerName);
    gameRooms.set(roomId, newRoom);
    
    socket.join(roomId);
    socket.emit('room_created', { roomId, gameState: newRoom.getGameState() });
  });

  // Присоединение к комнате
  socket.on('join_room', ({ roomId, playerName }) => {
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    if (room.isRoomFull()) {
      // Добавляем как наблюдателя
      room.addSpectator(socket.id);
      socket.join(roomId);
      socket.emit('joined_as_spectator', { gameState: room.getGameState() });
      io.to(roomId).emit('game_state_updated', room.getGameState());
    } else {
      // Добавляем как игрока
      room.addPlayer(socket.id, playerName);
      socket.join(roomId);
      socket.emit('joined_as_player', { gameState: room.getGameState() });
      io.to(roomId).emit('game_state_updated', room.getGameState());

      // Если комната заполнена, начинаем игру
      if (room.isRoomFull()) {
        startGame(roomId);
      }
    }
  });

  // Обработка ответа игрока
  socket.on('submit_answer', ({ roomId, answer }) => {
    const room = gameRooms.get(roomId);
    if (!room || !room.players.has(socket.id)) return;

    const player = room.players.get(socket.id);
    const currentWord = room.gameState.currentWord;

    if (currentWord && wordService.validateInput(answer) === wordService.validateInput(currentWord.text)) {
      // Правильный ответ
      player.streak++;
      player.score += player.streak;
      room.gameState.scores.set(socket.id, player.score);
    } else {
      // Неправильный ответ
      player.isAlive = false;
      player.streak = 0;
    }

    // Проверяем, остался ли только один живой игрок
    const alivePlayers = Array.from(room.players.values()).filter(p => p.isAlive);
    if (alivePlayers.length === 1) {
      // Объявляем победителя
      const winner = alivePlayers[0];
      io.to(roomId).emit('game_over', { winner });
      room.gameState.isActive = false;
    } else if (alivePlayers.length > 1) {
      // Продолжаем игру со следующим словом
      nextWord(roomId);
    }

    io.to(roomId).emit('game_state_updated', room.getGameState());
  });

  // Отключение игрока
  socket.on('disconnect', () => {
    for (const [roomId, room] of gameRooms) {
      if (room.players.has(socket.id)) {
        room.removePlayer(socket.id);
        io.to(roomId).emit('player_left', { playerId: socket.id });
        io.to(roomId).emit('game_state_updated', room.getGameState());
      } else if (room.spectators.has(socket.id)) {
        room.removeSpectator(socket.id);
        io.to(roomId).emit('game_state_updated', room.getGameState());
      }

      // Если в комнате не осталось игроков, удаляем её
      if (room.players.size === 0) {
        gameRooms.delete(roomId);
      }
    }
  });
});

// Функция для начала игры
function startGame(roomId) {
  const room = gameRooms.get(roomId);
  if (!room) return;

  room.gameState.isActive = true;
  room.gameState.difficulty = 'easy';
  wordService.setDifficulty('easy');
  nextWord(roomId);
  
  io.to(roomId).emit('game_started', room.getGameState());
}

// Функция для выбора следующего слова
function nextWord(roomId) {
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

  room.gameState.currentWord = wordService.getRandomWord();
  io.to(roomId).emit('new_word', { word: room.gameState.currentWord });
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
}); 