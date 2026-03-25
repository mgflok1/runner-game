import { Game } from './Game.js';

// Initialize the game when the window finishes loading
window.addEventListener('load', () => {
    const game = new Game();
    game.init();
});