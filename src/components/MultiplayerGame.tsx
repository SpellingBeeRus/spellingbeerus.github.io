import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
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
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PersonIcon from '@mui/icons-material/Person';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

interface Player {
  id: string;
  name: string;
  score: number;
  streak: number;
  isAlive: boolean;
}

interface GameState {
  difficulty: 'easy' | 'normal' | 'hard';
  currentWord: { text: string; audioPath: string } | null;
  players: Player[];
  spectators: string[];
  isActive: boolean;
}

const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin 
  : 'http://localhost:3001';

export const MultiplayerGame: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [isSpectator, setIsSpectator] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    const handleRoomCreated = ({ roomId, gameState }: { roomId: string; gameState: GameState }) => {
      setRoomId(roomId);
      setGameState(gameState);
    };

    const handleJoinedAsPlayer = ({ gameState }: { gameState: GameState }) => {
      setGameState(gameState);
      setIsSpectator(false);
    };

    const handleJoinedAsSpectator = ({ gameState }: { gameState: GameState }) => {
      setGameState(gameState);
      setIsSpectator(true);
    };

    const handleGameStarted = (gameState: GameState) => {
      setGameState(gameState);
    };

    const handleNewWord = ({ word }: { word: { text: string; audioPath: string } }) => {
      if (audioRef.current) {
        audioRef.current.src = word.audioPath;
        audioRef.current.load();
        audioRef.current.play().catch(console.error);
      }
    };

    const handleGameStateUpdated = (gameState: GameState) => {
      setGameState(gameState);
    };

    const handleGameOver = ({ winner }: { winner: Player }) => {
      alert(`Игра окончена! Победитель: ${winner.name}`);
    };

    const handleError = ({ message }: { message: string }) => {
      alert(message);
    };

    newSocket.on('room_created', handleRoomCreated);
    newSocket.on('joined_as_player', handleJoinedAsPlayer);
    newSocket.on('joined_as_spectator', handleJoinedAsSpectator);
    newSocket.on('game_started', handleGameStarted);
    newSocket.on('new_word', handleNewWord);
    newSocket.on('game_state_updated', handleGameStateUpdated);
    newSocket.on('game_over', handleGameOver);
    newSocket.on('error', handleError);

    return () => {
      newSocket.off('room_created', handleRoomCreated);
      newSocket.off('joined_as_player', handleJoinedAsPlayer);
      newSocket.off('joined_as_spectator', handleJoinedAsSpectator);
      newSocket.off('game_started', handleGameStarted);
      newSocket.off('new_word', handleNewWord);
      newSocket.off('game_state_updated', handleGameStateUpdated);
      newSocket.off('game_over', handleGameOver);
      newSocket.off('error', handleError);
      newSocket.close();
    };
  }, []);

  const createRoom = () => {
    if (!playerName.trim()) {
      alert('Введите имя игрока');
      return;
    }
    socket?.emit('create_room', { playerName });
  };

  const joinRoom = () => {
    if (!playerName.trim() || !roomId.trim()) {
      alert('Введите имя игрока и ID комнаты');
      return;
    }
    socket?.emit('join_room', { roomId, playerName });
    setShowJoinDialog(false);
  };

  const handleSubmit = () => {
    if (!userInput.trim() || !roomId || isSpectator) return;
    socket?.emit('submit_answer', { roomId, answer: userInput });
    setUserInput('');
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    alert('ID комнаты скопирован в буфер обмена');
  };

  if (!gameState) {
    return (
      <Box sx={{ p: 3 }}>
        <Paper sx={{ p: 3, maxWidth: 400, mx: 'auto' }}>
          <Typography variant="h5" sx={{ mb: 3 }}>
            Мультиплеер
          </Typography>
          
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
            onClick={createRoom}
            sx={{ mb: 1 }}
          >
            Создать комнату
          </Button>

          <Button
            fullWidth
            variant="outlined"
            onClick={() => setShowJoinDialog(true)}
          >
            Присоединиться к комнате
          </Button>
        </Paper>

        <Dialog open={showJoinDialog} onClose={() => setShowJoinDialog(false)}>
          <DialogTitle>Присоединиться к комнате</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="ID комнаты"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowJoinDialog(false)}>Отмена</Button>
            <Button onClick={joinRoom} variant="contained">
              Присоединиться
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h5">
            {isSpectator ? 'Наблюдение за игрой' : 'Игра'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">ID комнаты: {roomId}</Typography>
            <Tooltip title="Скопировать ID комнаты">
              <IconButton size="small" onClick={copyRoomId}>
                <ContentCopyIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={8}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Игроки:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {gameState.players.map((player) => (
                  <Chip
                    key={player.id}
                    icon={<PersonIcon />}
                    label={`${player.name} (${player.score})`}
                    color={player.isAlive ? 'primary' : 'error'}
                    variant={player.isAlive ? 'filled' : 'outlined'}
                  />
                ))}
              </Box>
            </Box>

            {gameState.spectators.length > 0 && (
              <Box>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Наблюдатели:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {gameState.spectators.map((spectator) => (
                    <Chip
                      key={spectator}
                      icon={<VisibilityIcon />}
                      label="Наблюдатель"
                      variant="outlined"
                      size="small"
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Статистика
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                <Typography variant="body2">
                  Сложность: {gameState.difficulty}
                </Typography>
                <Typography variant="body2">
                  Статус: {gameState.isActive ? 'Идет игра' : 'Ожидание'}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {!isSpectator && gameState.isActive && (
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Введите слово..."
              disabled={!gameState.isActive}
              sx={{ mb: 2 }}
            />
            <Button
              fullWidth
              variant="contained"
              onClick={handleSubmit}
              disabled={!gameState.isActive}
            >
              Отправить
            </Button>
          </Box>
        )}

        <audio ref={audioRef} />
      </Paper>
    </Box>
  );
}; 