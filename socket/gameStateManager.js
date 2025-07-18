const characterInfo = require('../data/characterInfo');
const activeGameStates = new Map();

/**
 * Initializes a new game state for a room
 * @param {string} roomId - Room ID to create game state for
 * @param {Array} players - Array of player socket IDs
 * @returns {Object} Initial game state
 */
function initializeGameState(roomId, players) {
  // Create initial game state
  const gameState = {
    roomId,
    players: players.map(player => ({
      socketId: player.socketId,
      deck: player.deck,
      hp: player.deck.map(cardName => characterInfo.maxHP[cardName] || 1000)
    })),
    turn: 0,
    currentPlayerIndex: 0, // Host starts
    gamePhase: 'loadout', // loadout, active, ended
    accuracyDebuffs: [0, 0], // Track accuracy debuff turns remaining for each player
    damageBuffs: [0, 0], // Track damage buff turns remaining for each player
    lastUpdated: Date.now()
  };
  
  // Store game state in memory
  activeGameStates.set(roomId, gameState);
  
  return gameState;
}

/**
 * Updates player decks in game state with confirmed loadouts
 * @param {string} roomId - Room ID to update
 * @param {Array} players - Array of players with confirmed decks
 * @returns {Object} Updated game state
 */
function updatePlayerDecks(roomId, players) {
  if (!activeGameStates.has(roomId)) {
    return { error: 'Game not found' };
  }
  
  const gameState = activeGameStates.get(roomId);
  
  // Update each player's deck in the game state
  players.forEach(player => {
    const playerIndex = gameState.players.findIndex(p => p.socketId === player.socketId);
    if (playerIndex !== -1) {
      gameState.players[playerIndex].deck = player.deck;
      gameState.players[playerIndex].hp = player.deck.map(cardName => characterInfo.maxHP[cardName] || 1000);
    }
  });
  
  // Update game phase to active
  gameState.gamePhase = 'active';
  gameState.accuracyDebuffs = [0, 0]; // Initialize accuracy debuff tracking
  gameState.damageBuffs = [0, 0]; // Initialize damage buff tracking
  gameState.lastUpdated = Date.now();
  
  // Store updated state
  activeGameStates.set(roomId, gameState);
  
  return gameState;
}

/**
 * Updates game state based on player action
 * @param {string} roomId - Room ID
 * @param {string} socketId - Socket ID of player making the action
 * @param {Object} action - Action data
 * @returns {Object} Updated game state
 */
