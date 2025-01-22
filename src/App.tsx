import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Container, 
  Paper,
  ThemeProvider,
  createTheme,
  CssBaseline,
  ToggleButtonGroup,
  ToggleButton,
  useMediaQuery,
  Alert,
  Snackbar,
  LinearProgress,
  IconButton,
  Tooltip,
  Chip,
  Tabs,
  Tab
} from '@mui/material';
import { wordService, Word, Difficulty } from './services/wordService';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import StopIcon from '@mui/icons-material/Stop';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SpeedIcon from '@mui/icons-material/Speed';
import TimerIcon from '@mui/icons-material/Timer';
import TimerOffIcon from '@mui/icons-material/TimerOff';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import InfoIcon from '@mui/icons-material/Info';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HelpIcon from '@mui/icons-material/Help';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import StarIcon from '@mui/icons-material/Star';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import './App.css';
import SinglePlayerGame from './components/SinglePlayerGame';
import MultiplayerGame from './components/MultiplayerGame';

function App() {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [darkMode, setDarkMode] = useState(prefersDarkMode);
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [userInput, setUserInput] = useState<string>('');
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [totalTime, setTotalTime] = useState<number>(0);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [showAlert, setShowAlert] = useState<boolean>(false);
  const [alertMessage, setAlertMessage] = useState<string>('');
  const [alertSeverity, setAlertSeverity] = useState<'success' | 'error'>('success');
  const [wpm, setWpm] = useState<number>(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeExpired, setTimeExpired] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [gameMode, setGameMode] = useState<'single' | 'multi'>('single');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const wpmTimerRef = useRef<number | null>(null);

  // Время для разных уровней сложности
  const difficultyTimes = {
    easy: 5,
    normal: 8,
    hard: 12
  };

  // Получаем текущее время в зависимости от сложности
  const getCurrentTimeLimit = useCallback(() => {
    return difficultyTimes[difficulty];
  }, [difficulty]);

  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: '#2196f3',
      },
      secondary: {
        main: '#00bcd4',
      },
      warning: {
        main: '#ff9800',
      },
      error: {
        main: '#f44336',
      },
      background: {
        default: darkMode ? '#1a1a1a' : '#f5f5f5',
        paper: darkMode ? '#2d2d2d' : '#ffffff',
      },
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      h4: {
        fontWeight: 700,
        letterSpacing: '-0.5px',
      },
      h6: {
        fontWeight: 600,
        letterSpacing: '-0.3px',
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            textTransform: 'none',
            fontSize: '1rem',
            padding: '12px 24px',
            fontWeight: 500,
            backdropFilter: 'blur(10px)',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 24,
            backgroundImage: darkMode ? 
              'linear-gradient(145deg, #2d2d2d, #333333)' : 
              'linear-gradient(145deg, #ffffff, #f5f5f5)',
            boxShadow: darkMode ?
              '20px 20px 60px #1a1a1a, -20px -20px 60px #363636' :
              '20px 20px 60px #d9d9d9, -20px -20px 60px #ffffff',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontSize: '0.9rem',
            height: 36,
            fontWeight: 500,
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
            },
          },
        },
      },
    },
  });

  useEffect(() => {
    const word = wordService.getRandomWord();
    setCurrentWord(word);
    setBestStreak(wordService.getBestStreak());
  }, []);

  useEffect(() => {
    return () => {
      if (wpmTimerRef.current) {
        clearInterval(wpmTimerRef.current);
      }
    };
  }, []);

  const calculateWPM = () => {
    if (!startTime) return 0;
    const timeElapsed = (Date.now() - startTime) / 1000 / 60; // в минутах
    const wordsTyped = streak + 1; // +1 потому что текущее слово тоже считаем
    return Math.round((wordsTyped / timeElapsed) * 10) / 10;
  };

  const handleDifficultyChange = (_: React.MouseEvent<HTMLElement>, newDifficulty: Difficulty) => {
    if (newDifficulty !== null) {
      setDifficulty(newDifficulty);
      wordService.setDifficulty(newDifficulty);
      const word = wordService.getRandomWord();
      setCurrentWord(word);
      setStreak(0);
      setWpm(0);
      setStartTime(null);
      handleStop();
      showMessage('Уровень сложности изменен', 'success');
    }
  };

  const showMessage = (message: string, severity: 'success' | 'error') => {
    setAlertMessage(message);
    setAlertSeverity(severity);
    setShowAlert(true);
  };

  const handlePlay = () => {
    if (audioRef.current) {
      // Сначала останавливаем предыдущее воспроизведение
      handleStop();
      
      // Получаем новое слово
      const newWord = wordService.getRandomWord();
      setCurrentWord(newWord);
      
      // Ждем немного перед новым воспроизведением
      setTimeout(() => {
        if (audioRef.current) {
          setTimeExpired(false);
          
          audioRef.current.onerror = (e) => {
            console.error('Ошибка воспроизведения аудио:', e);
            showMessage('Ошибка воспроизведения аудио', 'error');
            setGameStarted(false);
            setIsPlaying(false);
          };
          
          audioRef.current.onloadedmetadata = () => {
            console.log('Аудио метаданные загружены:', newWord.audioPath);
            if (audioRef.current) {
              const duration = audioRef.current.duration;
              console.log('Длительность аудио:', duration);
              const answerTime = getCurrentTimeLimit();
              setTotalTime(answerTime);
            }
          };
          
          audioRef.current.onplay = () => {
            console.log('Аудио начало воспроизводиться');
            setIsPlaying(true);
          };

          audioRef.current.onended = () => {
            console.log('Аудио закончило воспроизводиться');
            setIsPlaying(false);
            setGameStarted(true);
            
            const answerTime = getCurrentTimeLimit();
            setTimeLeft(answerTime);
            
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            
            const startTime = Date.now();
            timerRef.current = window.setInterval(() => {
              const elapsedTime = (Date.now() - startTime) / 1000;
              const remaining = Math.max(0, answerTime - elapsedTime);
              
              setTimeLeft(remaining);
              
              if (remaining <= 0.1) {
                clearInterval(timerRef.current!);
                setIsPlaying(false);
                setTimeExpired(true);
                showMessage('Время вышло!', 'error');
              }
            }, 50); // Уменьшаем интервал для более плавной анимации
          };

          audioRef.current.src = newWord.audioPath;
          audioRef.current.play().catch((error) => {
            console.error('Ошибка воспроизведения:', error);
            showMessage('Ошибка воспроизведения аудио', 'error');
            setGameStarted(false);
            setIsPlaying(false);
          });
        }
      }, 100);
    }
  };

  const handleStop = () => {
    // Сначала очищаем таймер
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Затем останавливаем аудио
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setIsPlaying(false);
    setTimeLeft(0);
  };

  const handleReplay = () => {
    if (audioRef.current && !isPlaying && currentWord) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((error) => {
        console.error('Ошибка воспроизведения:', error);
        showMessage('Ошибка воспроизведения аудио', 'error');
        setIsPlaying(false);
      });
    }
  };

  const handleSubmit = () => {
    if (!currentWord) return;

    const sanitizedInput = wordService.validateInput(userInput);
    if (sanitizedInput === wordService.validateInput(currentWord.text)) {
      // Правильный ответ
      const newStreak = streak + 1;
      setStreak(newStreak);
      
      // Обновляем WPM
      if (!startTime) {
        setStartTime(Date.now());
      }
      const newWpm = calculateWPM();
      setWpm(newWpm);

      // Показываем сообщение об успехе
      showMessage('Правильно! 🎯', 'success');
      
      // Получаем следующее слово
      const nextWord = wordService.getNextWord();
      setCurrentWord(nextWord);
      
      // Очищаем поле ввода и останавливаем текущее воспроизведение
      setUserInput('');
      handleStop();
      
      // Автоматически воспроизводим следующее слово после небольшой паузы
      setTimeout(() => {
        handlePlay();
      }, 1000);
    } else {
      // Неправильный ответ
      // Сохраняем текущий рекорд, если он лучше предыдущего
      if (streak > bestStreak) {
        wordService.updateBestStreak(streak, true);
        setBestStreak(streak);
        showMessage('Игра окончена. Новый рекорд! 🏆', 'error');
      } else {
        showMessage('Неправильно! Попробуйте еще раз 😔', 'error');
      }
      
      // Сбрасываем streak и WPM
      setStreak(0);
      setWpm(0);
      setStartTime(null);
      
      // Получаем новое случайное слово
      const newWord = wordService.getRandomWord();
      setCurrentWord(newWord);
      
      // Очищаем поле ввода и останавливаем воспроизведение
      setUserInput('');
      handleStop();
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSubmit();
    }
  };

  const handleGameModeChange = (_: React.SyntheticEvent, newMode: 'single' | 'multi') => {
    if (newMode !== null) {
      setGameMode(newMode);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="sm">
        <Box sx={{ 
          mt: 4, 
          mb: 4,
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -20,
            left: -20,
            right: -20,
            bottom: -20,
            background: 'radial-gradient(circle at center, rgba(33, 150, 243, 0.1) 0%, transparent 70%)',
            zIndex: -1,
            borderRadius: '50%',
            animation: 'pulse 4s infinite'
          }
        }}>
          <Paper 
            elevation={darkMode ? 4 : 2} 
            sx={{ 
              p: 4,
              position: 'relative',
              overflow: 'hidden',
              background: darkMode ? 
                'linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%)' : 
                'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, #2196f3, #00bcd4)',
              },
              '&::after': {
                content: '""',
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '150%',
                height: '150%',
                background: 'radial-gradient(circle, rgba(33, 150, 243, 0.05) 0%, transparent 70%)',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
              },
              boxShadow: darkMode ?
                '0 10px 30px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1)' :
                '0 10px 30px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.5)'
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" className="gradient-text">
                BeeSpelling
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Как играть">
                  <IconButton
                    onClick={() => setShowHint(!showHint)}
                    color="primary"
                    className="theme-toggle-button"
                  >
                    <HelpIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Сменить тему">
                  <IconButton
                    onClick={() => setDarkMode(!darkMode)}
                    color="inherit"
                    className="theme-toggle-button"
                  >
                    {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            <Tabs
              value={gameMode}
              onChange={handleGameModeChange}
              centered
              sx={{ mb: 3 }}
            >
              <Tab value="single" label="Одиночная игра" />
              <Tab value="multi" label="Мультиплеер" />
            </Tabs>

            {gameMode === 'single' ? (
              <>
                {showHint && (
                  <Paper
                    sx={{
                      p: 2,
                      mb: 3,
                      background: darkMode ? 'rgba(33, 150, 243, 0.1)' : 'rgba(33, 150, 243, 0.05)',
                      border: '1px solid',
                      borderColor: 'primary.main',
                      borderRadius: 2,
                    }}
                  >
                    <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                      Как играть в BeeSpelling
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <PlayArrowIcon color="primary" />
                        <Typography variant="body2">
                          Нажмите "Прослушать" и внимательно послушайте слово
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <KeyboardIcon color="primary" />
                        <Typography variant="body2">
                          Введите услышанное слово в поле ввода и нажмите "Проверить" или Enter
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <StarIcon color="primary" />
                        <Typography variant="body2">
                          Получайте очки за правильные ответы и следите за своим рекордом
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <TimerIcon color="primary" />
                        <Typography variant="body2">
                          Успейте ввести слово до истечения таймера
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                )}

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
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    gap: 2, 
                    mb: 2,
                    flexWrap: 'wrap'
                  }}>
                    <Chip
                      icon={<EmojiEventsIcon />}
                      label={`Серия: ${streak}`}
                      color="primary"
                      variant="outlined"
                      className="stat-chip"
                    />
                    <Chip
                      icon={<TrendingUpIcon />}
                      label={`WPM: ${wpm}`}
                      color="secondary"
                      variant="outlined"
                      className="stat-chip"
                    />
                    <Chip
                      icon={<EmojiEventsIcon />}
                      label={`Рекорд: ${bestStreak}`}
                      color="warning"
                      variant="outlined"
                      className="stat-chip"
                    />
                  </Box>
                </Box>

                {(timeLeft > 0 || timeExpired) && (
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      mb: 1,
                      color: timeExpired ? theme.palette.error.main : theme.palette.text.secondary
                    }}>
                      {timeExpired ? (
                        <TimerOffIcon sx={{ mr: 1 }} />
                      ) : (
                        <AccessTimeIcon sx={{ mr: 1 }} />
                      )}
                      <Typography 
                        variant="body2" 
                        color={timeExpired ? "error" : "text.secondary"}
                        sx={{ fontWeight: timeExpired ? 600 : 400 }}
                      >
                        {timeExpired ? 'Время вышло!' : `Осталось: ${timeLeft.toFixed(1)} сек`}
                      </Typography>
                    </Box>
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
                          }
                        }}
                      />
                    )}
                  </Box>
                )}

                <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
                  <Button 
                    variant="contained" 
                    onClick={handlePlay}
                    disabled={isPlaying}
                    startIcon={<PlayCircleOutlineIcon />}
                    fullWidth
                    className="gradient-button pulse-on-hover"
                    sx={{
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(45deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)',
                        transform: 'translateY(-100%)',
                        transition: 'transform 0.3s ease',
                      },
                      '&:hover::before': {
                        transform: 'translateY(0)',
                      }
                    }}
                  >
                    Прослушать
                  </Button>
                  {isPlaying ? (
                    <Button 
                      variant="outlined" 
                      onClick={handleStop}
                      startIcon={<StopIcon />}
                      fullWidth
                      className="stop-button"
                    >
                      Стоп
                    </Button>
                  ) : (
                    <Button 
                      variant="outlined" 
                      onClick={handleReplay}
                      startIcon={<PlayCircleOutlineIcon />}
                      fullWidth
                      className="replay-button"
                      disabled={!gameStarted}
                    >
                      Повторить
                    </Button>
                  )}
                </Box>

                <Box sx={{ position: 'relative', mb: 3 }}>
                  <TextField
                    fullWidth
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Введите слово..."
                    variant="outlined"
                    disabled={!gameStarted && isPlaying}
                    sx={{ 
                      mb: 0,
                      '& .MuiOutlinedInput-root': {
                        transition: 'all 0.3s ease',
                        backdropFilter: 'blur(10px)',
                        background: darkMode ? 
                          'rgba(255,255,255,0.05)' : 
                          'rgba(255,255,255,0.9)',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                        },
                        '&.Mui-focused': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 12px rgba(33, 150, 243, 0.2)',
                        }
                      }
                    }}
                    autoComplete="off"
                    inputProps={{
                      'aria-label': 'введите слово',
                      maxLength: 50,
                      style: { 
                        textAlign: 'center',
                        fontSize: '1.2rem',
                        letterSpacing: '1px'
                      }
                    }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: gameStarted ? 'success.main' : 'error.main',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {gameStarted ? <LockOpenIcon /> : <LockIcon />}
                  </Box>
                </Box>

                <Button 
                  fullWidth 
                  variant="contained" 
                  onClick={handleSubmit}
                  color="primary"
                  size="large"
                  className={`gradient-button ${gameStarted ? 'pulse-on-hover' : ''}`}
                  sx={{
                    background: gameStarted ?
                      'linear-gradient(45deg, #2196f3, #00bcd4)' :
                      'linear-gradient(45deg, #9e9e9e, #757575)',
                    transform: gameStarted ? 'scale(1)' : 'scale(0.98)',
                    opacity: gameStarted ? 1 : 0.8,
                    transition: 'all 0.3s ease'
                  }}
                >
                  Проверить
                </Button>
              </>
            ) : (
              <MultiplayerGame />
            )}
          </Paper>
        </Box>
        
        <Snackbar 
          open={showAlert} 
          autoHideDuration={2000} 
          onClose={() => setShowAlert(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            onClose={() => setShowAlert(false)} 
            severity={alertSeverity}
            variant="filled"
            sx={{ 
              width: '100%',
              borderRadius: 3,
              fontWeight: 500
            }}
          >
            {alertMessage}
          </Alert>
        </Snackbar>
        
        {currentWord && gameMode === 'single' && (
          <audio 
            ref={audioRef}
            preload="metadata"
            onError={(e) => {
              console.error('Ошибка аудио элемента:', e);
              showMessage('Ошибка загрузки аудио', 'error');
              setGameStarted(false);
            }}
          >
            <source src={currentWord.audioPath} type="audio/mpeg" />
            <source src={currentWord.audioPath.replace('.mp3', '.wav')} type="audio/wav" />
            Ваш браузер не поддерживает аудио элемент.
          </audio>
        )}
      </Container>
    </ThemeProvider>
  );
}

export default App;
