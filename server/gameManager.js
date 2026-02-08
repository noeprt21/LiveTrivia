export class GameManager {
  constructor() {
    this.games = new Map();
  }

  // Générer un code de partie unique
  generateGameCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.games.has(code));
    return code;
  }

  // Créer une nouvelle partie
  createGame(socketId, playerName) {
    const code = this.generateGameCode();
    const gameMaster = {
      id: `player_${Date.now()}`,
      socketId,
      name: playerName,
      isGameMaster: true,
      lives: 0,
      score: 0
    };

    const game = {
      code,
      gameMaster,
      players: [gameMaster],
      status: 'lobby', // lobby, playing, ended
      currentQuestion: 0,
      answers: [],
      settings: {
        lives: 3,
        totalQuestions: 10
      },
      createdAt: Date.now()
    };

    this.games.set(code, game);
    return game;
  }

  // Rejoindre une partie
  joinGame(gameCode, socketId, playerName) {
    const game = this.games.get(gameCode);
    
    if (!game) {
      throw new Error('Partie introuvable');
    }

    if (game.status !== 'lobby') {
      throw new Error('La partie a déjà commencé');
    }

    if (game.players.length >= 6) { // 1 GM + 5 joueurs max
      throw new Error('La partie est complète');
    }

    // Vérifier si le nom est déjà pris
    if (game.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
      throw new Error('Ce pseudo est déjà utilisé dans cette partie');
    }

    const player = {
      id: `player_${Date.now()}_${Math.random()}`,
      socketId,
      name: playerName,
      isGameMaster: false,
      lives: game.settings.lives,
      score: 0
    };

    game.players.push(player);
    return { game, player };
  }

  // Configurer les paramètres de la partie
  configureGame(gameCode, socketId, settings) {
    const game = this.games.get(gameCode);
    
    if (!game) {
      throw new Error('Partie introuvable');
    }

    if (game.gameMaster.socketId !== socketId) {
      throw new Error('Seul le Game Master peut configurer la partie');
    }

    game.settings = { ...game.settings, ...settings };
    
    // Mettre à jour les vies des joueurs
    game.players.forEach(player => {
      if (!player.isGameMaster) {
        player.lives = game.settings.lives;
      }
    });

    return game;
  }

  // Démarrer la partie
  startGame(gameCode, socketId) {
    const game = this.games.get(gameCode);
    
    if (!game) {
      throw new Error('Partie introuvable');
    }

    if (game.gameMaster.socketId !== socketId) {
      throw new Error('Seul le Game Master peut démarrer la partie');
    }

    if (game.players.length < 2) {
      throw new Error('Au moins 2 joueurs sont nécessaires');
    }

    game.status = 'playing';
    game.currentQuestion = 1;
    return game;
  }

  // Passer à la question suivante
  nextQuestion(gameCode, socketId) {
    const game = this.games.get(gameCode);
    
    if (!game) {
      throw new Error('Partie introuvable');
    }

    if (game.gameMaster.socketId !== socketId) {
      throw new Error('Seul le Game Master peut changer de question');
    }

    game.currentQuestion++;
    
    // Réinitialiser les réponses pour la nouvelle question
    game.answers = [];

    // Vérifier si la partie est terminée
    if (game.settings.totalQuestions > 0 && game.currentQuestion > game.settings.totalQuestions) {
      game.status = 'ended';
    }

    return game;
  }

  // Soumettre une réponse
  submitAnswer(gameCode, socketId, answerText) {
    const game = this.games.get(gameCode);
    
    if (!game) {
      throw new Error('Partie introuvable');
    }

    const player = game.players.find(p => p.socketId === socketId);
    
    if (!player) {
      throw new Error('Joueur introuvable');
    }

    if (player.isGameMaster) {
      throw new Error('Le Game Master ne peut pas répondre');
    }

    // Vérifier si le joueur a déjà une réponse en attente
    const existingAnswer = game.answers.find(
      a => a.playerId === player.id && !a.validated
    );

    if (existingAnswer) {
      throw new Error('Tu as déjà une réponse en attente de validation');
    }

    const answer = {
      id: `answer_${Date.now()}_${Math.random()}`,
      playerId: player.id,
      playerName: player.name,
      text: answerText,
      timestamp: Date.now(),
      validated: false,
      isCorrect: false,
      questionNumber: game.currentQuestion
    };

    game.answers.push(answer);
    return { answer, player };
  }

  // Valider une réponse
  validateAnswer(gameCode, socketId, playerId, isCorrect) {
    const game = this.games.get(gameCode);
    
    if (!game) {
      throw new Error('Partie introuvable');
    }

    if (game.gameMaster.socketId !== socketId) {
      throw new Error('Seul le Game Master peut valider les réponses');
    }

    const player = game.players.find(p => p.id === playerId);
    
    if (!player) {
      throw new Error('Joueur introuvable');
    }

    // Trouver la réponse en attente du joueur
    const answer = game.answers.find(
      a => a.playerId === playerId && !a.validated
    );

    if (!answer) {
      throw new Error('Aucune réponse en attente pour ce joueur');
    }

    // Valider la réponse
    answer.validated = true;
    answer.isCorrect = isCorrect;

    // Mettre à jour le joueur
    if (isCorrect) {
      player.score += 10; // +10 points par bonne réponse
    } else {
      player.lives = Math.max(0, player.lives - 1);
    }

    return { player, answer, game };
  }

  // Terminer la partie
  endGame(gameCode, socketId) {
    const game = this.games.get(gameCode);
    
    if (!game) {
      throw new Error('Partie introuvable');
    }

    if (game.gameMaster.socketId !== socketId) {
      throw new Error('Seul le Game Master peut terminer la partie');
    }

    game.status = 'ended';
    this.games.delete(gameCode);
    return game;
  }

  // Quitter la partie
  leaveGame(gameCode, socketId) {
    const game = this.games.get(gameCode);
    
    if (!game) {
      throw new Error('Partie introuvable');
    }

    const player = game.players.find(p => p.socketId === socketId);
    
    if (!player) {
      throw new Error('Joueur introuvable');
    }

    // Si c'est le GM qui part, supprimer la partie
    if (player.isGameMaster) {
      this.games.delete(gameCode);
      return { gameDeleted: true };
    }

    // Retirer le joueur
    game.players = game.players.filter(p => p.id !== player.id);
    
    // Retirer ses réponses
    game.answers = game.answers.filter(a => a.playerId !== player.id);

    return { game, gameDeleted: false };
  }

  // Gérer les déconnexions
  handleDisconnect(socketId) {
    for (const [code, game] of this.games.entries()) {
      const player = game.players.find(p => p.socketId === socketId);
      
      if (player) {
        if (player.isGameMaster) {
          // Si le GM se déconnecte, supprimer la partie
          this.games.delete(code);
        } else {
          // Retirer le joueur
          game.players = game.players.filter(p => p.id !== player.id);
          game.answers = game.answers.filter(a => a.playerId !== player.id);
        }
        break;
      }
    }
  }

  // Récupérer une partie
  getGame(gameCode) {
    return this.games.get(gameCode);
  }
}
