import crypto from 'crypto';

export function generatePassword() {
  return crypto.randomBytes(18).toString('base64url');
}

function mulberry32(seed) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = mulberry32(20261126);
export const pick = (items) => items[Math.floor(rand() * items.length)];
export const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));
export const hex = (bytes) => crypto.randomBytes(bytes).toString('hex');

export function ratingDistribution() {
  const weights = [1, 2, 4, 6, 10, 14, 18, 20, 15, 10];
  const total = weights.reduce((sum, value) => sum + value, 0);
  let ticket = rand() * total;
  for (let i = 0; i < weights.length; i += 1) {
    ticket -= weights[i];
    if (ticket <= 0) return i + 1;
  }
  return 8;
}