function processGameAction(roomId, socketId, action) {
  if (!activeGameStates.has(roomId)) {
    return { error: 'Game not found' };
  }
  
  const gameState = activeGameStates.get(roomId);
  
  // Verify it's the player's turn
  const playerIndex = gameState.players.findIndex(p => p.socketId === socketId);
  if (playerIndex === -1) {
    return { error: 'Player not in game' };
  }
  
  if (gameState.currentPlayerIndex !== playerIndex) {
    return { error: 'Not your turn' };
  }
  
  switch (action.type) {
    case 'attack':
      const { attackingCardIndex, targetCardIndex, specialAbility: isSpecialAttack } = action;
      
      if (attackingCardIndex < 0 || attackingCardIndex >= 3 || targetCardIndex < 0 || targetCardIndex >= 3) {
        return { error: 'Invalid card indices' };
      }
      
      const attackingCard = gameState.players[playerIndex].deck[attackingCardIndex];
      const damageRange = characterInfo.abilityDamages[attackingCard];
      if (!damageRange) {
        return { error: 'Invalid attacking card' };
      }
      
      const minDamage = damageRange[0];
      const maxDamage = damageRange[1];
      let damage = Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage;
      
      const attackingTeam = gameState.players[playerIndex].deck;
      const attackingTeamHP = gameState.players[playerIndex].hp;
      let criticalHit = false;
      
      const kakashiIndex = attackingTeam.indexOf('Kakashi');
      if (kakashiIndex !== -1 && attackingTeamHP[kakashiIndex] > 0) {
        const critChance = characterInfo.passiveAbilities['Kakashi'].value;
        if (Math.random() < critChance) {
          criticalHit = true;
          const critMultiplier = characterInfo.passiveAbilities['Kakashi'].multiplier;
          damage = Math.floor(damage * critMultiplier);
          console.log(`Critical hit! Kakashi's passive ability activated (${critChance * 100}% chance, ${critMultiplier}x damage)`);
        }
      }
      
      if (gameState.damageBuffs[playerIndex] > 0) {
        const luffyMultiplier = characterInfo.specialAbilities['Luffy'].value;
        const originalDamage = damage;
        damage = Math.floor(damage * luffyMultiplier);
        console.log(`Luffy's damage buff active! Damage increased from ${originalDamage} to ${damage} (${luffyMultiplier}x multiplier, ${gameState.damageBuffs[playerIndex]} turns remaining)`);
      }
      
      // Check for passive abilities on defending team
      const targetPlayerIndex = playerIndex === 0 ? 1 : 0;
      const defendingTeam = gameState.players[targetPlayerIndex].deck;
      const defendingTeamHP = gameState.players[targetPlayerIndex].hp;
      let attackDodged = false;
      
      let totalDodgeChance = 0;
      const gojoIndex = defendingTeam.indexOf('Gojo');
      if (gojoIndex !== -1 && defendingTeamHP[gojoIndex] > 0) {
        totalDodgeChance += characterInfo.passiveAbilities['Gojo'].value;
      }
      
      if (gameState.accuracyDebuffs[playerIndex] > 0) {
        const mudkipDebuff = characterInfo.specialAbilities['Mudkip'].value;
        totalDodgeChance += mudkipDebuff;
        console.log(`Mudkip's accuracy debuff active! Adding ${mudkipDebuff * 100}% miss chance (${gameState.accuracyDebuffs[playerIndex]} turns remaining)`);
      }
      
      if (totalDodgeChance > 0 && Math.random() < totalDodgeChance) {
        attackDodged = true;
        damage = 0;
      }
      
      const anyaIndex = defendingTeam.indexOf('Anya');
      if (!attackDodged && anyaIndex !== -1 && defendingTeamHP[anyaIndex] > 0) {
        const damageReduction = characterInfo.passiveAbilities['Anya'].value;
        const originalDamage = damage;
        damage = Math.floor(damage * (1 - damageReduction));
        console.log(`Damage reduced! Anya's passive ability activated (${damageReduction * 100}% reduction: ${originalDamage} → ${damage})`);
      }
      
      let enemyParalyzed = false;
      const mikasaIndex = attackingTeam.indexOf('Mikasa');
      if (!attackDodged && mikasaIndex !== -1 && attackingTeamHP[mikasaIndex] > 0) {
        const paralysisChance = characterInfo.passiveAbilities['Mikasa'].value;
        if (Math.random() < paralysisChance) {
          enemyParalyzed = true;
          console.log(`Enemy paralyzed! Mikasa's passive ability activated (${paralysisChance * 100}% chance)`);
        }
      }
      
      let enemyBurned = false;
      const natsuIndex = attackingTeam.indexOf('Natsu');
      if (!attackDodged && natsuIndex !== -1 && attackingTeamHP[natsuIndex] > 0) {
        const burnChance = characterInfo.passiveAbilities['Natsu'].value;
        if (Math.random() < burnChance) {
          enemyBurned = true;
          console.log(`Enemy burned! Natsu's passive ability activated (${burnChance * 100}% chance)`);
        }
      }
      
      gameState.isAttacking = true;
      gameState.attackingPlayer = playerIndex;
      gameState.attackingCardIndex = attackingCardIndex;
      gameState.targetPlayer = targetPlayerIndex;
      gameState.targetCardIndex = targetCardIndex;
      gameState.specialAbility = isSpecialAttack;
      gameState.damageDealt = damage;
      gameState.attackDodged = attackDodged;
      gameState.criticalHit = criticalHit;
      gameState.enemyParalyzed = enemyParalyzed;
      gameState.enemyBurned = enemyBurned;
      
      // Apply damage to HP if not dodged
      if (!attackDodged && damage > 0) {
        const makimaIndex = defendingTeam.indexOf('Makima');
        if (makimaIndex !== -1 && defendingTeamHP[makimaIndex] > 0) {
          const aliveCardIndices = [];
          for (let i = 0; i < gameState.players[targetPlayerIndex].hp.length; i++) {
            if (gameState.players[targetPlayerIndex].hp[i] > 0) {
              aliveCardIndices.push(i);
            }
          }
          
          if (aliveCardIndices.length > 0) {
            const distributedDamage = Math.floor(damage / aliveCardIndices.length);
            const remainderDamage = damage % aliveCardIndices.length;
            
            aliveCardIndices.forEach((cardIndex, i) => {
              const damageToApply = distributedDamage + (i < remainderDamage ? 1 : 0);
              gameState.players[targetPlayerIndex].hp[cardIndex] = Math.max(0, gameState.players[targetPlayerIndex].hp[cardIndex] - damageToApply);
            });
            
            console.log(`Makima's damage distribution: ${damage} damage distributed among ${aliveCardIndices.length} alive cards`);
          }
        } else {
          gameState.players[targetPlayerIndex].hp[targetCardIndex] = Math.max(0, gameState.players[targetPlayerIndex].hp[targetCardIndex] - damage);
        }
      }
      
      if (enemyBurned) {
        const burnDamage = characterInfo.passiveAbilities['Natsu'].burnDamage;
        const burnedPlayerHP = gameState.players[targetPlayerIndex].hp;
        
        for (let cardIndex = 0; cardIndex < burnedPlayerHP.length; cardIndex++) {
          if (burnedPlayerHP[cardIndex] > 0) {
            burnedPlayerHP[cardIndex] = Math.max(0, burnedPlayerHP[cardIndex] - burnDamage);
          }
        }
        
        gameState.burnDamageApplied = true;
        gameState.burnDamageAmount = burnDamage;
        gameState.burnedPlayer = targetPlayerIndex;
        console.log(`Burn damage applied immediately! Player ${targetPlayerIndex} takes ${burnDamage} damage to all alive cards`);
      }
      
      if (attackDodged) {
        console.log(`Player ${playerIndex} attacks with ${attackingCard} (card ${attackingCardIndex}) targeting opponent's card ${targetCardIndex} - ATTACK DODGED!`);
      } else if (criticalHit && enemyParalyzed) {
        console.log(`Player ${playerIndex} attacks with ${attackingCard} (card ${attackingCardIndex}) targeting opponent's card ${targetCardIndex} for ${damage} damage - CRITICAL HIT! ENEMY PARALYZED!`);
      } else if (criticalHit) {
        console.log(`Player ${playerIndex} attacks with ${attackingCard} (card ${attackingCardIndex}) targeting opponent's card ${targetCardIndex} for ${damage} damage - CRITICAL HIT!`);
      } else if (enemyParalyzed) {
        console.log(`Player ${playerIndex} attacks with ${attackingCard} (card ${attackingCardIndex}) targeting opponent's card ${targetCardIndex} for ${damage} damage - ENEMY PARALYZED!`);
      } else {
        console.log(`Player ${playerIndex} attacks with ${attackingCard} (card ${attackingCardIndex}) targeting opponent's card ${targetCardIndex} for ${damage} damage`);
      }
      break;
      
    case 'special_ability':
      const { attackingCardIndex: abilityCardIndex } = action;
      
      if (abilityCardIndex < 0 || abilityCardIndex >= 3) {
        return { error: 'Invalid card index' };
      }
      
      const abilityCard = gameState.players[playerIndex].deck[abilityCardIndex];
      const abilityData = characterInfo.specialAbilities[abilityCard];
      if (!abilityData) {
        return { error: 'Character has no special ability' };
      }
      
      switch (abilityData.type) {
        case 'heal_all':
          const healAmount = abilityData.value;
          
          // Apply healing to all alive cards on the player's team
          for (let i = 0; i < gameState.players[playerIndex].hp.length; i++) {
            if (gameState.players[playerIndex].hp[i] > 0) {
              const maxHP = characterInfo.maxHP[gameState.players[playerIndex].deck[i]];
              const healValue = Math.floor(maxHP * healAmount);
              const newHP = Math.min(gameState.players[playerIndex].hp[i] + healValue, maxHP);
              
              console.log(`Card ${i} (${gameState.players[playerIndex].deck[i]}) healed from ${gameState.players[playerIndex].hp[i]} to ${newHP} (+${healValue} HP, ${healAmount * 100}% of ${maxHP} max HP)`);
              gameState.players[playerIndex].hp[i] = newHP;
            }
          }
          
          gameState.isSpecialAbility = true;
          gameState.specialAbilityUser = playerIndex;
          gameState.specialAbilityCard = abilityCardIndex;
          gameState.specialAbilityType = 'heal_all';
          gameState.healAmount = healAmount;
          
          console.log(`Player ${playerIndex} uses ${abilityCard}'s special ability: Shadow Regeneration (heals all allies by ${healAmount * 100}% max HP)`);
          break;
          
        case 'sacrifice_blast':
          const genosMaxHP = characterInfo.maxHP[abilityCard];
          const genosCurrentHP = gameState.players[playerIndex].hp[abilityCardIndex];
          const hpLost = genosMaxHP - genosCurrentHP;
          const blastDamage = Math.floor(hpLost * abilityData.value);
          
          const opponentIndex = playerIndex === 0 ? 1 : 0;
          const aliveEnemyIndices = [];
          for (let i = 0; i < gameState.players[opponentIndex].hp.length; i++) {
            if (gameState.players[opponentIndex].hp[i] > 0) {
              aliveEnemyIndices.push(i);
            }
          }
          
          let targetCardIndex = -1;
          let targetCard = null;
          
          if (aliveEnemyIndices.length > 0) {
            targetCardIndex = aliveEnemyIndices[Math.floor(Math.random() * aliveEnemyIndices.length)];
            targetCard = gameState.players[opponentIndex].deck[targetCardIndex];
            
            const oldHP = gameState.players[opponentIndex].hp[targetCardIndex];
            gameState.players[opponentIndex].hp[targetCardIndex] = Math.max(0, oldHP - blastDamage);
            
            console.log(`${abilityCard} deals ${blastDamage} blast damage to ${targetCard} (${oldHP} -> ${gameState.players[opponentIndex].hp[targetCardIndex]} HP)`);
          }
          
          gameState.players[playerIndex].hp[abilityCardIndex] = 0;
          gameState.isSpecialAbility = true;
          gameState.specialAbilityUser = playerIndex;
          gameState.specialAbilityCard = abilityCardIndex;
          gameState.specialAbilityType = 'sacrifice_blast';
          gameState.blastDamage = blastDamage;
          gameState.targetPlayer = opponentIndex;
          gameState.targetCardIndex = targetCardIndex;
          gameState.hpLost = hpLost;
          
          console.log(`Player ${playerIndex} uses ${abilityCard}'s special ability: Sacrifice Blast (${hpLost} HP lost -> ${blastDamage} damage to random enemy, Genos dies)`);
          break;
          
        case 'accuracy_debuff':
          const opponentPlayerIndex = playerIndex === 0 ? 1 : 0;
          const debuffDuration = abilityData.duration;
          const debuffValue = abilityData.value;
          
          // Apply accuracy debuff to opponent
          gameState.accuracyDebuffs[opponentPlayerIndex] = debuffDuration;
          
          console.log(`Player ${playerIndex} uses ${abilityCard}'s special ability: Accuracy Debuff (reduces opponent accuracy by ${debuffValue * 100}% for ${debuffDuration} turns)`);
          break;
          
        case 'damage_buff':
          const buffDuration = abilityData.duration;
          const buffMultiplier = abilityData.value;
          
          // Apply damage buff to player's team
          gameState.damageBuffs[playerIndex] = buffDuration;
          
          console.log(`Player ${playerIndex} uses ${abilityCard}'s special ability: Damage Buff (increases all ally damage by ${buffMultiplier}x for ${buffDuration} turns)`);
          break;
          
        default:
          return { error: 'Unknown special ability type' };
      }
      break;
      
    default:
      return { error: 'Unknown action type' };
  }
  
  // Check for game end conditions after HP modifications
  const gameEndResult = checkGameEndConditions(roomId);
  if (gameEndResult.gameEnded) {
    return gameEndResult.gameState;
  }
  
  gameState.lastUpdated = Date.now();
  activeGameStates.set(roomId, gameState);
  
  return gameState;
}

