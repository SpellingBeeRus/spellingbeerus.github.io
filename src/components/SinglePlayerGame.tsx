import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  LinearProgress,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { wordService } from '../services/wordService';
import type { Word, Difficulty } from '../services/wordService';

interface Props {
  onScoreUpdate?: (score: number) => void;
  onStreakUpdate?: (streak: number) => void;
}

export default function SinglePlayerGame({ onScoreUpdate, onStreakUpdate }: Props) {
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [userInput, setUserInput] = useState('');
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(15);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [gameStarted, setGameStarted] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (!gameStartTime) {
      setGameStartTime(Date.now());
    }

    const duration = totalTime * 1000;
    setTimeExpired(false);

    timerRef.current = window.setInterval(() => {
      if (!gameStartTime) return;
      
      const elapsed = Date.now() - gameStartTime;
      const remaining = Math.max(0, duration - elapsed) / 1000;
      setTimeLeft(Number(remaining.toFixed(1)));

      if (remaining <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        setTimeExpired(true);
        handleIncorrectAnswer();
      }
    }, 100);
  }, [totalTime, gameStartTime]);

  const handlePlay = useCallback(async () => {
    if (!audioRef.current || isPlaying) return;
    
    try {
      setIsPlaying(true);
      await audioRef.current.play();
      
      if (!gameStarted) {
        setGameStarted(true);
        const word = await wordService.getRandomWord();
        setCurrentWord(word);
        startTimer();
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    } finally {
      setIsPlaying(false);
    }
  }, [isPlaying, gameStarted, startTimer]);

  const handleReplay = useCallback(async () => {
    if (!audioRef.current || isPlaying) return;
    
    try {
      setIsPlaying(true);
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
    } catch (error) {
      console.error('Error replaying audio:', error);
    } finally {
      setIsPlaying(false);
    }
  }, [isPlaying]);

  const handleDifficultyChange = useCallback((_: React.MouseEvent<HTMLElement>, newDifficulty: Difficulty | null) => {
    if (newDifficulty) {
      setDifficulty(newDifficulty);
      wordService.setDifficulty(newDifficulty);
    }
  }, []);

  const handleCorrectAnswer = useCallback(async () => {
    const newStreak = streak + 1;
    setStreak(newStreak);
    if (newStreak > bestStreak) {
      setBestStreak(newStreak);
    }
    onStreakUpdate?.(newStreak);
    
    const word = await wordService.getRandomWord();
    setCurrentWord(word);
    setUserInput('');
    setGameStartTime(Date.now());
    startTimer();
  }, [streak, bestStreak, onStreakUpdate, startTimer]);

  const handleIncorrectAnswer = useCallback(() => {
    setStreak(0);
    onStreakUpdate?.(0);
    setGameStarted(false);
    setUserInput('');
    setGameStartTime(null);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [onStreakUpdate]);

  const handleSubmit = useCallback(() => {
    if (!currentWord || !gameStarted) return;

    const normalizedInput = wordService.validateInput(userInput);
    const normalizedWord = wordService.validateInput(currentWord.text);

    if (normalizedInput === normalizedWord) {
      handleCorrectAnswer();
    } else {
      handleIncorrectAnswer();
    }
  }, [currentWord, gameStarted, userInput, handleCorrectAnswer, handleIncorrectAnswer]);

  return (
    <>
      <ToggleButtonGroup
        value={difficulty}
        exclusive
        onChange={handleDifficultyChange}
        aria-label="сложность"
        sx={{ mb: 3, width: '100%', gap: 1 }}
      >
        <ToggleButton value="easy" sx={{ flex: 1 }}>
          Легкий
        </ToggleButton>
        <ToggleButton value="normal" sx={{ flex: 1 }}>
          Средний
        </ToggleButton>
        <ToggleButton value="hard" sx={{ flex: 1 }}>
          Сложный
        </ToggleButton>
      </ToggleButtonGroup>

      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Серия: {streak} | Рекорд: {bestStreak}
        </Typography>
      </Box>

      {(timeLeft > 0 || timeExpired) && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color={timeExpired ? "error" : "text.secondary"} gutterBottom>
            {timeExpired ? 'Время вышло!' : `Осталось: ${timeLeft.toFixed(1)} сек`}
          </Typography>
          {!timeExpired && (
            <LinearProgress 
              variant="determinate" 
              value={(timeLeft / totalTime) * 100}
              sx={{ 
                height: 8,
                borderRadius: 4,
                background: 'rgba(33, 150, 243, 0.1)',
                '& .MuiLinearProgress-bar': {
                  background: 'linear-gradient(90deg, #2196f3, #00bcd4)',
                  transition: 'transform 0.1s linear'
                }
              }}
            />
          )}
        </Box>
      )}

      <Box sx={{ mb: 3 }}>
        <Button 
          variant="contained" 
          onClick={gameStarted ? handleReplay : handlePlay}
          startIcon={<PlayCircleOutlineIcon />}
          fullWidth
          className="gradient-button pulse-on-hover"
          sx={{
            background: 'linear-gradient(45deg, #2196f3, #00bcd4)',
            '&:hover': {
              background: 'linear-gradient(45deg, #1976d2, #00acc1)'
            }
          }}
        >
          {gameStarted ? 'Повторить слово' : 'Прослушать'}
        </Button>
      </Box>

      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Введите слово..."
          disabled={!gameStarted || timeExpired}
        />
      </Box>

      <Button 
        fullWidth 
        variant="contained" 
        onClick={handleSubmit}
        disabled={!gameStarted || timeExpired}
        sx={{
          background: gameStarted ? 
            'linear-gradient(45deg, #2196f3, #00bcd4)' :
            'linear-gradient(45deg, #9e9e9e, #757575)'
        }}
      >
        Проверить
      </Button>

      {currentWord && (
        <audio 
          ref={audioRef}
          src={currentWord.audioPath}
          onEnded={() => setIsPlaying(false)}
          onError={(e) => {
            console.error('Audio error:', e);
            setIsPlaying(false);
          }}
        />
      )}
    </>
  );
} 