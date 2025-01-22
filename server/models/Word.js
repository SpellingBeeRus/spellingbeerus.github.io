import mongoose from 'mongoose';

const wordSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    unique: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'normal', 'hard'],
    required: true
  },
  audioPath: {
    type: String,
    required: true
  },
  usageCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const Word = mongoose.model('Word', wordSchema); 