/**
 * Checks if game should end based on HP conditions
 * @param {string} roomId - Room ID
 * @returns {Object} Result with gameEnded flag and gameState if ended
 */
function checkGameEndConditions(roomId) {
  if (!activeGameStates.has(roomId)) {
    return { gameEnded: false, error: 'Game not found' };
  }
  
  const gameState = activeGameStates.get(roomId);
  
  // Check each player's HP to see if all cards are dead
  for (let playerIndex = 0; playerIndex < gameState.players.length; playerIndex++) {
    const playerHP = gameState.players[playerIndex].hp;
    const allCardsDead = playerHP.every(hp => hp <= 0);
    
    if (allCardsDead) {
      // Game ends - this player loses
      const loserIndex = playerIndex;
      const winnerIndex = playerIndex === 0 ? 1 : 0;
      
      gameState.gamePhase = 'ended';
      gameState.winner = gameState.players[winnerIndex].socketId;
      gameState.loser = gameState.players[loserIndex].socketId;
      gameState.lastUpdated = Date.now();
      
      activeGameStates.set(roomId, gameState);
      
      console.log(`Game ended in room ${roomId}. Winner: ${gameState.winner}, Loser: ${gameState.loser}`);
      
      return { gameEnded: true, gameState };
    }
  }
  
  return { gameEnded: false };
}

