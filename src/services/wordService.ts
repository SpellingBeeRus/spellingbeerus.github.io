interface Word {
  text: string;
  audioPath: string;
}

type Difficulty = 'easy' | 'normal' | 'hard';

class WordService {
  private easyWords: Word[] = [
    'кот', 'лес', 'мама', 'река', 'окно', 'гора', 'книга', 'друг', 'хлеб',
    'месяц', 'письмо', 'мост', 'семья', 'город', 'берег', 'орёл', 'лампа',
    'звонок', 'двор'
  ].map(word => this.createWordObject(word));

  private normalWords: Word[] = [
    'маршрут', 'костюм', 'талант', 'ворон', 'молчание', 'метель', 'загадка',
    'дружба', 'маршрутка', 'портфель', 'фарфор', 'художник', 'венок',
    'простыня', 'забота', 'любимый', 'серпантин', 'батон', 'пальто', 'картина',
    'зависть', 'здоровье', 'кузнец'
  ].map(word => this.createWordObject(word));

  private hardWords: Word[] = [
    'антагонизация', 'трансцендентность', 'экстраординарный',
    'кристаллография', 'метеорология', 'фотосинтез', 'орнаментализм',
    'акклиматизация', 'диспропорция', 'антропоцентризм', 'фоторепортаж', 'абонемент',
    'калейдоскоп', 'гиперболизация', 'милосердие', 'сверхъестественный', 'симультанный',
    'фантасмагория', 'энциклопедия', 'мегаполис', 'деинсталляция',
    'конфедерация', 'фотолитография', 'либерализация', 'гидроэлектростанция',
    'революционизировать'
  ].map(word => this.createWordObject(word));

  private currentIndex: number = -1;
  private currentDifficulty: Difficulty = 'normal';
  private currentWords: Word[] = [];
  private bestStreak: number = 0;
  private availableAudioFiles: Set<string> = new Set();
  private usedWords: Set<string> = new Set();

  constructor() {
    this.loadBestStreak();
    this.loadAvailableAudioFiles();
    this.setDifficulty('normal');
  }

  private async loadAvailableAudioFiles() {
    try {
      const allWords = new Set([
        ...this.easyWords.map(w => w.text),
        ...this.normalWords.map(w => w.text),
        ...this.hardWords.map(w => w.text)
      ]);
      this.availableAudioFiles = allWords;
    } catch (error) {
      console.error('Ошибка при загрузке списка аудиофайлов:', error);
    }
  }

  private createWordObject(word: string): Word {
    const sanitizedWord = this.sanitizeString(word);
    const audioPath = `/audio/${sanitizedWord}.mp3?v=${Date.now()}`;
    
    return {
      text: sanitizedWord,
      audioPath
    };
  }

  private normalizeText(text: string): string {
    // Заменяем ё на е
    return text.toLowerCase().replace(/ё/g, 'е');
  }

  private sanitizeString(str: string): string {
    // Сначала нормализуем текст
    const normalized = this.normalizeText(str);
    // Затем применяем защиту от XSS
    return normalized.replace(/[&<>"']/g, (match) => {
      const escape: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return escape[match];
    });
  }

  private loadBestStreak(): void {
    try {
      const savedStreak = localStorage.getItem('bestStreak');
      if (savedStreak) {
        this.bestStreak = parseInt(savedStreak, 10);
      }
    } catch (error) {
      console.error('Ошибка при загрузке лучшего результата:', error);
    }
  }

  public updateBestStreak(currentStreak: number, gameEnded: boolean = false): void {
    try {
      if (currentStreak > this.bestStreak && gameEnded) {
        this.bestStreak = currentStreak;
        localStorage.setItem('bestStreak', currentStreak.toString());
      }
    } catch (error) {
      console.error('Ошибка при сохранении лучшего результата:', error);
    }
  }

  public getBestStreak(): number {
    return this.bestStreak;
  }

  private resetUsedWords() {
    this.usedWords.clear();
  }

  public setDifficulty(difficulty: Difficulty) {
    this.currentDifficulty = difficulty;
    this.currentIndex = -1;
    this.resetUsedWords();

    // Фильтруем слова, для которых есть аудиофайлы
    const filterAvailableWords = (words: Word[]) => 
      words.filter(word => this.availableAudioFiles.has(word.text));

    switch (difficulty) {
      case 'easy':
        this.currentWords = [
          ...this.shuffle(filterAvailableWords(this.easyWords)),
          ...this.shuffle(filterAvailableWords(this.normalWords.slice(0, 5)))
        ];
        break;
      case 'normal':
        this.currentWords = [
          ...this.shuffle(filterAvailableWords(this.normalWords)),
          ...this.shuffle(filterAvailableWords(this.easyWords.slice(0, 5))),
          ...this.shuffle(filterAvailableWords(this.hardWords.slice(0, 5)))
        ];
        break;
      case 'hard':
        this.currentWords = [
          ...this.shuffle(filterAvailableWords(this.hardWords)),
          ...this.shuffle(filterAvailableWords(this.normalWords.slice(0, 5)))
        ];
        break;
    }

    this.currentWords = this.shuffle(this.currentWords);
  }

  private shuffle<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }

  public getNextWord(): Word {
    if (this.usedWords.size >= this.currentWords.length) {
      this.resetUsedWords();
      this.currentWords = this.shuffle(this.currentWords);
    }

    let attempts = 0;
    let word: Word;
    do {
      this.currentIndex = (this.currentIndex + 1) % this.currentWords.length;
      word = this.currentWords[this.currentIndex];
      attempts++;
      if (attempts >= this.currentWords.length) {
        this.resetUsedWords();
      }
    } while (this.usedWords.has(word.text) && attempts < this.currentWords.length);

    this.usedWords.add(word.text);
    return {
      ...word,
      audioPath: `${word.audioPath.split('?')[0]}?v=${Date.now()}`
    };
  }

  public getCurrentWord(): Word | null {
    if (this.currentIndex === -1) {
      return null;
    }
    return this.currentWords[this.currentIndex];
  }

  public getRandomWord(): Word {
    if (this.usedWords.size >= this.currentWords.length) {
      this.resetUsedWords();
      this.currentWords = this.shuffle(this.currentWords);
    }

    let attempts = 0;
    let word: Word;
    do {
      const randomIndex = Math.floor(Math.random() * this.currentWords.length);
      this.currentIndex = randomIndex;
      word = this.currentWords[randomIndex];
      attempts++;
      if (attempts >= this.currentWords.length) {
        this.resetUsedWords();
      }
    } while (this.usedWords.has(word.text) && attempts < this.currentWords.length);

    this.usedWords.add(word.text);
    return {
      ...word,
      audioPath: `${word.audioPath.split('?')[0]}?v=${Date.now()}`
    };
  }

  public getDifficulty(): Difficulty {
    return this.currentDifficulty;
  }

  public validateInput(input: string): string {
    return this.normalizeText(input.trim());
  }
}

export const wordService = new WordService();
export type { Word, Difficulty }; 