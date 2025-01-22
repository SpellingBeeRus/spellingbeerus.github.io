import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Grid,
  LinearProgress,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PersonIcon from '@mui/icons-material/Person';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { useTheme } from '@mui/material/styles';

interface Player {
  id: string;
  name: string;
  score: number;
  streak: number;
  isAlive: boolean;
  isHost: boolean;
  hasAnswered: boolean;
}

interface GameState {
  difficulty: 'easy' | 'normal' | 'hard';
  currentWord: { text: string; audioPath: string } | null;
  players: Player[];
  spectators: string[];
  isActive: boolean;
  timer: number;
  hostId: string;
}

interface Word {
  text: string;
  audioPath: string;
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export default function MultiplayerGame() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [isSpectator, setIsSpectator] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const theme = useTheme();

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      path: '/socket.io/',
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      secure: true,
      rejectUnauthorized: false
    });

    newSocket.on('connect', () => {
      console.log('Connected to server:', SOCKET_URL);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
    });

    setSocket(newSocket);

    const handleRoomCreated = ({ roomId, gameState }: { roomId: string; gameState: GameState }) => {
      setRoomId(roomId);
      setGameState(gameState);
      setError('');
    };

    const handleJoinedAsPlayer = ({ gameState }: { gameState: GameState }) => {
      setGameState(gameState);
      setIsSpectator(false);
      setError('');
    };

    const handleJoinedAsSpectator = ({ gameState }: { gameState: GameState }) => {
      setGameState(gameState);
      setIsSpectator(true);
      setError('');
    };

    const handleGameStarted = (gameState: GameState) => {
      setGameState(gameState);
    };

    const handleNewWord = ({ word }: { word: Word }) => {
      setCurrentWord(word);
    };

    const handleGameStateUpdated = (newGameState: GameState) => {
      setGameState(newGameState);
    };

    const handleGameOver = ({ winner }: { winner: Player }) => {
      alert(`Игра окончена! Победитель: ${winner.name}`);
      setGameState(null);
      setCurrentWord(null);
      setRoomId('');
    };

    const handleError = ({ message }: { message: string }) => {
      setError(message);
    };

    const handleTimerUpdate = ({ timer }: { timer: number }) => {
      setGameState(prev => prev ? { ...prev, timer } : null);
    };

    newSocket.on('room_created', handleRoomCreated);
    newSocket.on('joined_as_player', handleJoinedAsPlayer);
    newSocket.on('joined_as_spectator', handleJoinedAsSpectator);
    newSocket.on('game_started', handleGameStarted);
    newSocket.on('new_word', handleNewWord);
    newSocket.on('game_state_updated', handleGameStateUpdated);
    newSocket.on('game_over', handleGameOver);
    newSocket.on('error', handleError);
    newSocket.on('timer_update', handleTimerUpdate);

    return () => {
      newSocket.off('room_created', handleRoomCreated);
      newSocket.off('joined_as_player', handleJoinedAsPlayer);
      newSocket.off('joined_as_spectator', handleJoinedAsSpectator);
      newSocket.off('game_started', handleGameStarted);
      newSocket.off('new_word', handleNewWord);
      newSocket.off('game_state_updated', handleGameStateUpdated);
      newSocket.off('game_over', handleGameOver);
      newSocket.off('error', handleError);
      newSocket.off('timer_update', handleTimerUpdate);
      newSocket.close();
    };
  }, []);

  const handleCreateRoom = useCallback(() => {
    if (!socket || !playerName.trim()) return;
    socket.emit('create_room', { playerName: playerName.trim() });
  }, [socket, playerName]);

  const handleJoinRoom = useCallback(() => {
    if (!socket || !playerName.trim() || !roomId.trim()) return;
    socket.emit('join_room', { roomId: roomId.trim(), playerName: playerName.trim() });
  }, [socket, playerName, roomId]);

  const handleStartGame = useCallback(() => {
    if (!socket || !roomId) return;
    socket.emit('start_game', { roomId });
  }, [socket, roomId]);

  const handleSubmitAnswer = useCallback(() => {
    if (!socket || !roomId || !answer.trim()) return;
    socket.emit('submit_answer', { roomId, answer: answer.trim() });
    setAnswer('');
  }, [socket, roomId, answer]);

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    alert('ID комнаты скопирован в буфер обмена');
  };

  const playAudio = useCallback(async () => {
    if (!currentWord?.audioPath) return;
    try {
      const audio = new Audio(currentWord.audioPath);
      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }, [currentWord]);

  if (!socket) {
    return <CircularProgress />;
  }

  if (!gameState) {
    return (
      <Box sx={{ p: 3, maxWidth: 400, mx: 'auto' }}>
        <TextField
          fullWidth
          label="Ваше имя"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          sx={{ mb: 2 }}
        />
        <Button
          fullWidth
          variant="contained"
          onClick={handleCreateRoom}
          disabled={!playerName.trim()}
          sx={{ mb: 2 }}
        >
          Создать комнату
        </Button>
        <TextField
          fullWidth
          label="ID комнаты"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          sx={{ mb: 2 }}
        />
        <Button
          fullWidth
          variant="contained"
          onClick={() => setShowJoinDialog(true)}
          disabled={!playerName.trim() || !roomId.trim()}
        >
          Присоединиться к комнате
        </Button>
        {error && (
          <Typography color="error" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
      </Box>
    );
  }

  const isHost = socket.id === gameState.hostId;
  const canStartGame = isHost && gameState.players.length >= 2 && !gameState.isActive;

  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Комната: {roomId}
        <IconButton onClick={copyRoomId} size="small" sx={{ ml: 1 }}>
          <ContentCopyIcon />
        </IconButton>
      </Typography>
      
      {canStartGame && (
        <Button
          fullWidth
          variant="contained"
          onClick={handleStartGame}
          sx={{ mb: 2 }}
        >
          Начать игру
        </Button>
      )}

      {gameState.isActive && (
        <>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Время: {gameState.timer} сек
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={(gameState.timer / 30) * 100}
              sx={{ 
                height: 8,
                borderRadius: 4,
                mb: 2
              }}
            />
          </Box>
          
          {currentWord && (
            <Box sx={{ mb: 2 }}>
              <Button
                fullWidth
                variant="contained"
                onClick={playAudio}
                sx={{ mb: 1 }}
              >
                Прослушать слово
              </Button>
              <TextField
                fullWidth
                label="Ваш ответ"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSubmitAnswer()}
                sx={{ mt: 1 }}
                disabled={gameState.players.find(p => p.id === socket.id)?.hasAnswered}
              />
              <Button
                fullWidth
                variant="contained"
                onClick={handleSubmitAnswer}
                sx={{ mt: 1 }}
                disabled={gameState.players.find(p => p.id === socket.id)?.hasAnswered}
              >
                Отправить ответ
              </Button>
            </Box>
          )}
        </>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>
        Игроки:
      </Typography>
      {gameState.players.map((player) => (
        <Box
          key={player.id}
          sx={{
            p: 1,
            mb: 1,
            border: 1,
            borderColor: theme.palette.divider,
            borderRadius: 1,
            backgroundColor: player.isAlive ? 'inherit' : 'rgba(0,0,0,0.1)',
          }}
        >
          <Typography>
            {player.name} {player.isHost && '(Хост)'} - Очки: {player.score}, Серия: {player.streak}
            {!player.isAlive && ' (Выбыл)'}
            {player.hasAnswered && ' ✓'}
          </Typography>
        </Box>
      ))}

      {gameState.spectators.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
            Зрители: {gameState.spectators.length}
          </Typography>
        </>
      )}
    </Box>
  );
} 