/**
 * Gets current game state for a room
 * @param {string} roomId - Room ID
 * @returns {Object|null} Game state or null if not found
 */
function getGameState(roomId) {
  return activeGameStates.has(roomId) ? activeGameStates.get(roomId) : null;
}

/**
 * Marks a player as finished with their action (for turn switching)
 * @param {string} roomId - Room ID
 * @param {string} socketId - Socket ID of player who finished
 * @returns {Object} Result with readyToSwitchTurn flag
 */
function markPlayerActionFinished(roomId, socketId) {
  if (!activeGameStates.has(roomId)) {
    return { error: 'Game not found' };
  }
  
  const gameState = activeGameStates.get(roomId);
  
  // Initialize actionFinished tracking if not exists
  if (!gameState.actionFinished) {
    gameState.actionFinished = new Set();
  }
  
  // Mark this player as finished
  gameState.actionFinished.add(socketId);
  
  console.log(`Player ${socketId} finished action. Players finished: ${gameState.actionFinished.size}/${gameState.players.length}`);
  
  // Check if all players are ready to switch turns
  const readyToSwitchTurn = gameState.actionFinished.size >= gameState.players.length;
  
  return { readyToSwitchTurn };
}

function switchTurn(roomId) {
  if (!activeGameStates.has(roomId)) {
    return { error: 'Game not found' };
  }
  
  const gameState = activeGameStates.get(roomId);
  const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
  gameState.currentPlayerIndex = nextPlayerIndex;
  gameState.turn++;
  
  resetActionStates(gameState);
  for (let i = 0; i < gameState.accuracyDebuffs.length; i++) {
    if (gameState.accuracyDebuffs[i] > 0) {
      gameState.accuracyDebuffs[i]--;
      console.log(`Player ${i} accuracy debuff decremented to ${gameState.accuracyDebuffs[i]} turns remaining`);
    }
  }
  
  for (let i = 0; i < gameState.damageBuffs.length; i++) {
    if (gameState.damageBuffs[i] > 0) {
      gameState.damageBuffs[i]--;
      console.log(`Player ${i} damage buff decremented to ${gameState.damageBuffs[i]} turns remaining`);
    }
  }
  
  gameState.actionFinished = new Set();
  gameState.lastUpdated = Date.now();
  activeGameStates.set(roomId, gameState);
  
  console.log(`Turn switched to player ${nextPlayerIndex} (turn ${gameState.turn})`);
  return gameState;
}


