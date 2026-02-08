import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameManager } from './gameManager.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

const gameManager = new GameManager();

// Socket.io événements
io.on('connection', (socket) => {
  console.log(`Client connecté: ${socket.id}`);

  // Créer une partie
  socket.on('create-game', ({ playerName }) => {
    const game = gameManager.createGame(socket.id, playerName);
    socket.join(game.code);
    
    socket.emit('game-created', {
      gameCode: game.code,
      player: game.gameMaster
    });
  });

  // Rejoindre une partie
  socket.on('join-game', ({ gameCode, playerName }) => {
    try {
      const result = gameManager.joinGame(gameCode, socket.id, playerName);
      socket.join(gameCode);
      
      // Notifier le joueur
      socket.emit('game-joined', {
        gameCode,
        player: result.player,
        players: result.game.players,
        isGameMaster: false
      });
      
      // Notifier tous les joueurs de la partie
      io.to(gameCode).emit('player-joined', {
        players: result.game.players
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Configurer la partie (Game Master uniquement)
  socket.on('configure-game', ({ gameCode, settings }) => {
    try {
      const game = gameManager.configureGame(gameCode, socket.id, settings);
      io.to(gameCode).emit('game-configured', {
        settings: game.settings
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Démarrer la partie
  socket.on('start-game', ({ gameCode }) => {
    try {
      const game = gameManager.startGame(gameCode, socket.id);
      io.to(gameCode).emit('game-started', {
        currentQuestion: game.currentQuestion,
        players: game.players
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Passer à la question suivante
  socket.on('next-question', ({ gameCode }) => {
    try {
      const game = gameManager.nextQuestion(gameCode, socket.id);
      io.to(gameCode).emit('question-changed', {
        currentQuestion: game.currentQuestion
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Soumettre une réponse
  socket.on('submit-answer', ({ gameCode, answerText }) => {
    try {
      const result = gameManager.submitAnswer(gameCode, socket.id, answerText);
      
      // Notifier le joueur que sa réponse est en attente
      socket.emit('answer-submitted', {
        answerId: result.answer.id
      });
      
      // Envoyer la réponse au Game Master en temps réel
      const game = gameManager.getGame(gameCode);
      io.to(game.gameMaster.socketId).emit('answer-received', {
        answer: result.answer
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Valider une réponse (Game Master uniquement)
  socket.on('validate-answer', ({ gameCode, playerId, isCorrect }) => {
    try {
      const result = gameManager.validateAnswer(gameCode, socket.id, playerId, isCorrect);
      
      // Notifier le joueur de la validation
      io.to(result.player.socketId).emit('answer-validated', {
        isCorrect,
        lives: result.player.lives,
        score: result.player.score
      });
      
      // Mettre à jour l'interface du GM
      io.to(gameCode).emit('player-updated', {
        player: result.player
      });
      
      // Mettre à jour la liste des réponses pour le GM
      const game = gameManager.getGame(gameCode);
      io.to(game.gameMaster.socketId).emit('answers-updated', {
        answers: game.answers
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Terminer la partie
  socket.on('end-game', ({ gameCode }) => {
    try {
      gameManager.endGame(gameCode, socket.id);
      io.to(gameCode).emit('game-ended');
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Quitter la partie
  socket.on('leave-game', ({ gameCode }) => {
    try {
      const result = gameManager.leaveGame(gameCode, socket.id);
      socket.leave(gameCode);
      
      if (result.gameDeleted) {
        // La partie a été supprimée (GM parti)
        io.to(gameCode).emit('game-ended');
      } else if (result.game) {
        // Un joueur normal a quitté
        io.to(gameCode).emit('player-left', {
          players: result.game.players
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Déconnexion
  socket.on('disconnect', () => {
    console.log(`Client déconnecté: ${socket.id}`);
    // Gérer la déconnexion (retirer le joueur de sa partie)
    gameManager.handleDisconnect(socket.id);
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 Serveur LiveTrivia démarré sur le port ${PORT}`);
});
