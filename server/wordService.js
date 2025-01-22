class WordService {
  constructor() {
    this.easyWords = [
      'кот', 'лес', 'мама', 'река', 'окно', 'гора', 'книга', 'друг', 'хлеб',
      'месяц', 'письмо', 'мост', 'семья', 'город', 'берег', 'орёл', 'лампа',
      'звонок', 'двор'
    ].map(word => this.createWordObject(word));

    this.normalWords = [
      'маршрут', 'костюм', 'талант', 'ворон', 'молчание', 'метель', 'загадка',
      'дружба', 'маршрутка', 'портфель', 'фарфор', 'художник', 'венок',
      'простыня', 'забота', 'любимый', 'серпантин', 'батон', 'пальто', 'картина',
      'зависть', 'здоровье', 'кузнец'
    ].map(word => this.createWordObject(word));

    this.hardWords = [
      'антагонизация', 'трансцендентность', 'экстраординарный',
      'кристаллография', 'метеорология', 'фотосинтез', 'орнаментализм',
      'акклиматизация', 'диспропорция', 'антропоцентризм', 'фоторепортаж', 'абонемент',
      'калейдоскоп', 'гиперболизация', 'милосердие', 'сверхъестественный', 'симультанный',
      'фантасмагория', 'энциклопедия', 'мегаполис', 'деинсталляция',
      'конфедерация', 'фотолитография', 'либерализация', 'гидроэлектростанция',
      'революционизировать'
    ].map(word => this.createWordObject(word));

    this.currentIndex = -1;
    this.currentDifficulty = 'normal';
    this.currentWords = [];
    this.bestStreak = 0;
    this.availableAudioFiles = new Set();
    this.usedWords = new Set();

    this.loadBestStreak();
    this.loadAvailableAudioFiles();
    this.setDifficulty('normal');
  }

  createWordObject(word) {
    const sanitizedWord = this.sanitizeString(word);
    const audioPath = `/audio/${sanitizedWord}.mp3?v=${Date.now()}`;
    
    return {
      text: sanitizedWord,
      audioPath
    };
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

  loadBestStreak() {
    this.bestStreak = 0;
  }

  loadAvailableAudioFiles() {
    const allWords = new Set([
      ...this.easyWords.map(w => w.text),
      ...this.normalWords.map(w => w.text),
      ...this.hardWords.map(w => w.text)
    ]);
    this.availableAudioFiles = allWords;
  }

  setDifficulty(difficulty) {
    this.currentDifficulty = difficulty;
    this.currentIndex = -1;
    this.resetUsedWords();

    const filterAvailableWords = (words) => 
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

  shuffle(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }

  resetUsedWords() {
    this.usedWords.clear();
  }

  getRandomWord() {
    if (this.usedWords.size >= this.currentWords.length) {
      this.resetUsedWords();
      this.currentWords = this.shuffle(this.currentWords);
    }

    let attempts = 0;
    let word;
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

  validateInput(input) {
    return this.normalizeText(input.trim());
  }
}

export const wordService = new WordService(); 