function endGame(roomId, loserSocketId) {
  if (!activeGameStates.has(roomId)) {
    return { error: 'Game state not found' };
  }
  
  const gameState = activeGameStates.get(roomId);
  const loserPlayer = gameState.players.find(player => player.socketId === loserSocketId);
  const winnerPlayer = gameState.players.find(player => player.socketId !== loserSocketId);
  
  if (!loserPlayer || !winnerPlayer) {
    return { error: 'Invalid player data' };
  }
  
  gameState.gamePhase = 'ended';
  gameState.winner = winnerPlayer.socketId;
  gameState.loser = loserPlayer.socketId;
  gameState.lastUpdated = Date.now();
  
  console.log(`Game ended for room: ${roomId}. Winner: ${winnerPlayer.socketId}, Loser: ${loserPlayer.socketId}`);
  
  return {
    gameState,
    winner: winnerPlayer.socketId,
    loser: loserPlayer.socketId
  };
}


// Resets attack state without switching turns (used for paralysis)
function resetAttackState(roomId) {
  if (!activeGameStates.has(roomId)) {
    return { error: 'Game not found' };
  }
  
  const gameState = activeGameStates.get(roomId);
  resetActionStates(gameState);
  
  gameState.actionFinished = new Set();
  gameState.lastUpdated = Date.now();
  activeGameStates.set(roomId, gameState);

  console.log(`Attack state reset for paralysis - player ${gameState.currentPlayerIndex} gets another turn`);
  return gameState;
}

