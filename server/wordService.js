import { Word } from './models/Word.js';

class WordService {
  constructor() {
    this.currentDifficulty = 'normal';
    this.usedWords = new Set();
    this.initializeWords();
  }

  async initializeWords() {
    const defaultWords = {
      easy: [
        'кот', 'лес', 'мама', 'река', 'окно', 'гора', 'книга', 'друг', 'хлеб',
        'месяц', 'письмо', 'мост', 'семья', 'город', 'берег', 'орёл', 'лампа',
        'звонок', 'двор'
      ],
      normal: [
        'маршрут', 'костюм', 'талант', 'ворон', 'молчание', 'метель', 'загадка',
        'дружба', 'маршрутка', 'портфель', 'фарфор', 'художник', 'венок',
        'простыня', 'забота', 'любимый', 'серпантин', 'батон', 'пальто'
      ],
      hard: [
        'антагонизация', 'трансцендентность', 'экстраординарный',
        'кристаллография', 'метеорология', 'фотосинтез', 'орнаментализм',
        'акклиматизация', 'диспропорция', 'антропоцентризм'
      ]
    };

    try {
      const count = await Word.countDocuments();
      if (count === 0) {
        for (const [difficulty, words] of Object.entries(defaultWords)) {
          for (const text of words) {
            const wordObj = this.createWordObject(text);
            await Word.create({
              text: wordObj.text,
              difficulty,
              audioPath: wordObj.audioPath,
            });
          }
        }
        console.log('Базовые слова добавлены в базу данных');
      }
    } catch (error) {
      console.error('Ошибка при инициализации слов:', error);
    }
  }

  createWordObject(word) {
    const sanitizedWord = this.sanitizeString(word);
    const audioPath = `/audio/${sanitizedWord}.mp3?v=${Date.now()}`;
    return { text: sanitizedWord, audioPath };
  }

  normalizeText(text) {
    return text.toLowerCase().replace(/ё/g, 'е');
  }

  sanitizeString(str) {
    const normalized = this.normalizeText(str);
    return normalized.replace(/[&<>"']/g, (match) => {
      const escape = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return escape[match];
    });
  }

  setDifficulty(difficulty) {
    this.currentDifficulty = difficulty;
    this.usedWords.clear();
  }

  async getRandomWord() {
    try {
      const words = await Word.find({ difficulty: this.currentDifficulty });
      if (!words.length) return null;

      let availableWords = words.filter(word => !this.usedWords.has(word.text));
      if (!availableWords.length) {
        this.usedWords.clear();
        availableWords = words;
      }

      const randomIndex = Math.floor(Math.random() * availableWords.length);
      const word = availableWords[randomIndex];
      
      this.usedWords.add(word.text);
      await Word.findByIdAndUpdate(word._id, { $inc: { usageCount: 1 } });

      return {
        text: word.text,
        audioPath: `${word.audioPath.split('?')[0]}?v=${Date.now()}`
      };
    } catch (error) {
      console.error('Ошибка при получении случайного слова:', error);
      return null;
    }
  }

  validateInput(input) {
    return this.normalizeText(input.trim());
  }
}

export const wordService = new WordService(); 