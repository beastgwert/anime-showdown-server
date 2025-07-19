const characterInfo = {
  abilityDamages: {
    'Sung-jin-woo': [110, 130],
    'Mikasa': [70, 110],
    'Luffy': [80, 160],
    'Gojo': [70, 90],
    'Natsu': [125, 150],
    'Ichigo': [0, 10],
    'Kakashi': [90, 180],
    'Anya': [95, 105],
    'Mudkip': [80, 90],
    'Genos': [50, 60],
    'Makima': [1, 300],
    'Saitama': [99999, 99999]
  },
  maxHP: {
    'Sung-jin-woo': 500,
    'Mikasa': 450,
    'Luffy': 450,
    'Gojo': 375,
    'Natsu': 400,
    'Ichigo': 375,
    'Kakashi': 400,
    'Anya': 450,
    'Mudkip': 425,
    'Genos': 550,
    'Makima': 425,
    'Saitama': 1
  },
  passiveAbilities: {
    'Gojo': {
      type: 'dodge',
      value: 0.25, // 15% dodge chance for all team cards
      description: 'Grants 15% dodge chance to all team cards'
    },
    'Kakashi': {
      type: 'crit',
      value: 0.25, // 25% crit chance for all team cards
      multiplier: 1.5, // 1.5x damage on crit
      description: 'Grants 25% crit chance with 1.5x damage to all team cards'
    },
    'Anya': {
      type: 'damage_reduction',
      value: 0.20, // 20% damage reduction for all team cards
      description: 'Reduces all incoming damage by 20% for all team cards'
    },
    'Makima': {
      type: 'damage_distribution',
      description: 'Distributes incoming damage equally among all alive team cards'
    },
    'Mikasa': {
      type: 'paralysis',
      value: 0.25, // 15% chance to paralyze enemy on attack
      description: 'Grants 15% chance to paralyze enemy on attack for all team cards'
    },
    'Natsu': {
      type: 'burn',
      value: 0.50, // 50% chance to burn enemy on attack
      burnDamage: 40, // Burn damage per card
      description: 'Grants 50% chance to burn enemy on attack, causing burn damage next turn'
    }
  },
  specialAbilities: {
    'Sung-jin-woo': {
      type: 'heal_all',
      value: 0.15, // 15% of max HP
      description: 'Heals all ally cards by 15% of their max HP'
    },
    'Genos': {
      type: 'sacrifice_blast',
      value: 0.50, // 50% of HP lost
      description: 'Deals 50% of HP lost to a random enemy, then dies'
    },
    'Mudkip': {
      type: 'accuracy_debuff',
      value: 0.50, // 50% accuracy reduction
      duration: 4, // 2 rounds (4 turn switches) 
      description: 'Reduces opponent accuracy by 50% for 2 turns (stacks with Gojo passive)'
    },
    'Luffy': {
      type: 'damage_buff',
      value: 1.5, // 1.5x damage multiplier
      duration: 5, // 2 rounds (5 turn switches)
      description: 'Increases all ally damage by 1.5x for 2 rounds'
    }
  }
};

module.exports = characterInfo;