function resetActionStates(gameState) {
  gameState.isAttacking = false;
  gameState.attackingPlayer = undefined;
  gameState.attackingCardIndex = undefined;
  gameState.targetPlayer = undefined;
  gameState.targetCardIndex = undefined;
  gameState.specialAbility = undefined;
  gameState.damageDealt = undefined;
  gameState.attackDodged = undefined;
  gameState.criticalHit = undefined;
  gameState.enemyParalyzed = undefined;
  gameState.enemyBurned = undefined;
  gameState.burnDamageApplied = undefined;
  gameState.burnDamageAmount = undefined;
  gameState.burnedPlayer = undefined;
  
  gameState.isSpecialAbility = false;
  gameState.specialAbilityUser = undefined;
  gameState.specialAbilityCard = undefined;
  gameState.specialAbilityType = undefined;
  gameState.healAmount = undefined;
  gameState.blastDamage = undefined;
  gameState.hpLost = undefined;
  gameState.accuracyDebuffTarget = undefined;
  gameState.accuracyDebuffValue = undefined;
  gameState.accuracyDebuffDuration = undefined;
}

module.exports = {
  initializeGameState,
  updatePlayerDecks,
  processGameAction,
  getGameState,
  checkGameEndConditions,
  markPlayerActionFinished,
  switchTurn,
  resetAttackState,
  endGame
};
