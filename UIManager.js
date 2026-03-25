import { CONFIG } from './config.js';

export class UIManager {
    constructor() {
        // Cache DOM elements for quick access
        this.elements = {
            loadingScreen: document.getElementById('loading'),
            progressBar: document.getElementById('progress-bar'),
            loaderText: document.getElementById('loader-text'),
            progressWrapper: document.getElementById('progress-wrapper'),
            btnStart: document.getElementById('btn-start-game'),
            
            hudTop: document.getElementById('hud-top'),
            scoreDisplay: document.getElementById('score-display'),
            distDisplay: document.getElementById('dist-display'),
            livesDisplay: document.getElementById('lives-display'),
            btnPause: document.getElementById('btn-pause'),
            
            pauseScreen: document.getElementById('pause-screen'),
            gameOverScreen: document.getElementById('game-over-screen'),
            finalScore: document.getElementById('final-score'),
            tutorialLayer: document.getElementById('tutorial-layer'),
            threeCanvas: document.getElementById('three-canvas'),

            btnResume: document.getElementById('btn-resume'),
            btnRestartPause: document.getElementById('btn-restart-pause'),
            btnExit: document.getElementById('btn-exit'),
            btnRestartDeath: document.getElementById('btn-restart-death'),

            tutImages: [
                document.getElementById('tut-img-left'),
                document.getElementById('tut-img-right'),
                document.getElementById('tut-img-up'),
                document.getElementById('tut-img-down')
            ]
        };

        this.boundCallbacks = null; 
    }

    // Attach interaction callbacks from the main Game class
    bindEvents(callbacks) {
        this.boundCallbacks = callbacks; 

        this.elements.btnStart.addEventListener('click', this.boundCallbacks.onStart);
        this.elements.btnPause.addEventListener('click', this.boundCallbacks.onTogglePause);
        this.elements.btnResume.addEventListener('click', this.boundCallbacks.onTogglePause);
        this.elements.btnRestartPause.addEventListener('click', this.boundCallbacks.onRestartFromPause);
        this.elements.btnExit.addEventListener('click', this.boundCallbacks.onExit);
        this.elements.btnRestartDeath.addEventListener('click', this.boundCallbacks.onRestart);
    }

    destroy() {
        if (!this.boundCallbacks) return;

        this.elements.btnStart.removeEventListener('click', this.boundCallbacks.onStart);
        this.elements.btnPause.removeEventListener('click', this.boundCallbacks.onTogglePause);
        this.elements.btnResume.removeEventListener('click', this.boundCallbacks.onTogglePause);
        this.elements.btnRestartPause.removeEventListener('click', this.boundCallbacks.onRestartFromPause);
        this.elements.btnExit.removeEventListener('click', this.boundCallbacks.onExit);
        this.elements.btnRestartDeath.removeEventListener('click', this.boundCallbacks.onRestart);
        
        this.boundCallbacks = null;
    }

    updateLoadingProgress(pct) {
        this.elements.progressBar.style.width = pct + '%';
        this.elements.loaderText.innerText = `Loading: ${Math.round(pct)}%`;
    }

    showStartButton() {
        this.elements.progressWrapper.style.display = 'none';
        this.elements.btnStart.style.display = 'block';
    }

    hideLoadingScreen() {
        this.elements.loadingScreen.classList.add('hidden');
        setTimeout(() => { this.elements.loadingScreen.style.display = 'none'; }, CONFIG.TUTORIAL.uiHideDelay);
        this.elements.hudTop.style.display = 'flex';
    }

    updateHUD(score, distance, lives) {
        this.elements.scoreDisplay.innerText = score;
        this.elements.distDisplay.innerText = `${distance}m`;
        
        // Dynamically build life indicator images
        let livesHTML = '';
        for (let i = 0; i < CONFIG.maxLives; i++) {
            livesHTML += i < lives 
                ? '<img src="assets/textures/red-heart.png" class="heart-icon" alt="Life">' 
                : '<img src="assets/textures/grey-heart.png" class="heart-icon" alt="Empty Life">';
        }
        this.elements.livesDisplay.innerHTML = livesHTML;
    }

    setPauseButtonVisible(isVisible) {
        this.elements.btnPause.style.display = isVisible ? 'flex' : 'none';
    }

    togglePauseScreen(isPaused) {
        if (isPaused) this.elements.pauseScreen.classList.add('visible');
        else this.elements.pauseScreen.classList.remove('visible');
    }

    showGameOverScreen(finalScore) {
        this.elements.finalScore.innerText = finalScore;
        this.elements.gameOverScreen.classList.add('visible');
        this.setPauseButtonVisible(false);
    }

    resetScreens() {
        this.elements.pauseScreen.classList.remove('visible');
        this.elements.gameOverScreen.classList.remove('visible');
        this.hideTutorialLayer();
    }

    showTutorialStep(stepIndex) {
        this.elements.tutorialLayer.style.display = 'flex';
        this.hideAllTutorialImages();
        if (this.elements.tutImages[stepIndex]) {
            this.elements.tutImages[stepIndex].style.display = 'block';
        }
    }

    hideAllTutorialImages() {
        this.elements.tutImages.forEach(img => img.style.display = 'none');
    }

    hideTutorialLayer() {
        this.elements.tutorialLayer.style.display = 'none';
    }

    getCanvasContainer() {
        return this.elements.threeCanvas;
    }
}